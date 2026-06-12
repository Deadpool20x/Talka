'use client';

import { useEffect, useState } from 'react';

interface ImagePreviewProps {
  file: File;
  onRemove: () => void;
}

export function ImagePreview({ file, onRemove }: ImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  // Helper to format bytes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="relative flex items-center gap-3 bg-slate-800/90 border border-slate-700/60 p-3 rounded-xl backdrop-blur-md max-w-sm shadow-xl animate-fade-in group">
      {isImage && previewUrl ? (
        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
        </div>
      ) : isVideo ? (
        <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-slate-900 border border-slate-700 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      ) : (
        <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-slate-900 border border-slate-700 text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-xs font-medium text-slate-200 truncate">{file.name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-lg transition-transform hover:scale-105 active:scale-95 duration-200"
        aria-label="Remove attachment"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
