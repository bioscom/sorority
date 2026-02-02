import { User } from './auth';
import { Gift } from './profiles';

export interface Match {
  id: number;
  user1: User;
  user2: User;
  created_at: string; // ISO 8601 datetime string
  is_active: boolean;
}

export interface UserGift {
  id: number;
  sender: User;
  receiver: User;
  gift: Gift;
  gift_id?: number; // For sending, if only ID is needed
  sent_at: string; // ISO 8601 datetime string
}

