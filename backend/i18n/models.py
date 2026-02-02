from __future__ import annotations

import hashlib
from django.db import models
from django.utils.translation import gettext_lazy as _


def compute_checksum(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


class TranslatedString(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')

    key = models.CharField(max_length=255, db_index=True)
    source_text = models.TextField()
    source_language = models.CharField(max_length=16)
    target_language = models.CharField(max_length=16, db_index=True)
    translated_text = models.TextField(blank=True)
    provider = models.CharField(max_length=64, blank=True)
    checksum = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('key', 'target_language', 'checksum')
        indexes = [
            models.Index(fields=('key', 'target_language', 'checksum')),
            models.Index(fields=('status', 'target_language')),
        ]

    def __str__(self):
        return f"{self.key} [{self.source_language}->{self.target_language}]"

    def mark_failed(self, error_message: str) -> None:
        self.status = self.Status.FAILED
        self.last_error = error_message[:1000]
        self.save(update_fields=['status', 'last_error', 'updated_at'])
