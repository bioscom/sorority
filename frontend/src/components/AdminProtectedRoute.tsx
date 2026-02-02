'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function AdminProtectedRoute({
  children,
  redirectTo = '/dashboard',
}: AdminProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || (!user.is_staff && !user.is_superuser)) {
        router.push(redirectTo);
      }
    }
  }, [user, loading, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!user || (!user.is_staff && !user.is_superuser)) {
    return null;
  }

  return <>{children}</>;
}