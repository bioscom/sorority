'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { interactionsAPI } from '@/lib/api';
import { UserGift } from '@/types/interactions';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, Gift, User } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image'; // Import Next.js Image component
import Navbar from '@/components/Navbar'; // Import the Navbar component

export default function ReceivedGiftsPage() {
  const [receivedGifts, setReceivedGifts] = useState<UserGift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchReceivedGifts = async () => {
      try {
        const response = await interactionsAPI.getReceivedGifts();
        if (Array.isArray(response.data)) {
          setReceivedGifts(response.data);
        } else {
          setReceivedGifts([]);
        }
      } catch (error) {
        console.error('Error fetching received gifts:', error);
        showToast('Failed to load received gifts', 'error');
        setReceivedGifts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceivedGifts();
  }, []);

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading received gifts...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Received Gifts</h1>
          </div>

          {receivedGifts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Gift size={48} className="mx-auto mb-4" />
              <p className="text-xl">No gifts received yet!</p>
              <p className="mt-2">Keep interacting with others, and gifts might come your way.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {receivedGifts.map((userGift) => (
                <div key={userGift.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-center mb-4">
                    {userGift.gift.image ? (
                      <Image
                        src={userGift.gift.image}
                        alt={userGift.gift.name}
                        width={64} // Corresponds to w-16
                        height={64} // Corresponds to h-16
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Responsive sizes
                        className="object-contain mr-4"
                      />
                    ) : (
                      <Image
                        src="/images/placeholder-gift.png" // Updated placeholder path
                        alt="Placeholder Gift"
                        width={64}
                        height={64}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Responsive sizes
                        className="object-contain mr-4"
                      />
                    )}
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{userGift.gift.name}</p>
                      <p className="text-sm text-gray-600">From: {userGift.sender.username}</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-4">"{userGift.gift.description}"</p>
                  <p className="text-xs text-gray-500">Received on: {new Date(userGift.sent_at).toLocaleString(user?.profile?.preferred_language || 'en', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric'
                  })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
