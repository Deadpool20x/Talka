import { Request, Response, NextFunction } from 'express';
import * as svc from '@/services/conversations.service';

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query['limit']) || 20, 50);
    const cursor = req.query['cursor'] as string | undefined;
    const result = await svc.listConversations(req.userId!, limit, cursor);
    res.json(result);
  } catch (err) { next(err); }
}

export async function createPrivateConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { participantId } = req.body;
    const { conversation, created } = await svc.createPrivateConversation(req.userId!, participantId);
    res.status(created ? 201 : 200).json(conversation);
  } catch (err) { next(err); }
}

export async function createGroupConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, memberIds } = req.body;
    const conversation = await svc.createGroupConversation(req.userId!, name, memberIds);
    res.status(201).json(conversation);
  } catch (err) { next(err); }
}

export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await svc.getConversation(req.userId!, req.params['id']!);
    res.json(conversation);
  } catch (err) { next(err); }
}

export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteConversation(req.userId!, req.params['id']!);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function addMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await svc.addMembers(req.userId!, req.params['id']!, req.body.memberIds);
    res.json(conversation);
  } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.removeMember(req.userId!, req.params['id']!, req.params['userId']!);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    const conversation = await svc.updateGroup(req.userId!, req.params['id']!, name);
    res.json(conversation);
  } catch (err) { next(err); }
}
