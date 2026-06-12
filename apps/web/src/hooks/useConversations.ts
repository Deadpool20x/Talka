'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import type { ConversationWithParticipants } from '@chat-os/types';

/**
 * useConversations — loads and paginates the conversation list.
 *
 * Fixes spec stale-closure bug: cursor + conversations are stored in refs
 * so loadConversations doesn't re-create on every render.
 */
export function useConversations() {
  const { conversations, setConversations, addConversation } = useChatStore();
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Refs for pagination state — avoid stale closure in loadConversations
  const cursorRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);

  const loadConversations = useCallback(
    async (reset = false) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const cursor = reset ? undefined : cursorRef.current;
        const { data } = await api.getConversations(50, cursor);

        if (reset) {
          setConversations(data.data);
        } else {
          // Append pages without triggering stale closure on `conversations`
          const current = useChatStore.getState().conversations;
          setConversations([...current, ...data.data]);
        }

        const { setUnreadCount } = useChatStore.getState();
        const activeId = useChatStore.getState().activeConversationId;
        data.data.forEach((conv: any) => {
          const count = conv.unread_count ?? conv.unreadCount ?? 0;
          if (count > 0 && conv.id !== activeId) {
            setUnreadCount(conv.id, count);
          } else {
            setUnreadCount(conv.id, 0);
          }
        });

        setHasMore(data.meta.hasMore);
        cursorRef.current = data.meta.nextCursor;
      } catch (err) {
        console.error('[useConversations] Failed to load:', err);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [setConversations],
  );

  // Initial load — runs once on mount
  useEffect(() => {
    loadConversations(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => loadConversations(true), [loadConversations]);
  const loadMore = useCallback(() => loadConversations(false), [loadConversations]);

  const createPrivate = useCallback(
    async (participantId: string): Promise<ConversationWithParticipants> => {
      const { data } = await api.createPrivateConversation({ participantId });
      addConversation(data);
      return data;
    },
    [addConversation],
  );

  const createGroup = useCallback(
    async (name: string, memberIds: string[]): Promise<ConversationWithParticipants> => {
      const { data } = await api.createGroupConversation({ name, memberIds });
      addConversation(data);
      return data;
    },
    [addConversation],
  );

  return {
    conversations,
    isLoading,
    hasMore,
    loadMore,
    refresh,
    createPrivate,
    createGroup,
  };
}
