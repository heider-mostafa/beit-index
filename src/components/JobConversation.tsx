/**
 * Job Conversation Component
 *
 * Real-time messaging interface between clients and appraisers.
 * Shows message history and allows sending new messages.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { Send, Loader2, MessageCircle, User } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface JobConversationProps {
  jobId: string;
  jobStatus: string;
  className?: string;
}

export function JobConversation({ jobId, jobStatus, className = '' }: JobConversationProps) {
  const { i18n } = useTranslation();
  const { session, profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check if messaging is allowed for this job status
  const canMessage = ['paid', 'assigned', 'in_progress', 'delivered'].includes(jobStatus);

  // Fetch messages
  const fetchMessages = async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);

        // Mark messages as read
        if (data.unreadCount > 0) {
          await fetch(`/api/jobs/${jobId}/messages/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 15 seconds
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [jobId, session?.access_token]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !session?.access_token || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(isRTL ? 'فشل في إرسال الرسالة' : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-EG', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return isRTL ? 'أمس' : 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { weekday: 'short' });
    } else {
      return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-cream-100 flex items-center gap-3">
        <MessageCircle className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-semibold text-ink-900">
          {isRTL ? 'المحادثة' : 'Conversation'}
        </h2>
        {messages.length > 0 && (
          <span className="text-sm text-ink-400">
            ({messages.length} {isRTL ? 'رسالة' : messages.length === 1 ? 'message' : 'messages'})
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-4 bg-cream-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-400">
            <MessageCircle className="w-12 h-12 mb-3 text-ink-200" />
            <p className="text-sm">
              {canMessage
                ? isRTL
                  ? 'لا توجد رسائل بعد. ابدأ المحادثة!'
                  : 'No messages yet. Start the conversation!'
                : isRTL
                ? 'المحادثة ستكون متاحة بعد الدفع'
                : 'Conversation will be available after payment'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender.id === profile?.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {msg.sender.avatar_url ? (
                    <img
                      src={msg.sender.avatar_url}
                      alt={msg.sender.full_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-ink-400" />
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-ink-600">
                      {isOwn ? (isRTL ? 'أنت' : 'You') : msg.sender.full_name}
                    </span>
                    <span className="text-xs text-ink-400">{formatTime(msg.created_at)}</span>
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      isOwn
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-cream-200 text-ink-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canMessage ? (
        <div className="p-4 border-t border-cream-100">
          {error && (
            <p className="text-sm text-red-600 mb-2">{error}</p>
          )}
          <div className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Type your message...'}
              rows={1}
              className="flex-1 px-4 py-2 border border-cream-200 rounded-lg text-ink-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-2">
            {isRTL ? 'اضغط Enter للإرسال' : 'Press Enter to send'}
          </p>
        </div>
      ) : (
        <div className="p-4 border-t border-cream-100 bg-cream-50">
          <p className="text-sm text-ink-500 text-center">
            {isRTL
              ? 'المحادثة غير متاحة لهذه الحالة'
              : 'Messaging is not available for this job status'}
          </p>
        </div>
      )}
    </div>
  );
}

export default JobConversation;
