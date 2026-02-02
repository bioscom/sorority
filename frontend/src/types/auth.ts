import { Profile } from './profiles';
import { Notification } from './notifications';

export interface UserRegistration {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
  phone_country_code: string;
  phone_number: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  date_joined: string; // ISO 8601 date string
  is_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  phone_country_code?: string;
  phone_number?: string;
  profile?: any; // Profile data when included
  full_name?: string; // Full name when included
}

export interface UserProfile extends User {
  profile: Profile | null;
}
