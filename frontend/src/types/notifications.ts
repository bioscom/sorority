import { User } from './auth';

export interface Notification {
  id: number;
  recipient: User;
  sender: User | null;
  notification_type: 'match' | 'message' | 'profile_view' | 'like' | 'gift';
  message: string;
  is_read: boolean;
  created_at: string; // ISO 8601 datetime string
  content_type: number | null; // ID of the ContentType
  object_id: number | null;
}