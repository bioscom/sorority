from rest_framework import serializers
from .models import SubscriptionPlan, UserSubscription
from accounts.serializers import UserSerializer # Assuming UserSerializer exists

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for subscription plans"""
    class Meta:
        model = SubscriptionPlan
        fields = ('id', 'name', 'description', 'price', 'duration_days', 'features', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

class UserSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for user subscriptions"""
    user = UserSerializer(read_only=True)
    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(queryset=SubscriptionPlan.objects.all(), write_only=True, source='plan')

    class Meta:
        model = UserSubscription
        fields = ('id', 'user', 'plan', 'plan_id', 'start_date', 'end_date', 'is_active', 'stripe_customer_id', 'stripe_subscription_id', 'created_at', 'updated_at', 'is_premium_active')
        read_only_fields = ('id', 'user', 'start_date', 'end_date', 'is_active', 'stripe_customer_id', 'stripe_subscription_id', 'created_at', 'updated_at', 'is_premium_active')
