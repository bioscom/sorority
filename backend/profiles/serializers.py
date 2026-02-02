from rest_framework import serializers
from typing import Any, Dict, List
from .models import Profile, Photo, Interest, ProfileInterest, Boost, UserFeatureVector, Value, ProfileValue, Option
from django.utils import timezone
from .moderation_service import moderate_text
from .recommendation_engine import update_user_feature_vector # Added for AI recommendation engine


def serialize_profile_values(profile: Profile) -> List[Dict[str, Any]]:
    """Return normalized value data sourced from ProfileValue relations."""
    serialized_values: list[dict] = []

    profile_value_qs = profile.profile_values.select_related('value').all()
    for profile_value in profile_value_qs:
        value_obj = profile_value.value
        if value_obj:
            serialized_values.append({'id': value_obj.id, 'value': value_obj.name})

    if serialized_values:
        return serialized_values

    # Fallback to legacy JSON field data to avoid breaking older profiles
    legacy_values = getattr(profile, 'values', None)
    if isinstance(legacy_values, list):
        fallback_values: list[dict] = []
        for item in legacy_values:
            if isinstance(item, dict):
                label = item.get('value') or item.get('name') or item.get('label')
                if label:
                    fallback_values.append({'id': item.get('id'), 'value': label})
            elif isinstance(item, str) and item.strip():
                fallback_values.append({'id': None, 'value': item.strip()})
        if fallback_values:
            return fallback_values

    return []

class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for user photos"""
    class Meta:
        model = Photo
        fields = ('id', 'image', 'is_primary', 'uploaded_at', 'is_moderated', 'is_safe', 'moderation_score', 'rejection_reason')
        read_only_fields = ('id', 'uploaded_at', 'is_moderated', 'is_safe', 'moderation_score', 'rejection_reason')

    def create(self, validated_data):
        # Ensure the photo is linked to the requesting user's profile
        request = self.context.get('request', None)
        if request and hasattr(request.user, 'profile'):
            validated_data['profile'] = request.user.profile
        return super().create(validated_data)

class InterestSerializer(serializers.ModelSerializer):
    """Serializer for interests"""
    class Meta:
        model = Interest
        fields = ('id', 'name')

class ProfileInterestSerializer(serializers.ModelSerializer):
    """Serializer for profile interests"""
    interest = InterestSerializer(read_only=True)
    interest_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = ProfileInterest
        fields = ('id', 'interest', 'interest_id')

class ValueSerializer(serializers.ModelSerializer):
    """Serializer for values"""
    class Meta:
        model = Value
        fields = ('id', 'name', 'created_at')
        read_only_fields = ('id', 'created_at')

class ProfileValueSerializer(serializers.ModelSerializer):
    """Serializer for profile values"""
    value = ValueSerializer(read_only=True)
    value_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = ProfileValue
        fields = ('id', 'value', 'value_id', 'created_at')
        read_only_fields = ('id', 'created_at')

class OptionSerializer(serializers.ModelSerializer):
    """Serializer for configurable options (gender, looking_for, etc.)"""
    class Meta:
        model = Option
        fields = ('id', 'category', 'value', 'label', 'order', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

class BoostSerializer(serializers.ModelSerializer):
    """Serializer for Boost model"""
    class Meta:
        model = Boost
        fields = ('id', 'name', 'description', 'cost', 'duration_days', 'boost_type', 'created_at')
        read_only_fields = ('id', 'created_at')

class UserFeatureVectorSerializer(serializers.ModelSerializer):
    """Serializer for UserFeatureVector model"""
    class Meta:
        model = UserFeatureVector
        fields = ('id', 'user', 'feature_vector', 'created_at', 'updated_at')
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')

class ProfileSerializer(serializers.ModelSerializer):
    last_seen = serializers.SerializerMethodField()
    """Serializer for user profiles (creation, update, and retrieval)"""
    photos = PhotoSerializer(many=True, read_only=True)
    interests = serializers.PrimaryKeyRelatedField(many=True, queryset=Interest.objects.all(), source='profileinterest_set', required=False)
    full_name = serializers.ReadOnlyField()
    current_age = serializers.SerializerMethodField()


    class Meta:
        model = Profile
        fields = (
            'id', 'user', 'slug', 'bio', 'date_of_birth', 'gender', 'looking_for', 'relationship_status',
            'location', 'country', 'state_province', 'latitude', 'longitude', 'max_distance', 'min_age',
            'max_age', 'is_active', 'is_hidden', 'photo_visibility', 'virtual_currency', 'is_premium', 'is_online', 
            'last_login_reward_date', 'profile_completion_score', 'boost_expiry', 
            'bio_is_moderated', 'bio_is_safe', 'bio_moderation_score', 'bio_rejection_reason',
            'created_at', 'updated_at', 'photos',
            'interests', 'full_name', 'current_age', 'is_premium', 'preferred_language',
            'prompts', 'values', 'favorite_music', 'last_seen',
            'passport_latitude', 'passport_longitude', 'is_passport_enabled'
        )
        read_only_fields = (
            'id', 'user', 'created_at', 'updated_at', 'full_name', 'current_age', 
            'last_login_reward_date', 'profile_completion_score', 'boost_expiry',
            'bio_is_moderated', 'bio_is_safe', 'bio_moderation_score', 'bio_rejection_reason')

    def get_last_seen(self, obj):
        # Use the user's last_login if available, else fallback to date_joined
        user = getattr(obj, 'user', None)
        if user and hasattr(user, 'last_login') and user.last_login:
            return user.last_login.isoformat()
        if user and hasattr(user, 'date_joined') and user.date_joined:
            return user.date_joined.isoformat()
        return None


    def get_current_age(self, obj):
        if obj.date_of_birth:
            today = timezone.now().date()
            return today.year - obj.date_of_birth.year - ((today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day))
        return None

    def create(self, validated_data):
        interests_data = validated_data.pop('profileinterest_set', [])
        profile = Profile.objects.create(**validated_data)
        for interest_id in interests_data:
            ProfileInterest.objects.create(profile=profile, interest=interest_id)
        
        # Update user feature vector after profile creation
        # update_user_feature_vector(profile)
        
        return profile

    def update(self, instance, validated_data):
        interests_data = validated_data.pop('profileinterest_set', None)

        # Handle bio moderation if bio is being updated
        if 'bio' in validated_data:
            bio_content = validated_data['bio']
            moderation_results = moderate_text(bio_content)
            instance.bio_is_moderated = True
            instance.bio_is_safe = moderation_results['is_safe']
            instance.bio_moderation_score = moderation_results['moderation_score']
            instance.bio_rejection_reason = moderation_results['rejection_reason']
            
            if not instance.bio_is_safe:
                # If bio is not safe, set it to empty and use rejection reason
                instance.bio = ""
                # Optionally, raise a ValidationError here if you want to prevent saving
                # raise serializers.ValidationError({'bio': 'Bio rejected by moderation: ' + instance.bio_rejection_reason})
            else:
                instance.bio = bio_content # Set the bio only if it's safe

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if interests_data is not None:
            instance.interests.all().delete() # Remove existing interests
            for interest_id in interests_data:
                ProfileInterest.objects.create(profile=instance, interest=interest_id)

        # Update user feature vector after profile update
        # update_user_feature_vector(instance)

        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['values'] = serialize_profile_values(instance)
        return data

class ProfileListSerializer(serializers.ModelSerializer):
    """Serializer for profile lists (discovery)"""
    photos = PhotoSerializer(many=True, read_only=True)
    interests = ProfileInterestSerializer(many=True, read_only=True)
    full_name = serializers.ReadOnlyField()
    primary_photo = serializers.SerializerMethodField()
    current_age = serializers.SerializerMethodField()
    values = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Profile
        fields = (
            'id', 'user_id', 'slug', 'bio', 'current_age', 'gender', 'location', 'country', 'state_province', 'is_premium', 'is_online', 'photos', 'interests',
            'full_name', 'primary_photo', 'values'
        )
    
    def get_primary_photo(self, obj):
        primary_photo = obj.photos.filter(is_primary=True).first()
        if primary_photo:
            return PhotoSerializer(primary_photo).data
        return None

    def get_current_age(self, obj):
        if obj.date_of_birth:
            today = timezone.now().date()
            return today.year - obj.date_of_birth.year - ((today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day))
        return None

    def get_values(self, obj):
        return serialize_profile_values(obj)
