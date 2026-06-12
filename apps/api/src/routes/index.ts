import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth';
import { healthRouter } from './health';
import { meRouter } from './me';
import { conversationsRouter } from './conversations';
import { messagesRouter } from './messages';
import { usersRouter, registerHandler } from './users';

export const router: Router = Router();

router.use('/health', healthRouter);
router.use('/me', authMiddleware, meRouter);
router.use('/conversations', authMiddleware, conversationsRouter);
router.use('/messages', authMiddleware, messagesRouter);
// Public: POST /users/register — no auth, called immediately after signUp
// MUST be mounted BEFORE the auth-gated usersRouter so Express doesn't challenge it
router.post('/users/register', registerHandler);
router.use('/users', authMiddleware, usersRouter);
// TODO: Add other routes in subsequent prompts
