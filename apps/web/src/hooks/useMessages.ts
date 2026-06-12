'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';

/**
 * useMessages — loads message history for a conversation with scroll-up pagination.
 *
 * Fixes spec stale-closure bug: cursor is a ref, store is read via getState()
 * on append so the hook doesn't re-create every render.
 */
export function useMessages(conversationId: string | null) {
  const { setMessages, prependMessages } = useChatStore();

  const messages = useChatStore(
    (s) => (conversationId ? (s.messages[conversationId] ?? []) : []),
  );

  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Pagination refs — stable across renders
  const cursorRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);
  // Track which conversationId we last loaded to reset on conversation change
  const loadedForRef = useRef<string | null>(null);

  const loadMessages = useCallback(
    async (reset = false) => {
      if (!conversationId) return;
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const cursor = reset ? undefined : cursorRef.current;
        const { data } = await api.getMessages(conversationId, 50, cursor, 'older');

        const mapped = data.data.map((m: any) => ({
          id: m.id,
          conversationId: m.conversation_id ?? m.conversationId,
          senderId: m.sender_id ?? m.senderId,
          content: m.content,
          type: m.type,
          tempId: m.temp_id ?? m.tempId,
          replyToId: m.reply_to_id ?? m.replyToId,
          metadata: m.metadata,
          readBy: m.read_by ?? m.readBy ?? [],
          createdAt: m.created_at ?? m.createdAt,
        }));

        if (reset) {
          setMessages(conversationId, mapped);
        } else {
          // Prepend older pages at the top of the message list
          prependMessages(conversationId, mapped);
        }

        setHasMore(data.meta.has_more ?? data.meta.hasMore ?? false);
        cursorRef.current = data.meta.next_cursor ?? data.meta.nextCursor;
        loadedForRef.current = conversationId;
      } catch (err) {
        console.error('[useMessages] Failed to load:', err);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [conversationId, setMessages, prependMessages],
  );

  // Reload when active conversation changes
  useEffect(() => {
    if (!conversationId) return;
    // Reset pagination state for the new conversation
    cursorRef.current = undefined;
    setHasMore(true);
    loadMessages(true);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => loadMessages(false), [loadMessages]);

  /**
   * Mark conversation as read via REST (EVENT_PROTOCOL.md §5.1 message flow).
   * WebSocket send_message is handled by the parent component via sendEvent.
   */
  const markRead = useCallback(
    async (lastMessageId: string) => {
      if (!conversationId) return;
      try {
        await api.bulkMarkRead({ conversationId, lastMessageId });
      } catch (err) {
        console.error('[useMessages] markRead failed:', err);
      }
    },
    [conversationId],
  );

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    markRead,
  };
}
