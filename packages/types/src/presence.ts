import { z } from 'zod';
import { uuidSchema } from './user';

// UserStatus literal union
export const userStatusSchema = z.enum(['online', 'offline', 'away']);
export type UserStatus = z.infer<typeof userStatusSchema>;

// PresenceUpdate
export const presenceUpdateSchema = z.object({
  userId: uuidSchema,
  status: userStatusSchema,
  lastSeen: z.union([z.string().datetime(), z.date()]).nullable(),
});

export interface PresenceUpdate extends z.infer<typeof presenceUpdateSchema> {}

// HeartbeatPayload (empty object)
export const heartbeatPayloadSchema = z.object({});

export interface HeartbeatPayload extends z.infer<typeof heartbeatPayloadSchema> {}
