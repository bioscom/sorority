'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { chatAPI } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Conversation, Message } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Send } from 'lucide-react';
import { showToast } from '@/utils/toastUtils';
import Navbar from '@/components/Navbar';
import MessageBubble from '@/components/MessageBubble';

export default function ConversationPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const conversationId = parseInt(params.id as string);
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(user?.profile?.preferred_language || 'en');
  const [translatedMessages, setTranslatedMessages] = useState<{[key: number]: string}>({});
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const response = await chatAPI.getConversation(conversationId);
        setConversation(response.data);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
        showToast('Failed to load conversation', 'error');
        router.push('/messages');
      } finally {
        setLoading(false);
      }
    };

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId, router]);

  useEffect(() => {
    if (conversationId) {
      const fetchMessages = async () => {
        try {
          const response = await chatAPI.getMessages(conversationId);
          console.log('Messages API response:', response);
          console.log('Response data:', response.data);
          
          // Handle both array and paginated response formats
          const messagesData = Array.isArray(response.data) 
            ? response.data 
            : (response.data.results || []);
          
          console.log('Processed messages data:', messagesData);
          console.log('First message:', messagesData[0]);
          
          setMessages(messagesData);

          await chatAPI.markMessagesRead(conversationId);

          if (autoTranslate) {
            messagesData.forEach(async (message: Message) => {
              if (message.sender?.id !== user?.id && !translatedMessages[message.id]) {
                await handleTranslateMessage(message.id, message.content);
              }
            });
          }
        } catch (error) {
          console.error('Failed to fetch messages:', error);
        }
      };
      fetchMessages();

      const typingIndicatorInterval = setInterval(async () => {
        try {
          const response = await chatAPI.getTypingIndicators(conversationId);
          setTypingUsers(response.data.filter((u: string) => u !== user?.username));
        } catch (error) {
          console.error('Error fetching typing indicators:', error);
        }
      }, 3000);

      return () => clearInterval(typingIndicatorInterval);
    }
  }, [conversationId, autoTranslate, user?.id, user?.username, translatedMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !conversationId) return;

    if (isTyping) {
      await chatAPI.updateTypingStatus(conversationId, { is_typing: false });
      setIsTyping(false);
    }

    try {
      console.log('Sending message:', newMessage);
      const response = await chatAPI.sendMessage(conversationId, { content: newMessage });
      console.log('Send message response:', response);
      console.log('Response data:', response.data);
      
      // The response should be the created message with sender info
      const newMsg = response.data;
      console.log('New message to add:', newMsg);
      
      setMessages((prevMessages) => {
        console.log('Previous messages:', prevMessages);
        const updated = [...prevMessages, newMsg];
        console.log('Updated messages:', updated);
        return updated;
      });
      setNewMessage('');
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Failed to send message', 'error');
    }
  };

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!conversationId) return;

    if (e.target.value.length > 0 && !isTyping) {
      await chatAPI.updateTypingStatus(conversationId, { is_typing: true });
      setIsTyping(true);
    } else if (e.target.value.length === 0 && isTyping) {
      await chatAPI.updateTypingStatus(conversationId, { is_typing: false });
      setIsTyping(false);
    }
  };

  const handleTranslateMessage = async (messageId: number, text: string) => {
    try {
      const response = await chatAPI.translateMessage({ text, target_language: targetLanguage });
      setTranslatedMessages(prev => ({ ...prev, [messageId]: response.data.translated_text }));
      showToast('Message translated', 'success');
    } catch (error) {
      console.error('Failed to translate message:', error);
      showToast('Failed to translate message', 'error');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex flex-col h-screen bg-gray-100">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-600">Loading conversation...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!conversation) {
    return (
      <ProtectedRoute>
        <div className="flex flex-col h-screen bg-gray-100">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-600">Conversation not found</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const otherUser = conversation.match.user1.id === user?.id
    ? conversation.match.user2
    : conversation.match.user1;

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-gray-100">
        <Navbar />

        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto bg-white shadow-lg">
          {/* Chat Header */}
          <div className="bg-white border-b p-4 flex items-center">
            <button
              onClick={() => router.push('/messages')}
              className="mr-3 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex items-center">
              <div className="w-10 h-10 bg-pink-200 rounded-full flex items-center justify-center mr-3">
                <span className="text-pink-700 font-semibold">
                  {otherUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-semibold">
                Chat with {otherUser.username}
              </h2>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id || `message-${index}`}
                    message={message}
                    user={user}
                    autoTranslate={autoTranslate}
                    translatedMessages={translatedMessages}
                    handleTranslateMessage={handleTranslateMessage}
                    setTranslatedMessages={setTranslatedMessages}
                  />
                ))}
                {typingUsers.length > 0 && (
                  <div className="text-sm text-gray-500 italic mb-2">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="bg-white border-t p-4">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Type your message..."
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />

              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-pink-500 text-white p-3 rounded-full hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
