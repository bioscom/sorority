from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from .models import Conversation, Message, MessageReaction, TypingIndicator
from .serializers import (
    ConversationListSerializer, ConversationSerializer, MessageSerializer, MessageCreateSerializer,
    MessageReactionSerializer, TypingIndicatorSerializer
)
from interactions.models import Match
from .translation_service import translate_text # Import the translation service
from notifications.tasks import create_notification_task # Import Celery task
from django.contrib.contenttypes.models import ContentType # Import ContentType

class ConversationListView(generics.ListAPIView):
    """List user's conversations"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationListSerializer
    
    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(match__user1=user) | Q(match__user2=user),
            is_active=True
        ).order_by('-updated_at')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class ConversationDetailView(generics.RetrieveAPIView):
    """Retrieve a specific conversation"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer
    
    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(match__user1=user) | Q(match__user2=user),
            is_active=True
        )
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_conversation(request, match_id):
    """Create a conversation for a match"""
    if not request.user.profile.is_premium:
        return Response({'error': _('Only premium users can start conversations. Upgrade to premium to chat with matches.')}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        match = Match.objects.filter(
            id=match_id,
            is_active=True
        ).filter(Q(user1=request.user) | Q(user2=request.user)).first()
        
        if not match:
            return Response({'error': _('Match not found or you are not part of this match')}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if conversation already exists
        conversation, created = Conversation.objects.get_or_create(match=match)
        
        if created:
            return Response(
                ConversationSerializer(conversation, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        else:
            return Response(
                ConversationSerializer(conversation, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MessageListCreateView(generics.ListCreateAPIView):
    """List and create messages in a conversation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MessageCreateSerializer
        return MessageSerializer
    
    def get_queryset(self):
        conversation_id = self.kwargs['conversation_id']
        return Message.objects.filter(
            conversation_id=conversation_id,
            conversation__match__user1=self.request.user
        ) | Message.objects.filter(
            conversation_id=conversation_id,
            conversation__match__user2=self.request.user
        )
    
    def create(self, request, *args, **kwargs):
        """Override create to return full message with sender info"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Get the created message and serialize it with full details
        message = serializer.instance
        output_serializer = MessageSerializer(message)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        conversation_id = self.kwargs['conversation_id']
        conversation = Conversation.objects.filter(
            id=conversation_id
        ).filter(Q(match__user1=self.request.user) | Q(match__user2=self.request.user)).first()
        message = serializer.save(sender=self.request.user, conversation=conversation)

        # Determine the recipient (the other participant in the conversation)
        recipient = conversation.match.user1 if self.request.user == conversation.match.user2 else conversation.match.user2

        # Get ContentType for Message model
        message_content_type = ContentType.objects.get_for_model(Message)

        # Send new message notification asynchronously
        notification_message = _('%s sent you a new message: %s...') % (self.request.user.first_name, message.content[:50])
        create_notification_task.delay(
            recipient_id=recipient.id,
            sender_id=self.request.user.id,
            notification_type='message',
            message=notification_message,
            content_type_id=message_content_type.id,
            object_id=message.id
        )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_messages_read(request, conversation_id):
    """Mark messages as read in a conversation"""
    try:
        conversation = Conversation.objects.filter(
            id=conversation_id
        ).filter(Q(match__user1=request.user) | Q(match__user2=request.user)).first()
        
        # Mark all unread messages as read
        Message.objects.filter(
            conversation=conversation,
            is_read=False
        ).exclude(sender=request.user).update(is_read=True)
        
        return Response({'message': _('Messages marked as read')}, status=status.HTTP_200_OK)
    except Conversation.DoesNotExist:
        return Response({'error': _('Conversation not found')}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def add_message_reaction(request, message_id):
    """Add a reaction to a message"""
    try:
        message = Message.objects.filter(
            id=message_id
        ).filter(
            Q(conversation__match__user1=request.user) | Q(conversation__match__user2=request.user)
        ).first()
        
        reaction_type = request.data.get('reaction_type')
        if not reaction_type:
            return Response({'error': _('reaction_type is required')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create or update reaction
        reaction, created = MessageReaction.objects.update_or_create(
            message=message,
            user=request.user,
            defaults={'reaction_type': reaction_type}
        )
        
        return Response(MessageReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)
    except Message.DoesNotExist:
        return Response({'error': _('Message not found')}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_message_reaction(request, message_id):
    """Remove a reaction from a message"""
    try:
        message = Message.objects.filter(
            id=message_id
        ).filter(
            Q(conversation__match__user1=request.user) | Q(conversation__match__user2=request.user)
        ).first()
        
        reaction = MessageReaction.objects.get(message=message, user=request.user)
        reaction.delete()
        
        return Response({'message': 'Reaction removed'}, status=status.HTTP_200_OK)
    except (Message.DoesNotExist, MessageReaction.DoesNotExist):
        return Response({'error': _('Message or reaction not found')}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_typing_status(request, conversation_id):
    """Update typing status in a conversation"""
    try:
        conversation = Conversation.objects.filter(
            id=conversation_id
        ).filter(Q(match__user1=request.user) | Q(match__user2=request.user)).first()
        
        is_typing = request.data.get('is_typing', False)
        
        typing_indicator, created = TypingIndicator.objects.update_or_create(
            conversation=conversation,
            user=request.user,
            defaults={'is_typing': is_typing}
        )
        
        return Response(TypingIndicatorSerializer(typing_indicator).data, status=status.HTTP_200_OK)
    except Conversation.DoesNotExist:
        return Response({'error': _('Conversation not found')}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_typing_indicators(request, conversation_id):
    """Get typing indicators for a conversation"""
    try:
        conversation = Conversation.objects.filter(
            id=conversation_id
        ).filter(Q(match__user1=request.user) | Q(match__user2=request.user)).first()
        
        typing_indicators = TypingIndicator.objects.filter(
            conversation=conversation,
            is_typing=True
        ).exclude(user=request.user)
        
        serializer = TypingIndicatorSerializer(typing_indicators, many=True)
        return Response(serializer.data)
    except Conversation.DoesNotExist:
        return Response({'error': _('Conversation not found')}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def translate_message(request):
    """Translate a message to a target language using open-source MarianMT models."""
    text = request.data.get('text')
    target_language = request.data.get('target_language')
    source_language = request.data.get('source_language')

    if not text or not target_language:
        return Response({'error': _('Text and target_language are required')}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = translate_text(text=text, target_language=target_language, source_language=source_language)
        return Response(
            {
                'translated_text': result.translated_text,
                'source_language': result.source_language,
                'target_language': result.target_language,
                'provider': result.provider,
            },
            status=status.HTTP_200_OK,
        )
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response({'error': _('Translation service is temporarily unavailable.')}, status=status.HTTP_503_SERVICE_UNAVAILABLE)