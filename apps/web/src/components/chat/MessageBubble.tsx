'use client';

import { useState } from 'react';
import type { Message } from '@chat-os/types';
import { getAvatarColor } from '@/lib/avatarColor';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  senderName?: string;
}

// Check icon (single tick)
function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Double check icon (read receipt)
function DoubleCheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 13l4 4L13 7M9 13l4 4L21 7" />
    </svg>
  );
}

export function MessageBubble({ message, isOwn, senderName }: MessageBubbleProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const rawDate = message.createdAt ? new Date(message.createdAt) : new Date();
  const time = isNaN(rawDate.getTime())
    ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isRead = message.readBy != null && message.readBy.length > 0;
  // Optimistic messages have a tempId and no real id yet
  const isPending = Boolean(message.tempId) && !message.id;

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Render attachment depending on message.type
  const renderContent = () => {
    const type = message.type;

    if (type === 'image') {
      const [imageUrl, ...captionParts] = message.content.split('\n');
      const caption = captionParts.join('\n');

      return (
        <div className="flex flex-col gap-1.5">
          <div className="relative group/img overflow-hidden rounded-lg max-w-[300px] border border-slate-600/40 shadow-sm cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={caption || 'Sent image'}
              className="max-h-[220px] w-full object-cover transition-transform duration-300 group-hover/img:scale-102 hover:opacity-95"
            />
            <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </div>
          </div>
          {caption && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed mt-1 px-1">
              {caption}
            </p>
          )}

          {/* Lightbox Modal */}
          {isLightboxOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsLightboxOpen(false)}>
              <button
                type="button"
                className="absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2 shadow-lg hover:scale-105 active:scale-95 duration-200 transition-all border border-slate-600/30"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close image lightbox"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={caption || 'Enlarged view'}
                className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              />
              {caption && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-xl text-sm text-slate-200 shadow-xl max-w-lg truncate">
                  {caption}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (type === 'file') {
      let fileData = { url: '', name: 'Attachment', size: 0, mimeType: '' };
      try {
        fileData = JSON.parse(message.content);
      } catch {
        fileData = { url: message.content, name: 'Attachment', size: 0, mimeType: '' };
      }

      // If the file is actually a video, render a video player
      if (fileData.mimeType?.startsWith('video/')) {
        return (
          <div className="flex flex-col gap-1.5">
            <video
              controls
              src={fileData.url}
              className="max-w-[300px] rounded-lg border border-slate-600/40 shadow-sm overflow-hidden"
            />
          </div>
        );
      }

      return (
        <a
          href={fileData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate-700/80 hover:bg-slate-700 p-3.5 rounded-xl flex items-center gap-3 border border-slate-600/40 shadow-sm transition-all duration-200 group/card text-slate-100 max-w-[280px]"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 border border-slate-600/60 text-slate-300 group-hover/card:bg-slate-900 transition-colors">
            <svg className="w-5 h-5 text-sky-400 group-hover/card:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate group-hover/card:text-sky-300 transition-colors">{fileData.name}</p>
            {fileData.size > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(fileData.size)}</p>
            )}
          </div>
        </a>
      );
    }

    // Default text or system render
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {message.content}
      </p>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        padding: '2px 16px',
        marginBottom: '2px',
      }}
      aria-label={isOwn ? 'Your message' : 'Message from other'}
    >
      <div
        style={{
          maxWidth: '65%',
          background: isOwn ? '#2F7CF6' : '#FFFFFF',
          color: isOwn ? '#FFFFFF' : '#1A1A1A',
          borderRadius: isOwn
            ? '18px 18px 4px 18px'
            : '18px 18px 18px 4px',
          padding: '8px 12px 6px 12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          wordBreak: 'break-word',
          position: 'relative',
          opacity: isPending ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {/* Message content (text, image, file) */}
        <div style={{ paddingRight: isOwn ? '40px' : '36px' }}>
          {senderName && !isOwn && (
            <p style={{
              margin: '0 0 2px 0',
              fontSize: '12px',
              fontWeight: 600,
              color: getAvatarColor(senderName),
            }}>
              {senderName}
            </p>
          )}
          {renderContent()}
        </div>

        {/* Timestamp + read tick */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '3px',
            position: 'absolute',
            bottom: '6px',
            right: '10px',
          }}
        >
          <time
            dateTime={String(message.createdAt)}
            style={{
              fontSize: '11px',
              color: isOwn ? 'rgba(255,255,255,0.75)' : '#B0B8C9',
              whiteSpace: 'nowrap',
            }}
          >
            {time}
          </time>
          {isOwn && (
            <svg
              width="14"
              height="10"
              viewBox="0 0 16 11"
              fill={isRead ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
              aria-label={isRead ? 'Read' : 'Delivered'}
            >
              {isRead ? (
                <path d="M0.5 5.5L4 9L8.5 2M5.5 9L10 2M8 9L15 2" stroke={isRead ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              ) : (
                <path d="M1 5.5L5 9.5L15 1.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
