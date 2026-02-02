'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { chatAPI } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Conversation, Message } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Send, User as UserIcon } from 'lucide-react'; // Renamed User to UserIcon to avoid conflict
import { useSearchParams } from 'next/navigation';
import { showToast } from '@/utils/toastUtils';
import Navbar from '@/components/Navbar';
import Image from 'next/image'; // Import Next.js Image component
import MessageBubble from '@/components/MessageBubble';

interface ChatProps {
  // In a real app, you might pass conversationId as a prop or get from URL params
}

function MessagesPageContent({}: ChatProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(user?.profile?.preferred_language || 'en');
  const [translatedMessages, setTranslatedMessages] = useState<{[key: number]: string}>({});
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        console.log('Fetching conversations...');
        const response = await chatAPI.getConversations();
        console.log('Conversations API response:', response);
        console.log('Response data:', response.data);
        
        // Handle both array and paginated response formats
        const conversationsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data.results || []);
        
        console.log('Processed conversations:', conversationsData);
        setConversations(conversationsData);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
        setConversations([]);
      }
    };
    fetchConversations();
  }, []);

  // Handle conversationId from URL params
  useEffect(() => {
    const conversationId = searchParams.get('conversationId');
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === parseInt(conversationId));
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (selectedConversation) {
      const fetchMessages = async () => {
        try {
          const response = await chatAPI.getMessages(selectedConversation.id);
          console.log('Messages response for conversation:', selectedConversation.id, response);
          
          // Handle both array and paginated response formats
          const messagesData = Array.isArray(response.data) 
            ? response.data 
            : (response.data.results || []);
          
          setMessages(messagesData);

          if (selectedConversation.id) {
            await chatAPI.markMessagesRead(selectedConversation.id);
          }

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
        if (selectedConversation.id) {
          try {
            const response = await chatAPI.getTypingIndicators(selectedConversation.id);
            setTypingUsers(response.data.filter((u: string) => u !== user?.username));
          } catch (error) {
            console.error('Error fetching typing indicators:', error);
          }
        }
      }, 3000);

      return () => clearInterval(typingIndicatorInterval);
    }
  }, [selectedConversation, autoTranslate, user?.id, translatedMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !selectedConversation) return;

    if (isTyping) {
      await chatAPI.updateTypingStatus(selectedConversation.id, { is_typing: false });
      setIsTyping(false);
    }

    try {
      const response = await chatAPI.sendMessage(selectedConversation.id, { content: newMessage });
      setMessages((prevMessages) => [...prevMessages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Failed to send message', 'error');
    }
  };

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (!selectedConversation) return;

    if (e.target.value.length > 0 && !isTyping) {
      await chatAPI.updateTypingStatus(selectedConversation.id, { is_typing: true });
      setIsTyping(true);
    } else if (e.target.value.length === 0 && isTyping) {
      await chatAPI.updateTypingStatus(selectedConversation.id, { is_typing: false });
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

  return (
  <ProtectedRoute>
    <div className="flex flex-col h-screen bg-gray-100">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Messages Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Conversation List */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation?.id === conv.id ? 'bg-gray-100' : ''
                }`}
                onClick={() => setSelectedConversation(conv)}
              >
                <p className="font-medium">
                  Match with {conv.match.user1.id === user?.id
                    ? conv.match.user2.username
                    : conv.match.user1.username}
                </p>

                {conv.last_message && (
                  <p className="text-sm text-gray-500 truncate">
                    {conv.last_message.content}
                  </p>
                )}

                {conv.unread_count > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-pink-500 text-white text-xs rounded-full">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Window */}
        <div className="w-2/3 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b p-4 flex items-center">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="mr-3 text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft size={20} />
                </button>

                <h2 className="text-xl font-semibold">
                  Chat with {
                    selectedConversation.match.user1.id === user?.id
                      ? selectedConversation.match.user2.username
                      : selectedConversation.match.user1.username
                  }
                </h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    user={user}
                    autoTranslate={autoTranslate}
                    translatedMessages={translatedMessages}
                    handleTranslateMessage={handleTranslateMessage}
                    setTranslatedMessages={setTranslatedMessages}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="bg-white border-t p-4 flex items-center">
                <input
                  type="text"
                  className="flex-1 border rounded-md p-2 focus:ring-2 focus:ring-pink-500"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />

                <button
                  onClick={handleSendMessage}
                  className="ml-3 bg-pink-500 text-white p-2 rounded-full"
                >
                  <Send size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  </ProtectedRoute>
);
}

export default function MessagesPage({}: ChatProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}
