'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Message } from '@chat-os/types';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { formatMessageDate } from '@/lib/dateFormat';
import { useAuthStore } from '@/store/authStore';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  participants?: { id: string; username: string }[];
  isGroup?: boolean;
}

export function MessageList({ messages, isLoading, hasMore, loadMore, participants, isGroup }: MessageListProps) {
  const { userId } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const sorted = [...messages].sort((a, b) => {
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Messages"
      aria-live="polite"
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
        minHeight: 0,
        background: 'transparent',
      }}
    >
      {/* Spacer to push messages to bottom when few messages */}
      <div style={{ flex: 1 }} />

      {hasMore && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          {isLoading ? (
            <span style={{ fontSize: '12px', color: '#8A94A6' }}>Loading...</span>
          ) : (
            <button
              type="button"
              onClick={loadMore}
              style={{
                fontSize: '12px',
                color: '#2F7CF6',
                background: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              Load older messages
            </button>
          )}
        </div>
      )}

      {sorted.map((message, index) => {
        const dateLabel = formatMessageDate(message.createdAt ?? new Date());
        const prevMessage = sorted[index - 1];
        const prevDateLabel = prevMessage
          ? formatMessageDate(prevMessage.createdAt ?? new Date())
          : '';
        const showDateSeparator = dateLabel !== prevDateLabel;

        return (
          <div key={message.id ?? message.tempId ?? index}>
            {showDateSeparator && (
              <DateSeparator key={`date-${dateLabel}-${index}`} date={dateLabel} />
            )}
            <MessageBubble
              message={message}
              isOwn={message.senderId === userId}
              senderName={isGroup ? participants?.find((p) => p.id === message.senderId)?.username : undefined}
            />
          </div>
        );
      })}

      <div ref={bottomRef} style={{ height: '1px' }} aria-hidden="true" />
    </div>
  );
}