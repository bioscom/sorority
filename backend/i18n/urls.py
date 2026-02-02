from django.urls import path

from .views import TranslationBatchView, TranslationLookupView, TranslatedStringAdminView

urlpatterns = [
    path('translations/batch/', TranslationBatchView.as_view(), name='translation-batch'),
    path('translations/', TranslationLookupView.as_view(), name='translation-lookup'),
    path('translations/admin-preview/', TranslatedStringAdminView.as_view(), name='translation-admin-preview'),
]
