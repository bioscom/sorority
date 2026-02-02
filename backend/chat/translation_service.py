"""Translation utilities using MarianMT with Google fallback."""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Tuple

import torch
from langdetect import LangDetectException, detect
from google.api_core.exceptions import GoogleAPIError
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import translate_v2 as google_translate
from transformers import pipeline


logger = logging.getLogger(__name__)

DEFAULT_PIVOT_LANGUAGE = 'en'

LANGUAGE_ALIASES: Dict[str, str] = {
    'en-us': 'en',
    'en-gb': 'en',
    'es-es': 'es',
    'es-mx': 'es',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    'zh-cn': 'zh',
    'zh-tw': 'zh',
    'zh-hans': 'zh',
    'zh-hant': 'zh',
    'kr': 'ko',
    'jp': 'ja',
}

# Supported language pairs mapped to their MarianMT model names.
MODEL_NAME_MAP: Dict[Tuple[str, str], str] = {
    ('en', 'fr'): 'Helsinki-NLP/opus-mt-en-fr',
    ('fr', 'en'): 'Helsinki-NLP/opus-mt-fr-en',
    ('en', 'es'): 'Helsinki-NLP/opus-mt-en-es',
    ('es', 'en'): 'Helsinki-NLP/opus-mt-es-en',
    ('en', 'de'): 'Helsinki-NLP/opus-mt-en-de',
    ('de', 'en'): 'Helsinki-NLP/opus-mt-de-en',
    ('en', 'pt'): 'Helsinki-NLP/opus-mt-en-pt',
    ('pt', 'en'): 'Helsinki-NLP/opus-mt-pt-en',
    ('en', 'it'): 'Helsinki-NLP/opus-mt-en-it',
    ('it', 'en'): 'Helsinki-NLP/opus-mt-it-en',
    ('en', 'ru'): 'Helsinki-NLP/opus-mt-en-ru',
    ('ru', 'en'): 'Helsinki-NLP/opus-mt-ru-en',
    ('en', 'ja'): 'Helsinki-NLP/opus-mt-en-ja',
    ('ja', 'en'): 'Helsinki-NLP/opus-mt-ja-en',
    ('en', 'ko'): 'Helsinki-NLP/opus-mt-en-ko',
    ('ko', 'en'): 'Helsinki-NLP/opus-mt-ko-en',
    ('en', 'zh'): 'Helsinki-NLP/opus-mt-en-zh',
    ('zh', 'en'): 'Helsinki-NLP/opus-mt-zh-en',
    ('en', 'ar'): 'Helsinki-NLP/opus-mt-en-ar',
    ('ar', 'en'): 'Helsinki-NLP/opus-mt-ar-en',
    ('en', 'hi'): 'Helsinki-NLP/opus-mt-en-hi',
    ('hi', 'en'): 'Helsinki-NLP/opus-mt-hi-en',
    ('en', 'tr'): 'Helsinki-NLP/opus-mt-en-tr',
    ('tr', 'en'): 'Helsinki-NLP/opus-mt-tr-en',
    ('en', 'id'): 'Helsinki-NLP/opus-mt-en-id',
    ('id', 'en'): 'Helsinki-NLP/opus-mt-id-en',
    ('en', 'nl'): 'Helsinki-NLP/opus-mt-en-nl',
    ('nl', 'en'): 'Helsinki-NLP/opus-mt-nl-en',
    ('en', 'sv'): 'Helsinki-NLP/opus-mt-en-sv',
    ('sv', 'en'): 'Helsinki-NLP/opus-mt-sv-en',
    ('en', 'pl'): 'Helsinki-NLP/opus-mt-en-pl',
    ('pl', 'en'): 'Helsinki-NLP/opus-mt-pl-en',
    ('en', 'vi'): 'Helsinki-NLP/opus-mt-en-vi',
    ('vi', 'en'): 'Helsinki-NLP/opus-mt-vi-en',
}

SUPPORTED_LANGUAGES = {DEFAULT_PIVOT_LANGUAGE}
for source, target in MODEL_NAME_MAP.keys():
    SUPPORTED_LANGUAGES.add(source)
    SUPPORTED_LANGUAGES.add(target)


@dataclass(frozen=True)
class TranslationResult:
    translated_text: str
    source_language: str
    target_language: str
    provider: str = 'huggingface-marian'


def normalize_language_code(language: str | None) -> str | None:
    if not language:
        return None
    code = language.lower().replace('_', '-').strip()
    simplified = LANGUAGE_ALIASES.get(code)
    if simplified:
        return simplified
    return code.split('-')[0]


def detect_language(text: str) -> str:
    try:
        detected = detect(text)
        normalized = normalize_language_code(detected)
        if normalized and normalized in SUPPORTED_LANGUAGES:
            return normalized
        return DEFAULT_PIVOT_LANGUAGE
    except LangDetectException:
        return DEFAULT_PIVOT_LANGUAGE


@lru_cache(maxsize=len(MODEL_NAME_MAP) + 4)
def get_translator(model_name: str):
    device = 0 if torch.cuda.is_available() else -1
    return pipeline('translation', model=model_name, tokenizer=model_name, device=device)


@lru_cache(maxsize=1)
def get_google_translator():
    return google_translate.Client()


def _translate_with_model(text: str, source_language: str, target_language: str) -> str:
    model_name = MODEL_NAME_MAP.get((source_language, target_language))
    if not model_name:
        if source_language != DEFAULT_PIVOT_LANGUAGE and target_language != DEFAULT_PIVOT_LANGUAGE:
            intermediate = _translate_with_model(text, source_language, DEFAULT_PIVOT_LANGUAGE)
            return _translate_with_model(intermediate, DEFAULT_PIVOT_LANGUAGE, target_language)
        raise ValueError(f"Unsupported language pair: {source_language} -> {target_language}")

    translator = get_translator(model_name)
    outputs = translator(text, max_length=512)
    if not outputs:
        raise RuntimeError('Translation pipeline produced no output')
    return outputs[0]['translation_text']


def _translate_with_google(text: str, source_language: str, target_language: str) -> str:
    client = get_google_translator()
    try:
        response = client.translate(text, source_language=source_language, target_language=target_language, format_='text')
    except (GoogleAPIError, DefaultCredentialsError) as exc:
        raise RuntimeError('Google Translate fallback failed') from exc

    translated_text = response.get('translatedText') if isinstance(response, dict) else None
    if not translated_text:
        raise RuntimeError('Google Translate returned no output')
    return translated_text


def translate_text(text: str, target_language: str, source_language: str | None = None) -> TranslationResult:
    """Translate *text* into *target_language* using open-source MarianMT models."""

    if not text:
        raise ValueError('Text is required for translation')

    resolved_target = normalize_language_code(target_language)
    if not resolved_target:
        raise ValueError('target_language is required')

    resolved_source = normalize_language_code(source_language) or detect_language(text)

    if resolved_source == resolved_target:
        return TranslationResult(text, resolved_source, resolved_target)

    provider = 'huggingface-marian'
    try:
        translated = _translate_with_model(text, resolved_source, resolved_target)
    except Exception as marian_exc:  # pragma: no cover - fallback path
        logger.warning('MarianMT translation failed, falling back to Google: %s', marian_exc)
        translated = _translate_with_google(text, resolved_source, resolved_target)
        provider = 'google-translate'

    return TranslationResult(translated_text=translated, source_language=resolved_source, target_language=resolved_target, provider=provider)
