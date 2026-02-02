from rest_framework import serializers
from .models import Conversation, Message, MessageReaction, TypingIndicator
from accounts.serializers import UserSerializer
from interactions.serializers import MatchSerializer

class MessageReactionSerializer(serializers.ModelSerializer):
    """Serializer for message reactions"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = MessageReaction
        fields = ('id', 'user', 'reaction_type', 'created_at')
        read_only_fields = ('id', 'created_at')

class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages"""
    sender = UserSerializer(read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Message
        fields = (
            'id', 'sender', 'content', 'created_at', 'is_read', 'read_at', 'reactions'
        )
        read_only_fields = ('id', 'created_at', 'read_at')

class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating messages"""
    class Meta:
        model = Message
        fields = ('content',)

class ConversationListSerializer(serializers.ModelSerializer):
    """Serializer for conversations list (without messages)"""
    match = MatchSerializer(read_only=True)
    participants = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = (
            'id', 'match', 'participants', 'last_message',
            'unread_count', 'created_at', 'updated_at', 'is_active'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_participants(self, obj):
        return [UserSerializer(user).data for user in obj.participants]

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()

class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations"""
    match = MatchSerializer(read_only=True)
    messages = MessageSerializer(many=True, read_only=True)
    participants = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = (
            'id', 'match', 'participants', 'messages', 'last_message',
            'unread_count', 'created_at', 'updated_at', 'is_active'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_participants(self, obj):
        return [UserSerializer(user).data for user in obj.participants]
    
    def get_last_message(self, obj):
        last_message = obj.messages.last()
        if last_message:
            return MessageSerializer(last_message).data
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

class TypingIndicatorSerializer(serializers.ModelSerializer):
    """Serializer for typing indicators"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = TypingIndicator
        fields = ('user', 'is_typing', 'updated_at')
        read_only_fields = ('updated_at',)







