from django.contrib import admin
from .models import Match, Swipe, Block, Report, Gift, UserGift

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('user1', 'user2', 'created_at', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('user1__first_name', 'user1__last_name', 'user2__first_name', 'user2__last_name')
    readonly_fields = ('created_at',)

@admin.register(Swipe)
class SwipeAdmin(admin.ModelAdmin):
    list_display = ('swiper', 'swiped_user', 'action', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('swiper__first_name', 'swiper__last_name', 'swiped_user__first_name', 'swiped_user__last_name')
    readonly_fields = ('created_at',)

@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ('blocker', 'blocked_user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('blocker__first_name', 'blocker__last_name', 'blocked_user__first_name', 'blocked_user__last_name')
    readonly_fields = ('created_at',)

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('reporter', 'reported_user', 'reason', 'is_resolved', 'created_at')
    list_filter = ('reason', 'is_resolved', 'created_at')
    search_fields = ('reporter__first_name', 'reporter__last_name', 'reported_user__first_name', 'reported_user__last_name')
    readonly_fields = ('created_at',)

@admin.register(Gift)
class GiftAdmin(admin.ModelAdmin):
    list_display = ('name', 'cost', 'created_at')
    search_fields = ('name', 'description')

@admin.register(UserGift)
class UserGiftAdmin(admin.ModelAdmin):
    list_display = ('sender', 'receiver', 'gift', 'sent_at')
    list_filter = ('gift', 'sent_at')
    search_fields = ('sender__first_name', 'sender__last_name', 'receiver__first_name', 'receiver__last_name', 'gift__name')