from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _ # Added for internationalization

User = get_user_model()

class Notification(models.Model):
    """Model to store various types of notifications"""
    NOTIFICATION_TYPES = [
        ('match', _('New Match')),
        ('message', _('New Message')),
        ('profile_view', _('Profile View')),
        ('like', _('New Like')),
        ('gift', _('New Gift')),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', verbose_name=_("recipient"))
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications', verbose_name=_("sender"))
    notification_type = models.CharField(_("notification type"), max_length=20, choices=NOTIFICATION_TYPES)
    message = models.TextField(_("message"))
    is_read = models.BooleanField(_("is read"), default=False)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))

    # Generic foreign key to link to the object that triggered the notification (e.g., Match, Message)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True, verbose_name=_("content type"))
    object_id = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("object ID"))
    content_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        ordering = ['-created_at']
        verbose_name = _("Notification")
        verbose_name_plural = _("Notifications")

    def __str__(self):
        return f"Notification for {self.recipient.first_name}: {self.message}"