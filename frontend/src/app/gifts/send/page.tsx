'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { interactionsAPI, profilesAPI } from '@/lib/api';
import { Gift as GiftType, ProfileListItem } from '@/types/profiles';
import { Match } from '@/types/interactions';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, Gift, Coins } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image'; // Import Next.js Image component
import Navbar from '@/components/Navbar'; 
// Import the Navbar component

export default function SendGiftPage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [availableGifts, setAvailableGifts] = useState<GiftType[]>([]);
  const [recipientMatches, setRecipientMatches] = useState<Match[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [selectedGift, setSelectedGift] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userVirtualCurrency, setUserVirtualCurrency] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch available gifts
        const giftsResponse = await interactionsAPI.getGifts();
        if (Array.isArray(giftsResponse.data)) {
          setAvailableGifts(giftsResponse.data);
        } else {
          setAvailableGifts([]);
        }

        // Fetch matches to select a recipient
        const matchesResponse = await interactionsAPI.getMatches();
        if (Array.isArray(matchesResponse.data)) {
          setRecipientMatches(matchesResponse.data);
        } else {
          setRecipientMatches([]);
        }

        // Get user's virtual currency from their profile
        if (user?.profile?.virtual_currency !== undefined) {
          setUserVirtualCurrency(user.profile.virtual_currency);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load gift page data', 'error');
        setAvailableGifts([]);
        setRecipientMatches([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSendGift = async () => {
    if (selectedRecipient === null || selectedGift === null) {
      showToast('Please select a recipient and a gift', 'warn');
      return;
    }

    const giftToSend = availableGifts.find(gift => gift.id === selectedGift);
    if (!giftToSend || userVirtualCurrency < giftToSend.cost) {
      showToast('Insufficient virtual currency or invalid gift', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await interactionsAPI.sendGift({ recipient_user: selectedRecipient, gift_id: selectedGift });
      showToast('Gift sent successfully!', 'success');

      // Refresh user's virtual currency
      if (user?.profile?.id) {
        const updatedProfileResponse = await profilesAPI.getProfile(user.profile.id);
        setUserVirtualCurrency(updatedProfileResponse.data.virtual_currency);
        updateUser({ profile: updatedProfileResponse.data }); // Only update the profile part of the user
      }
      router.push('/dashboard'); // Redirect after sending gift
    } catch (error: any) {
      console.error('Error sending gift:', error);
      showToast(error.response?.data?.detail || 'Failed to send gift', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4"> */}
        <Navbar /> {/* Added Navbar here */}
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl p-8 mt-4">
          <div className="flex items-center mb-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Send a Gift</h1>
          </div>

          <div className="mb-6 flex items-center text-lg font-medium text-gray-700">
            <Coins className="h-6 w-6 text-yellow-500 mr-2" />
            Your Virtual Currency: <span className="ml-1 font-bold text-yellow-600">{userVirtualCurrency}</span>
          </div>

          <div className="space-y-6">
            {/* Recipient Selection */}
            <div>
              <label className="block text-lg font-semibold text-gray-800 mb-2">Select Recipient</label>
              <select
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                value={selectedRecipient || ''}
                onChange={(e) => setSelectedRecipient(Number(e.target.value))}
              >
                <option value="" disabled>Choose a match...</option>
                {recipientMatches.map((match) => (
                  <option key={match.id} value={match.user1.id === user?.id ? match.user2.id : match.user1.id}>
                    {match.user1.id === user?.id ? match.user2.username : match.user1.username}
                  </option>
                ))}
              </select>
              {recipientMatches.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">No matches available. Make some matches first!</p>
              )}
            </div>

            {/* Gift Selection */}
            <div>
              <label className="block text-lg font-semibold text-gray-800 mb-2">Select Gift</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableGifts.map((gift) => (
                  <div
                    key={gift.id}
                    className={`cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${selectedGift === gift.id ? 'border-pink-500 ring-2 ring-pink-300' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setSelectedGift(gift.id)}
                  >
                    <Image 
                      src={gift.image || '/images/placeholder-gift.png'} 
                      alt={gift.name} 
                      width={64} 
                      height={64} 
                      className="w-16 h-16 mx-auto mb-2 object-contain" 
                    />
                    <p className="font-medium text-gray-900">{gift.name}</p>
                    <p className="text-sm text-gray-600">Cost: {gift.cost} <Coins className="h-4 w-4 inline-block text-yellow-500" /></p>
                    {userVirtualCurrency < gift.cost && (
                      <p className="text-xs text-red-500 mt-1">Insufficient funds</p>
                    )}
                  </div>
                ))}
                {availableGifts.length === 0 && (
                  <p className="text-sm text-gray-500">No gifts available.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={handleSendGift}
                disabled={isLoading || selectedRecipient === null || selectedGift === null || userVirtualCurrency < (availableGifts.find(g => g.id === selectedGift)?.cost || 0)}
                className="px-8 py-3 bg-pink-600 text-white font-semibold rounded-lg shadow-md hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  'Sending...'
                ) : (
                  <><Gift size={20} className="mr-2" /> Send Gift</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
