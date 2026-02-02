'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Heart, User, Gift, MessageSquare, Moon, Sun, Crown, ChevronDown, Settings, LogOut, UserCircle, Blocks } from 'lucide-react';
import { notificationsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Gauge, BarChart3, Home, Compass } from "lucide-react";
import LanguageSelector from '@/components/LanguageSelector';

const Navbar = React.memo(() => {
  const { user, logout } = useAuth();
  const { translate } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false); // Placeholder for dark mode
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isGiftsDropdownOpen, setIsGiftsDropdownOpen] = useState(false);

  // Get user's primary photo
  const getPrimaryPhoto = () => {
    if (!user?.profile?.photos) return null;
    return user.profile.photos.find((photo: any) => photo.is_primary) || user.profile.photos[0];
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (isProfileDropdownOpen && !target.closest('.profile-dropdown')) {
        setIsProfileDropdownOpen(false);
      }

      if (isGiftsDropdownOpen && !target.closest('.gifts-dropdown')) {
        setIsGiftsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen, isGiftsDropdownOpen]);

  // Don't poll on pages where it might interfere with form submissions
  const shouldPoll = !['/profile-setup', '/register', '/login'].includes(pathname);

  const fetchUnreadNotificationsCount = useCallback(async () => {
    if (!user || document.hidden || !shouldPoll) return; // Skip if page is not visible or on sensitive pages
    
    try {
      const response = await notificationsAPI.getNotifications();
      if (Array.isArray(response.data)) {
        const unread = response.data.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      setUnreadCount(0);
    }
  }, [user, shouldPoll]);

  useEffect(() => {
    if (user) {
      fetchUnreadNotificationsCount();
      // Reduce polling frequency to every 2 minutes to minimize re-renders
      const interval = setInterval(fetchUnreadNotificationsCount, 120000);
      
      // Pause polling when page is not visible
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchUnreadNotificationsCount();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, fetchUnreadNotificationsCount]);

  return (
    <nav className="bg-white shadow-md p-4 sticky top-0 z-50">
      <div className="w-full flex justify-between items-center px-6">
        <Link href="/" className="text-2xl font-bold text-pink-600">
          Sorority<span className="text-red-500">❤️</span>
        </Link>


        <div className="flex items-center space-x-6">
          {user && (
            <Link href="/explore" className="relative text-gray-600 hover:text-pink-600 transition-colors flex items-center">
              <Compass size={24} />
              <span className="ml-1 hidden sm:inline">{translate('nav.explore', 'Explore')}</span>
            </Link>
          )}

          {user && (
            <Link href="/dashboard" className="relative text-gray-600 hover:text-pink-600 transition-colors flex items-center">
              <BarChart3 size={24} />
              <span className="ml-1 hidden sm:inline">{translate('nav.dashboard', 'Dashboard')}</span>
            </Link>
          )}
          
          {user && (
            <Link href="/discover" className="relative text-gray-600 hover:text-pink-600 transition-colors flex items-center">
              <Heart size={24} />
              <span className="ml-1 hidden sm:inline">{translate('nav.discover', 'Discover')}</span>
            </Link>
          )}

          {user && (
            <Link href="/messages" className="relative text-gray-600 hover:text-pink-600 transition-colors flex items-center">
              <MessageSquare size={24} />
              <span className="ml-1 hidden sm:inline">{translate('nav.messages', 'Messages')}</span>
            </Link>
          )}

          {user && (
            <div className="relative gifts-dropdown">
              <button
                type="button"
                onClick={() => setIsGiftsDropdownOpen(!isGiftsDropdownOpen)}
                className="flex items-center text-gray-600 hover:text-pink-600 transition-colors focus:outline-none"
                aria-haspopup="true"
                aria-expanded={isGiftsDropdownOpen}
              >
                <Gift size={24} />
                <span className="ml-1 hidden sm:inline">{translate('nav.gifts', 'Gifts')}</span>
                <ChevronDown size={16} className={`ml-1 transform transition-transform ${isGiftsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isGiftsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <Link
                    href="/gifts/send"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsGiftsDropdownOpen(false)}
                  >
                    <Gift size={16} className="mr-2" />
                    {translate('nav.sendGift', 'Send Gift')}
                  </Link>
                  <Link
                    href="/gifts/received"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsGiftsDropdownOpen(false)}
                  >
                    <Gift size={16} className="mr-2" />
                    {translate('nav.receivedGifts', 'Received Gifts')}
                  </Link>
                </div>
              )}
            </div>
          )}

          {user && (
            <Link href="/notifications" className="relative text-gray-600 hover:text-pink-600 transition-colors flex items-center">
              <Bell size={24} />
              <span className="ml-1 hidden sm:inline">{translate('nav.notifications', 'Notifications')}</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* User Profile Dropdown */}
          {user && (
            <div className="relative profile-dropdown">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2 text-gray-600 hover:text-pink-600 transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-pink-200">
                  {getPrimaryPhoto() ? (
                    <img
                      src={getPrimaryPhoto()?.image}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <UserCircle size={20} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <ChevronDown size={16} className={`transform transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>

                  <Link
                    href="/profile-setup"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  >
                    <User size={16} className="mr-2" />
                    {translate('nav.myProfile', 'My Profile')}
                  </Link>

                  <Link
                    href="/settings/account"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  >
                    <Settings size={16} className="mr-2" />
                    {translate('nav.account', 'Account')}
                  </Link>

                  <Link
                    href="/settings/billing"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  >
                    <Crown size={16} className="mr-2" />
                    {user?.profile?.is_premium
                      ? translate('nav.subscription', 'Subscription')
                      : translate('nav.billing', 'Billing')}
                  </Link>

                  {(user?.is_staff || user?.is_superuser) && (
                    <Link
                      href="/settings/blocked-users"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Blocks size={16} className="mr-2" />
                      {translate('nav.blockedUsers', 'Blocked Users')}
                    </Link>
                  )}

                  <div className="border-t border-gray-200 my-1"></div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut size={16} className="mr-2" />
                    {translate('nav.signOut', 'Sign Out')}
                  </button>
                </div>
              )}
            </div>
          )}

          <LanguageSelector />

          {!user?.profile?.is_premium && (
            <Link href="/billing" className="relative text-yellow-600 hover:text-yellow-700 transition-colors flex items-center bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text">
              <Crown size={24} />
              <span className="ml-1 hidden sm:inline font-semibold">{translate('nav.upgrade', 'Upgrade')}</span>
            </Link>
          )}

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="text-gray-600 hover:text-pink-600 transition-colors flex items-center"
            title="Toggle dark mode (coming soon)"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;

