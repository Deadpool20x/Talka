# Chat-OS REST API Specification
## Version: 1.0.0 | Status: FROZEN
## Last Updated: 2026-05-19
## Base URL: `http://localhost:3001/api/v1`

---

## 1. Global Rules

- All endpoints return JSON.
- All endpoints (except `/health`) require `Authorization: Bearer <supabase_jwt>` header.
- All timestamps are ISO 8601 strings in UTC.
- All IDs are UUID v4.
- Pagination is **cursor-based**, never offset-based.
- Standard HTTP status codes: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 500 (Server Error).
- Error response body:
  ```json
  {
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Conversation not found.",
      "details": null
    }
  }
  ```

---

## 2. Authentication Endpoints

> **Note:** Registration and login are handled by Supabase Auth directly. The API does NOT expose `/auth/register` or `/auth/login`. The client talks to Supabase, gets a JWT, then uses that JWT for all API calls.

### 2.1 `GET /health`
**Auth:** None
**Response:**
```json
{
  "status": "ok",
  "service": "chat-os-api",
  "version": "1.0.0",
  "timestamp": "2026-05-19T11:32:00.000Z"
}
```

### 2.2 `GET /me`
**Auth:** Required
**Purpose:** Get current user's extended profile.
**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "alice",
  "avatar_url": "https://...",
  "status": "online",
  "last_seen": "2026-05-19T11:32:00.000Z",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

### 2.3 `PATCH /me`
**Auth:** Required
**Purpose:** Update current user's profile.
**Request Body:**
```json
{
  "username": "alice_new",
  "avatar_url": "https://..."
}
```
**Validation:** `username`: 3-30 chars, alphanumeric + underscore. `avatar_url`: valid HTTPS URL, max 2048 chars.
**Response:** Updated user object (same shape as GET /me).

---

## 3. User Endpoints

### 3.1 `GET /users/search?q={query}`
**Auth:** Required
**Purpose:** Search users by username or email.
**Query Params:**
- `q`: string, 1-50 chars, required.
- `limit`: number, default 20, max 50.
**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "bob",
      "avatar_url": "https://...",
      "status": "online"
    }
  ],
  "meta": {
    "limit": 20,
    "total": 1
  }
}
```
**Privacy:** Never return email in search results. Only show users who have not blocked the searcher.

### 3.2 `GET /users/:id`
**Auth:** Required
**Purpose:** Get public profile of a specific user.
**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "username": "bob",
  "avatar_url": "https://...",
  "status": "offline",
  "last_seen": "2026-05-19T10:00:00.000Z"
}
```

---

## 4. Conversation Endpoints

### 4.1 `GET /conversations`
**Auth:** Required
**Purpose:** List all conversations for the current user.
**Query Params:**
- `limit`: number, default 20, max 50.
- `cursor`: ISO timestamp. Returns conversations with `updated_at < cursor`.
**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "type": "private",
      "name": null,
      "participants": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "username": "bob",
          "avatar_url": "https://...",
          "role": null
        }
      ],
      "last_message": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "content": "Hey there",
        "sender_id": "550e8400-e29b-41d4-a716-446655440001",
        "created_at": "2026-05-19T11:00:00.000Z"
      },
      "unread_count": 3,
      "created_at": "2026-05-01T00:00:00.000Z",
      "updated_at": "2026-05-19T11:00:00.000Z"
    }
  ],
  "meta": {
    "limit": 20,
    "next_cursor": "2026-05-19T10:00:00.000Z"
  }
}
```
**Rules:**
- Sorted by `updated_at` descending (most recent first).
- `unread_count` is the count of messages where current user is NOT in `read_by`.
- `name` is null for private chats. For groups, it is the group name.
- `participants` array always includes the OTHER user(s), never the current user.

### 4.2 `POST /conversations/private`
**Auth:** Required
**Purpose:** Create or retrieve a private 1-on-1 conversation.
**Request Body:**
```json
{
  "participant_id": "550e8400-e29b-41d4-a716-446655440001"
}
```
**Rules:**
- `participant_id` must not be the current user's own ID.
- If a private conversation already exists between these two users, return it (idempotent).
- If not, create it with `type: "private"`.
**Response:** Conversation object (same shape as in GET /conversations).
**Status:** 200 (existing) or 201 (created).

### 4.3 `POST /conversations/group`
**Auth:** Required
**Purpose:** Create a new group conversation.
**Request Body:**
```json
{
  "name": "Developers",
  "member_ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```
**Rules:**
- `name`: 1-100 chars, required.
- `member_ids`: array of 1-499 UUIDs (max 500 total including creator).
- Creator is automatically added as admin.
- All members get `role: "member"`.
**Response:** Conversation object with `type: "group"`.
**Status:** 201.

### 4.4 `GET /conversations/:id`
**Auth:** Required
**Purpose:** Get full conversation details.
**Response:** Conversation object with ALL participants (including current user, showing role).

### 4.5 `DELETE /conversations/:id`
**Auth:** Required
**Purpose:** Leave or delete a conversation.
**Rules:**
- Private: Both users can delete. Soft delete (set `deleted_at` for the requester).
- Group: Admin can delete entire group. Member can only leave (set `left_at` in participants).
**Response:** 204 No Content.

### 4.6 `POST /conversations/:id/members`
**Auth:** Required
**Purpose:** Add members to a group.
**Request Body:**
```json
{
  "member_ids": ["550e8400-e29b-41d4-a716-446655440003"]
}
```
**Rules:**
- Only group admin can add members.
- Cannot add users already in group (unless they left; then re-add with `left_at: null`).
**Response:** Updated conversation object.
**Status:** 200.

### 4.7 `DELETE /conversations/:id/members/:userId`
**Auth:** Required
**Purpose:** Remove a member from a group.
**Rules:**
- Admin can remove anyone.
- Members can remove themselves (leave group).
- Cannot remove the last admin (promote another first).
**Response:** 204 No Content.

### 4.8 `PATCH /conversations/:id`
**Auth:** Required
**Purpose:** Update group metadata.
**Request Body:**
```json
{
  "name": "New Group Name"
}
```
**Rules:** Only admin can update.
**Response:** Updated conversation object.

---

## 5. Message Endpoints

### 5.1 `GET /conversations/:id/messages`
**Auth:** Required
**Purpose:** Fetch message history for a conversation.
**Query Params:**
- `limit`: number, default 50, max 100.
- `cursor`: ISO timestamp. Returns messages with `created_at < cursor`.
- `direction`: `"older"` (default) or `"newer"`. For pagination vs. polling.
**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
      "sender_id": "550e8400-e29b-41d4-a716-446655440001",
      "content": "Hey there",
      "type": "text",
      "temp_id": null,
      "reply_to_id": null,
      "metadata": {},
      "read_by": ["550e8400-e29b-41d4-a716-446655440000"],
      "created_at": "2026-05-19T11:00:00.000Z"
    }
  ],
  "meta": {
    "limit": 50,
    "next_cursor": "2026-05-19T10:59:00.000Z",
    "has_more": true
  }
}
```
**Rules:**
- Sorted by `created_at` descending (newest first).
- User must be a participant of the conversation.
- Deleted conversations return 404.

### 5.2 `POST /messages`
**Auth:** Required
**Purpose:** Create a message via REST (fallback if WebSocket unavailable).
**Request Body:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "content": "Hello",
  "type": "text",
  "temp_id": "client-generated-uuid",
  "reply_to_id": null
}
```
**Rules:** Same validation as WebSocket `send_message`.
**Response:** Created message object.
**Status:** 201.

### 5.3 `POST /messages/:id/read`
**Auth:** Required
**Purpose:** Mark a specific message as read.
**Rules:**
- Adds current user to `read_by` array (idempotent).
- Updates conversation's `updated_at` (triggers conversation list refresh).
**Response:** Updated message object.

### 5.4 `POST /messages/bulk-read`
**Auth:** Required
**Purpose:** Mark all messages in a conversation as read up to a certain point.
**Request Body:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "last_message_id": "550e8400-e29b-41d4-a716-446655440003"
}
```
**Rules:**
- Marks all messages in conversation with `created_at <=` the specified message's `created_at` as read.
- Only marks messages where current user is not the sender.
**Response:**
```json
{
  "updated_count": 5
}
```

---

## 6. File Upload Endpoints

### 6.1 `POST /upload/presigned`
**Auth:** Required
**Purpose:** Get a presigned URL to upload directly to Supabase Storage.
**Request Body:**
```json
{
  "filename": "photo.jpg",
  "file_type": "image/jpeg",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002"
}
```
**Rules:**
- `file_type` must be in allowed list: `image/*`, `video/*`, `application/pdf`, `text/plain`.
- Max file size: 10MB images, 50MB videos, 20MB other.
**Response:**
```json
{
  "upload_url": "https://...supabase.co/...",
  "public_url": "https://...supabase.co/...",
  "path": "chat-attachments/conversation_id/uuid.jpg",
  "expires_at": "2026-05-19T11:37:00.000Z"
}
```
**Note:** Client uploads directly to Supabase using the presigned URL. Then sends message with `type: "image"` and `metadata.file_url`.

---

## 7. WebSocket Fallback Endpoints

### 7.1 `GET /presence/online-users`
**Auth:** Required
**Purpose:** Poll for online status of specific users (REST fallback when WS down).
**Query Params:**
- `user_ids`: comma-separated UUIDs, max 100.
**Response:**
```json
{
  "data": {
    "550e8400-e29b-41d4-a716-446655440001": {
      "status": "online",
      "last_seen": "2026-05-19T11:32:00.000Z"
    },
    "550e8400-e29b-41d4-a716-446655440002": {
      "status": "offline",
      "last_seen": "2026-05-19T10:00:00.000Z"
    }
  }
}
```

---

## 8. Rate Limits

| Endpoint | Limit |
|----------|-------|
| All authenticated endpoints | 100 requests per minute per user |
| `/users/search` | 30 requests per minute per user |
| `/messages` (POST) | 60 requests per minute per user |
| File upload | 10 uploads per minute per user |

**Headers returned:**
- `X-RateLimit-Limit`: 100
- `X-RateLimit-Remaining`: 87
- `X-RateLimit-Reset`: 1716118320

---

## 9. Pagination Standard

All list endpoints use cursor-based pagination:

```json
{
  "data": [...],
  "meta": {
    "limit": 50,
    "next_cursor": "2026-05-19T10:00:00.000Z",
    "has_more": true
  }
}
```

**Rules:**
- `next_cursor` is the `created_at` (or `updated_at`) of the last item in the current page.
- To get the next page, send the same request with `cursor={next_cursor}`.
- If `has_more` is false, there are no more items.
- Omitting `cursor` returns the first page (most recent items).
