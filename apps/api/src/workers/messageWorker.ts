import { z } from 'zod';
import { getRedisClient } from '@/config/redis';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Stream / Pub/Sub constants (frozen: EVENT_PROTOCOL.md §4)
// ---------------------------------------------------------------------------
const STREAM = 'stream:messages:incoming';
const GROUP = 'api-workers';
const CONSUMER = 'worker-1';

// ---------------------------------------------------------------------------
// Stream entry payload schemas
// The Gateway enriches send_message with sender_id + sent_at before publishing
// ---------------------------------------------------------------------------
const streamSendMessageSchema = z.object({
  event: z.literal('send_message'),
  sender_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
  type: z.enum(['text', 'image', 'file']),
  temp_id: z.string().uuid(),
  reply_to_id: z.string().uuid().nullable().optional(),
  sent_at: z.string().datetime(),
});

const streamMarkReadSchema = z.object({
  event: z.literal('mark_read'),
  sender_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  last_read_message_id: z.string().uuid(),
  sent_at: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Redis Stream field array → object converter
// XREADGROUP returns fields as a flat [key, value, key, value, ...] array
// ---------------------------------------------------------------------------
function fieldsToObject(fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]!] = fields[i + 1]!;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// send_message handler
// ---------------------------------------------------------------------------
async function handleSendMessage(
  redis: ReturnType<typeof getRedisClient>,
  streamId: string,
  raw: Record<string, string>
) {
  // Parse the JSON payload stored in the "data" field by the Gateway
  const jsonStr = raw['data'];
  if (!jsonStr) throw new Error('Missing data field in stream entry');

  const parsed = streamSendMessageSchema.parse(JSON.parse(jsonStr));

  // Idempotency check — deduplicate by temp_id
  const existing = await prisma.message.findUnique({
    where: { tempId: parsed.temp_id },
  });

  if (existing) {
    logger.debug({ msg: 'Skipping duplicate message', tempId: parsed.temp_id });
    await redis.xack(STREAM, GROUP, streamId);
    return;
  }

  // Persist message
  const message = await prisma.message.create({
    data: {
      conversationId: parsed.conversation_id,
      senderId: parsed.sender_id,
      content: parsed.content,
      type: parsed.type,
      tempId: parsed.temp_id,
      replyToId: parsed.reply_to_id ?? null,
      readBy: [],
    },
  });

  // Update conversation updatedAt for conversation list ordering
  await prisma.conversation.update({
    where: { id: parsed.conversation_id },
    data: { updatedAt: new Date() },
  });

  // Publish receive_message to Pub/Sub room — Gateway broadcasts to all subscribers
  const pubPayload = JSON.stringify({
    event: 'receive_message',
    payload: {
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      content: message.content,
      type: message.type,
      temp_id: message.tempId,
      reply_to_id: message.replyToId,
      created_at: message.createdAt.toISOString(),
      read_by: message.readBy,
    },
  });

  await redis.publish(`room:${parsed.conversation_id}`, pubPayload);

  // Acknowledge only AFTER both DB write and Pub/Sub publish succeed
  await redis.xack(STREAM, GROUP, streamId);

  logger.info({ msg: 'Message persisted and broadcast', messageId: message.id });
}

// ---------------------------------------------------------------------------
// mark_read handler
// ---------------------------------------------------------------------------
async function handleMarkRead(
  redis: ReturnType<typeof getRedisClient>,
  streamId: string,
  raw: Record<string, string>
) {
  const jsonStr = raw['data'];
  if (!jsonStr) throw new Error('Missing data field in stream entry');

  const parsed = streamMarkReadSchema.parse(JSON.parse(jsonStr));

  // Fetch the anchor message to get its createdAt
  const anchor = await prisma.message.findUnique({
    where: { id: parsed.last_read_message_id },
    select: { createdAt: true },
  });

  if (!anchor) {
    // Unknown message — ack and move on to avoid poison-pill
    logger.warn({ msg: 'mark_read anchor message not found', id: parsed.last_read_message_id });
    await redis.xack(STREAM, GROUP, streamId);
    return;
  }

  // Add reader to read_by on all messages up to anchor (raw SQL for array push)
  await prisma.$executeRaw`
    UPDATE messages
    SET read_by = array_append(read_by, ${parsed.sender_id}::uuid)
    WHERE conversation_id = ${parsed.conversation_id}::uuid
      AND created_at <= ${anchor.createdAt}
      AND NOT (${parsed.sender_id}::uuid = ANY(read_by))
  `;

  // Publish message_read event
  const pubPayload = JSON.stringify({
    event: 'message_read',
    payload: {
      conversation_id: parsed.conversation_id,
      reader_id: parsed.sender_id,
      last_read_message_id: parsed.last_read_message_id,
      read_at: new Date().toISOString(),
    },
  });

  await redis.publish(`room:${parsed.conversation_id}`, pubPayload);
  await redis.xack(STREAM, GROUP, streamId);

  logger.info({ msg: 'Read receipt processed', conversationId: parsed.conversation_id });
}

// ---------------------------------------------------------------------------
// Dispatch single stream entry
// ---------------------------------------------------------------------------
async function processStreamEntry(
  redis: ReturnType<typeof getRedisClient>,
  streamId: string,
  fields: string[]
) {
  const raw = fieldsToObject(fields);
  const event = raw['event'] ?? JSON.parse(raw['data'] ?? '{}').event;

  switch (event) {
    case 'send_message':
      await handleSendMessage(redis, streamId, raw);
      break;
    case 'mark_read':
      await handleMarkRead(redis, streamId, raw);
      break;
    default:
      // Silently ignore unknown events per EVENT_PROTOCOL §1
      logger.debug({ msg: 'Unknown stream event, ignoring', event });
      await redis.xack(STREAM, GROUP, streamId);
  }
}

// ---------------------------------------------------------------------------
// Main worker loop
// ---------------------------------------------------------------------------
export async function startMessageWorker() {
  const workerRedis = getRedisClient();

  // Create consumer group if not already created; MKSTREAM creates the stream too
  try {
    await workerRedis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
    logger.info({ msg: `Consumer group "${GROUP}" created on stream "${STREAM}"` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('BUSYGROUP')) throw err; // BUSYGROUP = already exists, safe to continue
  }

  logger.info({ msg: `Message worker started (${CONSUMER})` });

  while (true) {
    try {
      const results = await workerRedis.xreadgroup(
        'GROUP', GROUP, CONSUMER,
        'COUNT', '10',
        'BLOCK', '5000',
        'STREAMS', STREAM, '>'
      ) as [string, [string, string[]][]][] | null;

      if (!results) continue; // Timeout — no new entries, loop again

      for (const [, entries] of results) {
        for (const [id, fields] of entries) {
          try {
            await processStreamEntry(workerRedis, id, fields);
          } catch (err) {
            // Do NOT ack — failed entries remain pending and will be retried
            logger.error({ msg: 'Stream entry processing failed, NOT acking', streamId: id, error: err });
          }
        }
      }
    } catch (err) {
      // Outer error: Redis disconnect, etc. — log and wait before retrying
      logger.error({ msg: 'Worker loop error, retrying in 2s', error: err });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
