from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
import re


def send_activation_email(user):
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    current_site = getattr(settings, 'FRONTEND_HOST', 'localhost:3000')
    link = reverse('email_verify_confirm', kwargs={'uidb64': uid, 'token': token})
    activation_link = f"http://{current_site}{link}"

    subject = "Activate Your Dating App Account"
    message = render_to_string('accounts/account_activation_email.html', {
        'user': user,
        'activation_link': activation_link,
    })

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )

class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    phone_country_code = serializers.CharField(write_only=True)
    phone_number = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = (
            'email', 'username', 'first_name', 'last_name', 'password', 'password_confirm',
            'phone_country_code', 'phone_number'
        )
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        phone_number = attrs.get('phone_number', '').strip()
        phone_country_code = attrs.get('phone_country_code', '').strip()
        if not phone_number:
            raise serializers.ValidationError({'phone_number': 'Phone number is required'})
        if not phone_country_code or not phone_country_code.startswith('+'):
            raise serializers.ValidationError({'phone_country_code': 'Phone country code must start with + and be detected from location'})
        if not re.fullmatch(r'^[0-9]{5,15}$', phone_number):
            raise serializers.ValidationError({'phone_number': 'Enter digits only (5-15 characters)'})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        
        # Send verification email
        send_activation_email(user)
        
        return user

class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField()
    password = serializers.CharField()
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include email and password')
        
        return attrs

class UserSerializer(serializers.ModelSerializer):
    """Serializer for user data"""
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name', 'date_joined',
            'is_verified', 'is_staff', 'is_superuser', 'phone_country_code', 'phone_number'
        )
        read_only_fields = ('id', 'date_joined', 'is_verified', 'is_staff', 'is_superuser')

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile data"""
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name', 'profile',
            'is_staff', 'is_superuser', 'is_verified', 'phone_country_code', 'phone_number'
        )
    
    def get_profile(self, obj):
        if hasattr(obj, 'profile'):
            from profiles.serializers import ProfileSerializer
            return ProfileSerializer(obj.profile).data
        return None


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()







