from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_verified', 'date_joined')
    list_filter = ('is_verified', 'is_staff', 'is_active', 'date_joined')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    actions = ['verify_users', 'unverify_users']

    @admin.action(description='Mark selected users as verified')
    def verify_users(self, request, queryset):
        queryset.update(is_verified=True)
        self.message_user(request, f'{queryset.count()} users successfully marked as verified.')

    @admin.action(description='Mark selected users as unverified')
    def unverify_users(self, request, queryset):
        queryset.update(is_verified=False)
        self.message_user(request, f'{queryset.count()} users successfully marked as unverified.', level='warning')
