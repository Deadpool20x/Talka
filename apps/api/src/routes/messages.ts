import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/middleware/validate';
import * as ctrl from '@/controllers/messages.controller';

export const messagesRouter: Router = Router();

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------
const getMessagesQuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? Number(v) : 50)),
  cursor: z.string().datetime().optional(),
  direction: z.enum(['older', 'newer']).optional().default('older'),
});

const createMessageBodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
  type: z.enum(['text', 'image', 'file']),
  temp_id: z.string().uuid(),
  reply_to_id: z.string().uuid().nullable().optional(),
});

const bulkReadBodySchema = z.object({
  conversation_id: z.string().uuid(),
  last_message_id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Routes
// Note: /conversations/:id/messages is mounted on the conversations router
// but GET is handled here via a separate mount in index.ts for simplicity.
// The controller routes are:
//   GET    /conversations/:id/messages  -> getMessages      (mounted via conversationsRouter)
//   POST   /messages                   -> createMessage
//   POST   /messages/:id/read          -> markMessageRead
//   POST   /messages/bulk-read         -> bulkMarkRead
// ---------------------------------------------------------------------------

// POST /messages (REST fallback)
messagesRouter.post(
  '/',
  validateBody(createMessageBodySchema),
  ctrl.createMessage
);

// POST /messages/bulk-read — must be declared BEFORE /:id/read to avoid route collision
messagesRouter.post(
  '/bulk-read',
  validateBody(bulkReadBodySchema),
  ctrl.bulkMarkRead
);

// POST /messages/:id/read
messagesRouter.post('/:id/read', ctrl.markMessageRead);

// ---------------------------------------------------------------------------
// Conversation-scoped message history — exported separately for index.ts
// ---------------------------------------------------------------------------
export const conversationMessagesRouter: Router = Router({ mergeParams: true });

conversationMessagesRouter.get(
  '/',
  validateQuery(getMessagesQuerySchema),
  ctrl.getMessages
);
