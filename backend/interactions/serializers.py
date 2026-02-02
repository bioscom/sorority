from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from profiles.models import Profile
from .models import Match, Swipe, Block, Report, Gift, UserGift
from accounts.serializers import UserSerializer


class UserWithProfileSerializer(serializers.ModelSerializer):
    """Serializer for user with profile slug"""
    profile = serializers.SerializerMethodField()
    
    class Meta:
        from accounts.models import User
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'profile')
    
    def get_profile(self, obj):
        if hasattr(obj, 'profile'):
            from profiles.serializers import ProfileListSerializer
            return ProfileListSerializer(obj.profile).data
        return None


class SwipeSerializer(serializers.ModelSerializer):
    """Serializer for swipe actions"""
    swiper = UserWithProfileSerializer(read_only=True)
    swiped_user = UserWithProfileSerializer(read_only=True)
    
    class Meta:
        model = Swipe
        fields = ('id', 'swiper', 'swiped_user', 'action', 'created_at')
        read_only_fields = ('id', 'swiper', 'created_at')

UserModel = get_user_model()


class SwipedUserField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if isinstance(data, UserModel):
            return data

        # Allow clients to pass a profile slug rather than a numeric user identifier
        if isinstance(data, str):
            normalized_value = data.strip()
            if normalized_value:
                if normalized_value.isdigit():
                    data = normalized_value
                else:
                    try:
                        profile = Profile.objects.select_related('user').get(slug=normalized_value)
                        return profile.user
                    except Profile.DoesNotExist:
                        pass

        try:
            # Prefer treating the value as a direct user identifier
            return super().to_internal_value(data)
        except serializers.ValidationError:
            try:
                lookup_value = int(data)
            except (TypeError, ValueError):
                raise serializers.ValidationError(_('Invalid user identifier.'))

            try:
                profile = Profile.objects.select_related('user').get(pk=lookup_value)
                return profile.user
            except Profile.DoesNotExist:
                raise serializers.ValidationError(_('User not found.'))


class SwipeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating swipe actions"""
    swiped_user = SwipedUserField(queryset=UserModel.objects.all())

    class Meta:
        model = Swipe
        fields = ('swiped_user', 'action')

class MatchSerializer(serializers.ModelSerializer):
    """Serializer for matches"""
    user1 = UserWithProfileSerializer(read_only=True)
    user2 = UserWithProfileSerializer(read_only=True)
    
    class Meta:
        model = Match
        fields = ('id', 'user1', 'user2', 'created_at', 'is_active')
        read_only_fields = ('id', 'created_at')

class BlockSerializer(serializers.ModelSerializer):
    """Serializer for blocks"""
    blocker = UserSerializer(read_only=True)
    blocked_user = UserSerializer(read_only=True)
    
    class Meta:
        model = Block
        fields = ('id', 'blocker', 'blocked_user', 'reason', 'created_at')
        read_only_fields = ('id', 'blocker', 'created_at')

class BlockCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating blocks"""
    class Meta:
        model = Block
        fields = ('blocked_user', 'reason')

class ReportSerializer(serializers.ModelSerializer):
    """Serializer for reports"""
    reporter = UserSerializer(read_only=True)
    reported_user = UserSerializer(read_only=True)
    
    class Meta:
        model = Report
        fields = (
            'id', 'reporter', 'reported_user', 'reason', 'description',
            'created_at', 'is_resolved'
        )
        read_only_fields = ('id', 'reporter', 'created_at')

class ReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating reports"""
    class Meta:
        model = Report
        fields = ('reported_user', 'reason', 'description')

class GiftSerializer(serializers.ModelSerializer):
    """Serializer for virtual gifts"""
    class Meta:
        model = Gift
        fields = ('id', 'name', 'description', 'cost', 'image', 'created_at')
        read_only_fields = ('id', 'created_at')

class UserGiftSerializer(serializers.ModelSerializer):
    """Serializer for tracking sent/received gifts"""
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    gift = GiftSerializer(read_only=True)
    gift_id = serializers.PrimaryKeyRelatedField(queryset=Gift.objects.all(), write_only=True)

    class Meta:
        model = UserGift
        fields = ('id', 'sender', 'receiver', 'gift', 'gift_id', 'sent_at')
        read_only_fields = ('id', 'sender', 'receiver', 'gift', 'sent_at')








