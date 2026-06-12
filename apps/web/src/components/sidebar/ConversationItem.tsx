'use client';

import { useChatStore } from '@/store/chatStore';
import { getAvatarColor } from '@/lib/avatarColor';
import type { ConversationWithParticipants } from '@chat-os/types';

interface ConversationItemProps {
  conversation: ConversationWithParticipants;
  unreadCount: number;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  unreadCount,
  isActive,
  onClick,
}: ConversationItemProps) {
  const isGroup = conversation.type === 'group';

  const name = isGroup
    ? (conversation.name ?? 'Unnamed Group')
    : (conversation.participants?.[0]?.username ?? 'Direct message');

  const otherUserId = !isGroup ? conversation.participants?.[0]?.id : undefined;
  const presence = useChatStore((s) =>
    otherUserId ? s.presence[otherUserId] : undefined
  );
  const isOnline = !isGroup && (presence?.status === 'online' ||
    conversation.participants?.[0]?.status === 'online');

  const lastMsg = conversation.last_message ?? (conversation as any).lastMessage;

  const lastMessagePreview = (() => {
    if (!lastMsg) return isOnline ? 'Online' : 'Offline';
    const content = lastMsg.content ?? '';
    let preview: string;
    if (content.startsWith('http') && (content.includes('.jpg') ||
        content.includes('.png') || content.includes('.gif') ||
        content.includes('.webp'))) {
      preview = '📷 Photo';
    } else {
      try {
        const parsed = JSON.parse(content);
        if (parsed.name) {
          preview = '📎 ' + parsed.name;
        } else {
          preview = content.length > 40 ? content.slice(0, 40) + '…' : content;
        }
      } catch {
        preview = content.length > 40 ? content.slice(0, 40) + '…' : content;
      }
    }
    if (isGroup) {
      const sender = (lastMsg as Record<string, unknown>).sender_username;
      if (typeof sender === 'string') return `${sender}: ${preview}`;
    }
    return preview;
  })();

  const lastMessageTime = (() => {
    const dateStr = lastMsg?.created_at ?? lastMsg?.createdAt;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  })();

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        cursor: 'pointer',
        background: isActive ? '#EAF2FF' : 'transparent',
        transition: 'background 0.1s',
        borderBottom: '1px solid #F0F2F5',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#F5F8FF';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Avatar with online dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: getAvatarColor(name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 600,
            color: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {!isGroup && (
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isOnline ? '#4ECDC4' : '#CBD5E1',
              border: '2px solid #FFFFFF',
            }}
          />
        )}
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#1A1A1A',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px',
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: '12px', color: '#B0B8C9', flexShrink: 0 }}>
            {lastMessageTime}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p
            style={{
              fontSize: '13px',
              color: '#8A94A6',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '220px',
              margin: 0,
            }}
          >
            {lastMessagePreview}
          </p>
          {unreadCount > 0 && (
            <span
              style={{
                background: '#FF6B6B',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '10px',
                padding: '1px 6px',
                minWidth: '20px',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
