'use client';

import { useCallback, useState, ChangeEvent } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profilesAPI } from '@/lib/api';
import { showToast } from '@/utils/toastUtils';
import { useTranslation } from '@/contexts/TranslationContext';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'tr', label: 'Turkish' },
  { code: 'id', label: 'Indonesian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'pl', label: 'Polish' },
  { code: 'vi', label: 'Vietnamese' },
];

const LanguageSelector = () => {
  const { user, refreshUser } = useAuth();
  const { language, setLanguage } = useTranslation();
  const [isSavingPreference, setIsSavingPreference] = useState(false);

  const persistPreference = useCallback(
    async (languageCode: string) => {
      const profileIdentifier = user?.profile?.slug || user?.profile?.id;
      if (!profileIdentifier) {
        showToast('Complete your profile before setting a preferred language.', 'error');
        return;
      }

      try {
        setIsSavingPreference(true);
        await profilesAPI.updateProfile(profileIdentifier, { preferred_language: languageCode });
        await refreshUser();
        showToast('Language preference saved.', 'success');
      } catch (error) {
        console.error('Failed to persist language preference', error);
        showToast('Unable to save language preference right now.', 'error');
      } finally {
        setIsSavingPreference(false);
      }
    },
    [refreshUser, user?.profile?.id]
  );

  const handleLanguageChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    await persistPreference(nextLanguage);
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Globe size={18} className="text-gray-500" aria-hidden="true" />
      <select
        value={language}
        onChange={handleLanguageChange}
        disabled={isSavingPreference}
        className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
      {isSavingPreference && <Loader2 size={16} className="text-gray-400 animate-spin" aria-label="Saving language preference" />}
    </div>
  );
};

export default LanguageSelector;
