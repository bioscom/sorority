'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Heart, X, Sparkles, MapPin, Flag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profilesAPI, interactionsAPI } from '@/lib/api';
import { ProfileListItem, ProfileValueEntry } from '@/types/profiles';
import { showToast } from '@/utils/toastUtils';

interface DiscoverFeedProps {
  embedded?: boolean;
}

type GroupedProfiles = Record<string, ProfileListItem[]>;

const extractValueLabel = (value?: ProfileValueEntry | null): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value.value === 'string') {
    const trimmed = value.value.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  if (value.value && typeof value.value === 'object') {
    const nested = value.value as Record<string, string | undefined>;
    const nestedLabel = nested.name || nested.label || nested.value;
    if (typeof nestedLabel === 'string') {
      const trimmed = nestedLabel.trim();
      if (trimmed.length) {
        return trimmed;
      }
    }
  }

  if (typeof value.label === 'string') {
    const trimmed = value.label.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  if (typeof value.name === 'string') {
    const trimmed = value.name.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  return null;
};

const DiscoverFeed: React.FC<DiscoverFeedProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyStateMessage, setEmptyStateMessage] = useState<string>('');

  const localeLabel = useMemo(() => {
    const profile = user?.profile;
    return profile?.state_province || profile?.location || profile?.country || 'your area';
  }, [user?.profile]);

  const normalizeLocale = useCallback((value?: string | null) => {
    return value ? value.toLowerCase().trim() : '';
  }, []);

  const filterProfilesByLocale = useCallback(
    (data: ProfileListItem[]) => {
      const profile = user?.profile;
      if (!profile) {
        return data;
      }

      const targetCountry = normalizeLocale(profile.country);
      const targetLocation = normalizeLocale(profile.location);

      if (!targetCountry && !targetLocation) {
        return data;
      }

      return data.filter((candidate) => {
        const candidateCountry = normalizeLocale(candidate.country);
        const candidateLocation = normalizeLocale(candidate.location);

        if (targetCountry && candidateCountry && candidateCountry === targetCountry) {
          return true;
        }

        if (targetLocation && candidateLocation) {
          return (
            candidateLocation.includes(targetLocation) ||
            targetLocation.includes(candidateLocation)
          );
        }

        return false;
      });
    },
    [normalizeLocale, user?.profile]
  );

  const buildLocationParamSets = useCallback(() => {
    const profile = user?.profile;
    const sets: Record<string, any>[] = [];

    if (profile?.country) {
      if (profile?.state_province) {
        sets.push({ country: profile.country, state_province: profile.state_province });
      }
      if (profile?.location) {
        sets.push({ country: profile.country, location: profile.location });
      }
      sets.push({ country: profile.country });
    }

    sets.push({});
    return sets;
  }, [user?.profile]);

  const fetchLocalProfiles = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      const PAGE_LIMIT = 40;
      const locationSets = buildLocationParamSets();
      let localizedData: ProfileListItem[] = [];

      for (const params of locationSets) {
        const aggregated: ProfileListItem[] = [];
        let page = 1;
        let hasNext = true;

        while (hasNext && page <= PAGE_LIMIT) {
          const response = await profilesAPI.getProfiles({ ...params, page, page_size: 50 });
          const payload = response.data;
          const pageProfiles: ProfileListItem[] = Array.isArray(payload)
            ? (payload as ProfileListItem[])
            : Array.isArray(payload?.results)
              ? (payload.results as ProfileListItem[])
              : [];

          aggregated.push(...pageProfiles);
          hasNext = Boolean(payload?.next);
          page += 1;
        }

        localizedData = filterProfilesByLocale(aggregated);
        if (localizedData.length > 0) {
          break;
        }
      }

      setProfiles(localizedData);
      if (localizedData.length === 0) {
        setEmptyStateMessage(`No profiles found in ${localeLabel}. Check back soon or adjust your profile preferences.`);
      } else {
        setEmptyStateMessage('');
      }
    } catch (err: any) {
      console.error('Error fetching local profiles:', err);
      const message = err.response?.data?.detail || 'Failed to load local profiles.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, buildLocationParamSets, filterProfilesByLocale, localeLabel]);

  useEffect(() => {
    fetchLocalProfiles();
  }, [fetchLocalProfiles]);

  const handleSwipe = async (profile: ProfileListItem, action: 'like' | 'pass' | 'super_like') => {
    const swipedUserIdentifier = profile.slug || profile.user_id || profile.id;
    try {
      await interactionsAPI.swipe({
        swiped_user: swipedUserIdentifier,
        action,
      });
      const actionLabel = action === 'like' ? 'Liked' : action === 'super_like' ? 'Super Liked' : 'Passed';
      showToast(`${actionLabel} ${profile.full_name}!`, 'success');
      setProfiles((prev) => prev.filter((candidate) => candidate.id !== profile.id));
    } catch (err: any) {
      console.error('Error swiping:', err);
      showToast(err.response?.data?.detail || `Failed to ${action} profile.`, 'error');
    }
  };

  const handleReportUser = async (profile: ProfileListItem) => {
    const reportedUserId = profile.user_id ?? profile.id;
    if (!window.confirm('Are you sure you want to report this user? Please report only genuine violations.')) {
      return;
    }

    try {
      await interactionsAPI.reportUser({
        reported_user: reportedUserId,
        reason: 'Violation of community guidelines',
      });
      showToast('User reported successfully. We will investigate.', 'success');
      setProfiles((prev) => prev.filter((candidate) => candidate.id !== profile.id));
    } catch (err: any) {
      console.error('Error reporting user:', err);
      showToast(err.response?.data?.detail || 'Failed to report user.', 'error');
    }
  };

  const groupedProfiles = useMemo<GroupedProfiles>(() => {
    return profiles.reduce((acc, profile) => {
      const lookingKey = profile.looking_for || 'Unspecified';
      if (!acc[lookingKey]) {
        acc[lookingKey] = [];
      }
      acc[lookingKey].push(profile);
      return acc;
    }, {} as GroupedProfiles);
  }, [profiles]);

  const getUniqueProfileCount = (profilesForGroup: ProfileListItem[]) => {
    const ids = new Set<number>();
    profilesForGroup.forEach((profile) => ids.add(profile.id));
    return ids.size;
  };

  const renderProfileCard = (profile: ProfileListItem) => (
    <div key={profile.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative h-48">
        {profile.primary_photo?.image ? (
          <Image
            src={profile.primary_photo.image}
            alt={`${profile.full_name}'s profile`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
            No Photo
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{profile.full_name}</h3>
          <p className="text-sm text-gray-500 mb-2">{profile.current_age} yrs • {profile.gender}</p>
          <p className="text-gray-600 text-sm flex items-center">
            <MapPin className="h-4 w-4 mr-1 text-pink-500" />
            {profile.location || 'Location not set'}
          </p>
        </div>
        {(profile.values?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(profile.values ?? []).slice(0, 4).map((value, index) => {
              const label = extractValueLabel(value);
              if (!label) {
                return null;
              }
              const valueId = typeof value === 'string' ? undefined : value?.id;
              return (
                <span key={`${profile.id}-${label}-${valueId ?? index}`} className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs">
                  {label}
                </span>
              );
            })}
            {(profile.values?.length ?? 0) > 4 && (
              <span className="text-xs text-gray-500">+{(profile.values?.length ?? 0) - 4} more</span>
            )}
          </div>
        )}
        <p className="mt-3 text-sm text-gray-700 line-clamp-3 flex-1">{profile.bio}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => handleSwipe(profile, 'pass')}
            className="flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 py-2"
          >
            <X className="h-4 w-4 mr-1" /> Pass
          </button>
          <button
            type="button"
            onClick={() => handleSwipe(profile, 'like')}
            className="flex items-center justify-center rounded-lg bg-green-100 text-green-700 hover:bg-green-200 py-2"
          >
            <Heart className="h-4 w-4 mr-1" /> Like
          </button>
          <button
            type="button"
            onClick={() => handleSwipe(profile, 'super_like')}
            className="flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 py-2"
          >
            <Sparkles className="h-4 w-4 mr-1" /> Super Like
          </button>
          <button
            type="button"
            onClick={() => handleReportUser(profile)}
            className="flex items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 py-2"
          >
            <Flag className="h-4 w-4 mr-1" /> Report
          </button>
        </div>
      </div>
    </div>
  );

  const baseStateClasses = embedded ? 'min-h-[300px]' : 'min-h-[50vh]';

  if (!user) {
    return (
      <div className={`flex justify-center items-center ${baseStateClasses} text-lg text-gray-600`}>
        Please log in to discover profiles.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center ${baseStateClasses} text-lg text-gray-600`}>
        Loading profiles...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center ${baseStateClasses} text-red-600`}>
        <p className="mb-4 text-center">Error: {error}</p>
        <button
          onClick={fetchLocalProfiles}
          className="px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center ${baseStateClasses} text-gray-700 text-center`}>
        <p className="text-xl font-semibold">{emptyStateMessage || 'No new profiles to discover right now.'}</p>
        <p className="mt-2">We'll notify you when new people in {localeLabel} join.</p>
        <button
          onClick={fetchLocalProfiles}
          className="mt-4 px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  const lookingEntries = Object.entries(groupedProfiles);

  return (
    <div className={`flex flex-col ${embedded ? '' : 'min-h-[60vh]'}`}>
      {/* <div className={`${embedded ? 'mb-4' : 'mb-8 text-center'}`}>
        {!embedded && (
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            Connections near {localeLabel}
          </h1>
        )}
        <p className={`text-sm text-gray-600 ${embedded ? '' : 'mt-2'}`}>
          Grouped by relationship goals so you can focus on what matters most.
        </p>
      </div> */}

      <div className="space-y-8">
        {lookingEntries.map(([lookingKey, profilesForGoal]) => (
          <section key={lookingKey} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-semibold text-gray-900">Looking for: {lookingKey}</h4>
              <span className="text-sm text-gray-500">
                {getUniqueProfileCount(profilesForGoal)} matches
              </span>
            </div>
            <div className={`grid gap-4 ${embedded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 max-w-[1100px] mx-auto'}`}>
              {profilesForGoal.map((profile) => renderProfileCard(profile))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default DiscoverFeed;
