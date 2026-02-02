from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TranslatedString
from .serializers import TranslationBatchSerializer, TranslatedStringSerializer
from .services import ensure_translation, get_cached_translations


class TranslationBatchView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TranslationBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_language = serializer.validated_data['target_language']
        payload = []

        for string in serializer.validated_data['strings']:
            key = string['key']
            text = string['text']
            source_language = string.get('source_language')

            translation, queued = ensure_translation(
                key=key,
                source_text=text,
                target_language=target_language,
                source_language=source_language,
            )

            payload.append(
                {
                    'key': key,
                    'target_language': target_language,
                    'status': translation.status if translation else 'pending',
                    'translated_text': translation.translated_text if translation else None,
                    'queued': queued,
                }
            )

        return Response({'results': payload}, status=status.HTTP_200_OK)


class TranslationLookupView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        keys = request.query_params.getlist('keys') or request.query_params.get('keys', '').split(',')
        keys = [key.strip() for key in keys if key]
        target_language = request.query_params.get('target_language')

        if not keys or not target_language:
            return Response({'error': 'keys and target_language are required'}, status=status.HTTP_400_BAD_REQUEST)

        results = get_cached_translations(keys=keys, target_language=target_language)
        return Response({'results': results}, status=status.HTTP_200_OK)


class TranslatedStringAdminView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        queryset = TranslatedString.objects.all().order_by('-updated_at')[:200]
        serializer = TranslatedStringSerializer(queryset, many=True)
        return Response(serializer.data)