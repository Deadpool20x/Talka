'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getAvatarColor } from '@/lib/avatarColor';
import { useChatStore } from '@/store/chatStore';
import type { UserSearchResult } from '@chat-os/types';

interface UserSearchModalProps {
  onClose: () => void;
}

export function UserSearchModal({ onClose }: UserSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null); // userId being created
  const [error, setError] = useState('');

  const { setActiveConversation } = useChatStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.searchUsers(q);
      setResults(data.data);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search — 300ms
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(value), 300);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleSelectUser = async (user: UserSearchResult) => {
    if (isCreating) return;
    setIsCreating(user.id);
    setError('');
    try {
      const { data: conversation } = await api.createPrivateConversation({
        participantId: user.id,
      });
      setActiveConversation(conversation.id);
      onClose();
    } catch {
      setError('Could not start conversation. Please try again.');
      setIsCreating(null);
    }
  };

  const hasQuery = query.trim().length > 0;
  const showEmpty = hasQuery && !isLoading && results.length === 0 && !error;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New chat"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          width: '400px',
          maxWidth: '90vw',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            maxHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          {/* Modal header */}
          <div
            style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A' }}>New Chat</h2>
            <button
              type="button"
              aria-label="Close modal"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#AAAAAA', display: 'flex', alignItems: 'center', borderRadius: '50%' }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search input */}
          <div style={{ padding: '12px 20px' }}>
            <label htmlFor="user-search-input" className="sr-only">Search by username or email</label>
            <input
              id="user-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search by username or email…"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: '#1A1A1A',
                background: '#F4F6F9',
                borderRadius: '8px',
                padding: '10px 14px',
              }}
            />
          </div>

          {/* Error banner */}
          {error && (
            <p style={{ margin: '0 20px 8px', padding: '8px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '8px', fontSize: '13px', color: '#ef4444' }}>
              {error}
            </p>
          )}

          {/* Results list */}
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {/* Loading */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                <div className="h-5 w-5 animate-spin rounded-full" style={{ border: '2px solid #E0E0E0', borderTopColor: '#2F7CF6' }} />
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#AAAAAA' }}>No users found for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {/* Initial prompt */}
            {!hasQuery && !isLoading && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#AAAAAA' }}>Type a name or email to search</p>
              </div>
            )}

            {/* User results */}
            {!isLoading && results.length > 0 && (
              <ul role="listbox" aria-label="User results" style={{ padding: '4px 0' }}>
                {results.map((user) => (
                  <li key={user.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      disabled={isCreating === user.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px 20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: isCreating === user.id ? 'wait' : 'pointer',
                        borderBottom: '1px solid #F0F2F5',
                        textAlign: 'left',
                        opacity: isCreating === user.id ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F8FF'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      {/* Avatar circle */}
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: getAvatarColor(user.username),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#FFFFFF',
                          flexShrink: 0,
                        }}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{user.username}</p>
                      </div>
                      {isCreating === user.id ? (
                        <div className="h-4 w-4 shrink-0 animate-spin rounded-full" style={{ border: '2px solid #E0E0E0', borderTopColor: '#2F7CF6' }} />
                      ) : (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#AAAAAA" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
