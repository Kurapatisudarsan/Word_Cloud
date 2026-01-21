from django.urls import path

from .views import (
    ApiLoginView, ApiLogoutView, ApiMeView, ApiOtpRequestView, ApiOtpVerifyView, HealthView,
    ApiCreateRoundView, ApiMyRoundsView, ApiRoundDetailView, ApiSubmitResponseView,
    ApiWordCloudDataView, ApiRecordShareView, ApiLeaderboardView
)

urlpatterns = [
    path('', HealthView.as_view(), name='health'),
    path('api/login', ApiLoginView.as_view(), name='api_login'),
    path('api/otp/request', ApiOtpRequestView.as_view(), name='api_otp_request'),
    path('api/otp/verify', ApiOtpVerifyView.as_view(), name='api_otp_verify'),
    path('api/me', ApiMeView.as_view(), name='api_me'),
    path('api/logout', ApiLogoutView.as_view(), name='api_logout'),
    
    # Word cloud game endpoints
    path('api/rounds/create', ApiCreateRoundView.as_view(), name='api_create_round'),
    path('api/rounds/my', ApiMyRoundsView.as_view(), name='api_my_rounds'),
    path('api/rounds/<int:round_id>', ApiRoundDetailView.as_view(), name='api_round_detail'),
    path('api/rounds/<int:round_id>/respond', ApiSubmitResponseView.as_view(), name='api_submit_response'),
    path('api/rounds/<int:round_id>/wordcloud', ApiWordCloudDataView.as_view(), name='api_wordcloud_data'),
    path('api/rounds/<int:round_id>/share', ApiRecordShareView.as_view(), name='api_record_share'),
    path('api/rounds/<int:round_id>/leaderboard', ApiLeaderboardView.as_view(), name='api_leaderboard'),
]
