'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import type { Message, PresenceUpdate } from '@chat-os/types';
import type { UserJoinedPayload, UserLeftPayload, GatewayErrorPayload } from '@chat-os/types';

// ---------------------------------------------------------------------------
// Payload shapes for Gateway→Client events (EVENT_PROTOCOL.md §3)
// Gateway sends camelCase per gateway.ts type definitions
// ---------------------------------------------------------------------------

interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface MessageReadPayload {
  conversationId: string;
  readerId: string;
  lastReadMessageId: string;
}

interface PongPayload {
  serverTime: string;
}

interface GatewayFrame {
  event: string;
  payload: unknown;
}

/**
 * useChatEvents — subscribes to all Gateway→Client events from EVENT_PROTOCOL.md §3
 * and dispatches them to the Zustand chat store.
 *
 * Must be called inside a component that also calls useGateway so socketRef is fresh.
 */
export function useChatEvents(socketRef: React.MutableRefObject<WebSocket | null>, isConnected?: boolean) {
  const {
    appendMessage,
    updateMessage,
    setTyping,
    setPresence,
    incrementUnread,
    activeConversationId,
    markMessagesRead,
  } = useChatStore();

  const { userId } = useAuthStore();
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Automatically mark active conversation messages as read
  const activeMessages = useChatStore((s) =>
    activeConversationId ? (s.messages[activeConversationId] ?? []) : []
  );

  useEffect(() => {
    const socket = socketRef.current;
    if (!activeConversationId || !socket || socket.readyState !== WebSocket.OPEN || !userId) return;

    if (activeMessages.length === 0) return;

    // Sort active messages chronologically (ascending: oldest first, newest last)
    const sortedMessages = [...activeMessages].sort(
      (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    );

    // Find the last message that was NOT sent by the current user
    const lastMessage = [...sortedMessages].reverse().find((m) => m.senderId !== userId);
    if (!lastMessage) return;

    // Check if the current user has already read it
    if (lastMessage.readBy?.includes(userId)) return;

    socket.send(
      JSON.stringify({
        event: 'mark_read',
        payload: {
          conversation_id: activeConversationId,
          last_read_message_id: lastMessage.id,
        },
      })
    );
  }, [activeConversationId, activeMessages, socketRef, userId, isConnected]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (event: MessageEvent<string>) => {
      let frame: GatewayFrame;
      try {
        frame = JSON.parse(event.data) as GatewayFrame;
      } catch {
        console.error('[useChatEvents] Failed to parse WebSocket frame');
        return;
      }

      const { event: eventName, payload } = frame;

      switch (eventName) {
        // ── EVENT_PROTOCOL.md §3.1 receive_message ──────────────────────────
        case 'receive_message': {
          const msgPayload = payload as any;
          const msg: Message = {
            id: msgPayload.id,
            conversationId: msgPayload.conversation_id,
            senderId: msgPayload.sender_id,
            content: msgPayload.content,
            type: msgPayload.type,
            tempId: msgPayload.temp_id,
            replyToId: msgPayload.reply_to_id,
            metadata: msgPayload.metadata,
            readBy: msgPayload.read_by || [],
            createdAt: msgPayload.created_at,
          };
          const existingMessages = useChatStore.getState().messages[msg.conversationId] ?? [];
          const alreadyExists = existingMessages.some(
            (m) => m.id === msg.id || (msg.tempId && m.tempId === msg.tempId)
          );
          if (alreadyExists) break;

          appendMessage(msg.conversationId, msg);

          // Increment unread only for messages from others in non-active conversations
          if (msg.conversationId !== activeConversationId && msg.senderId !== userId) {
            incrementUnread(msg.conversationId);
          }
          break;
        }

        // ── EVENT_PROTOCOL.md §3.2 message_read ─────────────────────────────
        case 'message_read': {
          const p = payload as any;
          const cid = p.conversation_id ?? p.conversationId;
          const readerId = p.reader_id ?? p.readerId;
          const lastReadMessageId = p.last_read_message_id ?? p.lastReadMessageId;

          if (cid && readerId && lastReadMessageId) {
            markMessagesRead(cid, readerId, lastReadMessageId);
          }
          break;
        }

        // ── EVENT_PROTOCOL.md §3.3 typing ───────────────────────────────────
        case 'typing': {
          const p = payload as any;
          const cid = p.conversation_id;
          const uid = p.user_id;
          const isTyping = p.is_typing;

          if (cid && uid) {
            setTyping(cid, uid, isTyping);

            const timerKey = `${cid}:${uid}`;
            if (typingTimers.current[timerKey]) {
              clearTimeout(typingTimers.current[timerKey]);
              delete typingTimers.current[timerKey];
            }

            if (isTyping) {
              typingTimers.current[timerKey] = setTimeout(() => {
                setTyping(cid, uid, false);
                delete typingTimers.current[timerKey];
              }, 5_000);
            }
          }
          break;
        }

        // ── EVENT_PROTOCOL.md §3.6 user_online ──────────────────────────────
        case 'user_online': {
          const p = payload as any;
          setPresence({
            userId: p.userId ?? p.user_id,
            status: 'online',
            lastSeen: p.lastSeen ?? p.last_seen ?? new Date().toISOString(),
          });
          break;
        }

        // ── EVENT_PROTOCOL.md §3.7 user_offline ─────────────────────────────
        case 'user_offline': {
          const p = payload as any;
          setPresence({
            userId: p.userId ?? p.user_id,
            status: 'offline',
            lastSeen: p.lastSeen ?? p.last_seen ?? new Date().toISOString(),
          });
          break;
        }

        // ── EVENT_PROTOCOL.md §3.8 user_joined ──────────────────────────────
        case 'user_joined': {
          // Presence join broadcast — participant list update handled in 4E
          const _p = payload as UserJoinedPayload;
          void _p;
          break;
        }

        // ── EVENT_PROTOCOL.md §3.9 user_left ────────────────────────────────
        case 'user_left': {
          const _p = payload as UserLeftPayload;
          void _p;
          break;
        }

        // ── EVENT_PROTOCOL.md §3.5 pong ─────────────────────────────────────
        case 'pong': {
          const _p = payload as PongPayload;
          void _p; // heartbeat acknowledged — no state update needed
          break;
        }

        // ── EVENT_PROTOCOL.md §3.10 error ───────────────────────────────────
        case 'error': {
          const err = payload as GatewayErrorPayload;
          console.error('[Gateway] Error:', err.code, err.message);
          break;
        }

        default:
          console.warn('[useChatEvents] Unknown gateway event:', eventName);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => {
      socket.removeEventListener('message', handleMessage);
      // Clean up any remaining typing timers on unmount
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
    };
  }, [
    socketRef,
    appendMessage,
    updateMessage,
    setTyping,
    setPresence,
    incrementUnread,
    activeConversationId,
    userId,
    markMessagesRead,
    activeMessages,
    isConnected,
  ]);
}
