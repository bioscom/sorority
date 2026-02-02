'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { showToast } from '@/utils/toastUtils';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { ArrowLeft, Key, Mail, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface ChangePasswordData {
  old_password: string;
  new_password: string;
  confirm_new_password: string;
}

interface UpdateEmailData {
  email: string;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const { register: registerPassword, handleSubmit: handleSubmitPassword, formState: { errors: errorsPassword }, reset: resetPassword, watch } = useForm<ChangePasswordData>();
  const { register: registerEmail, handleSubmit: handleSubmitEmail, formState: { errors: errorsEmail }, reset: resetEmail } = useForm<UpdateEmailData>();

  const handleChangePassword = async (data: ChangePasswordData) => {
    try {
      await authAPI.changePassword(data);
      showToast('Password updated successfully!', 'success');
      resetPassword();
    } catch (error: any) {
      showToast(error.response?.data?.old_password?.[0] || error.response?.data?.new_password?.[0] || error.response?.data?.non_field_errors?.[0] || 'Failed to change password', 'error');
    }
  };

  const handleUpdateEmail = async (data: UpdateEmailData) => {
    try {
      // Assuming updateProfile can handle email updates directly from the User model
      // If not, a dedicated backend endpoint for email update might be needed.
      await authAPI.updateProfile({ email: data.email });
      showToast('Email updated successfully!', 'success');
      resetEmail();
    } catch (error: any) {
      showToast(error.response?.data?.email?.[0] || error.response?.data?.non_field_errors?.[0] || 'Failed to update email', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await authAPI.deleteAccount();
        showToast('Account deleted successfully.', 'success');
        router.push('/login'); // Redirect to login page after deletion
      } catch (error: any) {
        showToast(error.response?.data?.error || 'Failed to delete account', 'error');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
        <Navbar />
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center mb-8">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          </div>

          {/* Change Password Form */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Key className="mr-2" size={20} /> Change Password
            </h2>
            <form onSubmit={handleSubmitPassword(handleChangePassword)} className="space-y-4">
              <div>
                <label htmlFor="old_password" className="block text-sm font-medium text-gray-700">Old Password</label>
                <input
                  type="password"
                  id="old_password"
                  {...registerPassword('old_password', { required: 'Old password is required' })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
                {errorsPassword.old_password && <p className="mt-1 text-sm text-red-600">{errorsPassword.old_password.message}</p>}
              </div>
              <div>
                <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  id="new_password"
                  {...registerPassword('new_password', {
                    required: 'New password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
                {errorsPassword.new_password && <p className="mt-1 text-sm text-red-600">{errorsPassword.new_password.message}</p>}
              </div>
              <div>
                <label htmlFor="confirm_new_password" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  id="confirm_new_password"
                  {...registerPassword('confirm_new_password', {
                    required: 'Confirm new password is required',
                    validate: (value) => value === watch('new_password') || 'Passwords do not match',
                  })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
                {errorsPassword.confirm_new_password && <p className="mt-1 text-sm text-red-600">{errorsPassword.confirm_new_password.message}</p>}
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
              >
                Update Password
              </button>
            </form>
          </div>

          {/* Update Email Form */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Mail className="mr-2" size={20} /> Update Email
            </h2>
            <form onSubmit={handleSubmitEmail(handleUpdateEmail)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">New Email Address</label>
                <input
                  type="email"
                  id="email"
                  {...registerEmail('email', { required: 'Email is required', pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' } })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
                {errorsEmail.email && <p className="mt-1 text-sm text-red-600">{errorsEmail.email.message}</p>}
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
              >
                Update Email
              </button>
            </form>
          </div>

          {/* Delete Account Section */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-red-800 mb-4 flex items-center">
              <Trash2 className="mr-2" size={20} /> Delete Account
            </h2>
            <p className="text-sm text-red-700 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting Account...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
