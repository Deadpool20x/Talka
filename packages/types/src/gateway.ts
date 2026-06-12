import { z } from 'zod';
import { uuidSchema } from './user';

// GatewayEvent (Base event structure)
export const gatewayEventSchema = z.object({
  event: z.string(),
  payload: z.unknown(),
});

export interface GatewayEvent extends z.infer<typeof gatewayEventSchema> {}

// AuthenticatePayload
export const authenticatePayloadSchema = z.object({
  token: z.string().min(1),
});

export interface AuthenticatePayload extends z.infer<typeof authenticatePayloadSchema> {}

// AuthErrorPayload
export const authErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export interface AuthErrorPayload extends z.infer<typeof authErrorPayloadSchema> {}

// JoinConversationPayload
export const joinConversationPayloadSchema = z.object({
  conversationId: uuidSchema,
});

export interface JoinConversationPayload extends z.infer<typeof joinConversationPayloadSchema> {}

// LeaveConversationPayload
export const leaveConversationPayloadSchema = z.object({
  conversationId: uuidSchema,
});

export interface LeaveConversationPayload extends z.infer<typeof leaveConversationPayloadSchema> {}

// PongPayload
export const pongPayloadSchema = z.object({
  serverTime: z.union([z.string().datetime(), z.date()]),
});

export interface PongPayload extends z.infer<typeof pongPayloadSchema> {}

// UserJoinedPayload
export const userJoinedPayloadSchema = z.object({
  conversationId: uuidSchema,
  userId: uuidSchema,
});

export interface UserJoinedPayload extends z.infer<typeof userJoinedPayloadSchema> {}

// UserLeftPayload
export const userLeftPayloadSchema = z.object({
  conversationId: uuidSchema,
  userId: uuidSchema,
});

export interface UserLeftPayload extends z.infer<typeof userLeftPayloadSchema> {}

// GatewayErrorPayload
export const gatewayErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfter: z.number().int().positive().optional(),
});

export interface GatewayErrorPayload extends z.infer<typeof gatewayErrorPayloadSchema> {}
