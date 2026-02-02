import React from 'react';
import { Message } from '@/types/chat';
import Image from 'next/image';

interface MessageBubbleProps {
  message: Message;
  user: any;
  autoTranslate: boolean;
  translatedMessages: {[key: number]: string};
  handleTranslateMessage: (messageId: number, text: string) => void;
  setTranslatedMessages: React.Dispatch<React.SetStateAction<{[key: number]: string}>>;
}

export default function MessageBubble({
  message,
  user,
  autoTranslate,
  translatedMessages,
  handleTranslateMessage,
  setTranslatedMessages
}: MessageBubbleProps) {
  // Handle case where sender might be undefined
  if (!message || !message.sender) {
    return null;
  }
  
  const isOwnMessage = message.sender.id === user?.id;
  const displayText = autoTranslate && translatedMessages[message.id]
    ? translatedMessages[message.id]
    : message.content;

  return (
    <div className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwnMessage && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-2 flex-shrink-0">
            {message.sender.profile?.profile_picture ? (
              <Image
                src={message.sender.profile.profile_picture}
                alt={message.sender.username}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-600">{message.sender.username[0].toUpperCase()}</span>
            )}
          </div>
        )}
        <div
          className={`rounded-lg px-4 py-2 max-w-full break-words ${
            isOwnMessage
              ? 'bg-pink-500 text-white'
              : 'bg-white text-gray-900 border border-gray-200'
          }`}
        >
          <p className="text-sm">{displayText}</p>
          {autoTranslate && translatedMessages[message.id] && (
            <p className="text-xs text-gray-400 mt-1 italic">
              Original: {message.content}
            </p>
          )}
          <p className={`text-xs mt-1 ${isOwnMessage ? 'text-pink-100' : 'text-gray-500'}`}>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}