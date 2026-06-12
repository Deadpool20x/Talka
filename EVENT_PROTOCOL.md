# Chat-OS Event Protocol Specification
## Version: 1.0.0 | Status: FROZEN
## Last Updated: 2026-05-19

---

## 1. Protocol Rules

- All events are JSON objects with exactly two fields: `event` (string) and `payload` (object).
- Event names use `snake_case` and are globally unique.
- Payloads are validated against Zod schemas in `@chat-os/types`.
- Unknown events received by any party must be silently ignored (log at debug level only).
- All timestamps are ISO 8601 strings in UTC (`2026-05-19T11:32:00.000Z`).

---

## 2. Client → Gateway Events (C→G)

Sent by the Next.js client via WebSocket to the Go Gateway.

### 2.1 `authenticate`
**Direction:** C→G (immediately after WebSocket open, before any other event)
**Purpose:** Provide JWT token if not sent in query param.
**Payload:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```
**Gateway Response:**
- Success: No event. Connection remains open. Gateway stores user mapping.
- Failure: Gateway sends `auth_error` and closes connection with code `1008`.

### 2.2 `join_conversation`
**Direction:** C→G
**Purpose:** Subscribe to a conversation room to receive messages.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```
**Gateway Action:**
- Validate `conversation_id` is a valid UUID.
- Subscribe Redis client to Pub/Sub channel `room:{conversation_id}`.
- Store in local memory: this socket is in room X.
- Publish `user_joined` to the room (so other participants see "User is here").

### 2.3 `leave_conversation`
**Direction:** C→G
**Purpose:** Unsubscribe from a conversation room.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```
**Gateway Action:**
- Unsubscribe Redis client from channel.
- Remove socket from local room registry.
- Publish `user_left` to the room.

### 2.4 `send_message`
**Direction:** C→G
**Purpose:** Send a chat message.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Hello world",
  "type": "text",
  "temp_id": "client-generated-uuid-v4",
  "reply_to_id": null
}
```
**Field Rules:**
- `conversation_id`: UUID, required.
- `content`: string, max 4000 chars, required if `type=text`.
- `type`: enum `['text', 'image', 'file', 'system']`. Client may only send `text`, `image`, `file`.
- `temp_id`: UUID v4 generated client-side. Used for idempotency.
- `reply_to_id`: UUID or null. ID of message being replied to.

**Gateway Action:**
1. Validate payload shape against Zod schema.
2. Add `sender_id`, `sent_at` (server timestamp).
3. Publish to Redis Stream: `stream:messages:incoming`
   ```json
   {
     "event": "send_message",
     "payload": { /* enriched payload */ }
   }
   ```
4. Do NOT broadcast directly. Wait for API worker to persist and publish back.

### 2.5 `typing`
**Direction:** C→G
**Purpose:** Indicate the user is typing.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_typing": true
}
```
**Gateway Action:**
- Publish to Redis Pub/Sub channel `room:{conversation_id}`.
- Throttle: Gateway ignores typing events from same user+room within 3 seconds.

### 2.6 `mark_read`
**Direction:** C→G
**Purpose:** Mark all messages in a conversation as read up to a point.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "last_read_message_id": "550e8400-e29b-41d4-a716-446655440001"
}
```
**Gateway Action:**
- Publish to Redis Stream: `stream:messages:incoming`.
- API worker will update `read_by` array and publish `message_read` event.

### 2.7 `heartbeat`
**Direction:** C→G
**Purpose:** Keep connection alive and confirm presence.
**Payload:**
```json
{}
```
**Gateway Action:**
- Reset Redis TTL on `user_socket_map:{userId}` to 60 seconds.
- Send `pong` event back.

---

## 3. Gateway → Client Events (G→C)

Sent by the Go Gateway to the Next.js client via WebSocket.

### 3.1 `auth_error`
**Direction:** G→C
**Purpose:** Authentication failed.
**Payload:**
```json
{
  "code": "INVALID_TOKEN",
  "message": "The provided JWT could not be verified."
}
```
**Client Action:** Close socket, redirect to `/login`.

### 3.2 `pong`
**Direction:** G→C
**Purpose:** Response to client heartbeat.
**Payload:**
```json
{
  "server_time": "2026-05-19T11:32:00.000Z"
}
```

### 3.3 `receive_message`
**Direction:** G→C
**Purpose:** A new message has been sent to a conversation the user is in.
**Payload:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "550e8400-e29b-41d4-a716-446655440003",
  "content": "Hello world",
  "type": "text",
  "temp_id": "client-generated-uuid-v4",
  "reply_to_id": null,
  "created_at": "2026-05-19T11:32:00.000Z",
  "read_by": []
}
```
**Client Action:** Append to conversation message list. If `temp_id` matches a pending message, replace it.

### 3.4 `message_read`
**Direction:** G→C
**Purpose:** Someone has read messages.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "reader_id": "550e8400-e29b-41d4-a716-446655440003",
  "last_read_message_id": "550e8400-e29b-41d4-a716-446655440002",
  "read_at": "2026-05-19T11:33:00.000Z"
}
```
**Client Action:** Update read receipts in UI for that conversation.

### 3.5 `typing`
**Direction:** G→C
**Purpose:** Someone is typing.
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "is_typing": true
}
```
**Client Action:** Show typing indicator for 5 seconds, then hide if no update.

### 3.6 `user_online`
**Direction:** G→C
**Purpose:** A friend/contact has come online.
**Payload:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "online",
  "last_seen": "2026-05-19T11:30:00.000Z"
}
```

### 3.7 `user_offline`
**Direction:** G→C
**Purpose:** A friend/contact has gone offline.
**Payload:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "offline",
  "last_seen": "2026-05-19T11:32:00.000Z"
}
```

### 3.8 `user_joined`
**Direction:** G→C
**Purpose:** A user has joined the conversation room (opened the chat).
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440003"
}
```

### 3.9 `user_left`
**Direction:** G→C
**Purpose:** A user has left the conversation room (closed the chat).
**Payload:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440003"
}
```

### 3.10 `error`
**Direction:** G→C
**Purpose:** Generic gateway-level error.
**Payload:**
```json
{
  "code": "RATE_LIMITED",
  "message": "Too many messages sent. Please slow down.",
  "retry_after": 5
}
```

---

## 4. Gateway → Redis Events (Internal)

### 4.1 Redis Stream: `stream:messages:incoming`
**Producer:** Go Gateway
**Consumer:** Node.js API Worker
**Purpose:** Durable queue for all messages requiring persistence.
**Payload Structure (XADD):**
```json
{
  "event": "send_message",
  "sender_id": "uuid",
  "conversation_id": "uuid",
  "content": "...",
  "type": "text",
  "temp_id": "uuid",
  "reply_to_id": "uuid|null",
  "sent_at": "iso-timestamp"
}
```

### 4.2 Redis Stream: `stream:presence:updates`
**Producer:** Go Gateway
**Consumer:** Node.js API Worker (optional, for analytics)
**Purpose:** Presence state changes.

### 4.3 Redis Pub/Sub: `room:{conversationId}`
**Producer:** Node.js API (after persisting message)
**Consumer:** Go Gateway (all instances subscribed)
**Purpose:** Real-time broadcast to room participants.

### 4.4 Redis Pub/Sub: `presence:broadcast`
**Producer:** Go Gateway
**Consumer:** Go Gateway (all instances)
**Purpose:** Cross-instance presence propagation.

---

## 5. Event Name Registry (Master List)

| Event Name | Direction | Layer | Purpose |
|-----------|-----------|-------|---------|
| `authenticate` | C→G | WS | Handshake auth |
| `join_conversation` | C→G | WS | Enter room |
| `leave_conversation` | C→G | WS | Exit room |
| `send_message` | C→G→R→API→R→G→C | WS/Stream | Chat message |
| `typing` | C→G→R→G→C | WS/PubSub | Typing indicator |
| `mark_read` | C→G→R→API→R→G→C | WS/Stream | Read receipt |
| `heartbeat` | C→G | WS | Keepalive |
| `pong` | G→C | WS | Keepalive response |
| `auth_error` | G→C | WS | Auth failure |
| `receive_message` | G→C | WS | New message delivery |
| `message_read` | G→C | WS | Read receipt update |
| `user_online` | G→C | WS | Presence online |
| `user_offline` | G→C | WS | Presence offline |
| `user_joined` | G→C | WS | Room join notice |
| `user_left` | G→C | WS | Room leave notice |
| `error` | G→C | WS | Generic error |

**Legend:** C=Client, G=Gateway, R=Redis, API=Node.js API

---

## 6. Validation Rules

All payloads must pass Zod validation before processing. Failure results in `error` event with code `INVALID_PAYLOAD`.

### 6.1 UUID Validation
All IDs must be valid UUID v4 format: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

### 6.2 Content Validation
- `text`: 1-4000 characters. No HTML. URLs auto-linkified client-side.
- `image`: `content` is caption (optional, max 500 chars). File URL in metadata.
- `file`: `content` is filename. File URL in metadata.

### 6.3 Rate Limits (Gateway Enforced)
- `send_message`: 1 per second per user per conversation.
- `typing`: 1 per 3 seconds per user per conversation.
- `heartbeat`: 1 per 30 seconds per connection.
- Violations emit `error` with code `RATE_LIMITED`.

---

## 7. Connection Lifecycle

```
[Client opens browser]
       │
       ▼
[WS connect to Gateway: wss://host:4000?token=JWT]
       │
       ▼
[Gateway validates JWT with Supabase]
       │
   ┌───┴───┐
   │       │
 Valid   Invalid
   │       │
   ▼       ▼
[Store    [Emit auth_error]
 mapping] [Close 1008]
   │
   ▼
[Emit pong on heartbeat]
   │
   ▼
[Client joins conversation rooms]
   │
   ▼
[Normal operation]
   │
   ▼
[Client closes tab / disconnects]
       │
       ▼
[Gateway: 30s grace period]
       │
   ┌───┴───┐
   │       │
Reconnect  No reconnect
   │       │
   ▼       ▼
[Resume   [Delete Redis mapping]
 rooms]   [Broadcast user_offline]
```
