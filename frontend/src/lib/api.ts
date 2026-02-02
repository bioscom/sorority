//import axios from 'axios';
import api from './axios';
import Cookies from 'js-cookie';
import { getErrorMessages } from '../utils/errorUtils';
import { showToast } from '../utils/toastUtils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Create axios instance
// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = Cookies.get('refresh_token');
        const response = await api.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh: refreshToken });
        
        const { access } = response.data;
        Cookies.set('access_token', access, { expires: 7 }); // Set an expiry for the access token
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear all tokens and redirect to login
        Cookies.remove('access_token');
        Cookies.remove('refresh_token'); 
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    const errorMessages = getErrorMessages(error);
    errorMessages.forEach(message => showToast(message, 'error'));

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: {
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    password: string;
    password_confirm: string;
    phone_country_code: string;
    phone_number: string;
  }) => api.post('/auth/register/', data),
  
  login: (data: { email: string; password: string }) => api.post('/auth/login/', data),
  
  logout: (data: { refresh: string }) => api.post('/auth/logout/', data),
  
  getProfile: () => api.get('/auth/profile/'),
  
  updateProfile: (data: any) => api.put('/auth/profile/update/', data),
  
  verifyEmail: (uidb64: string, token: string) => api.post(`/auth/verify-email/${uidb64}/${token}/`),
  
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password/', data),

  resetPasswordConfirm: (uidb64: string, token: string, data: { new_password1: string; new_password2: string }) => 
    api.post(`/auth/reset-password-confirm/${uidb64}/${token}/`, data),

  changePassword: (data: { old_password: string; new_password: string; confirm_new_password: string }) => 
    api.post('/auth/change-password/', data),

  resendVerification: (data: { email: string }) => api.post('/auth/resend-verification/', data),

  deleteAccount: () => api.delete('/auth/delete-account/'),
};

// Profiles API
export const profilesAPI = {
  getProfiles: (params?: any) => api.get('/profiles/', { params }),
  getPublicProfiles: (params?: any) => api.get('/profiles/public/', { params }),
  getProfile: (identifier: string | number) => api.get(`/profiles/${identifier}/`),
  createProfile: (data: any) => api.post('/profiles/', data),  
  updateProfile: (identifier: string | number, data: any) => api.patch(`/profiles/${identifier}/`, data),
  getRecommendations: (params?: any) => api.get('/profiles/recommendations/', { params }),
  //getRecommendations: () => api.get('/profiles/recommendations/'),
  getPhotos: () => api.get('/profiles/photos/'),
  uploadPhoto: (data: FormData) => api.post('/profiles/photos/', data),
  deletePhoto: (id: number) => api.delete(`/profiles/photos/${id}/`),
  setPrimaryPhoto: (id: number) => api.post(`/profiles/photos/${id}/set-primary/`),
  getInterests: () => api.get('/profiles/interests/'),
  getProfileInterests: () => api.get('/profiles/profile-interests/'),
  addProfileInterest: (data: { interest_id: number }) => api.post('/profiles/profile-interests/', data),
  removeProfileInterest: (id: number) => api.delete(`/profiles/profile-interests/${id}/`),
  getValues: (params?: any) => api.get('/profiles/values/', { params }),
  getProfileValues: () => api.get('/profiles/profile-values/'),
  addProfileValue: (data: { value_id: number }) => api.post('/profiles/profile-values/', data),
  removeProfileValue: (id: number) => api.delete(`/profiles/profile-values/${id}/`),
  getOptions: (category?: string) =>  api.get('/profiles/options/', { params: category ? { category } : {} }),
  getDailyLoginReward: () => api.post('/profiles/daily-login-reward/'),
  getProfileCompletion: () => api.get('/profiles/profile-completion/'),
  getBoosts: () => api.get('/profiles/boosts/'),
  activateBoost: (data: { boost_id: number }) => api.post('/profiles/boosts/activate/', data),
  managePassport: (data: { passport_latitude: number | null; passport_longitude: number | null; is_passport_enabled: boolean }) => api.post('/profiles/passport/', data), 
  getPassportStatus: () => api.get('/profiles/passport/'),
  deletePassport: () => api.delete('/profiles/passport/'),
  getDashboardStats: () => api.get('/profiles/dashboard-stats/'),
};

// Interactions API
export const interactionsAPI = {
  swipe: (data: { swiped_user: number | string; action: 'like' | 'pass' | 'super_like' }) => api.post('/interactions/swipe/', data),
  
  getMatches: () => api.get('/interactions/matches/'),
  
  getMatch: (id: number) => api.get(`/interactions/matches/${id}/`),
  
  unmatch: (id: number) => api.post(`/interactions/matches/${id}/unmatch/`),
  
  getSwipeHistory: () => api.get('/interactions/swipe/history/'),
  
  getLikesReceived: () => api.get('/interactions/swipe/likes-received/'),
  
  blockUser: (data: { blocked_user: number; reason?: string }) => api.post('/interactions/blocks/create/', data),
  
  getBlocks: () => api.get('/interactions/blocks/'),
  
  unblockUser: (id: number) => api.post(`/interactions/blocks/${id}/unblock/`),
  
   reportUser: (data: { reported_user: number; reason: string; description?: string }) => api.post('/interactions/reports/create/', data),
  
  getGifts: () => api.get('/interactions/gifts/'),

  sendGift: (data: { recipient_user: number; gift_id: number }) =>  api.post('/interactions/gifts/send/', data),

  getReceivedGifts: () => api.get('/interactions/gifts/received/'),
};

// Chat API
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations/'),
  
  getConversation: (id: number) => api.get(`/chat/conversations/${id}/`),
  
  createConversation: (matchId: number) =>
    api.post(`/chat/conversations/create/${matchId}/`),
  
  getMessages: (conversationId: number) =>
    api.get(`/chat/conversations/${conversationId}/messages/`),
  
  sendMessage: (conversationId: number, data: { content: string }) =>
    api.post(`/chat/conversations/${conversationId}/messages/`, data),
  
  markMessagesRead: (conversationId: number) =>
    api.post(`/chat/conversations/${conversationId}/messages/read/`),
  
  addReaction: (messageId: number, data: { reaction_type: string }) =>
    api.post(`/chat/messages/${messageId}/reactions/`, data),
  
   removeReaction: (messageId: number) =>
    api.delete(`/chat/messages/${messageId}/reactions/remove/`),
  
   updateTypingStatus: (conversationId: number, data: { is_typing: boolean }) =>
    api.post(`/chat/conversations/${conversationId}/typing/`, data),
  
   getTypingIndicators: (conversationId: number) =>
    api.get(`/chat/conversations/${conversationId}/typing-indicators/`),
  
  translateMessage: (data: { text: string; target_language: string }) =>
    api.post('/chat/translate/', data),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () => api.get('/notifications/'),
  
  markNotificationAsRead: (id: number) =>
    api.post(`/notifications/${id}/read/`),
  
   markAllNotificationsAsRead: () => api.post('/notifications/read-all/'),
};

// Translation API
export const translationAPI = {
  ensureBatch: (payload: { target_language: string; strings: { key: string; text: string; source_language?: string }[] }) =>
    api.post('/i18n/translations/batch/', payload),
  lookup: ({ target_language, keys }: { target_language: string; keys: string[] }) =>
    api.get('/i18n/translations/', {
      params: {
        target_language,
        keys: keys.join(','),
      },
    }),
};

// Billing API
export const billingAPI = {
  getSubscriptionPlans: () => api.get('/billing/plans/'),

  createCheckoutSession: (planId: number) => api.post(`/billing/create-checkout-session/${planId}/`),

  getStripeWebhook: () => api.post('/billing/stripe-webhook/'),

  getMySubscription: () => api.get('/billing/my-subscription/'),

  paymentSuccess: (sessionId?: string) => api.get('/billing/payment-success/', { params: { session_id: sessionId } }),

  paymentCancel: () => api.get('/billing/payment-cancel/'),
};


export default api;




