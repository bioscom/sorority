import { User } from './auth';
import { Match } from './interactions';

export interface MessageReaction {
  id: number;
  user: User;
  reaction_type: string;
  created_at: string; // ISO 8601 datetime string
}

export interface Message {
  id: number;
  sender: User;
  content: string;
  created_at: string; // ISO 8601 datetime string
  is_read: boolean;
  read_at: string | null; // ISO 8601 datetime string
  reactions: MessageReaction[];
}

export interface Conversation {
  id: number;
  match: Match;
  participants: User[];
  last_message: Message | null;
  unread_count: number;
  created_at: string; // ISO 8601 datetime string
  updated_at: string; // ISO 8601 datetime string
  is_active: boolean;
}

