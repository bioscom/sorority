'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Heart, MessageCircle, Users, Settings, ShieldCheck, Crown, MapPin, Compass } from 'lucide-react';
import { profilesAPI, billingAPI, interactionsAPI, chatAPI } from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { showToast } from '@/utils/toastUtils';
import Image from 'next/image';
import DiscoverFeed from '@/components/DiscoverFeed';

const isDev = process.env.NODE_ENV !== 'production';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/?api\/?$/, '') || '';
const DEFAULT_DEV_MEDIA_BASE = isDev ? 'http://localhost:8000' : '';
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_URL || API_BASE_URL || DEFAULT_DEV_MEDIA_BASE;

const resolveMediaUrl = (src?: string | null): string | null => {
  if (!src) {
    return null;
  }

  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  const base = MEDIA_BASE_URL.replace(/\/+$/, '');
  const path = src.startsWith('/') ? src : `/${src}`;
  return `${base}${path}`;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) {
    console.warn('formatDate received null/undefined:', dateString);
    return 'Unknown date';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Invalid date';
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid date';
  }
};

interface DashboardStats {
  new_matches_count: number;
  unread_messages_count: number;
  likes_received_count: number;
}

interface UserSubscription {
  id: number;
  plan: {
    id: number;
    name: string;
    description: string;
    price: number;
    currency?: string;
    duration_days: number;
    features: string[];
  };
  start_date: string;
  end_date: string;
  is_active: boolean;
  cancel_at_period_end: boolean;
}

interface Match {
  id: number;
  user1: any;
  user2: any;
  created_at: string;
}

interface SwipeHistory {
  id: number;
  swiper: any;
  swiped_user: any;
  action: string;
  created_at: string;
}

interface Conversation {
  id: number;
  match: {
    id: number;
    user1: any;
    user2: any;
  };
  last_message?: {
    content: string;
    created_at: string;
  };
  unread_count: number;
}

type ViewType = 'matches' | 'messages' | 'likes' | 'discover';

const filterLikesAgainstMatches = (
  incoming: SwipeHistory[] = [],
  matches: Match[] = [],
  currentUserId?: number
): SwipeHistory[] => {
  if (!incoming.length) {
    return [];
  }

  const matchedUserIds = new Set<number>();

  if (currentUserId) {
    matches.forEach((match) => {
      const otherUser = match.user1.id === currentUserId ? match.user2 : match.user1;
      const otherUserId = otherUser?.id;

      if (otherUserId) {
        matchedUserIds.add(otherUserId);
      }
    });
  }

  return incoming.filter((like) => {
    const likerId = like?.swiper?.id;
    if (!likerId) {
      return false;
    }
    return !matchedUserIds.has(likerId);
  });
};

export default function DashboardPage() {
  const { user, resendVerificationEmail } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [selectedView, setSelectedView] = useState<ViewType>('matches');
  const [likeBackLoadingId, setLikeBackLoadingId] = useState<number | null>(null);
  const [chatLoadingMatchId, setChatLoadingMatchId] = useState<number | null>(null);
  const [showLikeBackUpgradeModal, setShowLikeBackUpgradeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data for each view
  const [matches, setMatches] = useState<Match[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [likes, setLikes] = useState<SwipeHistory[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const userAvatarSrc = resolveMediaUrl(user?.profile?.primary_photo?.image);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return; // Don't fetch if user is not authenticated

      try {
        setLoading(true);
        const [statsResponse, subscriptionResponse, matchesResponse, conversationsResponse, likesResponse] = await Promise.all([
          profilesAPI.getDashboardStats(),
          billingAPI.getMySubscription().catch(() => null), // Don't fail if subscription fetch fails
          interactionsAPI.getMatches(),
          chatAPI.getConversations(),
          interactionsAPI.getLikesReceived(),
        ]);
        setStats(statsResponse.data);
        setSubscription(subscriptionResponse?.data || null);
        const matchesData = matchesResponse.data.results || matchesResponse.data || [];
        setMatches(matchesData);
        setConversations(conversationsResponse.data.results || conversationsResponse.data || []);
        const likesData = likesResponse.data.results || likesResponse.data || [];
        setLikes(filterLikesAgainstMatches(likesData, matchesData, user?.id ?? undefined));
        setError(null); // Clear any previous errors
      } catch (err: any) {
        console.error('Failed to fetch dashboard stats:', err);

        // Check if it's an authentication error
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Session expired. Redirecting to login...');
          // Clear tokens and redirect to login
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          router.push('/login');
          return;
        } else {
          // Set default stats on other errors
          setStats({
            new_matches_count: 0,
            unread_messages_count: 0,
            likes_received_count: 0,
          });
          setSubscription(null);
          setError('Unable to load latest stats. Showing defaults.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Fetch data based on selected view
  useEffect(() => {
    if (!user) return;
    if (selectedView === 'discover') {
      setLoadingData(false);
      return;
    }

    const fetchViewData = async () => {
      setLoadingData(true);
      try {
        switch (selectedView) {
          case 'matches':
            const matchesResponse = await interactionsAPI.getMatches();
            setMatches(matchesResponse.data.results || matchesResponse.data || []);
            break;
          case 'messages':
            const conversationsResponse = await chatAPI.getConversations();
            setConversations(conversationsResponse.data.results || conversationsResponse.data || []);
            break;
          case 'likes':
            const likesResponse = await interactionsAPI.getLikesReceived();
            setLikes(filterLikesAgainstMatches(likesResponse.data.results || likesResponse.data || []));
            break;
        }
      } catch (err: any) {
        console.error(`Failed to fetch ${selectedView}:`, err);
        showToast(`Failed to load ${selectedView}`, 'error');
      } finally {
        setLoadingData(false);
      }
    };

    fetchViewData();
  }, [selectedView, user]);

  useEffect(() => {
    setLikes((prev) => {
      if (!prev.length) return prev;
      const filtered = filterLikesAgainstMatches(prev, matches, user?.id ?? undefined);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [matches, user?.id]);

  // const handleLikeBack = async (likerIdentifier: number | string, likeId: number) => {
  //   try {
  //     setLikeBackLoadingId(likeId);
  //     const swipeResponse = await interactionsAPI.swipe({
  //       swiped_user: likerIdentifier,
  //       action: 'like',
  //     });

  //     showToast('Matched! 🎉', 'success');
  //     setLikes((prev) => prev.filter((like) => like.id !== likeId));

  //     const matchData = swipeResponse.data?.match as Match | undefined;
  //     const matched = Boolean(matchData);

  //     setStats((prev) => {
  //       if (!prev) return prev;
  //       return {
  //         ...prev,
  //         likes_received_count: Math.max((prev.likes_received_count || 0) - 1, 0),
  //         new_matches_count: matched ? (prev.new_matches_count || 0) + 1 : prev.new_matches_count,
  //       };
  //     });

  //     if (matchData) {
  //       setMatches((prev) => {
  //         const withoutDupes = prev.filter((match) => match.id !== matchData.id);
  //         return [matchData, ...withoutDupes];
  //       });
  //       setSelectedView('matches');
  //     } else {
  //       try {
  //         const matchesResponse = await interactionsAPI.getMatches();
  //         setMatches(matchesResponse.data.results || matchesResponse.data || []);
  //       } catch (innerErr) {
  //         console.error('Failed to refresh matches after like back:', innerErr);
  //       } finally {
  //         setSelectedView('matches');
  //       }
  //     }
  //   } catch (err: any) {
  //     console.error('Failed to like back:', err);
  //     const message = err.response?.data?.detail || err.response?.data?.error || 'Failed to like back';
  //     showToast(message, 'error');
  //   } finally {
  //     setLikeBackLoadingId(null);
  //   }
  // };


  const handleLikeBack = async (likerIdentifier: number | string, likeId: number) => {
    if (!user?.profile?.is_premium) {
      setShowLikeBackUpgradeModal(true);
      return;
    }

    try {
      setLikeBackLoadingId(likeId);

      const swipeResponse = await interactionsAPI.swipe({
        swiped_user: likerIdentifier,
        action: 'like',
      });

      const matchData = swipeResponse?.data?.match ?? null;
      const matched = Boolean(matchData);

      showToast(matched ? 'Matched! 🎉' : 'Liked back ❤️', 'success');

      setLikes((prev) => prev.filter((like) => like.id !== likeId));

      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          likes_received_count: Math.max((prev.likes_received_count || 0) - 1, 0),
          new_matches_count: matched
            ? (prev.new_matches_count || 0) + 1
            : prev.new_matches_count,
        };
      });

      if (matchData) {
        setMatches((prev) => [matchData, ...prev.filter((m) => m.id !== matchData.id)]);
      } else {
        try {
          const matchesResponse = await interactionsAPI.getMatches();
          setMatches(matchesResponse.data.results || matchesResponse.data || []);
        } catch (e) {
          console.error('Failed to refresh matches:', e);
        }
      }

      setSelectedView('matches');
    } catch (err: any) {
      console.error('Failed to like back:', err);
      showToast(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Failed to like back',
        'error'
      );
    } finally {
      setLikeBackLoadingId(null);
    }
  };

  const handleStartChatFromMatch = async (match: Match) => {
    if (!user) return;

    if (!user.profile?.is_premium) {
      showToast('Upgrade to premium to chat with your matches.', 'info');
      router.push('/billing');
      return;
    }

    setChatLoadingMatchId(match.id);
    try {
      const existingConversation = conversations.find(
        (conversation) => conversation.match?.id === match.id || conversation.match === match.id
      );

      if (existingConversation) {
        router.push(`/messages/${existingConversation.id}`);
        return;
      }

      const newConversationResponse = await chatAPI.createConversation(match.id);
      const newConversation = newConversationResponse.data;
      setConversations((prev) => [newConversation, ...prev]);
      router.push(`/messages/${newConversation.id}`);
    } catch (err: any) {
      console.error('Failed to start chat for match:', err);
      const message = err.response?.data?.detail || err.response?.data?.error || 'Failed to start chat';
      showToast(message, 'error');
    } finally {
      setChatLoadingMatchId(null);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email || user.is_verified) return;
    try {
      setIsResending(true);
      await resendVerificationEmail(user.email);
      showToast('Verification email sent. Please check your inbox.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Unable to resend verification email', 'error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <ProtectedRoute>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navbar />
        
          <div className="md:hidden p-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white shadow-sm"
            >
              ☰
            </button>
          </div>

        {/* Verification Banner */}
        {!user?.is_verified && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-amber-900">Verify your email</h3>
                <p className="text-sm text-amber-800">
                  We sent a verification link to {user?.email}. Please verify to unlock all features.
                </p>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {isResending ? 'Sending…' : 'Resend email'}
              </button>
            </div>
          </div>
        )}

        {/* Two Column Layout 
        <div className="flex flex-1 overflow-hidden">*/}
        <div className="flex flex-1 overflow-y-auto md:overflow-hidden flex-col md:flex-row">
          {/* Left Sidebar - Navigation 
          <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          <div className="hidden md:w-2/5 lg:w-[360px] xl:w-[400px] bg-white border-r border-gray-200 flex flex-col shrink-0">*/}
          <div className={`
              fixed inset-y-0 left-0 z-50
              w-[80%] max-w-[360px]
              bg-white border-r border-gray-200
              transform transition-transform duration-300 ease-in-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
              md:relative md:translate-x-0 md:flex
              md:w-2/5 lg:w-[360px] xl:w-[400px]
              flex flex-col shrink-0
            `}>

            

            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  {userAvatarSrc ? (
                    <Image
                      src={userAvatarSrc}
                      alt={user.first_name}
                      width={64}
                      height={64}
                      className="rounded-full object-cover"
                      unoptimized={isDev}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-pink-200 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-pink-700">
                        {user?.first_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    {/* <p className="text-xs uppercase tracking-wide text-gray-500">You</p> */}
                    <p className="text-lg font-semibold text-gray-900">{user?.first_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Link
                    href="/profile-setup"
                    title="Edit Profile"
                    aria-label="Edit Profile"
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-pink-600 text-white hover:bg-pink-700 transition shadow-md"
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    title="Start Browsing"
                    aria-label="Start Browsing"
                    onClick={() => setSelectedView('discover')}
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-pink-600 text-pink-600 hover:bg-pink-50 transition shadow-sm"
                  >
                    <Compass className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Navigation */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setSelectedView('matches')}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    selectedView === 'matches'
                      ? 'bg-pink-50 border-2 border-pink-500'
                      : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-pink-100 p-3 rounded-full">
                        <Users className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">New Matches</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {matches.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedView('messages')}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    selectedView === 'messages'
                      ? 'bg-pink-50 border-2 border-pink-500'
                      : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-pink-100 p-3 rounded-full">
                        <MessageCircle className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Messages</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {conversations.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedView('likes')}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    selectedView === 'likes'
                      ? 'bg-pink-50 border-2 border-pink-500'
                      : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-pink-100 p-3 rounded-full">
                        <Heart className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-600">Likes Received</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {likes.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Subscription Card */}
                <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-200">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-full ${user?.profile?.is_premium ? 'bg-yellow-200' : 'bg-white'}`}>
                      <Crown className={`h-5 w-5 ${user?.profile?.is_premium ? 'text-yellow-600' : 'text-gray-600'}`} />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-600">Subscription</p>
                      {subscription && subscription.plan && user?.profile?.is_premium ? (
                        <div>
                          <p className="text-lg font-bold text-gray-900">{subscription.plan.name}</p>
                          <p className="text-xs text-gray-500">
                            {subscription.is_active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg font-bold text-gray-900">Free Plan</p>
                          <Link href="/billing" className="text-xs text-pink-600 hover:underline font-medium">
                            Upgrade Now →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

           {/* Overlay */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
          )}

          {/* Right Content Area 
          <div className="w-2/3 flex flex-col bg-gray-50">*/}
          <div className="flex-1 bg-gray-50 flex flex-col overflow-y-auto">
            {/* Content Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedView === 'matches' && 'Your Matches'}
                {selectedView === 'messages' && 'Your Conversations'}
                {selectedView === 'likes' && 'People Who Liked You'}
                {selectedView === 'discover' && 'Discover New Connections'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedView === 'matches' && 'Connect with people who matched with you'}
                {selectedView === 'messages' && 'Continue your conversations'}
                {selectedView === 'likes' && 'See who is interested in you'}
                {selectedView === 'discover' && 'Browse recommended profiles without leaving your dashboard'}
              </p>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedView === 'discover' ? (
                <DiscoverFeed embedded />
              ) : loadingData ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <>
                  {selectedView === 'matches' && (
                    <div>
                      {matches.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500 mb-4">No matches yet</p>
                          <button
                            type="button"
                            onClick={() => setSelectedView('discover')}
                            className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                          >
                            Start Discovering
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {matches.map((match) => {
                            const otherUser = match.user1.id === user?.id ? match.user2 : match.user1;
                            const otherUserPhoto = resolveMediaUrl(otherUser.profile?.primary_photo?.image);
                            return (
                              <div
                                key={match.id}
                                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                              >
                                {/* Profile Image */}
                                <div className="relative h-64 bg-gradient-to-br from-pink-100 to-purple-100">
                                  {otherUserPhoto ? (
                                    <Image
                                      src={otherUserPhoto}
                                      alt={otherUser.username}
                                      fill
                                      className="object-cover"
                                      unoptimized={isDev}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-6xl font-bold text-pink-300">
                                        {otherUser.username.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  {/* Match Badge */}
                                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full shadow-lg flex items-center">
                                    <Heart className="h-4 w-4 mr-1 fill-current" />
                                    <span className="text-xs font-semibold">Match!</span>
                                  </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-4">
                                  <h3 className="font-bold text-xl text-gray-900 mb-1">
                                    {otherUser.profile?.full_name || otherUser.username}
                                  </h3>
                                  {otherUser.profile?.current_age && (
                                    <p className="text-gray-600 text-sm mb-2">
                                      {otherUser.profile.current_age} years old
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-600 flex items-center mb-1">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    {otherUser.profile?.location || 'Location not set'}
                                  </p>
                                  <p className="text-xs text-gray-500 mb-4">
                                    Matched {formatDate(match.created_at)}
                                  </p>

                                  {/* Bio Preview */}
                                  {otherUser.profile?.bio && (
                                    <p className="text-sm text-gray-700 line-clamp-2 mb-4">
                                      {otherUser.profile.bio}
                                    </p>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex space-x-2">
                                    <Link
                                      href={`/profiles/${otherUser.profile?.slug || otherUser.id}`}
                                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center text-sm font-medium"
                                    >
                                      View Profile
                                    </Link>
                                    <button
                                      onClick={() => handleStartChatFromMatch(match)}
                                      disabled={chatLoadingMatchId === match.id}
                                      className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center text-sm font-medium ${
                                        chatLoadingMatchId === match.id
                                          ? 'bg-green-400 text-white cursor-not-allowed'
                                          : 'bg-green-600 text-white hover:bg-green-700'
                                      }`}
                                    >
                                      {chatLoadingMatchId === match.id ? (
                                        <span>Opening…</span>
                                      ) : (
                                        <>
                                          <MessageCircle className="h-4 w-4 mr-1" />
                                          Chat
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedView === 'messages' && (
                    <div className="space-y-4">
                      {conversations.length === 0 ? (
                        <div className="text-center py-12">
                          <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500 mb-4">No conversations yet</p>
                          <button
                            type="button"
                            onClick={() => setSelectedView('discover')}
                            className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                          >
                            Find Matches
                          </button>
                        </div>
                      ) : (
                        conversations.map((conversation) => {
                          const otherUser =
                            conversation.match.user1.id === user?.id
                              ? conversation.match.user2
                              : conversation.match.user1;
                          return (
                            <div
                              key={conversation.id}
                              onClick={() => router.push(`/messages/${conversation.id}`)}
                              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="w-16 h-16 bg-pink-200 rounded-full flex items-center justify-center">
                                    <span className="text-2xl font-bold text-pink-700">
                                      {otherUser.username.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-lg text-gray-900">
                                      {otherUser.username}
                                    </h3>
                                    {conversation.last_message && (
                                      <p className="text-sm text-gray-600 truncate max-w-md">
                                        {conversation.last_message.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {conversation.unread_count > 0 && (
                                  <span className="px-3 py-1 bg-pink-500 text-white text-xs font-semibold rounded-full">
                                    {conversation.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {selectedView === 'likes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {likes.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500 mb-4">No likes yet</p>
                          <button
                            type="button"
                            onClick={() => setSelectedView('discover')}
                            className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                          >
                            Start Browsing
                          </button>
                        </div>
                      ) : (
                        likes.map((like) => {
                          const liker = like.swiper;
                          const likerPhoto = resolveMediaUrl(liker.profile?.primary_photo?.image);
                          return (
                            <div
                              key={like.id}
                              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                            >
                              {/* Profile Image */}
                              <div className="relative h-64 bg-gradient-to-br from-pink-100 to-purple-100">
                                {likerPhoto ? (
                                  <Image
                                    src={likerPhoto}
                                    alt={liker.username}
                                    fill
                                    className="object-cover"
                                    unoptimized={isDev}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-6xl font-bold text-pink-300">
                                      {liker.username.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                {/* Like Badge */}
                                <div className="absolute top-4 right-4 bg-pink-500 text-white p-2 rounded-full shadow-lg">
                                  <Heart className="h-5 w-5 fill-current" />
                                </div>
                              </div>

                              {/* Card Content */}
                              <div className="p-4">
                                <h3 className="font-bold text-xl text-gray-900 mb-1">
                                  {liker.profile?.full_name || liker.username}
                                </h3>
                                {liker.profile?.current_age && (
                                  <p className="text-gray-600 text-sm mb-2">
                                    {liker.profile.current_age} years old
                                  </p>
                                )}
                                <p className="text-sm text-gray-600 flex items-center mb-1">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {liker.profile?.location || 'Location not set'}
                                </p>
                                <p className="text-xs text-gray-500 mb-4">
                                  Liked {formatDate(like.created_at)}
                                </p>

                                {/* Bio Preview */}
                                {liker.profile?.bio && (
                                  <p className="text-sm text-gray-700 line-clamp-2 mb-4">
                                    {liker.profile.bio}
                                  </p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex space-x-2">
                                  <Link
                                    href={`/profiles/${liker.profile?.slug || liker.id}`}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center text-sm font-medium"
                                  >
                                    View Profile
                                  </Link>
                                    <button
                                      onClick={() => handleLikeBack(liker.profile?.slug || liker.id, like.id)}
                                    disabled={likeBackLoadingId === like.id}
                                    className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center text-sm font-medium ${
                                      likeBackLoadingId === like.id
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-pink-600 text-white hover:bg-pink-700'
                                    }`}
                                  >
                                    {likeBackLoadingId === like.id ? (
                                      <span>Matching...</span>
                                    ) : (
                                      <>
                                        <Heart className="h-4 w-4 mr-1" />
                                        Like Back
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      
    </ProtectedRoute>

   

    {showLikeBackUpgradeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-pink-600">
              <Crown className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Subscribe to like back</h3>
            <p className="text-sm text-gray-600">
              Liking back is part of our premium experience. Upgrade now to match instantly with people
              who already liked you and unlock every connection feature.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowLikeBackUpgradeModal(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLikeBackUpgradeModal(false);
                  router.push('/billing');
                }}
                className="flex-1 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
              >
                See plans
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
