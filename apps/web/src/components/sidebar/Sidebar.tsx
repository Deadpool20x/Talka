'use client';

import { useState } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useChatStore } from '@/store/chatStore';
import { ConversationItem } from './ConversationItem';
import { NewChatButton } from './NewChatButton';
import { UserSearchModal } from './UserSearchModal';
import { CreateGroupModal } from './CreateGroupModal';
import { ProfileModal } from '@/components/profile/ProfileModal';

export function Sidebar() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { conversations, isLoading, hasMore, loadMore } = useConversations();
  const {
    activeConversationId,
    setActiveConversation,
    unreadCounts,
  } = useChatStore();

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const name = c.participants?.[0]?.username ?? (c as any).name ?? '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  return (
    <div
      style={{
        width: '360px',
        minWidth: '360px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        borderRight: '1px solid #E8E8E8',
        overflow: 'hidden',
      }}
    >
      {/* Top bar: hamburger + search + new chat */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: 'none',
          background: 'linear-gradient(135deg, #4D8DFF 0%, #2F7CF6 100%)',
        }}
      >
        <button
          onClick={() => setIsProfileOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            padding: '7px 14px',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#FFFFFF',
              width: '100%',
            }}
          />
        </div>

        <NewChatButton
            onNewChat={() => setIsModalOpen(true)}
            onNewGroup={() => setIsGroupModalOpen(true)}
          />
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredConversations.length === 0 && !isLoading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8A94A6', fontSize: '14px' }}>
            No conversations yet
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              unreadCount={unreadCounts[conv.id] ?? 0}
              isActive={conv.id === activeConversationId}
              onClick={() => setActiveConversation(conv.id)}
            />
          ))
        )}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'none',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              color: '#2F7CF6',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {/* User search modal */}
      {isModalOpen && <UserSearchModal onClose={() => setIsModalOpen(false)} />}
      {isGroupModalOpen && <CreateGroupModal onClose={() => setIsGroupModalOpen(false)} />}

      {/* Profile modal */}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
}
