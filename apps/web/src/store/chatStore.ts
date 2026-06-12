import { create } from 'zustand';
import type { ConversationWithParticipants, Message, PresenceUpdate } from '@chat-os/types';

interface ChatState {
  conversations: ConversationWithParticipants[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  /** convId → userId → isTyping */
  typingUsers: Record<string, Record<string, boolean>>;
  presence: Record<string, PresenceUpdate>;
  unreadCounts: Record<string, number>;
  isSidebarOpen: boolean;

  // Actions
  setConversations: (conversations: ConversationWithParticipants[]) => void;
  addConversation: (conversation: ConversationWithParticipants) => void;
  updateConversation: (id: string, updates: Partial<ConversationWithParticipants>) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  markMessagesRead: (conversationId: string, readerId: string, lastReadMessageId: string) => void;
  setPresence: (update: PresenceUpdate) => void;
  setUnreadCount: (conversationId: string, count: number) => void;
  incrementUnread: (conversationId: string) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

const initialState = {
  conversations: [] as ConversationWithParticipants[],
  activeConversationId: null as string | null,
  messages: {} as Record<string, Message[]>,
  typingUsers: {} as Record<string, Record<string, boolean>>,
  presence: {} as Record<string, PresenceUpdate>,
  unreadCounts: {} as Record<string, number>,
  isSidebarOpen: true,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((s) => ({ conversations: [conversation, ...s.conversations] })),

  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  setActiveConversation: (id) => set((s) => ({
    activeConversationId: id,
    unreadCounts: id 
      ? { ...s.unreadCounts, [id]: 0 }
      : s.unreadCounts,
  })),

  // Replace the message list for a conversation (initial load)
  setMessages: (conversationId, messages) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: messages } })),

  // Prepend older messages at the top (pagination scroll-up)
  prependMessages: (conversationId, messages) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...messages, ...(s.messages[conversationId] ?? [])],
      },
    })),

  // Append a new message — deduplicates by tempId to handle optimistic → confirmed swap
  appendMessage: (conversationId, message) =>
    set((s) => {
      const existing = s.messages[conversationId] ?? [];
      const filtered =
        message.tempId
          ? existing.filter((m) => m.tempId !== message.tempId)
          : existing;
      const updatedConversations = s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const createdAtStr = typeof message.createdAt === 'string'
          ? message.createdAt
          : (message.createdAt instanceof Date ? message.createdAt.toISOString() : new Date().toISOString());
        return {
          ...c,
          last_message: {
            id: message.id ?? '',
            content: message.content,
            sender_id: message.senderId ?? '',
            created_at: createdAtStr,
          },
          updatedAt: message.createdAt ?? new Date(),
          updated_at: message.createdAt ?? new Date().toISOString(),
        };
      });
      return {
        messages: { ...s.messages, [conversationId]: [...filtered, message] },
        conversations: updatedConversations,
      };
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m,
        ),
      },
    })),

  setTyping: (conversationId, userId, isTyping) =>
    set((s) => ({
      typingUsers: {
        ...s.typingUsers,
        [conversationId]: { ...s.typingUsers[conversationId], [userId]: isTyping },
      },
    })),

  markMessagesRead: (conversationId, readerId, lastReadMessageId) =>
    set((s) => {
      const messages = s.messages[conversationId] ?? [];
      
      const anchorMessage = messages.find((m) => m.id === lastReadMessageId);
      
      const updated = messages.map((m) => {
        const isBeforeOrAtAnchor = anchorMessage
          ? new Date(m.createdAt ?? 0).getTime() <= new Date(anchorMessage.createdAt ?? 0).getTime()
          : true; // fallback to marking all as read if anchor message is not found

        if (isBeforeOrAtAnchor) {
          const alreadyRead = m.readBy?.includes(readerId);
          if (!alreadyRead) {
            return { ...m, readBy: [...(m.readBy ?? []), readerId] };
          }
        }
        return m;
      });

      return {
        messages: {
          ...s.messages,
          [conversationId]: updated,
        },
      };
    }),

  setPresence: (update) =>
    set((s) => ({ presence: { ...s.presence, [update.userId]: update } })),

  setUnreadCount: (conversationId, count) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [conversationId]: count } })),

  incrementUnread: (conversationId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [conversationId]: (s.unreadCounts[conversationId] ?? 0) + 1,
      },
    })),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  reset: () => set(initialState),
}));

// ---------------------------------------------------------------------------
// Typed selectors — use these in components to minimise re-renders
// ---------------------------------------------------------------------------
export const selectConversations = (s: ChatState) => s.conversations;
export const selectActiveConversationId = (s: ChatState) => s.activeConversationId;
export const selectMessages = (conversationId: string) => (s: ChatState) =>
  s.messages[conversationId] ?? [];
export const selectTypingUsers = (conversationId: string) => (s: ChatState) =>
  s.typingUsers[conversationId] ?? {};
export const selectPresence = (userId: string) => (s: ChatState) => s.presence[userId];
export const selectUnreadCount = (conversationId: string) => (s: ChatState) =>
  s.unreadCounts[conversationId] ?? 0;
export const selectIsSidebarOpen = (s: ChatState) => s.isSidebarOpen;
