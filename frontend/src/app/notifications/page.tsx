'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { notificationsAPI } from '@/lib/api';
import { Notification } from '@/types/notifications';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, Bell, MailOpen } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar'; // Import the Navbar component
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth(); // Destructure user from useAuth

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await notificationsAPI.getNotifications();
      if (Array.isArray(response.data)) {
        setNotifications(response.data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      showToast('Failed to load notifications', 'error');
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsAPI.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
      showToast('Notification marked as read', 'success');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      showToast('Failed to mark notification as read', 'error');
    } finally {
      // Re-fetch or update local state
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      showToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      showToast('Failed to mark all notifications as read', 'error');
    } finally {
      fetchNotifications();
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading notifications...</p>
        </div>
      </ProtectedRoute>
    );
  }

  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4"> */}
        <Navbar /> {/* Added Navbar here */}
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl p-8 mt-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              {unreadNotificationsCount > 0 && (
                <span className="ml-3 px-3 py-1 bg-pink-500 text-white text-sm font-semibold rounded-full">
                  {unreadNotificationsCount} Unread
                </span>
              )}
            </div>
            {notifications.length > 0 && unreadNotificationsCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition-colors"
              >
                <MailOpen size={18} className="mr-2" /> Mark All as Read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Bell size={48} className="mx-auto mb-4" />
              <p className="text-xl">No new notifications!</p>
              <p className="mt-2">You're all caught up. Check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`flex items-start p-4 rounded-lg shadow-sm ${notification.is_read ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800 border border-pink-200'}`}
                >
                  <div className="flex-shrink-0 mr-4 mt-1">
                    <Bell size={20} className={`${notification.is_read ? 'text-gray-400' : 'text-pink-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{notification.message}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(notification.created_at).toLocaleString(user?.profile?.preferred_language || 'en', {
                          hour: 'numeric',
                          minute: 'numeric',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                      })}{' '}
                      {notification.sender && `from ${notification.sender.username}`}
                    </p>
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="mt-2 text-sm text-blue-500 hover:underline"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
