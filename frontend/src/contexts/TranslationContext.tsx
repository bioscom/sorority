'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { translationAPI } from '@/lib/api';
import { useAuth } from './AuthContext';

type TranslationRequest = {
  key: string;
  text: string;
  source_language?: string;
};

type QueuedRequest = TranslationRequest & {
  targetLanguage: string;
};

type TranslationContextValue = {
  language: string;
  setLanguage: (code: string) => void;
  translate: (key: string, fallback: string, options?: { sourceLanguage?: string }) => string;
  isTranslating: boolean;
};

const LANGUAGE_STORAGE_KEY = 'sorority_preferred_language';

const TranslationContext = createContext<TranslationContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  translate: (_key, fallback) => fallback,
  isTranslating: false,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const getInflightKey = (language: string, key: string) => `${language}::${key}`;

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [language, setLanguageState] = useState('en');
  const [translationStore, setTranslationStore] = useState<Record<string, Record<string, string>>>({});
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [activeBatches, setActiveBatches] = useState(0);
  const pendingRequestsRef = useRef<QueuedRequest[]>([]);
  const inflightKeysRef = useRef<Set<string>>(new Set());

  const persistLanguage = useCallback((next: string) => {
    const normalized = next || 'en';
    setLanguageState(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      document.documentElement.setAttribute('lang', normalized);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const profilePreference = user?.profile?.preferred_language;
    const initial = profilePreference || stored || 'en';
    persistLanguage(initial);
  }, [persistLanguage, user?.profile?.preferred_language]);

  const translations = useMemo(() => translationStore[language] || {}, [language, translationStore]);

  const updateTranslations = useCallback((targetLanguage: string, entries: Record<string, string>) => {
    setTranslationStore((prev) => ({
      ...prev,
      [targetLanguage]: { ...(prev[targetLanguage] || {}), ...entries },
    }));

    Object.keys(entries).forEach((entryKey) => {
      inflightKeysRef.current.delete(getInflightKey(targetLanguage, entryKey));
    });
  }, []);

  const pollForTranslations = useCallback(
    async (keys: string[], targetLanguage: string) => {
      let remaining = Array.from(new Set(keys));
      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts && remaining.length; attempt += 1) {
        try {
          const response = await translationAPI.lookup({ target_language: targetLanguage, keys: remaining });
          const results: Record<string, string | null> = response.data?.results || {};
          const resolved: Record<string, string> = {};

          remaining = remaining.filter((key) => {
            const value = results?.[key];
            if (typeof value === 'string' && value.trim().length) {
              resolved[key] = value;
              return false;
            }
            return true;
          });

          if (Object.keys(resolved).length) {
            updateTranslations(targetLanguage, resolved);
          }

          if (remaining.length) {
            await delay(1500);
          }
        } catch (error) {
          console.error('Translation lookup failed', error);
          break;
        }
      }
    },
    [updateTranslations]
  );

  const processBatch = useCallback(
    async (targetLanguage: string, requests: TranslationRequest[]) => {
      if (!requests.length || targetLanguage === 'en') {
        return;
      }

      setActiveBatches((count) => count + 1);
      try {
        await translationAPI.ensureBatch({ target_language: targetLanguage, strings: requests });
        const keys = requests.map((item) => item.key);
        await pollForTranslations(keys, targetLanguage);
      } catch (error) {
        console.error('Translation batch failed', error);
      } finally {
        setActiveBatches((count) => Math.max(0, count - 1));
      }
    },
    [pollForTranslations]
  );

  useEffect(() => {
    if (!pendingRequestsRef.current.length) {
      return;
    }

    const pending = pendingRequestsRef.current;
    pendingRequestsRef.current = [];

    setQueue((prev) => {
      const next = [...prev];
      pending.forEach((request) => {
        const exists = next.some(
          (item) =>
            item.key === request.key &&
            item.targetLanguage === request.targetLanguage &&
            item.text === request.text
        );
        if (!exists) {
          next.push(request);
        }
      });
      return next;
    });
  });

  useEffect(() => {
    if (!queue.length) {
      return;
    }

    const grouped = queue.reduce<Record<string, TranslationRequest[]>>((acc, item) => {
      if (item.targetLanguage === 'en') {
        return acc;
      }
      acc[item.targetLanguage] = acc[item.targetLanguage] || [];
      acc[item.targetLanguage].push({ key: item.key, text: item.text, source_language: item.source_language });
      return acc;
    }, {});

    setQueue([]);

    Object.entries(grouped).forEach(([targetLanguage, requests]) => {
      processBatch(targetLanguage, requests);
    });
  }, [processBatch, queue]);

  const setLanguage = useCallback(
    (code: string) => {
      console.log('[TranslationContext] setLanguage called with:', code);
      persistLanguage(code);
    },
    [persistLanguage]
  );

  const translate = useCallback(
    (key: string, fallback: string, options?: { sourceLanguage?: string }) => {
      if (!key) {
        return fallback;
      }
      const normalizedLanguage = language.toLowerCase();
      if (normalizedLanguage === 'en' || normalizedLanguage.startsWith('en-')) {
        return fallback;
      }

      const existing = translations[key];
      if (existing) {
        console.log('[TranslationContext] Found translation for', key, ':', existing);
        return existing;
      }

      const inflightKey = getInflightKey(language, key);
      if (inflightKeysRef.current.has(inflightKey)) {
        return fallback;
      }

      console.log('[TranslationContext] Queuing translation for', key, 'in language', language);
      inflightKeysRef.current.add(inflightKey);
      pendingRequestsRef.current.push({
        key,
        text: fallback,
        source_language: options?.sourceLanguage || 'en',
        targetLanguage: language,
      });

      return fallback;
    },
    [language, translations]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translate,
      isTranslating: activeBatches > 0,
    }),
    [activeBatches, language, setLanguage, translate]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export { LANGUAGE_STORAGE_KEY };
