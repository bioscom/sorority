'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '@/lib/api';
import { UserProfile } from '@/types/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<UserProfile>) => void;
  refreshUser: () => Promise<void>;
  resendVerificationEmail: (email?: string) => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  phone_country_code: string;
  phone_number: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('access_token');
      if (token) {
        try {
          const response = await authAPI.getProfile();
          console.log('AuthContext - Profile response:', response.data);
          setUser(response.data);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          Cookies.remove('access_token');
          // Cookies.remove('refresh_token'); // Removed as refresh token will be http-only
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    console.log('AuthContext login called with:', email);
    try {
      console.log('Making API call to authAPI.login...');
      const response = await authAPI.login({ email, password });
      console.log('API response received:', response);
      const { user: userData, tokens } = response.data;
      
      Cookies.set('access_token', tokens.access);
      Cookies.set('refresh_token', tokens.refresh);
      setUser(userData);
      console.log('Login completed successfully');
    } catch (error: any) {
      console.error('AuthContext login error:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await authAPI.register(data);
      const { user: userData, tokens } = response.data;
      
      Cookies.set('access_token', tokens.access);
      Cookies.set('refresh_token', tokens.refresh);
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const resendVerificationEmail = async (email?: string) => {
    const targetEmail = email || user?.email;
    if (!targetEmail) {
      throw new Error('Email address is required to resend verification.');
    }
    try {
      await authAPI.resendVerification({ email: targetEmail });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Unable to resend verification email');
    }
  };

  const logout = async () => {
    const refreshToken = Cookies.get('refresh_token');
    if (refreshToken) {
      try {
        await authAPI.logout({ refresh: refreshToken });
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    setUser(null);
  };

  const updateUser = (userData: Partial<UserProfile>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};







