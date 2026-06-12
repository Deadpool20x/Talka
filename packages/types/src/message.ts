import { z } from 'zod';
import { uuidSchema } from './user';

// MessageType literal union
export const messageTypeSchema = z.enum(['text', 'image', 'file', 'system']);
export type MessageType = z.infer<typeof messageTypeSchema>;

// Message Content validation primitive
export const messageContentSchema = z.string().min(1).max(4000);

// Message database model schema
export const messageSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  senderId: uuidSchema.nullable(), // Null for system messages
  content: messageContentSchema,
  type: messageTypeSchema,
  tempId: uuidSchema.nullable(),
  replyToId: uuidSchema.nullable(),
  metadata: z.any().nullable().optional(),
  readBy: z.array(uuidSchema),
  createdAt: z.union([z.string().datetime(), z.date()]),
});

export interface Message extends z.infer<typeof messageSchema> {}

// SendMessagePayload
export const sendMessagePayloadSchema = z.object({
  conversationId: uuidSchema,
  content: messageContentSchema,
  type: z.enum(['text', 'image', 'file']), // client only sends text, image, or file
  tempId: uuidSchema,
  replyToId: uuidSchema.nullable().optional(),
});

export interface SendMessagePayload extends z.infer<typeof sendMessagePayloadSchema> {}

// ReceiveMessagePayload (same shape as full Message model)
export const receiveMessagePayloadSchema = messageSchema;
export interface ReceiveMessagePayload extends Message {}

// MarkReadPayload
export const markReadPayloadSchema = z.object({
  conversationId: uuidSchema,
  lastReadMessageId: uuidSchema,
});

export interface MarkReadPayload extends z.infer<typeof markReadPayloadSchema> {}

// BulkReadPayload
export const bulkReadPayloadSchema = z.object({
  conversationId: uuidSchema,
  lastMessageId: uuidSchema,
});

export interface BulkReadPayload extends z.infer<typeof bulkReadPayloadSchema> {}

// TypingPayload
export const typingPayloadSchema = z.object({
  conversationId: uuidSchema,
  isTyping: z.boolean(),
});

export interface TypingPayload extends z.infer<typeof typingPayloadSchema> {}
