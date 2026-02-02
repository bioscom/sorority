from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.translation import gettext_lazy as _ # Added for internationalization

User = get_user_model()

class SubscriptionPlan(models.Model):
    """Defines different premium subscription plans"""
    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.TextField(_("description"), blank=True)
    price = models.DecimalField(_("price"), max_digits=10, decimal_places=2) # Price in USD
    duration_days = models.PositiveIntegerField(
        _("duration (days)"), help_text=_("Duration of the subscription in days (e.g., 30 for 1 month)")
    )
    features = models.JSONField(
        _("features"), default=list,
        help_text=_("JSON array of features included in the plan (e.g., ['ad_free', 'advanced_filters'])")
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("updated at"))

    class Meta:
        verbose_name = _("Subscription Plan")
        verbose_name_plural = _("Subscription Plans")

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    """Tracks a user's active subscription to a plan"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription', verbose_name=_("user"))
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("plan"))
    start_date = models.DateTimeField(auto_now_add=True, verbose_name=_("start date"))
    end_date = models.DateTimeField(null=True, blank=True, verbose_name=_("end date"))
    is_active = models.BooleanField(_("is active"), default=False)
    stripe_customer_id = models.CharField(_("Stripe customer ID"), max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(_("Stripe subscription ID"), max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("created at"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("updated at"))

    class Meta:
        verbose_name = _("User Subscription")
        verbose_name_plural = _("User Subscriptions")

    def __str__(self):
        if self.plan:
            return f"{self.user.first_name}'s {self.plan.name} Subscription"
        return f"{self.user.first_name}'s Subscription (No Plan)"

    @property
    def is_premium_active(self):
        """Checks if the user's premium subscription is currently active"""
        return self.is_active and self.end_date and self.end_date > timezone.now()
