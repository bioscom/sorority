from django.contrib import admin
from .models import Profile, Photo, Interest, ProfileInterest, Boost, UserFeatureVector, Value, ProfileValue, Option

class PhotoInline(admin.TabularInline):
    model = Photo
    extra = 0

class ProfileInterestInline(admin.TabularInline):
    model = ProfileInterest
    extra = 0

class ProfileValueInline(admin.TabularInline):
    model = ProfileValue
    extra = 0

@admin.register(Boost)
class BoostAdmin(admin.ModelAdmin):
    list_display = ('name', 'cost', 'duration_days', 'boost_type', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('boost_type', 'duration_days')

@admin.register(UserFeatureVector)
class UserFeatureVectorAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'updated_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at', 'feature_vector')

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'date_of_birth', 'gender', 'location', 'is_active', 'is_hidden', 'photo_visibility', 'virtual_currency', 'is_premium', 'is_online', 'bio_is_safe', 'profile_completion_score', 'boost_expiry', 'created_at')
    list_filter = ('gender', 'looking_for', 'relationship_status', 'is_active', 'is_hidden', 'is_premium', 'is_online', 'photo_visibility', 'bio_is_safe', 'created_at', 'last_login_reward_date', 'boost_expiry')
    search_fields = ('user__first_name', 'user__last_name', 'user__email', 'location', 'bio', 'bio_rejection_reason')
    inlines = [PhotoInline, ProfileInterestInline, ProfileValueInline]
    readonly_fields = ('created_at', 'updated_at', 'last_login_reward_date', 'profile_completion_score', 'boost_expiry', 'bio_is_moderated', 'bio_is_safe', 'bio_moderation_score', 'bio_rejection_reason')
    actions = ['approve_bio', 'reject_bio']

    @admin.action(description='Mark selected bios as approved')
    def approve_bio(self, request, queryset):
        queryset.update(bio_is_moderated=True, bio_is_safe=True, bio_rejection_reason='', bio_moderation_score=1.0)
        self.message_user(request, f'{queryset.count()} bios successfully approved.')

    @admin.action(description='Mark selected bios as rejected')
    def reject_bio(self, request, queryset):
        # In a real app, you might want a form to specify rejection reason
        queryset.update(bio_is_moderated=True, bio_is_safe=False, bio_rejection_reason='Manually rejected by admin.', bio_moderation_score=0.0)
        self.message_user(request, f'{queryset.count()} bios successfully rejected.', level='error')

@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ('profile', 'image_tag', 'is_primary', 'is_moderated', 'is_safe', 'moderation_score', 'uploaded_at')
    list_filter = ('is_primary', 'is_moderated', 'is_safe', 'uploaded_at')
    search_fields = ('profile__user__first_name', 'profile__user__last_name', 'rejection_reason')
    readonly_fields = ('uploaded_at', 'image_tag', 'is_moderated', 'is_safe', 'moderation_score', 'rejection_reason')
    actions = ['approve_photos', 'reject_photos']

    def image_tag(self, obj):
        from django.utils.html import mark_safe
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" width="100" height="auto" />')
        return ""
    image_tag.short_description = 'Image'

    @admin.action(description='Mark selected photos as approved')
    def approve_photos(self, request, queryset):
        queryset.update(is_moderated=True, is_safe=True, rejection_reason='')
        self.message_user(request, f'{queryset.count()} photos successfully approved.')

    @admin.action(description='Mark selected photos as rejected')
    def reject_photos(self, request, queryset):
        # In a real app, you might want a form to specify rejection reason
        queryset.update(is_moderated=True, is_safe=False, rejection_reason='Manually rejected by admin.')
        self.message_user(request, f'{queryset.count()} photos successfully rejected.', level='error')

@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(ProfileInterest)
class ProfileInterestAdmin(admin.ModelAdmin):
    list_display = ('profile', 'interest')
    list_filter = ('interest',)
    search_fields = ('profile__user__first_name', 'profile__user__last_name', 'interest__name')

@admin.register(Value)
class ValueAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)

@admin.register(ProfileValue)
class ProfileValueAdmin(admin.ModelAdmin):
    list_display = ('profile', 'value', 'created_at')
    list_filter = ('value', 'created_at')
    search_fields = ('profile__user__first_name', 'profile__user__last_name', 'value__name')

@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ('category', 'label', 'value', 'order', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('label', 'value')
    ordering = ('category', 'order', 'value')
    list_editable = ('order', 'is_active')
    fieldsets = (
        ('Basic Information', {
            'fields': ('category', 'value', 'label')
        }),
        ('Display Settings', {
            'fields': ('order', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')
