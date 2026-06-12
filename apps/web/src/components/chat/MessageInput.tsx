'use client';

import { useState, useRef, useCallback } from 'react';
import { useTyping } from '@/hooks/useTyping';
import { api } from '@/lib/api';
import { ImagePreview } from './ImagePreview';

interface MessageInputProps {
  conversationId: string;
  isConnected: boolean;
  sendEvent: (event: string, payload: unknown) => boolean;
}

export function MessageInput({ conversationId, isConnected, sendEvent }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startTyping, stopTyping } = useTyping(sendEvent);

  const getFileType = (file: File): 'image' | 'video' | 'file' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!isConnected || uploadProgress !== null) return;

      const text = content.trim();

      // Case 1: Sending file attachment
      if (selectedFile) {
        setUploadProgress(0);
        setUploadError(null);
        const tempId = crypto.randomUUID();

        try {
          // Upload directly to Supabase Storage
          const publicUrl = await api.uploadFile(
            conversationId,
            tempId,
            selectedFile,
            (pct) => setUploadProgress(pct),
          );

          const fileType = getFileType(selectedFile);
          let contentField = publicUrl;

          if (fileType === 'file') {
            contentField = JSON.stringify({
              url: publicUrl,
              name: selectedFile.name,
              size: selectedFile.size,
            });
          } else if (text) {
            contentField = `${publicUrl}\n${text}`;
          }

          const sent = sendEvent('send_message', {
            conversation_id: conversationId,
            content: contentField,
            type: fileType,
            temp_id: tempId,
            reply_to_id: null,
          });

          if (sent) {
            setSelectedFile(null);
            setContent('');
            setUploadProgress(null);
            stopTyping(conversationId);
            if (inputRef.current) {
              inputRef.current.style.height = 'auto';
            }
          } else {
            setUploadError('Failed to dispatch real-time message');
            setUploadProgress(null);
          }
        } catch (err: any) {
          setUploadError(err?.message || 'File upload failed');
          setUploadProgress(null);
        }
        return;
      }

      // Case 2: Sending text-only message
      if (!text) return;

      const tempId = crypto.randomUUID();
      const sent = sendEvent('send_message', {
        conversation_id: conversationId,
        content: text,
        type: 'text',
        temp_id: tempId,
        reply_to_id: null,
      });

      if (sent) {
        setContent('');
        stopTyping(conversationId);
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
    },
    [content, isConnected, sendEvent, conversationId, stopTyping, selectedFile, uploadProgress],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`;

    if (e.target.value) {
      startTyping(conversationId);
    } else {
      stopTyping(conversationId);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      e.target.value = ''; // allow selecting same file again
    }
  };

  const canSend = (Boolean(content.trim()) || selectedFile) && isConnected && uploadProgress === null;

  return (
    <div
      style={{
        background: '#F4F6F9',
        flexShrink: 0,
      }}
    >
      {/* Upload error banner */}
      {uploadError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(220,38,38,0.1)',
            borderBottom: '1px solid rgba(220,38,38,0.2)',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && (
        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <ImagePreview file={selectedFile} onRemove={() => setSelectedFile(null)} />
        </div>
      )}

      {/* Upload progress bar */}
      {uploadProgress !== null && (
        <div style={{ width: '100%', background: 'rgba(0,0,0,0.1)', height: '3px', overflow: 'hidden' }}>
          <div
            style={{ background: '#2F7CF6', height: '100%', transition: 'width 0.2s ease-out', width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: '10px' }}>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
        />

        {/* Attach button */}
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={!isConnected || uploadProgress !== null}
          style={{
            background: 'none',
            border: 'none',
            cursor: !isConnected || uploadProgress !== null ? 'not-allowed' : 'pointer',
            padding: '6px',
            color: '#8A94A6',
            opacity: !isConnected || uploadProgress !== null ? 0.4 : 0.8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label="Attach file"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Input pill */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '8px 8px 8px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #E8ECF2',
          }}
        >
          <label htmlFor="message-input" className="sr-only">Message</label>
          <textarea
            id="message-input"
            ref={inputRef}
            rows={1}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Message' : 'Connecting…'}
            disabled={!isConnected || uploadProgress !== null}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#1A1A1A',
              background: 'transparent',
              padding: '2px 0',
              maxHeight: '144px',
              overflowY: 'auto',
              lineHeight: '1.4',
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            aria-label="Send message"
            disabled={!canSend}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: canSend ? '#2F7CF6' : '#CBD5E1',
              border: 'none',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s',
              marginLeft: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
