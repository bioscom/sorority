from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('profile/', views.profile, name='profile'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('verify-email/<str:uidb64>/<str:token>/', views.email_verify_confirm, name='email_verify_confirm'),
    path('resend-verification/', views.resend_verification_email, name='resend_verification_email'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('reset-password-confirm/<str:uidb64>/<str:token>/', views.password_reset_confirm, name='password_reset_confirm'),
    path('change-password/', views.change_password, name='change_password'),
    path('delete-account/', views.delete_account, name='delete_account'),
]







