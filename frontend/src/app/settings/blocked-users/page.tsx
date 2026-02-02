'use client';

import React, { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import Navbar from '@/components/Navbar';
import { interactionsAPI } from '@/lib/api';
import { User } from '@/types/auth'; // Assuming User type is available
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, UserX, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface BlockedUser {
  id: number;
  blocked_user: User;
  created_at: string;
}

export default function BlockedUsersPage() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedUsers = async () => {
    setIsLoading(true);
    try {
      const response = await interactionsAPI.getBlocks();
      // Handle paginated response - blocks are in response.data.results
      setBlockedUsers(response.data.results || response.data);
    } catch (err: any) {
      console.error('Error fetching blocked users:', err);
      setError(err.response?.data?.detail || 'Failed to load blocked users.');
      showToast(err.response?.data?.detail || 'Failed to load blocked users.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (blockId: number) => {
    if (window.confirm('Are you sure you want to unblock this user?')) {
      try {
        await interactionsAPI.unblockUser(blockId);
        setBlockedUsers(prevBlockedUsers => prevBlockedUsers.filter(block => block.id !== blockId));
        showToast('User unblocked successfully!', 'success');
      } catch (err: any) {
        console.error('Error unblocking user:', err);
        showToast(err.response?.data?.detail || 'Failed to unblock user.', 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading blocked users...</p>
        </div>
      </AdminProtectedRoute>
    );
  }

  if (error) {
    return (
      <AdminProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 text-red-600">
          <p>Error: {error}</p>
        </div>
      </AdminProtectedRoute>
    );
  }

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
        <Navbar />
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center mb-8">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Blocked Users</h1>
          </div>

          {(!Array.isArray(blockedUsers) || blockedUsers.length === 0) ? (
            <div className="text-center text-gray-500 py-8">
              <UserX size={48} className="mx-auto mb-4" />
              <p className="text-xl">No users blocked.</p>
              <p className="mt-2">You haven't blocked any users yet. All clear!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blockedUsers.map((block) => (
                <div key={block.id} className="flex items-center justify-between bg-gray-50 rounded-lg shadow-sm p-4 border border-gray-200">
                  <div className="flex items-center">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden mr-4 border border-gray-300">
                      {block.blocked_user.profile?.primary_photo?.image ? (
                        <Image
                          src={block.blocked_user.profile.primary_photo.image}
                          alt={block.blocked_user.username}
                          layout="fill"
                          objectFit="cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600">
                          <UserIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{block.blocked_user.full_name || block.blocked_user.username}</p>
                      <p className="text-sm text-gray-500">Blocked on: {new Date(block.created_at).toLocaleDateString(user?.profile?.preferred_language || 'en')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(block.id)}
                    className="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors flex items-center text-sm"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminProtectedRoute>
  );
}

