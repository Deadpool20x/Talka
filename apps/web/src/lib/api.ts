import axios, { type InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';
import type {
  Conversation,
  Message,
  PaginatedResponse,
  CreatePrivateConversationPayload,
  CreateGroupConversationPayload,
  UpdateGroupPayload,
  AddMemberPayload,
  SendMessagePayload,
  BulkReadPayload,
  UserProfile,
  UpdateProfilePayload,
  UserSearchResult,
  UploadPresignedPayload,
  UploadPresignedResponse,
} from '@chat-os/types';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach Supabase JWT from active session
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor — redirect to /login on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isAlreadyOnLogin = window.location.pathname === '/login';
      if (!isAlreadyOnLogin) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Typed API surface — mirrors REST_API.md §1–7
// ---------------------------------------------------------------------------

export const api = {
  // ── Health ──────────────────────────────────────────────────────────────
  health: () => apiClient.get<{ status: string }>('/health'),

  // ── Auth / User (REST_API.md §2) ────────────────────────────────────────
  getMe: () =>
    apiClient.get<UserProfile>('/me'),

  updateMe: (data: UpdateProfilePayload) =>
    apiClient.patch<UserProfile>('/me', data),

  searchUsers: (q: string, limit = 20) =>
    apiClient.get<{ data: UserSearchResult[]; meta: { limit: number; total: number } }>(
      `/users/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  // ── Conversations (REST_API.md §3) ──────────────────────────────────────
  getConversations: (limit = 50, cursor?: string) =>
    apiClient.get<PaginatedResponse<Conversation>>(
      `/conversations?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
    ),

  createPrivateConversation: (data: CreatePrivateConversationPayload) =>
    apiClient.post<Conversation>('/conversations/private', data),

  createGroupConversation: (data: CreateGroupConversationPayload) =>
    apiClient.post<Conversation>('/conversations/group', data),

  getConversation: (id: string) =>
    apiClient.get<Conversation>(`/conversations/${id}`),

  deleteConversation: (id: string) =>
    apiClient.delete(`/conversations/${id}`),

  addMembers: (id: string, data: AddMemberPayload) =>
    apiClient.post<Conversation>(`/conversations/${id}/members`, data),

  removeMember: (id: string, userId: string) =>
    apiClient.delete(`/conversations/${id}/members/${userId}`),

  updateGroup: (id: string, data: UpdateGroupPayload) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, data),

  // ── Messages (REST_API.md §5) ────────────────────────────────────────────
  getMessages: (
    conversationId: string,
    limit = 50,
    cursor?: string,
    direction: 'older' | 'newer' = 'older',
  ) =>
    apiClient.get<PaginatedResponse<Message>>(
      `/conversations/${conversationId}/messages?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}&direction=${direction}`,
    ),

  sendMessage: (data: SendMessagePayload) =>
    apiClient.post<Message>('/messages', data),

  markMessageRead: (messageId: string) =>
    apiClient.post(`/messages/${messageId}/read`),

  bulkMarkRead: (data: BulkReadPayload) =>
    apiClient.post<{ updatedCount: number }>('/messages/bulk-read', data),

  // ── Upload (REST_API.md §7) ──────────────────────────────────────────────
  getPresignedUrl: (data: UploadPresignedPayload) =>
    apiClient.post<UploadPresignedResponse>('/upload/presigned', data),

  uploadFile: async (
    conversationId: string,
    messageId: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<string> => {
    const bucketName = 'chat-attachments';

    try {
      await supabase.storage.createBucket(bucketName, {
        public: true,
      });
    } catch {
      // Ignored: bucket may already exist or lack permission
    }

    const cleanFileName = file.name.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
    const filePath = `${conversationId}/${messageId}-${cleanFileName}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: (progressEvent: any) => {
          if (onProgress && progressEvent?.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      } as any);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  },
};

export default apiClient;
