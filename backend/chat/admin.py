from django.contrib import admin
from .models import Conversation, Message, MessageReaction, TypingIndicator

class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('created_at',)

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('match', 'created_at', 'updated_at', 'is_active')
    list_filter = ('is_active', 'created_at', 'updated_at')
    search_fields = ('match__user1__first_name', 'match__user1__last_name', 'match__user2__first_name', 'match__user2__last_name')
    inlines = [MessageInline]
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender', 'content_preview', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at')
    search_fields = ('sender__first_name', 'sender__last_name', 'content')
    readonly_fields = ('created_at', 'read_at')
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'

@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ('message', 'user', 'reaction_type', 'created_at')
    list_filter = ('reaction_type', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'message__content')
    readonly_fields = ('created_at',)

@admin.register(TypingIndicator)
class TypingIndicatorAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'user', 'is_typing', 'updated_at')
    list_filter = ('is_typing', 'updated_at')
    search_fields = ('user__first_name', 'user__last_name')
    readonly_fields = ('updated_at',)
