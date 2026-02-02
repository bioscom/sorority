'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { showToast } from '@/utils/toastUtils';
import { billingAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentSuccessPage() {
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [message, setMessage] = useState('Verifying your payment...');
  const { refreshUser } = useAuth();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get session_id from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        // Call payment success with session_id to verify and activate subscription
        const response = await billingAPI.paymentSuccess(sessionId || undefined);

        if (response.status === 200) {
          setVerificationStatus('success');
          const responseMessage = response.data.message || 'Payment successful! Your subscription is now active.';
          setMessage(responseMessage);
          showToast(responseMessage, 'success');
          
          // Refresh user profile to update subscription status
          await refreshUser();
        } else {
          setVerificationStatus('failed');
          setMessage('Payment verification failed. Please contact support.');
          showToast('Payment verification failed.', 'error');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setVerificationStatus('failed');
        setMessage('An error occurred during payment verification. Please contact support.');
        showToast('An error occurred during payment verification.', 'error');
      }
    };

    verifyPayment();
  }, [refreshUser]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4 flex flex-col items-center justify-center">
        <Navbar />
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          {verificationStatus === 'pending' && (
            <div className="flex flex-col items-center">
              <CheckCircle size={48} className="text-gray-500 animate-pulse mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h1>
              <p className="text-gray-600">{message}</p>
            </div>
          )}
          {verificationStatus === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle size={48} className="text-green-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
              <p className="text-gray-600">{message}</p>
              <Link href="/dashboard" className="mt-6 px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
                Go to Dashboard
              </Link>
            </div>
          )}
          {verificationStatus === 'failed' && (
            <div className="flex flex-col items-center">
              <XCircle size={48} className="text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
              <p className="text-gray-600">{message}</p>
              <Link href="/settings/billing" className="mt-6 px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
                Try Again
              </Link>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

