from django.db import models
from django.utils import timezone


class AppUser(models.Model):
    team_no = models.PositiveIntegerField(unique=True, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True)

    password_salt_b64 = models.CharField(max_length=64)
    password_hash_b64 = models.CharField(max_length=128)
    password_iterations = models.PositiveIntegerField()

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.username


class AppUserMember(models.Model):
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name='members')
    member_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, null=True, blank=True)
    phone = models.CharField(max_length=32)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'phone'], name='uniq_member_phone_per_team'),
        ]
        indexes = [
            models.Index(fields=['user', 'phone']),
        ]

    def __str__(self) -> str:
        return f'{self.user.username}:{self.phone}'


class AuthSession(models.Model):
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name='sessions')
    member = models.ForeignKey(AppUserMember, on_delete=models.CASCADE, related_name='sessions', null=True, blank=True)
    token_hash = models.CharField(max_length=64, unique=True)

    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'expires_at']),
            models.Index(fields=['member', 'expires_at']),
        ]

    def is_valid(self) -> bool:
        if self.revoked_at is not None:
            return False
        return self.expires_at > timezone.now()


class OtpChallenge(models.Model):
    identifier = models.CharField(max_length=255)
    member = models.ForeignKey(AppUserMember, on_delete=models.CASCADE, related_name='otp_challenges', null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['identifier', 'expires_at']),
            models.Index(fields=['member', 'expires_at']),
            models.Index(fields=['expires_at']),
        ]

    def is_valid(self) -> bool:
        if self.consumed_at is not None:
            return False
        return self.expires_at > timezone.now()


class GameRound(models.Model):
    """Stores a word cloud game round"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]
    
    creator = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name='created_rounds')
    question = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['creator', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self) -> str:
        return f"Round {self.id}: {self.question[:50]}"


class Response(models.Model):
    """Stores individual word responses to a game round"""
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='responses')
    member = models.ForeignKey(AppUserMember, on_delete=models.CASCADE, related_name='responses', null=True, blank=True)
    word = models.CharField(max_length=100)  # Original word
    word_normalized = models.CharField(max_length=100)  # Lowercase, stripped
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['round', 'member'], name='one_response_per_member_per_round'),
        ]
        indexes = [
            models.Index(fields=['round', 'word_normalized']),
            models.Index(fields=['round', '-created_at']),
        ]
    
    def __str__(self) -> str:
        return f"{self.word} by {self.member.name if self.member else 'Anonymous'}"


class ShareEvent(models.Model):
    """Tracks share button clicks for scoring"""
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='share_events')
    member = models.ForeignKey(AppUserMember, on_delete=models.CASCADE, related_name='share_events')
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        indexes = [
            models.Index(fields=['round', 'member']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self) -> str:
        return f"Share by {self.member.name} for Round {self.round.id}"


class PlayerScore(models.Model):
    """Aggregates player scores per round"""
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='player_scores')
    member = models.ForeignKey(AppUserMember, on_delete=models.CASCADE, related_name='player_scores')
    response_points = models.IntegerField(default=0)  # +1 for valid response
    share_points = models.IntegerField(default=0)  # +1 per share
    total_points = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['round', 'member'], name='one_score_per_member_per_round'),
        ]
        indexes = [
            models.Index(fields=['round', '-total_points']),
        ]
    
    def __str__(self) -> str:
        return f"{self.member.name}: {self.total_points} points (Round {self.round.id})"

