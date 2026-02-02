'use client';

import React from 'react';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

export default function PaymentCancelPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4 flex flex-col items-center justify-center">
        <Navbar />
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="flex flex-col items-center">
            <XCircle size={48} className="text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
            <p className="text-gray-600 mb-4">
              Your payment was cancelled. You have not been charged.
            </p>
            <Link href="/settings/billing" className="mt-6 px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
              Return to Billing
            </Link>
            <Link href="/dashboard" className="mt-4 text-pink-600 hover:text-pink-500">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

