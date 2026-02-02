from __future__ import annotations

from typing import Optional, Tuple

from django.db import transaction

from .models import TranslatedString, compute_checksum
from .tasks import translate_pending_string


def normalize_language_code(language: Optional[str]) -> Optional[str]:
    if not language:
        return None
    return language.lower().replace('_', '-').split('-')[0]


def ensure_translation(
    *,
    key: str,
    source_text: str,
    target_language: str,
    source_language: Optional[str] = None,
) -> Tuple[Optional[TranslatedString], bool]:
    """Return cached translation if it exists, otherwise queue a job.

    Returns a tuple `(translation_or_none, queued)` where `queued` indicates
    whether a background task was enqueued during this call.
    """

    cleaned_text = source_text or ''
    if not cleaned_text.strip():
        return None, False

    checksum = compute_checksum(cleaned_text)
    target_language = normalize_language_code(target_language) or 'en'
    normalized_source = normalize_language_code(source_language)

    translation = TranslatedString.objects.filter(
        key=key,
        target_language=target_language,
        checksum=checksum,
        status=TranslatedString.Status.COMPLETED,
    ).first()
    if translation:
        return translation, False

    with transaction.atomic():
        entry, created = TranslatedString.objects.get_or_create(
            key=key,
            target_language=target_language,
            checksum=checksum,
            defaults={
                'source_text': cleaned_text,
                'source_language': normalized_source or 'auto',
                'status': TranslatedString.Status.PENDING,
            },
        )

    if created:
        translate_pending_string.delay(entry.id, normalized_source)
        return None, True

    if entry.status == TranslatedString.Status.PENDING:
        return None, False

    if entry.status == TranslatedString.Status.FAILED:
        translate_pending_string.delay(entry.id, normalized_source)
        return None, True

    return entry, False


def get_cached_translations(*, keys: list[str], target_language: str) -> dict[str, Optional[str]]:
    target_language = normalize_language_code(target_language) or 'en'
    qs = TranslatedString.objects.filter(
        key__in=keys,
        target_language=target_language,
        status=TranslatedString.Status.COMPLETED,
    )
    return {item.key: item.translated_text for item in qs}
