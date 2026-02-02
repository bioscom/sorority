from rest_framework import status, generics, permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password # Added for password validation
from django.utils import timezone # Added for daily login rewards
from django.utils.translation import gettext_lazy as _
from .models import User
from profiles.models import Profile # Added for daily login rewards
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, 
    UserSerializer, UserProfileSerializer, ResendVerificationSerializer,
    send_activation_email
)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """User registration endpoint"""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    """User login endpoint"""
    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Daily login reward logic
        today = timezone.now().date()
        if hasattr(user, 'profile') and (user.profile.last_login_reward_date is None or user.profile.last_login_reward_date < today):
            user.profile.virtual_currency += 10 # Reward 10 virtual currency for daily login
            user.profile.last_login_reward_date = today
            user.profile.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    """User logout endpoint"""
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message': _('Successfully logged out')}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': _('Invalid token')}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile(request):
    """Get current user profile"""
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)

@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_profile(request):
    """Update current user profile"""
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # For now, we'll just mark as verified
    # user = request.user
    # user.is_verified = True
    # user.save()
    # return Response({'message': 'Email verified successfully'}, status=status.HTTP_200_OK)
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import default_token_generator
from django.http import Http404

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def email_verify_confirm(request, uidb64, token):
    """Confirm email verification with token"""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.is_verified = True
        user.save()
        return Response({'message': _('Account successfully activated!')}, status=status.HTTP_200_OK)
    else:
        return Response({'error': _('Activation link is invalid!')}, status=status.HTTP_400_BAD_REQUEST)

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse

class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    """Request a password reset email"""
    serializer = PasswordResetSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'message': _('If an account with that email exists, a password reset email has been sent.')})
    
    token_generator = PasswordResetTokenGenerator()
    token = token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    current_site = "localhost:3000" # TODO: Replace with dynamic site in production
    link = reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
    reset_link = f"http://{current_site}{link}"
    
    subject = "Password Reset Request for Your Dating App Account"
    message = render_to_string('accounts/password_reset_email.html', {
        'user': user,
        'reset_link': reset_link,
    })
    
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    
    return Response({'message': 'If an account with that email exists, a password reset email has been sent.'})

class SetNewPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request, uidb64, token):
    """Confirm password reset with token and set new password"""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        serializer = SetNewPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': _('Password has been reset successfully.')}, status=status.HTTP_200_OK)
    else:
        return Response({'error': _('Reset link is invalid or has expired.')}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    confirm_new_password = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError(_("New passwords don't match"))
        return attrs

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': [_('Wrong password.')]}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': _('Password updated successfully')}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_account(request):
    user = request.user
    user.delete()
    return Response({'message': _('Account deleted successfully')}, status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def resend_verification_email(request):
    serializer = ResendVerificationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email']

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Obfuscate existence for security
        return Response({'message': _('If an account with that email exists, a verification email has been sent.')}, status=status.HTTP_200_OK)

    if user.is_verified:
        return Response({'message': _('Account already verified.')}, status=status.HTTP_200_OK)

    send_activation_email(user)
    return Response({'message': _('Verification email sent successfully.')}, status=status.HTTP_200_OK)