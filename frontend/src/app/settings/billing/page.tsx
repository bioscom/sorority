'use client';

import React, { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import Navbar from '@/components/Navbar';
import { billingAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastUtils';
import { ArrowLeft, Crown, DollarSign, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency?: string;
  duration_days: number;
  features: string[];
}

interface UserSubscription {
  id: number;
  plan: SubscriptionPlan;
  start_date: string;
  end_date: string;
  is_active: boolean;
  cancel_at_period_end: boolean;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillingData = async () => {
      setIsLoading(true);
      try {
        const [plansResponse, subscriptionResponse] = await Promise.all([
          billingAPI.getSubscriptionPlans(),
          billingAPI.getMySubscription(),
        ]);
        setPlans(plansResponse.data.results || plansResponse.data);
        setCurrentSubscription(subscriptionResponse.data || null);
      } catch (err: any) {
        console.error('Error fetching billing data:', err);
        setError(err.response?.data?.detail || 'Failed to load billing information.');
        showToast(err.response?.data?.detail || 'Failed to load billing information.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBillingData();
  }, []);

  const handleSubscribe = async (planId: number) => {
    setIsLoading(true);
    try {
      const response = await billingAPI.createCheckoutSession(planId);
      // Redirect to Stripe Checkout page
      window.location.href = response.data.checkout_url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      showToast(err.response?.data?.detail || 'Failed to initiate checkout.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p>Loading billing information...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          </div>

          {/* Current Subscription Status */}
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4 flex items-center">
              <Crown className="mr-2" size={24} /> Your Subscription
            </h2>
            {currentSubscription && user?.profile?.is_premium ? (
              <div>
                <p className="text-lg font-medium text-blue-700">Plan: {currentSubscription.plan.name}</p>
                <p className="text-sm text-blue-600 mt-1">
                  Status: {currentSubscription.is_active ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Renews on: {new Date(currentSubscription.end_date).toLocaleDateString(user?.profile?.preferred_language || 'en')}
                </p>
                {/* Add options to manage subscription if backend supports (e.g., cancel, upgrade) */}
              </div>
            ) : (
              <p className="text-blue-700">You do not have an active subscription. Explore our plans below!</p>
            )}
          </div>

          {/* Available Plans */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.length > 0 ? (
                plans.map(plan => (
                  <div key={plan.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-pink-600 mb-2">{plan.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                      <p className="text-3xl font-bold text-gray-900 mb-4">
                        {new Intl.NumberFormat(user?.profile?.preferred_language || 'en', { style: 'currency', currency: plan.currency || 'USD' }).format(plan.price)}
                        <span className="text-lg font-medium text-gray-500">/{plan.duration_days} days</span>
                      </p>
                      <ul className="text-sm text-gray-700 space-y-2 mb-6">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <CheckCircle size={16} className="mr-2 text-green-500" /> {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      className="mt-4 w-full py-3 bg-pink-600 text-white font-semibold rounded-md hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLoading}
                    >
                      {user?.profile?.is_premium ? 'Upgrade Plan' : 'Choose Plan'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-600">No subscription plans available at the moment.</p>
              )}
            </div>
          </div>

          {/* Payment Success/Cancel Callbacks - (Handled by Stripe redirect, no direct UI here) */}
          {/* A separate page for payment success/cancel would handle the actual redirection and backend update */}

        </div>
      </div>
    </AdminProtectedRoute>
  );
}

