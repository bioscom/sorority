export interface Photo {
  id: number;
  image: string; // URL to the image
  is_primary: boolean;
  uploaded_at: string; // ISO 8601 datetime string
  is_moderated: boolean;
  is_safe: boolean;
  moderation_score: number;
  rejection_reason: string | null;
}

export interface Interest {
  id: number;
  name: string;
}

export interface ProfileInterest {
  id: number;
  interest: Interest;
  interest_id?: number; // Only for writing, not returned by read
}

export interface ValueOptionPayload {
  id?: number;
  name?: string;
  label?: string;
  value?: string;
}

export type ProfileValueEntry =
  | string
  | {
      id?: number;
      value?: string | ValueOptionPayload;
      name?: string;
      label?: string;
    };

export interface Boost {
  id: number;
  name: string;
  description: string;
  cost: number;
  duration_days: number;
  boost_type: string;
  created_at: string; // ISO 8601 datetime string
}

export interface UserFeatureVector {
  id: number;
  user: number; // User ID
  feature_vector: { [key: string]: number }; // JSON field
  created_at: string; // ISO 8601 datetime string
  updated_at: string; // ISO 8601 datetime string
}

export interface Profile {
  id: number;
  slug: string;
  bio: string;
  date_of_birth: string; // YYYY-MM-DD
  gender: 'Male' | 'Female' | 'Other';
  looking_for: 'Long-term relationship' | 'Short-term relationship' | 'Friendship' | 'Casual dating';
  relationship_status: 'Single' | 'In a relationship' | 'Married';
  location: string;
  country?: string;
  state_province?: string;
  latitude: number | null;
  longitude: number | null;
  max_distance: number;
  min_age: number;
  max_age: number;
  is_active: boolean;
  is_hidden: boolean;
  photo_visibility: 'Public' | 'Private' | 'Friends Only';
  virtual_currency: number;
  is_premium: boolean;
  is_online: boolean;
  last_login_reward_date: string | null; // ISO 8601 date string
  profile_completion_score: number;
  boost_expiry: string | null; // ISO 8601 datetime string
  bio_is_moderated: boolean;
  bio_is_safe: boolean;
  bio_moderation_score: number;
  bio_rejection_reason: string | null;
  created_at: string; // ISO 8601 datetime string
  updated_at: string; // ISO 8601 datetime string
  photos: Photo[];
  interests: number[]; // PrimaryKeyRelatedField returns a list of IDs for writing
  full_name: string;
  current_age: number;
  preferred_language: string;
  prompts: { id: number; question: string; answer: string }[];
  values?: ProfileValueEntry[];
  favorite_music: string[];
  passport_latitude: number | null;
  passport_longitude: number | null;
  is_passport_enabled: boolean;
}

export interface ProfileListItem {
  id: number;
  user_id: number;
  slug: string;
  bio: string;
  current_age: number;
  gender: 'Male' | 'Female' | 'Other';
  location: string;
  country?: string;
  state_province?: string;
  looking_for?: 'Long-term relationship' | 'Short-term relationship' | 'Friendship' | 'Casual dating' | string;
  is_premium: boolean;
  is_online: boolean;
  photos: Photo[];
  interests: ProfileInterest[]; // ProfileInterestSerializer for list views
  full_name: string;
  primary_photo: Photo | null;
  prompts: { id: number; question: string; answer: string }[];
  values?: ProfileValueEntry[];
  favorite_music: string[];
}

export interface Gift {
  id: number;
  name: string;
  description: string;
  cost: number;
  image: string; // URL to the gift image
  created_at: string; // ISO 8601 datetime string
}

