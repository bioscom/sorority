from rest_framework import serializers

from .models import TranslatedString


class TranslationRequestSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=255)
    text = serializers.CharField()
    source_language = serializers.CharField(max_length=16, required=False, allow_blank=True)


class TranslationBatchSerializer(serializers.Serializer):
    target_language = serializers.CharField(max_length=16)
    strings = TranslationRequestSerializer(many=True)


class TranslatedStringSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranslatedString
        fields = (
            'id',
            'key',
            'source_text',
            'source_language',
            'target_language',
            'translated_text',
            'status',
            'provider',
            'last_error',
            'updated_at',
        )
        read_only_fields = fields
