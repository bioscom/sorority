from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

@shared_task
def create_notification_task(recipient_id, sender_id, notification_type, message, content_type_id=None, object_id=None):
    recipient = User.objects.get(id=recipient_id)
    sender = User.objects.get(id=sender_id) if sender_id else None
    content_type = ContentType.objects.get(id=content_type_id) if content_type_id else None

    Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        message=message,
        content_type=content_type,
        object_id=object_id,
    )
    # In a real application, you might also send a real-time notification here (e.g., via websockets/FCM)

