'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MapPin, Heart, MessageCircle, Flag, Star, LogIn, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { profilesAPI, interactionsAPI, chatAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastUtils';
import Navbar from '@/components/Navbar';

const isDev = process.env.NODE_ENV !== 'production';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/?api\/?$/, '') || '';
const DEFAULT_DEV_MEDIA_BASE = isDev ? 'http://localhost:8000' : '';
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_URL || API_BASE_URL || DEFAULT_DEV_MEDIA_BASE;

type ProfileValueObject = {
  id?: number | null;
  value?: string | null;
  name?: string | null;
  label?: string | null;
};

type ProfileValueEntry = ProfileValueObject | string | number;

interface ProfileDetail {
  id: number;
  user: number | { id: number };
  slug: string;
  full_name: string;
  current_age: number;
  bio: string;
  location: string;
  country?: string;
  state_province?: string;
  gender: string;
  looking_for: string;
  relationship_status: string;
  values: ProfileValueEntry[];
  primary_photo: {
    image: string;
  } | null;
  photos: Array<{
    id: number;
    image: string;
    is_primary: boolean;
  }>;
  interests: Array<{
    interest: {
      name: string;
    };
  }>;
  completion_score: number;
  is_online: boolean;
  last_seen: string;
}

type UpgradeContext = 'chat' | 'like' | 'report';

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<UpgradeContext>('chat');
  const [hasMatch, setHasMatch] = useState(false);
  const [hasPendingLike, setHasPendingLike] = useState(false);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [availableValues, setAvailableValues] = useState<Array<{ id: number; name: string }>>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPendingMatchModal, setShowPendingMatchModal] = useState(false);
  const [pendingMatchName, setPendingMatchName] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const upgradeCopy: Record<UpgradeContext, { title: string; body: string; cta: string }> = {
    chat: {
      title: 'Premium Feature',
      body: 'Upgrade to premium to start chatting with other users and unlock the full messaging experience.',
      cta: 'Upgrade to chat',
    },
    like: {
      title: 'Subscribe to like profiles',
      body: 'Only premium members can send likes and respond to admirers instantly. Upgrade to let them know you are interested.',
      cta: 'Upgrade to like',
    },
    report: {
      title: 'Subscribe to report profiles',
      body: 'Help keep the community safe. Upgrade to premium to report profiles directly to our trust team.',
      cta: 'Upgrade to report',
    },
  };
  const upgradeModalCopy = upgradeCopy[upgradeContext];

  const slug = params.slug as string;

  const getValueLabel = (valueEntry: ProfileValueEntry): string => {
    if (typeof valueEntry === 'string') {
      return valueEntry;
    }

    if (typeof valueEntry === 'number') {
      const match = availableValues.find(v => v.id === valueEntry);
      return match?.name || valueEntry.toString();
    }

    if (valueEntry && typeof valueEntry === 'object') {
      const directLabel = valueEntry.value || valueEntry.name || valueEntry.label;
      if (directLabel) {
        return directLabel;
      }

      if (typeof valueEntry.id === 'number') {
        const match = availableValues.find(v => v.id === valueEntry.id);
        return match?.name || '';
      }
    }

    return '';
  };

  const getValueKey = (valueEntry: ProfileValueEntry, index: number) => {
    if (typeof valueEntry === 'number') {
      return `value-${valueEntry}`;
    }

    if (valueEntry && typeof valueEntry === 'object' && typeof valueEntry.id === 'number') {
      return `value-${valueEntry.id}`;
    }

    return `value-${index}`;
  };

  const allPhotos = useMemo(() => {
    return profile?.primary_photo
      ? [profile.primary_photo, ...(profile.photos?.filter(p => !p.is_primary) || [])]
      : profile?.photos || [];
  }, [profile]);

  const portraitPhotos = allPhotos.length ? allPhotos : ([{ id: -1, image: '' }] as typeof allPhotos);
  useEffect(() => {
    setActiveSlide(0);
  }, [portraitPhotos.length]);


  useEffect(() => {
    if (slug) {
      fetchProfile();
    }
  }, [slug]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await profilesAPI.getProfile(slug);
      setProfile(response.data);

      if (user) {
        const [matchFound] = await Promise.all([
          checkForMatchAfterProfileLoad(response.data),
          checkIfAlreadyLikedProfile(response.data)
        ]);
        if (matchFound) {
          setHasPendingLike(false);
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.response?.data?.detail || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const checkForMatchAfterProfileLoad = async (loadedProfile: ProfileDetail): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const matchResponse = await interactionsAPI.getMatches();
      const matches = matchResponse.data.results || matchResponse.data || [];
      const profileUserId = typeof loadedProfile.user === 'object' ? loadedProfile.user.id : loadedProfile.user;
      
      const existingMatch = matches.find((match: any) => 
        match.user1?.id === profileUserId || match.user2?.id === profileUserId
      );
      
      if (existingMatch) {
        console.log('Match exists with this user, match ID:', existingMatch.id);
        setHasMatch(true);
        setMatchId(existingMatch.id);
        setHasPendingLike(false);
        return true;
      } else {
        console.log('No match exists with this user yet');
        setHasMatch(false);
        setMatchId(null);
        return false;
      }
    } catch (err) {
      console.error('Error checking for match:', err);
      return false;
    }
  };

  const checkIfAlreadyLikedProfile = async (loadedProfile: ProfileDetail): Promise<boolean> => {
    if (!user) {
      setHasPendingLike(false);
      return false;
    }

    try {
      const historyResponse = await interactionsAPI.getSwipeHistory();
      const swipes = historyResponse.data.results || historyResponse.data || [];
      const profileUserId = typeof loadedProfile.user === 'object' ? loadedProfile.user.id : loadedProfile.user;

      const existingLike = swipes.find((swipe: any) => {
        const swipedUser = swipe.swiped_user?.id ?? swipe.swiped_user;
        return swipedUser === profileUserId && swipe.action === 'like';
      });

      const alreadyLiked = Boolean(existingLike);
      setHasPendingLike(alreadyLiked && !hasMatch);
      return alreadyLiked;
    } catch (err) {
      console.error('Error checking existing like:', err);
      setHasPendingLike(false);
      return false;
    }
  };

  const handlePrevSlide = () => {
    if (portraitPhotos.length <= 1) return;
    setActiveSlide(prev => (prev - 1 + portraitPhotos.length) % portraitPhotos.length);
  };

  const handleNextSlide = () => {
    if (portraitPhotos.length <= 1) return;
    setActiveSlide(prev => (prev + 1) % portraitPhotos.length);
  };

  const handleSelectSlide = (index: number) => {
    if (index < 0 || index >= portraitPhotos.length) return;
    setActiveSlide(index);
  };

  const handleLike = async () => {
    if (!profile) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!user.profile?.is_premium) {
      setUpgradeContext('like');
      setShowUpgradeModal(true);
      return;
    }

    if (hasPendingLike) {
      showToast(`You're already waiting for ${profile.full_name} to like you back.`, 'info');
      setPendingMatchName(profile.full_name);
      setShowPendingMatchModal(true);
      return;
    }

    setIsLiking(true);
    console.log('Like button clicked for profile:', profile.full_name);
    try {
      const swipedUserIdentifier = profile.slug || (typeof profile.user === 'object' ? profile.user.id : profile.user);
      const swipeResponse = await interactionsAPI.swipe({
        swiped_user: swipedUserIdentifier,
        action: 'like',
      });

      const isMatch = Boolean(swipeResponse.data?.is_match);
      const matchPayload = swipeResponse.data?.match;

      if (isMatch && matchPayload?.id) {
        setHasMatch(true);
        setMatchId(matchPayload.id);
        setHasPendingLike(false);
        showToast(`It's a match! You can now start chatting with ${profile.full_name}.`, 'success');
      } else {
        const matchFound = await checkForMatchAfterProfileLoad(profile);
        if (matchFound) {
          showToast(`It's a match! You can now start chatting with ${profile.full_name}.`, 'success');
        } else {
          showToast(`You liked ${profile.full_name}! If they like you back, you can start chatting.`, 'success');
          setPendingMatchName(profile.full_name);
          setShowPendingMatchModal(true);
          setHasPendingLike(true);
        }
      }
    } catch (err: any) {
      console.error('Error liking profile:', err);
      const message = err.response?.data?.detail || err.response?.data?.error || 'Failed to like profile';
      showToast(message, 'error');
    } finally {
      setIsLiking(false);
    }
  };

  const handleStartChat = async () => {
    if (!user || !profile || !matchId) {
      console.error('Cannot start chat: missing user, profile, or matchId');
      return;
    }

    // Check if user is a subscriber
    if (!user.profile?.is_premium) {
      setUpgradeContext('chat');
      setShowUpgradeModal(true);
      return;
    }

    setIsStartingChat(true);
    try {
      console.log('Starting chat for match ID:', matchId);
      
      // Check if conversation exists for this match
      const conversationResponse = await chatAPI.getConversations();
      const conversations = conversationResponse.data.results || conversationResponse.data || [];
      const conversation = conversations.find(
        (conv: any) => conv.match === matchId || conv.match?.id === matchId
      );

      if (conversation) {
        console.log('Found existing conversation, navigating to:', conversation.id);
        router.push(`/messages/${conversation.id}`);
      } else {
        // Create new conversation
        console.log('Creating new conversation for match ID:', matchId);
        const newConversation = await chatAPI.createConversation(matchId);
        console.log('Conversation created successfully:', newConversation.data.id);
        showToast(`Starting chat with ${profile.full_name}!`, 'success');
        router.push(`/messages/${newConversation.data.id}`);
      }
    } catch (err: any) {
      console.error('Error starting chat:', err);
      console.error('Error response:', err.response?.data);
      const message = err.response?.data?.detail || err.response?.data?.error || 'Failed to start chat';
      showToast(message, 'error');
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleReport = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    if (!user.profile?.is_premium) {
      setUpgradeContext('report');
      setShowUpgradeModal(true);
      return;
    }

    // TODO: Implement reporting functionality
    showToast('Report functionality coming soon', 'info');
  };

  const handleLoginRedirect = () => {
    const nextPath = encodeURIComponent(`/profiles/${slug}`);
    router.push(`/login?next=${nextPath}`);
  };

  useEffect(() => {
    // Fetch all available values for mapping IDs to names
    const fetchValues = async () => {
      try {
        const response = await profilesAPI.getValues();
        const values = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setAvailableValues(values);
      } catch (err) {
        setAvailableValues([]);
      }
    };
    fetchValues();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center py-20">
          <div className="text-lg text-gray-600">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">Error: {error || 'Profile not found'}</div>
            {/* <Link
              href="/discover"
              className="inline-flex items-center text-pink-600 hover:text-pink-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Discover
            </Link> */}
          </div>
        </div>
      </div>
    );
  }

  const locationDisplay = [profile.location, profile.state_province, profile.country]
    .filter(part => part && part.trim())
    .join(', ') || 'Location not set';
  const firstName = profile.full_name?.split(' ')[0] || profile.full_name;
  
  const ProfileDetailsCard = () => (
    // <div className="rounded-[32px] bg-white/95 p-8 text-gray-900 shadow-2xl backdrop-blur space-y-8">
    <div className="rounded-[32px] bg-white/95 p-8 text-gray-900 shadow-2xl backdrop-blur space-y-8 border border-gray-300/60">
      <div className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Profile</p>
          <h2 className="text-2xl font-semibold text-gray-900">Meet {firstName}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gender</span>
            <span className="text-base text-gray-900">{profile.gender}</span>
          </p>
          <p className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Looking for</span>
            <span className="text-base text-gray-900">{profile.looking_for}</span>
          </p>
          <p className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Relationship status</span>
            <span className="text-base text-gray-900">{profile.relationship_status}</span>
          </p>
          <p className="flex flex-col rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last seen</span>
            <span className="text-base text-gray-900">
              {profile.last_seen
                ? new Date(profile.last_seen).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Never'}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bio</h3>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm leading-relaxed text-gray-700">
          {profile.bio || 'No bio added yet.'}
        </div>
      </div>

      {profile.interests?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest, index) => (
              <span
                key={index}
                className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700"
              >
                {interest.interest.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.values && profile.values.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Values</h3>
          <div className="flex flex-wrap gap-2">
            {profile.values.map((valueEntry, index) => {
              const label = getValueLabel(valueEntry);
              if (!label) {
                return null;
              }
              return (
                <span
                  key={getValueKey(valueEntry, index)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Profile completion</p>
          <p className="text-3xl font-bold text-gray-900">{profile.completion_score}%</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
          <p className="text-lg font-semibold text-gray-900">
            {hasMatch ? 'Match confirmed' : hasPendingLike ? 'Awaiting match' : 'Ready to connect'}
          </p>
        </div>
      </div>

    </div>
  );

  const ActionIconButton = ({
    onClick,
    disabled,
    icon,
    label,
    description,
    intent = 'neutral',
  }: {
    onClick?: () => void;
    disabled?: boolean;
    icon: ReactNode;
    label: string;
    description: string;
    intent?: 'primary' | 'success' | 'warning' | 'neutral';
  }) => {
    const baseStyles =
      'group relative flex h-16 w-16 items-center justify-center rounded-3xl border text-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-400';
    const intentStyles: Record<string, string> = {
      primary: 'border-pink-200 bg-white text-pink-600 hover:bg-pink-50 disabled:bg-gray-100 disabled:text-gray-400',
      success: 'border-green-200 bg-white text-green-600 hover:bg-green-50 disabled:bg-gray-100 disabled:text-gray-400',
      warning: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
      neutral: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400',
    };

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`${baseStyles} ${intentStyles[intent]}`}
      >
        <span className="sr-only">{label}</span>
        {icon}
        <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-200 group-hover:-translate-y-[calc(100%+6px)] group-hover:opacity-100">
          {description}
        </span>
      </button>
    );
  };

  const ActionButtons = () => {
    const primaryLabel = hasPendingLike
      ? 'Awaiting match…'
      : isLiking
        ? 'Sending your like…'
        : 'Send a like';
    const chatLabel = isStartingChat ? 'Opening chat…' : 'Start chatting';

    const actions = [
      hasMatch
        ? {
            key: 'chat',
            icon: <MessageCircle className="h-7 w-7" />,
            label: 'Start chat',
            description: chatLabel,
            onClick: handleStartChat,
            disabled: isStartingChat,
            intent: 'success' as const,
          }
        : {
            key: 'like',
            icon: <Heart className="h-7 w-7" />,
            label: 'Send like',
            description: primaryLabel,
            onClick: handleLike,
            disabled: isLiking || hasPendingLike,
            intent: 'primary' as const,
          },
      {
        key: 'report',
        icon: <Flag className="h-7 w-7" />,
        label: 'Report profile',
        description: 'Report profile',
        onClick: handleReport,
        intent: 'warning' as const,
      },
    ];

    return (
      <div className="flex items-center justify-center gap-4">
        {actions.map(action => (
          <ActionIconButton key={action.key} {...action} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />

      <div className="max-w-2xl mx-auto px-3 py-6 lg:py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm leading-tight text-black/70">
          {/* <Link
            href="/discover"
            className="inline-flex items-center gap-2 font-medium tracking-wide uppercase text-xs text-black/70 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Discover
          </Link> */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasPendingLike && !hasMatch && (
              <span className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-black/10 px-3 py-1 text-xs font-semibold text-black">
                <Heart className="h-3.5 w-3.5 text-pink-300" />
                Awaiting their response
              </span>
            )}
            {/* <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                profile.is_online
                  ? 'bg-green-500/20 text-green-200'
                  : 'bg-black/10 text-black/70'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${profile.is_online ? 'bg-green-300' : 'bg-black/40'}`} />
              {profile.is_online ? 'Online now' : 'Recently active'}
            </span> */}
          </div>
        </div>

        <div className="space-y-8">
          <div className="relative">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-neutral-900 shadow-2xl">
              <div
                className="flex transition-transform duration-700 ease-out"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {portraitPhotos.map((photo, index) => {
                  const chips = [profile.gender, profile.looking_for, profile.relationship_status].filter(Boolean);
                  if (!hasMatch && hasPendingLike) {
                    chips.push('Awaiting match');
                  }
                  const key = `photo-${photo?.id ?? index}-${index}`;
                  return (
                    <div key={key} className="relative aspect-[2/3] w-full min-w-full flex-shrink-0 bg-neutral-900">
                      {photo?.image ? (
                        <Image
                          src={photo.image}
                          alt={`${profile.full_name} photo ${index + 1}`}
                          fill
                          unoptimized={isDev}
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 60vw"
                          priority={index === 0}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-white/60">
                          No photo available
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/30 to-black/80" />
                      <div className="absolute top-5 left-5 right-5 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/70">
                        <span>{profile.current_age} yrs</span>
                      </div>
                      {index === 0 ? (
                        <div className="absolute bottom-36 left-6 right-6 space-y-4">
                          <div className="flex flex-wrap items-baseline gap-3">
                            <h1 className="text-4xl font-semibold leading-tight text-white">{profile.full_name}</h1>
                            <p className="text-base text-white/80">{profile.current_age} yrs</p>

                            <div className="flex items-center gap-2 flex-wrap">
                              {hasPendingLike && !hasMatch && (
                                <span className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-black/10 px-3 py-1 text-xs font-semibold text-black">
                                  <Heart className="h-3.5 w-3.5 text-pink-300" />
                                  Awaiting their response
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                  profile.is_online
                                    ? 'bg-green-500/20 text-green-200'
                                    : 'bg-black/10 text-white/70'
                                }`}
                              >
                                <div className={`h-2 w-2 rounded-full ${profile.is_online ? 'bg-green-300' : 'bg-white/40'}`} />
                                {profile.is_online ? 'Online now' : 'Recently active'}
                              </span>
                            </div>
                          </div>
                          <p className="flex items-center gap-2 text-sm font-medium text-white">
                            <MapPin className="h-4 w-4" />
                            {locationDisplay}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {chips.map((chip, chipIndex) => (
                              <span
                                key={`${chip}-${chipIndex}`}
                                className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="absolute bottom-32 left-4 right-4 space-y-1 text-white">
                          <p className="text-lg font-semibold">{profile.full_name}</p>
                          <p className="text-xs text-white/80">{profile.looking_for}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {portraitPhotos.length > 1 && (
              <>
                <button
                  onClick={handlePrevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
                  aria-label="View previous photo"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
                  aria-label="View next photo"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute inset-x-0 bottom-36 z-10 flex justify-center gap-2">
                  {portraitPhotos.map((_, index) => (
                    <button
                      key={`dot-${index}`}
                      onClick={() => handleSelectSlide(index)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        index === activeSlide ? 'bg-white' : 'bg-white/40'
                      }`}
                      aria-label={`Go to photo ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
              <div className="pointer-events-auto">
                <ActionButtons />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setShowDetails(prev => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              aria-expanded={showDetails}
              aria-controls="profile-details-panel"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide profile details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show profile details
                </>
              )}
            </button>
          </div>

          <div
            id="profile-details-panel"
            className={`transition-all duration-500 ease-out ${
              showDetails ? 'max-h-[4000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <ProfileDetailsCard />
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <LogIn className="h-12 w-12 text-pink-600 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Login Required</h3>
                <p className="text-gray-600">
                  You need to log in before you can like profiles or connect with other members.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    handleLoginRedirect();
                  }}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors"
                >
                  Login Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <Star className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">{upgradeModalCopy.title}</h3>
                <p className="text-gray-600">{upgradeModalCopy.body}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowUpgradeModal(false);
                    router.push('/billing');
                  }}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors"
                >
                  {upgradeModalCopy.cta}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Match Modal */}
      {showPendingMatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <Heart className="h-12 w-12 text-pink-600 mx-auto mb-2" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Like Sent!</h3>
                <p className="text-gray-600">
                  You just liked {pendingMatchName || 'this member'}. Hang tight while they review your profile—once they like you back, we’ll let you know so you can start a perfect match.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPendingMatchModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Keep Browsing
                </button>
                <button
                  onClick={() => setShowPendingMatchModal(false)}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
