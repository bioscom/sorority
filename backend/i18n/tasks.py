from __future__ import annotations

from celery import shared_task
from django.db import transaction

from chat.translation_service import translate_text
from .models import TranslatedString


@shared_task(name='i18n.translate_pending_string')
def translate_pending_string(translation_id: int, source_language: str | None = None) -> None:
    translation = TranslatedString.objects.filter(id=translation_id).first()
    if not translation or translation.status == TranslatedString.Status.COMPLETED:
        return

    try:
        result = translate_text(
            text=translation.source_text,
            target_language=translation.target_language,
            source_language=source_language or translation.source_language,
        )
    except Exception as exc:  # pragma: no cover - logging in production
        translation.mark_failed(str(exc))
        return

    with transaction.atomic():
        translation.source_language = result.source_language
        translation.translated_text = result.translated_text
        translation.provider = result.provider
        translation.status = TranslatedString.Status.COMPLETED
        translation.last_error = ''
        translation.save(update_fields=['source_language', 'translated_text', 'provider', 'status', 'last_error', 'updated_at'])
