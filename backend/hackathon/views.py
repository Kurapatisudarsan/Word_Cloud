import json
import re
from datetime import timedelta

from django.http import HttpRequest, JsonResponse
from django.db import transaction
from django.utils import timezone
from django.views import View
from typing import Optional

from .auth import (
    create_session_token,
    OtpDispatchError,
    OtpVerifyError,
    get_session_times,
    hash_session_token,
    dispatch_otp,
    verify_otp_via_gateway,
    verify_password,
)
from .models import AppUser, AppUserMember, AuthSession, OtpChallenge, GameRound, Response, ShareEvent, PlayerScore


def _normalize_phone(raw: str) -> str:
    return re.sub(r'\D+', '', (raw or '').strip())


def _get_bearer_token(request: HttpRequest) -> Optional[str]:
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None

    prefix = 'Bearer '
    if not auth_header.startswith(prefix):
        return None

    token = auth_header[len(prefix) :].strip()
    return token or None


def _get_session(request: HttpRequest) -> Optional[AuthSession]:
    token = _get_bearer_token(request)
    if not token:
        return None

    token_hash = hash_session_token(token)
    return (
        AuthSession.objects.select_related('user', 'member')
        .filter(token_hash=token_hash, revoked_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


class HealthView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({'status': 'ok'})


class ApiLoginView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        username_raw = (payload.get('username') or '').strip()
        password = (payload.get('password') or '').strip()

        if not username_raw or not password:
            return JsonResponse({'error': 'Please enter username and password.'}, status=400)

        members_qs = AppUserMember.objects.select_related('user').filter(user__is_active=True)
        if '@' in username_raw:
            members_qs = members_qs.filter(email__iexact=username_raw)
        else:
            phone = _normalize_phone(username_raw)
            if not phone:
                return JsonResponse({'error': 'Please enter username and password.'}, status=400)
            members_qs = members_qs.filter(phone=phone)

        members = list(members_qs)
        if not members:
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

        matched_user: Optional[AppUser] = None
        matched_member: Optional[AppUserMember] = None
        for member in members:
            user = member.user
            if verify_password(
                password,
                salt_b64=user.password_salt_b64,
                password_hash_b64=user.password_hash_b64,
                iterations=user.password_iterations,
            ):
                matched_user = user
                matched_member = member
                break

        if matched_user is None:
            return JsonResponse({'error': 'Invalid username or password.'}, status=401)

        user = matched_user

        raw_token = create_session_token()
        times = get_session_times()
        AuthSession.objects.create(
            user=user,
            member=matched_member,
            token_hash=hash_session_token(raw_token),
            created_at=times.created_at,
            expires_at=times.expires_at,
        )

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': times.expires_at.isoformat(),
                'user': {
                    'id': user.id,
                    'username': user.username,
                },
            }
        )


class ApiMeView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        session = _get_session(request)
        if session is None or not session.user.is_active:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        if session.member is None:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        return JsonResponse(
            {
                'user': {
                    'id': session.user.id,
                    'username': session.user.username,
                    'team_no': session.user.team_no,
                },
                'member': {
                    'id': session.member.id,
                    'member_id': session.member.member_id,
                    'name': session.member.name,
                    'email': session.member.email,
                    'phone': session.member.phone,
                },
            }
        )


class ApiLogoutView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        session = _get_session(request)
        if session is None:
            return JsonResponse({'ok': True})

        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at'])
        return JsonResponse({'ok': True})


class ApiOtpRequestView(View):
    OTP_TTL = timedelta(minutes=5)

    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        channel = (payload.get('channel') or '').strip().lower()
        phone = _normalize_phone(payload.get('phone') or payload.get('username') or '')
        email = (payload.get('email') or payload.get('username') or '').strip()
        team_no_raw = payload.get('team_no')

        if channel not in {'whatsapp', 'email'}:
            return JsonResponse({'error': 'Invalid OTP channel.'}, status=400)

        if channel == 'whatsapp' and not phone:
            return JsonResponse({'error': 'Please enter mobile number.'}, status=400)
        if channel == 'email' and not email:
            return JsonResponse({'error': 'Please enter email id.'}, status=400)

        if channel == 'whatsapp':
            members_qs = (
                AppUserMember.objects.select_related('user')
                .filter(phone=phone)
                .filter(user__is_active=True)
            )
        else:
            members_qs = (
                AppUserMember.objects.select_related('user')
                .filter(email__iexact=email)
                .filter(user__is_active=True)
            )

        if team_no_raw is not None and str(team_no_raw).strip() != '':
            try:
                team_no = int(team_no_raw)
            except (TypeError, ValueError):
                return JsonResponse({'error': 'Invalid team number.'}, status=400)
            members_qs = members_qs.filter(user__team_no=team_no)

        members = list(members_qs)
        if not members:
            if channel == 'whatsapp':
                return JsonResponse({'error': 'Mobile number not registered.'}, status=404)
            return JsonResponse({'error': 'Email id not registered.'}, status=404)

        if len(members) > 1:
            identifier_label = 'mobile number' if channel == 'whatsapp' else 'email id'
            teams = []
            for m in members:
                teams.append({'team_no': m.user.team_no, 'username': m.user.username})
            teams = sorted(teams, key=lambda t: (t['team_no'] is None, t['team_no'] or 0))
            return JsonResponse(
                {
                    'error': f'Multiple team accounts found for this {identifier_label}. Please select team number.',
                    'teams': teams,
                },
                status=409,
            )

        member = members[0]

        identifier = phone if channel == 'whatsapp' else (member.email or email)

        try:
            dispatch_otp(channel=channel, identifier=identifier, display_name=member.name)
        except OtpDispatchError as exc:
            return JsonResponse({'error': str(exc)}, status=502)

        now = timezone.now()
        expires_at = now + self.OTP_TTL

        with transaction.atomic():
            OtpChallenge.objects.filter(
                member=member,
                identifier=identifier,
                consumed_at__isnull=True,
                expires_at__gt=now,
            ).update(consumed_at=now)

            challenge = OtpChallenge.objects.create(
                identifier=identifier,
                member=member,
                created_at=now,
                expires_at=expires_at,
            )

        return JsonResponse({'challenge_id': challenge.id, 'expires_at': expires_at.isoformat()})


class ApiOtpVerifyView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        challenge_id = payload.get('challenge_id')
        otp = (payload.get('otp') or '').strip()

        if not challenge_id or not otp:
            return JsonResponse({'error': 'Please enter OTP.'}, status=400)

        try:
            challenge_id_int = int(challenge_id)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid OTP request.'}, status=400)

        challenge = (
            OtpChallenge.objects.select_related('member', 'member__user')
            .filter(id=challenge_id_int)
            .first()
        )
        if challenge is None or not challenge.is_valid() or challenge.member is None:
            return JsonResponse({'error': 'Invalid or expired OTP.'}, status=401)

        try:
            ok = verify_otp_via_gateway(identifier=challenge.identifier, otp=otp)
        except OtpVerifyError as exc:
            return JsonResponse({'error': str(exc)}, status=502)

        if not ok:
            return JsonResponse({'error': 'Invalid or expired OTP.'}, status=401)

        now = timezone.now()

        with transaction.atomic():
            updated = OtpChallenge.objects.filter(id=challenge.id, consumed_at__isnull=True).update(consumed_at=now)
            if updated != 1:
                return JsonResponse({'error': 'Invalid or expired OTP.'}, status=401)

            member = challenge.member
            user = member.user

            raw_token = create_session_token()
            times = get_session_times()
            AuthSession.objects.create(
                user=user,
                member=member,
                token_hash=hash_session_token(raw_token),
                created_at=times.created_at,
                expires_at=times.expires_at,
            )

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': times.expires_at.isoformat(),
                'user': {'id': user.id, 'username': user.username},
            }
        )


class ApiCreateRoundView(View):
    """Create a new word cloud game round"""
    def post(self, request: HttpRequest) -> JsonResponse:
        try:
            session = _get_session(request)
            if session is None or not session.user.is_active:
                return JsonResponse({'error': 'Unauthorized'}, status=401)
            
            payload = _json_body(request)
            question = (payload.get('question') or '').strip()
            
            if not question:
                return JsonResponse({'error': 'Question is required'}, status=400)
            
            if len(question) < 5:
                return JsonResponse({'error': 'Question must be at least 5 characters'}, status=400)
            
            round_obj = GameRound.objects.create(
                creator=session.user,
                question=question,
                status='active'
            )
            
            return JsonResponse({
                'id': round_obj.id,
                'question': round_obj.question,
                'status': round_obj.status,
                'created_at': round_obj.created_at.isoformat(),
            }, status=201)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)


class ApiMyRoundsView(View):
    """Get all rounds created by the authenticated user"""
    def get(self, request: HttpRequest) -> JsonResponse:
        session = _get_session(request)
        if session is None or not session.user.is_active:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        rounds = GameRound.objects.filter(creator=session.user).order_by('-created_at')
        
        rounds_data = []
        for round_obj in rounds:
            response_count = Response.objects.filter(round=round_obj).count()
            rounds_data.append({
                'id': round_obj.id,
                'question': round_obj.question,
                'status': round_obj.status,
                'response_count': response_count,
                'created_at': round_obj.created_at.isoformat(),
            })
        
        return JsonResponse({'rounds': rounds_data})


class ApiRoundDetailView(View):
    """Get details of a specific round"""
    def get(self, request: HttpRequest, round_id: int) -> JsonResponse:
        round_obj = GameRound.objects.filter(id=round_id).first()
        if not round_obj:
            return JsonResponse({'error': 'Round not found'}, status=404)
        
        response_count = Response.objects.filter(round=round_obj).count()
        
        return JsonResponse({
            'id': round_obj.id,
            'question': round_obj.question,
            'status': round_obj.status,
            'response_count': response_count,
            'created_at': round_obj.created_at.isoformat(),
        })


class ApiSubmitResponseView(View):
    """Submit a single-word response to a round"""
    def post(self, request: HttpRequest, round_id: int) -> JsonResponse:
        try:
            # Get session but don't require it (allow anonymous responses)
            session = _get_session(request)
            member = session.member if session else None
            
            round_obj = GameRound.objects.filter(id=round_id).first()
            if not round_obj:
                return JsonResponse({'error': 'Round not found'}, status=404)
            
            if round_obj.status != 'active':
                return JsonResponse({'error': 'This round is closed'}, status=400)
            
            payload = _json_body(request)
            word = (payload.get('word') or '').strip()
            
            if not word:
                return JsonResponse({'error': 'Word is required'}, status=400)
            
            # Validate single word (only letters, numbers, basic punctuation)
            word_clean = re.sub(r'[^\w\s-]', '', word)
            if ' ' in word_clean or '\t' in word_clean or '\n' in word_clean:
                return JsonResponse({'error': 'Only one word allowed'}, status=400)
            
            if len(word_clean) == 0:
                return JsonResponse({'error': 'Invalid word'}, status=400)
            
            word_normalized = word_clean.lower()
            
            # Check if member already responded (only for authenticated users)
            if member:
                existing = Response.objects.filter(round=round_obj, member=member).first()
                if existing:
                    return JsonResponse({'error': 'You have already responded to this round'}, status=400)
            
            with transaction.atomic():
                # Create response (member can be None for anonymous)
                Response.objects.create(
                    round=round_obj,
                    member=member,
                    word=word_clean,
                    word_normalized=word_normalized
                )
                
                # Update or create player score (only for authenticated users)
                if member:
                    score, _ = PlayerScore.objects.get_or_create(
                        round=round_obj,
                        member=member,
                        defaults={'response_points': 0, 'share_points': 0, 'total_points': 0}
                    )
                    score.response_points += 1
                    score.total_points = score.response_points + score.share_points
                    score.save()
            
            return JsonResponse({
                'success': True,
                'word': word_clean,
                'message': 'Response submitted successfully'
            }, status=201)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)


class ApiWordCloudDataView(View):
    """Get word cloud data (word frequencies) for a round"""
    def get(self, request: HttpRequest, round_id: int) -> JsonResponse:
        round_obj = GameRound.objects.filter(id=round_id).first()
        if not round_obj:
            return JsonResponse({'error': 'Round not found'}, status=404)
        
        # Get word frequencies using aggregation
        from django.db.models import Count
        
        word_frequencies = (
            Response.objects
            .filter(round=round_obj)
            .values('word_normalized')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        
        words_data = [
            {'text': item['word_normalized'], 'count': item['count']}
            for item in word_frequencies
        ]
        
        return JsonResponse({
            'words': words_data,
            'total_responses': sum(w['count'] for w in words_data)
        })


class ApiRecordShareView(View):
    """Record a share event and update player score"""
    def post(self, request: HttpRequest, round_id: int) -> JsonResponse:
        session = _get_session(request)
        if session is None or session.member is None:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        round_obj = GameRound.objects.filter(id=round_id).first()
        if not round_obj:
            return JsonResponse({'error': 'Round not found'}, status=404)
        
        with transaction.atomic():
            # Create share event
            ShareEvent.objects.create(
                round=round_obj,
                member=session.member
            )
            
            # Update or create player score
            score, created = PlayerScore.objects.get_or_create(
                round=round_obj,
                member=session.member,
                defaults={'response_points': 0, 'share_points': 1, 'total_points': 1}
            )
            
            if not created:
                score.share_points += 1
                score.total_points = score.response_points + score.share_points
                score.save(update_fields=['share_points', 'total_points', 'updated_at'])
        
        return JsonResponse({
            'success': True,
            'total_shares': score.share_points,
            'total_points': score.total_points
        })


class ApiLeaderboardView(View):
    """Get leaderboard for a round"""
    def get(self, request: HttpRequest, round_id: int) -> JsonResponse:
        round_obj = GameRound.objects.filter(id=round_id).first()
        if not round_obj:
            return JsonResponse({'error': 'Round not found'}, status=404)
        
        scores = (
            PlayerScore.objects
            .filter(round=round_obj)
            .select_related('member')
            .order_by('-total_points', '-updated_at')[:10]
        )
        
        leaderboard_data = []
        for rank, score in enumerate(scores, start=1):
            leaderboard_data.append({
                'rank': rank,
                'member_name': score.member.name,
                'response_points': score.response_points,
                'share_points': score.share_points,
                'total_points': score.total_points,
            })
        
        return JsonResponse({'leaderboard': leaderboard_data})

