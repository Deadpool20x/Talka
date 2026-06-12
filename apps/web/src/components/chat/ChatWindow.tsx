'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useMessages } from '@/hooks/useMessages';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';

// ---------------------------------------------------------------------------
// Props — injected from ChatPage so that WebSocket hooks are called exactly
// once at the stable parent level, not inside this frequently re-rendering
// component. This eliminates the "Displacing existing connection" loop.
// ---------------------------------------------------------------------------
interface ChatWindowProps {
  socketRef: React.MutableRefObject<WebSocket | null>;
  isConnected: boolean;
  joinRoom: (conversationId: string) => boolean;
  leaveRoom: (conversationId: string) => boolean;
  sendEvent: (event: string, payload: unknown) => boolean;
}

export function ChatWindow({
  isConnected,
  joinRoom,
  leaveRoom,
  sendEvent,
}: ChatWindowProps) {
  const { activeConversationId, conversations } = useChatStore();

  const { messages, isLoading, hasMore, loadMore } = useMessages(activeConversationId);

  const conversation = conversations.find((c) => c.id === activeConversationId);

  // Join/leave WS room when the active conversation changes.
  // joinRoom and leaveRoom are stable useCallback refs — safe to omit from deps.
  // Including them would cause re-fire on every isConnected state change.
  useEffect(() => {
    if (!activeConversationId) return;
    joinRoom(activeConversationId);
    return () => {
      leaveRoom(activeConversationId);
    };
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeConversationId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F4F6F9',
          color: '#8A94A6',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '48px' }}>💬</div>
        <p style={{ fontSize: '16px', fontWeight: 500, color: '#8A94A6' }}>
          Select a chat to start messaging
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#F4F6F9',
        height: '100%',
      }}
    >
      <ChatHeader />
      <MessageList
        messages={messages}
        isLoading={isLoading}
        hasMore={hasMore}
        loadMore={loadMore}
        participants={conversation?.participants}
        isGroup={conversation?.type === 'group'}
      />
      <TypingIndicator />
      <MessageInput
        conversationId={activeConversationId}
        isConnected={isConnected}
        sendEvent={sendEvent}
      />
    </div>
  );
}
