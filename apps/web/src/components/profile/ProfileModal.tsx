'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getAvatarColor } from '@/lib/avatarColor';

interface ProfileModalProps {
  onClose: () => void;
}

// The /me endpoint returns snake_case fields with email + created_at
interface MeResponse {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      setIsLoading(true);
      api
        .getMe()
        .then(({ data }) => {
          if (!mounted) return;
          const raw = data as unknown as MeResponse;
          setProfile(raw);
          setUsernameInput(raw.username ?? '');
          setIsLoading(false);
          setError(null);
        })
        .catch((err) => {
          if (!mounted) return;
          console.error('[ProfileModal] Failed to load profile:', err);
          setError('Failed to load profile. Please try again.');
          setIsLoading(false);
        });
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveUsername = async () => {
    if (!usernameInput.trim() || usernameInput === profile?.username) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const { data } = await api.updateMe({ username: usernameInput.trim() });
      // Merge updated fields back (updateMe returns UserProfile shape)
      setProfile((prev) =>
        prev ? { ...prev, username: (data as unknown as MeResponse).username ?? usernameInput.trim() } : prev,
      );
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to update username');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    // Reset so same file can be selected again
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB');
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);
    try {
      // uploadFile('avatars', userId, file) → uploads to `avatars/{userId}-{filename}`
      const publicUrl = await api.uploadFile('avatars', profile.id, file);
      await api.updateMe({ avatarUrl: publicUrl });
      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
    } catch (err: any) {
      console.error('[ProfileModal] Avatar upload failed:', err);
      setError('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  const avatarInitial = profile?.username?.charAt(0)?.toUpperCase() ?? '?';
  const avatarBg = profile ? getAvatarColor(profile.username) : '#8A94A6';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '380px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F0F2F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #4D8DFF 0%, #2F7CF6 100%)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
            Profile
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#FFFFFF',
              lineHeight: 1,
              padding: '6px 8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close profile"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ padding: '28px 24px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '3px solid #E8ECF2',
                  borderTopColor: '#2F7CF6',
                  margin: '0 auto 12px',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '14px', color: '#8A94A6' }}>Loading profile…</span>
            </div>
          ) : profile ? (
            <>
              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                <div
                  onClick={handleAvatarClick}
                  style={{
                    width: '88px',
                    height: '88px',
                    borderRadius: '50%',
                    background: profile.avatar_url ? 'transparent' : avatarBg,
                    backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    position: 'relative',
                    marginBottom: '10px',
                    boxShadow: '0 4px 16px rgba(47,124,246,0.3)',
                    border: '3px solid #FFFFFF',
                    outline: '2px solid #2F7CF6',
                    transition: 'transform 0.15s ease',
                  }}
                  title="Click to change photo"
                >
                  {!profile.avatar_url && avatarInitial}

                  {/* Upload overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: isUploadingAvatar ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                  >
                    {isUploadingAvatar ? (
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid rgba(255,255,255,0.4)',
                          borderTopColor: '#FFFFFF',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    ) : null}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                  aria-label="Upload profile photo"
                />

                <button
                  onClick={handleAvatarClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#2F7CF6',
                    fontWeight: 600,
                    padding: '2px 0',
                  }}
                >
                  Change photo
                </button>
              </div>

              {/* Username */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#8A94A6', fontWeight: 500, display: 'block', marginBottom: '6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Username
                </label>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveUsername();
                        if (e.key === 'Escape') { setIsEditing(false); setUsernameInput(profile.username); }
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        fontSize: '15px',
                        color: '#1A1A1A',
                        border: '2px solid #2F7CF6',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        outline: 'none',
                        background: '#F8FAFF',
                      }}
                    />
                    <button
                      onClick={handleSaveUsername}
                      disabled={isSaving}
                      style={{
                        background: '#2F7CF6',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                        minWidth: '56px',
                      }}
                    >
                      {isSaving ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setUsernameInput(profile.username); }}
                      style={{
                        background: '#F4F6F9',
                        color: '#8A94A6',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditing(true)}
                    style={{
                      fontSize: '15px',
                      color: '#1A1A1A',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E8ECF2',
                      background: '#FAFBFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2F7CF6')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E8ECF2')}
                    title="Click to edit username"
                  >
                    <span>{profile.username}</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#2F7CF6" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#8A94A6', fontWeight: 500, display: 'block', marginBottom: '6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Email
                </label>
                <div style={{ fontSize: '15px', color: '#1A1A1A', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8ECF2', background: '#FAFBFC' }}>
                  {profile.email}
                </div>
              </div>

              {/* Member since */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: '#8A94A6', fontWeight: 500, display: 'block', marginBottom: '6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Member since
                </label>
                <div style={{ fontSize: '15px', color: '#1A1A1A', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8ECF2', background: '#FAFBFC' }}>
                  {new Date(profile.created_at).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#FF6B6B',
                    background: 'rgba(255,107,107,0.08)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: '#FFF0F0',
                  color: '#FF6B6B',
                  border: '1px solid rgba(255,107,107,0.2)',
                  borderRadius: '10px',
                  padding: '13px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FFE0E0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF0F0')}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Log out
              </button>
            </>
          ) : error && !profile ? (
            <div
              style={{
                textAlign: 'center',
                color: '#FF6B6B',
                fontSize: '14px',
                padding: '32px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span>{error}</span>
              <button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  api
                    .getMe()
                    .then(({ data }) => {
                      const raw = data as unknown as MeResponse;
                      setProfile(raw);
                      setUsernameInput(raw.username ?? '');
                      setIsLoading(false);
                      setError(null);
                    })
                    .catch((err) => {
                      console.error('[ProfileModal] Retry failed:', err);
                      setError('Failed to load profile. Please try again.');
                      setIsLoading(false);
                    });
                }}
                style={{
                  background: '#2F7CF6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Spinner keyframes injected via style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
