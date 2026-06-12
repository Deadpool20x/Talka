import { z } from 'zod';

// Shared validation primitives
export const uuidSchema = z.string().uuid();
export const usernameSchema = z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/);
export const avatarUrlSchema = z.string().url().max(2048).startsWith('https://');

// User database model schema
export const userSchema = z.object({
  id: uuidSchema,
  username: usernameSchema,
  avatarUrl: avatarUrlSchema.nullable(),
  status: z.string().default('offline'),
  lastSeen: z.union([z.string().datetime(), z.date()]).nullable(),
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
});

export interface User extends z.infer<typeof userSchema> {}

// UserProfile (public view)
export const userProfileSchema = z.object({
  id: uuidSchema,
  username: usernameSchema,
  avatarUrl: avatarUrlSchema.nullable(),
  status: z.string(),
  lastSeen: z.union([z.string().datetime(), z.date()]).nullable(),
});

export interface UserProfile extends z.infer<typeof userProfileSchema> {}

// UserSearchResult
export const userSearchResultSchema = z.object({
  id: uuidSchema,
  username: usernameSchema,
  avatarUrl: avatarUrlSchema.nullable(),
  status: z.string(),
});

export interface UserSearchResult extends z.infer<typeof userSearchResultSchema> {}

// UpdateProfilePayload
export const updateProfilePayloadSchema = z.object({
  username: usernameSchema.optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
});

export interface UpdateProfilePayload extends z.infer<typeof updateProfilePayloadSchema> {}
