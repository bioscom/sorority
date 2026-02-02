from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.translation import gettext_lazy as _ # Added for internationalization

User = get_user_model()

class Conversation(models.Model):
    """Represents a conversation between two matched users"""
    match = models.OneToOneField('interactions.Match', on_delete=models.CASCADE, related_name='conversation', verbose_name=_("match"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("updated at"))
    is_active = models.BooleanField(_("is active"), default=True)
    
    class Meta:
        ordering = ['-updated_at']
        verbose_name = _("Conversation")
        verbose_name_plural = _("Conversations")
    
    def __str__(self):
        return f"Conversation: {self.match.user1.first_name} & {self.match.user2.first_name}"
    
    @property
    def participants(self):
        return [self.match.user1, self.match.user2]

class Message(models.Model):
    """Individual messages within a conversation"""
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages', verbose_name=_("conversation"))
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages', verbose_name=_("sender"))
    content = models.TextField(_("content"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    is_read = models.BooleanField(_("is read"), default=False)
    read_at = models.DateTimeField(null=True, blank=True, verbose_name=_("read at"))
    
    class Meta:
        ordering = ['created_at']
        verbose_name = _("Message")
        verbose_name_plural = _("Messages")
    
    def __str__(self):
        return f"Message from {self.sender.first_name} in {self.conversation}"
    
    def mark_as_read(self):
        """Mark the message as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()

class MessageReaction(models.Model):
    """Reactions to messages (like, love, laugh, etc.)"""
    REACTION_TYPES = [
        ('like', _('👍')),
        ('love', _('❤️')),
        ('laugh', _('😂')),
        ('wow', _('😮')),
        ('sad', _('😢')),
        ('angry', _('😠')),
    ]
    
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions', verbose_name=_("message"))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_reactions', verbose_name=_("user"))
    reaction_type = models.CharField(_("reaction type"), max_length=10, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    
    class Meta:
        unique_together = ['message', 'user']
        ordering = ['-created_at']
        verbose_name = _("Message Reaction")
        verbose_name_plural = _("Message Reactions")
    
    def __str__(self):
        return f"{self.user.first_name} reacted {self.reaction_type} to message"

class TypingIndicator(models.Model):
    """Tracks when users are typing in a conversation"""
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='typing_indicators', verbose_name=_("conversation"))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='typing_indicators', verbose_name=_("user"))
    is_typing = models.BooleanField(_("is typing"), default=False)
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("updated at"))
    
    class Meta:
        unique_together = ['conversation', 'user']
        verbose_name = _("Typing Indicator")
        verbose_name_plural = _("Typing Indicators")
    
    def __str__(self):
        status = "typing" if self.is_typing else "not typing"
        return f"{self.user.first_name} is {status} in {self.conversation}"
