import { z } from 'zod';
import { uuidSchema } from './user';

// ConversationType literal union
export const conversationTypeSchema = z.enum(['private', 'group']);
export type ConversationType = z.infer<typeof conversationTypeSchema>;

// ParticipantRole literal union
export const participantRoleSchema = z.enum(['admin', 'member']);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

// Group Name validation primitive
export const groupNameSchema = z.string().min(1).max(100);

// Conversation database model schema
export const conversationSchema = z.object({
  id: uuidSchema,
  type: conversationTypeSchema,
  name: groupNameSchema.nullable(),
  createdBy: uuidSchema,
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
  deletedAt: z.union([z.string().datetime(), z.date()]).nullable(),
});

export interface Conversation extends z.infer<typeof conversationSchema> {}

// ---------------------------------------------------------------------------
// API response participant shape — GET /conversations embeds participant
// summaries with username and status. Use ConversationWithParticipants in
// components that need to display participant names or online status.
// ---------------------------------------------------------------------------
export interface ConversationParticipant {
  id: string;
  username: string;
  avatar_url: string | null;
  role: ParticipantRole;
  /** Live presence status from the gateway */
  status: 'online' | 'offline' | 'away';
}

/** Extended conversation shape returned by GET /conversations & related endpoints */
export interface ConversationWithParticipants extends Conversation {
  participants?: ConversationParticipant[];
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count?: number;
}


// Participant database model schema
export const participantSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  userId: uuidSchema,
  role: participantRoleSchema,
  joinedAt: z.union([z.string().datetime(), z.date()]),
  leftAt: z.union([z.string().datetime(), z.date()]).nullable(),
});

export interface Participant extends z.infer<typeof participantSchema> {}

// CreatePrivateConversationPayload
export const createPrivateConversationPayloadSchema = z.object({
  participantId: uuidSchema,
});

export interface CreatePrivateConversationPayload extends z.infer<typeof createPrivateConversationPayloadSchema> {}

// CreateGroupConversationPayload
export const createGroupConversationPayloadSchema = z.object({
  name: groupNameSchema,
  memberIds: z.array(uuidSchema).min(1).max(499),
});

export interface CreateGroupConversationPayload extends z.infer<typeof createGroupConversationPayloadSchema> {}

// UpdateGroupPayload
export const updateGroupPayloadSchema = z.object({
  name: groupNameSchema.optional(),
});

export interface UpdateGroupPayload extends z.infer<typeof updateGroupPayloadSchema> {}

// AddMemberPayload
export const addMemberPayloadSchema = z.object({
  memberIds: z.array(uuidSchema),
});

export interface AddMemberPayload extends z.infer<typeof addMemberPayloadSchema> {}
