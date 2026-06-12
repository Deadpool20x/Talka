import { Router } from 'express';
import { validateBody, validateQuery } from '@/middleware/validate';
import {
  createPrivateConversationPayloadSchema,
  createGroupConversationPayloadSchema,
  addMemberPayloadSchema,
  updateGroupPayloadSchema,
} from '@chat-os/types';
import { z } from 'zod';
import * as ctrl from '@/controllers/conversations.controller';
import { conversationMessagesRouter } from './messages';

export const conversationsRouter: Router = Router();

const listQuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? Number(v) : 20)),
  cursor: z.string().datetime().optional(),
});

// GET /conversations
conversationsRouter.get('/', validateQuery(listQuerySchema), ctrl.listConversations);

// POST /conversations/private
conversationsRouter.post(
  '/private',
  validateBody(createPrivateConversationPayloadSchema),
  ctrl.createPrivateConversation
);

// POST /conversations/group
conversationsRouter.post(
  '/group',
  validateBody(createGroupConversationPayloadSchema),
  ctrl.createGroupConversation
);

// GET /conversations/:id
conversationsRouter.get('/:id', ctrl.getConversation);

// DELETE /conversations/:id
conversationsRouter.delete('/:id', ctrl.deleteConversation);

// POST /conversations/:id/members
conversationsRouter.post(
  '/:id/members',
  validateBody(addMemberPayloadSchema),
  ctrl.addMembers
);

// DELETE /conversations/:id/members/:userId
conversationsRouter.delete('/:id/members/:userId', ctrl.removeMember);

// GET /conversations/:id/messages
conversationsRouter.use('/:id/messages', conversationMessagesRouter);

// PATCH /conversations/:id
conversationsRouter.patch(
  '/:id',
  validateBody(updateGroupPayloadSchema),
  ctrl.updateGroup
);
