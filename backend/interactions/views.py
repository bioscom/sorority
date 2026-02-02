import logging

from notifications.tasks import create_notification_task  # Import Celery task
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from .models import Match, Swipe, Block, Report, Gift, UserGift
from .serializers import (
    SwipeSerializer, SwipeCreateSerializer, MatchSerializer,
    BlockSerializer, BlockCreateSerializer, ReportSerializer, ReportCreateSerializer,
    GiftSerializer, UserGiftSerializer
)
from accounts.serializers import UserSerializer
from profiles.models import Profile  # Import Profile model for virtual currency management
# from notifications.models import Notification # Removed direct import
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.contenttypes.models import ContentType  # Keep ContentType import


logger = logging.getLogger(__name__)


def queue_notification(recipient_id, sender_id, notification_type, message, content_type_id=None, object_id=None):
    """Safely enqueue a notification task without failing the request."""
    try:
        create_notification_task.delay(
            recipient_id=recipient_id,
            sender_id=sender_id,
            notification_type=notification_type,
            message=message,
            content_type_id=content_type_id,
            object_id=object_id,
        )
    except Exception as exc:  # pragma: no cover - logging path for infra issues
        logger.warning(
            "Failed to enqueue %s notification for user %s: %s",
            notification_type,
            recipient_id,
            exc,
        )


def push_realtime_notification(recipient_id, notification_type, sender_id, message):
    """Best-effort realtime notification over Channels/Redis."""
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient_id}",
            {
                "type": "send_notification",
                "message": message,
                "notification_type": notification_type,
                "sender_id": sender_id,
                "created_at": timezone.now().isoformat(),
            },
        )
    except Exception as exc:  # pragma: no cover - logging path for infra issues
        logger.warning(
            "Failed to push realtime %s notification to user %s: %s",
            notification_type,
            recipient_id,
            exc,
        )


class SwipeCreateView(generics.CreateAPIView):
    """Create a swipe action"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SwipeCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        swiper = request.user
        swiped_user = serializer.validated_data['swiped_user']
        action = serializer.validated_data['action']

        existing_swipe = Swipe.objects.filter(swiper=swiper, swiped_user=swiped_user).first()

        if existing_swipe:
            if existing_swipe.action != action:
                existing_swipe.action = action
                existing_swipe.created_at = timezone.now()
                existing_swipe.save(update_fields=['action', 'created_at'])
            swipe = existing_swipe
            serializer.instance = swipe  # ensure serializer.data works for headers
            created = False
        else:
            swipe = serializer.save(swiper=swiper)
            created = True
        swipe_content_type = ContentType.objects.get_for_model(Swipe)

        if action in ['like', 'super_like']:
            notification_message = _('%s %sd your profile!') % (swiper.first_name, action)
            queue_notification(
                recipient_id=swiped_user.id,
                sender_id=swiper.id,
                notification_type='like',
                message=notification_message,
                content_type_id=swipe_content_type.id,
                object_id=swipe.id,
            )
            push_realtime_notification(
                recipient_id=swiped_user.id,
                notification_type='like',
                sender_id=swiper.id,
                message=notification_message,
            )

        match = None
        if action in ['like', 'super_like']:
            reverse_swipe = Swipe.objects.filter(
                swiper=swiped_user,
                swiped_user=swiper,
                action__in=['like', 'super_like']
            ).first()

            if reverse_swipe:
                match = Match.objects.filter(
                    Q(user1=swiper, user2=swiped_user) | Q(user1=swiped_user, user2=swiper),
                    is_active=True
                ).first()

                if not match:
                    match = Match.objects.create(user1=swiper, user2=swiped_user)
                    match_content_type = ContentType.objects.get_for_model(Match)

                    match_notification_message_1 = _('You have a new match with %s!') % swiper.first_name
                    queue_notification(
                        recipient_id=swiped_user.id,
                        sender_id=swiper.id,
                        notification_type='match',
                        message=match_notification_message_1,
                        content_type_id=match_content_type.id,
                        object_id=match.id,
                    )
                    push_realtime_notification(
                        recipient_id=swiped_user.id,
                        notification_type='match',
                        sender_id=swiper.id,
                        message=match_notification_message_1,
                    )
                    match_notification_message_2 = _('You have a new match with %s!') % swiped_user.first_name
                    queue_notification(
                        recipient_id=swiper.id,
                        sender_id=swiped_user.id,
                        notification_type='match',
                        message=match_notification_message_2,
                        content_type_id=match_content_type.id,
                        object_id=match.id,
                    )
                    push_realtime_notification(
                        recipient_id=swiper.id,
                        notification_type='match',
                        sender_id=swiped_user.id,
                        message=match_notification_message_2,
                    )

        response_payload = {
            'swipe': SwipeSerializer(swipe, context={'request': request}).data,
            'is_match': bool(match)
        }
        if match:
            response_payload['match'] = MatchSerializer(match, context={'request': request}).data

        headers = self.get_success_headers(serializer.data) if created else {}
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(response_payload, status=status_code, headers=headers)

class MatchListView(generics.ListAPIView):
    """List user's matches"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MatchSerializer
    
    def get_queryset(self):
        user = self.request.user
        return Match.objects.filter(
            Q(user1=user) | Q(user2=user),
            is_active=True
        ).order_by('-created_at')

class MatchDetailView(generics.RetrieveAPIView):
    """Retrieve a specific match"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MatchSerializer
    
    def get_queryset(self):
        user = self.request.user
        return Match.objects.filter(
            Q(user1=user) | Q(user2=user),
            is_active=True
        )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def unmatch(request, match_id):
    """Unmatch with a user"""
    try:
        match = Match.objects.get(
            id=match_id,
            is_active=True
        )
        if match.user1 != request.user and match.user2 != request.user:
            return Response({'error': _('Match not found')}, status=status.HTTP_404_NOT_FOUND)
        match.is_active = False
        match.save()
        return Response({'message': _('Successfully unmatched')}, status=status.HTTP_200_OK)
    except Match.DoesNotExist:
        return Response({'error': 'Match not found'}, status=status.HTTP_404_NOT_FOUND)

class BlockCreateView(generics.CreateAPIView):
    """Block a user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BlockCreateSerializer
    
    def perform_create(self, serializer):
        blocker = self.request.user
        blocked_user = serializer.validated_data['blocked_user']
        
        # Check if already blocked
        if Block.objects.filter(blocker=blocker, blocked_user=blocked_user).exists():
            return Response({'error': _('User already blocked')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create block
        block = serializer.save(blocker=blocker)
        
        # Deactivate any existing match
        Match.objects.filter(
            Q(user1=blocker, user2=blocked_user) | Q(user1=blocked_user, user2=blocker),
            is_active=True
        ).update(is_active=False)
        
        return Response(BlockSerializer(block).data, status=status.HTTP_201_CREATED)

class BlockListView(generics.ListAPIView):
    """List blocked users"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BlockSerializer
    
    def get_queryset(self):
        return Block.objects.filter(blocker=self.request.user).order_by('-created_at')

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def unblock(request, block_id):
    """Unblock a user"""
    try:
        block = Block.objects.get(id=block_id, blocker=request.user)
        block.delete()
        return Response({'message': _('User unblocked')}, status=status.HTTP_200_OK)
    except Block.DoesNotExist:
        return Response({'error': _('Block not found')}, status=status.HTTP_404_NOT_FOUND)

class ReportCreateView(generics.CreateAPIView):
    """Report a user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReportCreateSerializer
    
    def perform_create(self, serializer):
        reporter = self.request.user
        reported_user = serializer.validated_data['reported_user']
        
        # Check if already reported
        if Report.objects.filter(reporter=reporter, reported_user=reported_user).exists():
            return Response({'error': _('User already reported')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create report
        report = serializer.save(reporter=reporter)
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def swipe_history(request):
    """Get user's swipe history"""
    swipes = Swipe.objects.filter(swiper=request.user).order_by('-created_at')
    serializer = SwipeSerializer(swipes, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def likes_received(request):
    """Get likes received by the current user"""
    likes = Swipe.objects.filter(
        swiped_user=request.user,
        action='like'
    ).order_by('-created_at')
    serializer = SwipeSerializer(likes, many=True)
    return Response(serializer.data)


class GiftListView(generics.ListAPIView):
    """List all available gifts"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Gift.objects.all()
    serializer_class = GiftSerializer

class SendGiftView(generics.CreateAPIView):
    """Send a virtual gift to another user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserGiftSerializer

    def perform_create(self, serializer):
        sender_profile = self.request.user.profile
        gift = serializer.validated_data['gift_id']
        receiver = serializer.validated_data['receiver']

        if sender_profile.virtual_currency < gift.cost:
            return Response({'error': _('Insufficient virtual currency')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Deduct cost from sender's virtual currency
        sender_profile.virtual_currency -= gift.cost
        sender_profile.save()

        # Create UserGift instance
        user_gift = serializer.save(sender=self.request.user, receiver=receiver, gift=gift)

        # Get ContentType for UserGift model
        user_gift_content_type = ContentType.objects.get_for_model(UserGift)

        # Send notification for new gift asynchronously
        notification_message = _('%s sent you a %s!') % (self.request.user.first_name, gift.name)
        queue_notification(
            recipient_id=receiver.id,
            sender_id=self.request.user.id,
            notification_type='gift',
            message=notification_message,
            content_type_id=user_gift_content_type.id,
            object_id=user_gift.id,
        )
        # Existing real-time notification code (keep for immediate feedback)
        push_realtime_notification(
            recipient_id=receiver.id,
            notification_type='gift',
            sender_id=self.request.user.id,
            message=notification_message,
        )
        return Response({'message': _('Successfully sent %s to %s') % (gift.name, receiver.first_name)},
                        status=status.HTTP_201_CREATED)

class ReceivedGiftListView(generics.ListAPIView):
    """List gifts received by the current user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserGiftSerializer

    def get_queryset(self):
        return UserGift.objects.filter(receiver=self.request.user).order_by('-sent_at')