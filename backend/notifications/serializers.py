from rest_framework import serializers
from .models import Notification
from accounts.serializers import UserSerializer

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications"""
    recipient = UserSerializer(read_only=True)
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'recipient', 'sender', 'notification_type', 'message', 'is_read', 'created_at', 'content_type', 'object_id')
        read_only_fields = ('id', 'created_at', 'content_type', 'object_id')

