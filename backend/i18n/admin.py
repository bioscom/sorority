from django.contrib import admin

from .models import TranslatedString


@admin.register(TranslatedString)
class TranslatedStringAdmin(admin.ModelAdmin):
    list_display = ('key', 'source_language', 'target_language', 'status', 'updated_at')
    list_filter = ('status', 'target_language', 'provider')
    search_fields = ('key', 'source_text', 'translated_text')
    ordering = ('-updated_at',)
