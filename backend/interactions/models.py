from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

User = get_user_model()

class Match(models.Model):
    """Represents a match between two users"""
    user1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_user1', verbose_name=_("user 1"))
    user2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_user2', verbose_name=_("user 2"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    is_active = models.BooleanField(_("is active"), default=True)
    
    class Meta:
        unique_together = ['user1', 'user2']
        ordering = ['-created_at']
        verbose_name = _("Match")
        verbose_name_plural = _("Matches")
    
    def __str__(self):
        return f"Match: {self.user1.first_name} & {self.user2.first_name}"
    
    @property
    def other_user(self, user):
        """Get the other user in the match"""
        return self.user2 if user == self.user1 else self.user1

class Swipe(models.Model):
    """Represents a swipe action (like/pass)"""
    SWIPE_CHOICES = [
        ('like', _('Like')),
        ('pass', _('Pass')),
        ('super_like', _('Super Like')),
    ]
    
    swiper = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swipes_made', verbose_name=_("swiper"))
    swiped_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swipes_received', verbose_name=_("swiped user"))
    action = models.CharField(_("action"), max_length=10, choices=SWIPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    
    class Meta:
        unique_together = ['swiper', 'swiped_user']
        ordering = ['-created_at']
        verbose_name = _("Swipe")
        verbose_name_plural = _("Swipes")
    
    def __str__(self):
        return f"{self.swiper.first_name} {self.action} {self.swiped_user.first_name}"

class Block(models.Model):
    """Represents a user blocking another user"""
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_made', verbose_name=_("blocker"))
    blocked_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocks_received', verbose_name=_("blocked user"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    reason = models.TextField(_("reason"), blank=True)
    
    class Meta:
        unique_together = ['blocker', 'blocked_user']
        ordering = ['-created_at']
        verbose_name = _("Block")
        verbose_name_plural = _("Blocks")
    
    def __str__(self):
        return f"{self.blocker.first_name} blocked {self.blocked_user.first_name}"

class Report(models.Model):
    """User reports for inappropriate behavior"""
    REPORT_REASONS = [
        ('inappropriate_photos', _('Inappropriate Photos')),
        ('harassment', _('Harassment')),
        ('spam', _('Spam')),
        ('fake_profile', _('Fake Profile')),
        ('underage', _('Underage')),
        ('other', _('Other')),
    ]
    
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_made', verbose_name=_("reporter"))
    reported_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_received', verbose_name=_("reported user"))
    reason = models.CharField(_("reason"), max_length=20, choices=REPORT_REASONS)
    description = models.TextField(_("description"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    is_resolved = models.BooleanField(_("is resolved"), default=False)
    
    class Meta:
        unique_together = ['reporter', 'reported_user']
        ordering = ['-created_at']
        verbose_name = _("Report")
        verbose_name_plural = _("Reports")
    
    def __str__(self):
        return f"Report: {self.reported_user.first_name} by {self.reporter.first_name}"

class Gift(models.Model):
    """Represents a virtual gift that can be sent"""
    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.TextField(_("description"), blank=True)
    cost = models.PositiveIntegerField(_("cost"), default=1) # Cost in virtual currency
    image = models.ImageField(_("image"), upload_to='gifts/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))

    class Meta:
        verbose_name = _("Gift")
        verbose_name_plural = _("Gifts")

    def __str__(self):
        return self.name

class UserGift(models.Model):
    """Tracks gifts sent from one user to another"""
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gifts_sent', verbose_name=_("sender"))
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gifts_received', verbose_name=_("receiver"))
    gift = models.ForeignKey(Gift, on_delete=models.CASCADE, verbose_name=_("gift"))
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name=_("sent at"))

    class Meta:
        unique_together = ['sender', 'receiver', 'gift']
        ordering = ['-sent_at']
        verbose_name = _("User Gift")
        verbose_name_plural = _("User Gifts")

    def __str__(self):
        return f"{self.sender.first_name} sent {self.gift.name} to {self.receiver.first_name}"

class ProfileView(models.Model):
    """Tracks when a user views another user's profile"""
    viewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profiles_viewed', verbose_name=_("viewer"))
    viewed_profile = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profile_views_received', verbose_name=_("viewed user"))
    viewed_at = models.DateTimeField(auto_now_add=True, verbose_name=_("viewed at"))

    class Meta:
        ordering = ['-viewed_at']
        verbose_name = _("Profile View")
        verbose_name_plural = _("Profile Views")

    def __str__(self):
        return f"{self.viewer.first_name} viewed {self.viewed_profile.first_name}"
