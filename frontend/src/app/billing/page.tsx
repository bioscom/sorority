'use client';
import { Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { billingAPI } from '@/lib/api';
import { showToast } from '@/utils/toastUtils';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Crown, Check, Star, Zap } from 'lucide-react';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  features: string[];
}

export default function BillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<number | null>(null);

  const fetchPlans = async () => {
    try {
      const response = await billingAPI.getSubscriptionPlans();
      // Handle paginated response - plans are in response.data.results
      setPlans(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      showToast('Failed to load subscription plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  //console.log("PLANS TYPE:", typeof plans, plans);

  const handleSubscribe = async (planId: number) => {
    setProcessingPlan(planId);
    try {
      const response = await billingAPI.createCheckoutSession(planId);
      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      showToast('Failed to start checkout process', 'error');
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-lg text-gray-600">Loading subscription plans...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <Crown className="h-12 w-12 text-yellow-500" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Upgrade to Premium
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Unlock unlimited photos, advanced features, and find your perfect match faster
            </p>
          </div>

          {/* Current Status */}
          {user?.profile?.is_premium && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800 font-semibold">Premium Member</span>
              </div>
              <p className="text-green-700 text-sm">
                You're enjoying all premium features! Thank you for your support.
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Why Go Premium?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="h-6 w-6 text-pink-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Unlimited Photos</h3>
                <p className="text-gray-600 text-sm">Upload as many photos as you want to showcase your best self</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Super Likes</h3>
                <p className="text-gray-600 text-sm">Stand out with super likes that get noticed instantly</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Star className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Profile Boosts</h3>
                <p className="text-gray-600 text-sm">Get more visibility and matches with profile boosts</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Premium Support</h3>
                <p className="text-gray-600 text-sm">Get priority support and advanced features</p>
              </div>
            </div>
          </div>

          {/* Subscription Plans */}
          <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8">
            {Array.isArray(plans) && plans.length > 0 ? (
              plans.map((plan) => {
                // Mark the plan with the highest price as popular
                const isPopular = plan.price === Math.max(...plans.map(p => p.price));
                return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-lg shadow-sm border-2 ${
                    isPopular ? 'border-pink-500 relative' : 'border-gray-200'
                  } p-6`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-pink-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold text-pink-600 mb-1">
                      ${plan.price}
                      <span className="text-lg text-gray-500">/{plan.duration_days === 30 ? 'month' : plan.duration_days === 90 ? '3 months' : 'year'}</span>
                    </div>
                    <div className="text-gray-600 text-sm leading-relaxed">
                      {plan.description.split('\n').map((line, index) => (
                        <div key={index} className={line.startsWith('-') ? 'ml-4' : ''}>
                          {line.startsWith('-') ? (
                            <span className="flex items-start">
                              <span className="text-pink-500 mr-2 mt-1">•</span>
                              <span>{line.substring(1).trim()}</span>
                            </span>
                          ) : (
                            <span className={index === 0 ? 'font-medium' : ''}>{line}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={processingPlan === plan.id || user?.profile?.is_premium}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                      isPopular
                        ? 'bg-pink-600 text-white hover:bg-pink-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processingPlan === plan.id ? (
                      'Processing...'
                    ) : user?.profile?.is_premium ? (
                      'Current Plan'
                    ) : (
                      `Subscribe to ${plan.name}`
                    )}
                  </button>
                </div>
                );
              })
            ) : (
              <div className="col-span-full text-center text-gray-600">No subscription plans available at the moment.</div>
            )}
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              Have questions about premium features?
            </p>
            <p className="text-sm text-gray-500">
              Contact our support team for assistance with your subscription.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}