import { z } from 'zod';
import { uuidSchema } from './user';

// PaginatedResponse Generic Helper
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    nextCursor?: string;
    next_cursor?: string;
    hasMore: boolean;
    has_more?: boolean;
  };
}

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      limit: z.number().int().min(1).max(100).default(50),
      nextCursor: z.string().datetime().optional(),
      hasMore: z.boolean(),
    }),
  });
}

// ApiError
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export interface ApiError extends z.infer<typeof apiErrorSchema> {}

// UploadPresignedPayload
export const uploadPresignedPayloadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  conversationId: uuidSchema,
});

export interface UploadPresignedPayload extends z.infer<typeof uploadPresignedPayloadSchema> {}

// UploadPresignedResponse
export const uploadPresignedResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  path: z.string().min(1),
  expiresAt: z.union([z.string().datetime(), z.date()]),
});

export interface UploadPresignedResponse extends z.infer<typeof uploadPresignedResponseSchema> {}
