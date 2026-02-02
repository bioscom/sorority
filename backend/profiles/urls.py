from django.urls import path
from . import views

urlpatterns = [
    # Specific paths must come before the catch-all <slug:slug> pattern
    path('public/', views.PublicProfileListView.as_view(), name='public_profile_list'),
    path('recommendations/', views.profile_recommendations, name='profile_recommendations'),
    path('photos/', views.PhotoListCreateView.as_view(), name='photo_list_create'),
    path('photos/<int:pk>/', views.PhotoDetailView.as_view(), name='photo_detail'),
    path('photos/<int:photo_id>/set-primary/', views.set_primary_photo, name='set_primary_photo'),
    path('interests/', views.InterestListView.as_view(), name='interest_list'),
    path('profile-interests/', views.ProfileInterestListCreateView.as_view(), name='profile_interest_list_create'),
    path('profile-interests/<int:pk>/', views.ProfileInterestDetailView.as_view(), name='profile_interest_detail'),
    path('values/', views.ValueListView.as_view(), name='value_list'),
    path('profile-values/', views.ProfileValueListCreateView.as_view(), name='profile_value_list_create'),
    path('profile-values/<int:pk>/', views.ProfileValueDetailView.as_view(), name='profile_value_detail'),
    path('options/', views.OptionListView.as_view(), name='option_list'),
    path('daily-login-reward/', views.daily_login_reward, name='daily_login_reward'),
    path('profile-completion/', views.get_profile_completion, name='get_profile_completion'),
    path('boosts/', views.BoostListView.as_view(), name='boost_list'),
    path('boosts/activate/', views.activate_boost, name='activate_boost'),
    path('passport/', views.manage_passport, name='manage_passport'),
    path('dashboard-stats/', views.get_user_dashboard_stats, name='get_user_dashboard_stats'),
    
    # Catch-all slug pattern must come last
    path('', views.ProfileListCreateView.as_view(), name='profile_list_create'),
    path('<slug:slug>/', views.ProfileDetailView.as_view(), name='profile_detail'),
]







