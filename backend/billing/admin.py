from django.contrib import admin
from .models import SubscriptionPlan, UserSubscription

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'duration_days', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('duration_days',)

@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'start_date', 'end_date', 'is_active', 'is_premium_active')
    list_filter = ('is_active', 'plan', 'start_date', 'end_date')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'plan__name')
    actions = ['activate_subscriptions', 'deactivate_subscriptions']
    readonly_fields = ('stripe_customer_id', 'stripe_subscription_id', 'created_at', 'updated_at')

    @admin.action(description='Activate selected subscriptions')
    def activate_subscriptions(self, request, queryset):
        from django.utils import timezone
        for subscription in queryset:
            subscription.is_active = True
            subscription.start_date = timezone.now()
            subscription.end_date = timezone.now() + timezone.timedelta(days=subscription.plan.duration_days)
            if hasattr(subscription.user, 'profile'):
                subscription.user.profile.is_premium = True
                subscription.user.profile.save()
            subscription.save()
        self.message_user(request, f'{queryset.count()} subscriptions successfully activated.')

    @admin.action(description='Deactivate selected subscriptions')
    def deactivate_subscriptions(self, request, queryset):
        for subscription in queryset:
            subscription.is_active = False
            if hasattr(subscription.user, 'profile'):
                subscription.user.profile.is_premium = False
                subscription.user.profile.save()
            subscription.save()
        self.message_user(request, f'{queryset.count()} subscriptions successfully deactivated.', level='warning')
