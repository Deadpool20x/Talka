import { Request, Response, NextFunction } from 'express';
import * as svc from '@/services/messages.service';

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationId = req.params['id']!;
    const limit = Math.min(Math.max(Number(req.query['limit']) || 50, 1), 100);
    const cursor = req.query['cursor'] as string | undefined;
    const direction = (req.query['direction'] as 'older' | 'newer') ?? 'older';
    const result = await svc.getMessages(req.userId!, conversationId, limit, cursor, direction);
    res.json(result);
  } catch (err) { next(err); }
}

export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversation_id, content, type, temp_id, reply_to_id } = req.body;
    const message = await svc.createMessage(
      req.userId!,
      conversation_id,
      content,
      type,
      temp_id,
      reply_to_id ?? null
    );
    res.status(201).json(message);
  } catch (err) { next(err); }
}

export async function markMessageRead(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await svc.markMessageRead(req.userId!, req.params['id']!);
    res.json(message);
  } catch (err) { next(err); }
}

export async function bulkMarkRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversation_id, last_message_id } = req.body;
    const result = await svc.bulkMarkRead(req.userId!, conversation_id, last_message_id);
    res.json(result);
  } catch (err) { next(err); }
}
