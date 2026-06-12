'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getAvatarColor } from '@/lib/avatarColor';
import { useChatStore } from '@/store/chatStore';
import type { UserSearchResult } from '@chat-os/types';

interface CreateGroupModalProps {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [step, setStep] = useState<'members' | 'name'>('members');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const { setActiveConversation } = useChatStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step === 'members') {
      inputRef.current?.focus();
    } else {
      nameInputRef.current?.focus();
    }
  }, [step]);

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

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(value), 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const toggleUser = (user: UserSearchResult) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      return [...prev, user];
    });
  };

  const handleNext = () => {
    if (selectedUsers.length === 0) {
      setError('Select at least one member');
      return;
    }
    setError('');
    setStep('name');
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Enter a group name');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const { data: conversation } = await api.createGroupConversation({
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u.id),
      });
      setActiveConversation(conversation.id);
      onClose();
    } catch {
      setError('Could not create group. Please try again.');
      setIsCreating(false);
    }
  };

  const hasQuery = query.trim().length > 0;
  const showEmpty = hasQuery && !isLoading && results.length === 0 && !error;
  const visibleResults = results.filter((r) => !selectedUsers.find((u) => u.id === r.id));

  return (
    <>
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New group"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          width: '420px',
          maxWidth: '90vw',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            maxHeight: '560px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A' }}>
              {step === 'members' ? 'New Group' : 'Group Details'}
            </h2>
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

          {step === 'members' ? (
            <>
              {selectedUsers.length > 0 && (
                <div style={{ padding: '12px 20px 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: '#EAF2FF', color: '#2F7CF6',
                        borderRadius: '14px', padding: '4px 10px', fontSize: '13px', fontWeight: 500,
                      }}
                    >
                      {u.username}
                      <button
                        type="button"
                        onClick={() => toggleUser(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2F7CF6', display: 'flex', padding: 0 }}
                        aria-label={`Remove ${u.username}`}
                      >
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ padding: '12px 20px' }}>
                <label htmlFor="group-search-input" className="sr-only">Search by username or email</label>
                <input
                  id="group-search-input"
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search by username or email…"
                  style={{
                    width: '100%', border: 'none', outline: 'none',
                    fontSize: '14px', color: '#1A1A1A', background: '#F4F6F9',
                    borderRadius: '8px', padding: '10px 14px',
                  }}
                />
              </div>

              {error && (
                <p style={{ margin: '0 20px 8px', padding: '8px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '8px', fontSize: '13px', color: '#ef4444' }}>
                  {error}
                </p>
              )}

              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {isLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                    <div className="h-5 w-5 animate-spin rounded-full" style={{ border: '2px solid #E0E0E0', borderTopColor: '#2F7CF6' }} />
                  </div>
                )}
                {showEmpty && (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: '#AAAAAA' }}>No users found for &ldquo;{query}&rdquo;</p>
                  </div>
                )}
                {!hasQuery && !isLoading && selectedUsers.length === 0 && (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#AAAAAA' }}>Search for people to add to the group</p>
                  </div>
                )}
                {!isLoading && visibleResults.length > 0 && (
                  <ul role="listbox" aria-label="User results" style={{ padding: '4px 0' }}>
                    {visibleResults.map((user) => (
                      <li key={user.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onClick={() => toggleUser(user)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            width: '100%', padding: '12px 20px', background: 'transparent',
                            border: 'none', cursor: 'pointer', borderBottom: '1px solid #F0F2F5',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F8FF'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <div
                            style={{
                              width: '40px', height: '40px', borderRadius: '50%',
                              background: getAvatarColor(user.username),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '16px', fontWeight: 600, color: '#FFFFFF', flexShrink: 0,
                            }}
                          >
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '15px', fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{user.username}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F2F5' }}>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={selectedUsers.length === 0}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                    background: selectedUsers.length === 0 ? '#CBD5E1' : '#2F7CF6',
                    color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
                    cursor: selectedUsers.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next ({selectedUsers.length} selected)
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '20px' }}>
                <label htmlFor="group-name-input" style={{ fontSize: '12px', color: '#8A94A6', display: 'block', marginBottom: '6px' }}>
                  Group Name
                </label>
                <input
                  id="group-name-input"
                  ref={nameInputRef}
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Team"
                  maxLength={100}
                  style={{
                    width: '100%', border: '1px solid #E8ECF2', outline: 'none',
                    fontSize: '15px', color: '#1A1A1A', background: '#FFFFFF',
                    borderRadius: '8px', padding: '10px 14px',
                  }}
                />

                <p style={{ fontSize: '12px', color: '#8A94A6', margin: '16px 0 8px' }}>
                  Members ({selectedUsers.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: '#F4F6F9', color: '#1A1A1A',
                        borderRadius: '14px', padding: '4px 10px', fontSize: '13px',
                      }}
                    >
                      {u.username}
                    </span>
                  ))}
                </div>

                {error && (
                  <p style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '8px', fontSize: '13px', color: '#ef4444' }}>
                    {error}
                  </p>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F2F5', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setStep('members')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #E8ECF2',
                    background: '#FFFFFF', color: '#1A1A1A', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !groupName.trim()}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                    background: (!groupName.trim() || isCreating) ? '#CBD5E1' : '#2F7CF6',
                    color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
                    cursor: (!groupName.trim() || isCreating) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCreating ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}