'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useGateway } from '@/hooks/useGateway';
import { useChatEvents } from '@/hooks/useChatEvents';

export default function ChatPage() {
  const { isAuthenticated, isLoading, init } = useAuthStore();
  const router = useRouter();

  // Hydrate auth state from Supabase session on mount and subscribe to changes
  useEffect(() => {
    const unsubscribe = init();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [init]);

  // Redirect unauthenticated users after hydration
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Single WebSocket connection for the entire chat page — hoisted here so
  // re-renders of ChatWindow do NOT create new connections.
  const { socketRef, isConnected, joinRoom, leaveRoom, sendEvent } = useGateway();

  // Wire all Gateway→Client events to the Zustand store (single listener)
  useChatEvents(socketRef, isConnected);

  // Full-screen loading spinner while hydrating
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-green-500" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar />
      <ChatWindow
        socketRef={socketRef}
        isConnected={isConnected}
        joinRoom={joinRoom}
        leaveRoom={leaveRoom}
        sendEvent={sendEvent}
      />
    </main>
  );
}
