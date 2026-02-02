'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { chatAPI, interactionsAPI } from '@/lib/api';
import { Match } from '@/types/interactions';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, MessageCircle, User as UserIcon, XCircle, Crown } from 'lucide-react'; // Added XCircle for unmatch button
import Link from 'next/link';
import Image from 'next/image';

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      setIsLoading(true);
      try {
        const response = await interactionsAPI.getMatches();
        setMatches(response.data);
      } catch (err: any) {
        console.error('Error fetching matches:', err);
        setError(err.response?.data?.detail || 'Failed to load matches.');
        showToast(err.response?.data?.detail || 'Failed to load matches.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const handleUnmatch = async (matchId: number) => {
    if (window.confirm('Are you sure you want to unmatch? This action cannot be undone.')) {
      try {
        await interactionsAPI.unmatch(matchId);
        setMatches(prevMatches => prevMatches.filter(match => match.id !== matchId));
        showToast('Unmatched successfully!', 'success');
      } catch (err: any) {
        console.error('Error unmatching:', err);
        showToast(err.response?.data?.detail || 'Failed to unmatch.', 'error');
      }
    }
  };

  const handleStartChat = async (matchId: number) => {
    try {
      const response = await chatAPI.createConversation(matchId);
      // Redirect to messages page with the conversation
      window.location.href = `/messages?conversationId=${response.data.id}`;
    } catch (err: any) {
      console.error('Error starting chat:', err);
      if (err.response?.status === 403) {
        showToast('Chat is a premium feature. Upgrade to start conversations!', 'error');
      } else {
        showToast(err.response?.data?.error || 'Failed to start chat.', 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading matches...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 text-red-600">
          <p>Error: {error}</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
        <Navbar />
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center mb-8">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Your Matches</h1>
          </div>

          {!user?.profile?.is_premium && matches.length > 0 && (
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Unlock Chat Features</h3>
                  <p className="text-gray-700">Start conversations with your matches by upgrading to premium.</p>
                </div>
                <Link
                  href="/billing"
                  className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors font-semibold"
                >
                  Upgrade Now
                </Link>
              </div>
            </div>
          )}

          {matches.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <UserIcon size={48} className="mx-auto mb-4" />
              <p className="text-xl">No matches yet!</p>
              <p className="mt-2">Start swiping on the Discover page to find new connections.</p>
              <Link href="/discover" className="mt-4 px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
                Go to Discover
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => {
                const matchedUser = match.user1.id === user?.id ? match.user2 : match.user1;
                const profilePhoto = matchedUser.profile?.primary_photo?.image;

                return (
                  <div key={match.id} className="bg-gray-50 rounded-lg shadow-md p-6 border border-gray-200 flex flex-col items-center text-center">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-pink-500">
                      {profilePhoto ? (
                        <Image
                          src={profilePhoto}
                          alt={matchedUser.username}
                          layout="fill"
                          objectFit="cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600">
                          <UserIcon size={40} />
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{matchedUser.full_name || matchedUser.username}</h3>
                    <p className="text-sm text-gray-600">Matched on: {new Date(match.created_at).toLocaleDateString(user?.profile?.preferred_language || 'en')}</p>
                    <div className="flex space-x-2 mt-4">
                      {user?.profile?.is_premium ? (
                        <button
                          onClick={() => handleStartChat(match.id)}
                          className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors flex items-center"
                        >
                          <MessageCircle size={18} className="mr-2" /> Chat
                        </button>
                      ) : (
                        <Link
                          href="/billing"
                          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-md hover:from-pink-600 hover:to-purple-700 transition-colors flex items-center text-center"
                        >
                          <Crown size={18} className="mr-2" /> Upgrade to Chat
                        </Link>
                      )}
                      <button
                        onClick={() => handleUnmatch(match.id)}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors flex items-center"
                      >
                        <XCircle size={18} className="mr-2" /> Unmatch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
