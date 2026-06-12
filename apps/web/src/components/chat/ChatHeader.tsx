'use client';

import { useChatStore } from '@/store/chatStore';
import { getAvatarColor } from '@/lib/avatarColor';
import type { ConversationWithParticipants } from '@chat-os/types';

export function ChatHeader() {
  const { conversations, activeConversationId } =
    useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId) as ConversationWithParticipants | undefined;

  const isGroup = conversation?.type === 'group';
  const otherUser = conversation && !isGroup ? conversation.participants?.[0] : undefined;
  const presence = useChatStore((s) =>
    otherUser?.id ? s.presence[otherUser.id] : undefined
  );

  if (!conversation) return null;

  const name = isGroup
    ? (conversation.name ?? 'Unnamed Group')
    : (conversation.participants?.[0]?.username ?? 'Direct message');

  const memberCount = conversation?.participants?.length ?? 0;
  const isOnline = presence?.status === 'online' ||
    otherUser?.status === 'online';
  const statusText = isGroup
    ? `${memberCount} member${memberCount === 1 ? '' : 's'}`
    : (isOnline ? 'Online' : 'Offline');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'linear-gradient(135deg, #4D8DFF 0%, #2F7CF6 100%)',
        borderBottom: 'none',
        height: '60px',
        flexShrink: 0,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: getAvatarColor(name),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 600,
          color: '#FFFFFF',
          flexShrink: 0,
          marginRight: '12px',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Name and status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
          {name}
        </div>
        <div style={{ fontSize: '12px', color: isGroup ? 'rgba(255,255,255,0.7)' : (isOnline ? '#B8FFF0' : 'rgba(255,255,255,0.7)'), lineHeight: 1.2 }}>
          {statusText}
        </div>
      </div>

      {/* Right icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#FFFFFF' }}
          title="Search in chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#FFFFFF' }}
          title="More options"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
