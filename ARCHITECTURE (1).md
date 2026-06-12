# Chat-OS Architecture Specification
## Version: 1.0.0 | Status: FROZEN
## Last Updated: 2026-05-19

---

## 1. System Overview

Chat-OS is a real-time messaging platform built on a **separated-gateway architecture**.
The real-time transport layer (WebSocket Gateway) is decoupled from the business logic API.
This enables horizontal scaling of connection handling independently from application logic.

### High-Level Data Flow

```
┌─────────────┐      WS (binary/JSON)       ┌─────────────────┐
│  Next.js    │ ◄──────────────────────────► │   Go Gateway    │
│   Client    │                              │  (WebSocket)    │
└─────────────┘                              └────────┬────────┘
       │                                              │
       │ HTTP/REST                                    │ Redis Pub/Sub
       ▼                                              ▼
┌─────────────┐                              ┌─────────────────┐
│  Node.js    │ ◄──────────────────────────► │  Redis Cluster  │
│   API       │         Prisma ORM           │  (Docker)       │
└──────┬──────┘                              └─────────────────┘
       │
       │ SQL
       ▼
┌──────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                              │
│  (Users, Conversations, Participants, Messages, Files)       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Service Definitions

### 2.1 Gateway Service (`apps/gateway/`)
- **Language:** Go 1.22+
- **Port:** `4000`
- **Role:** WebSocket connection manager. Stateless. No business logic.
- **Responsibilities:**
  - Accept and upgrade WebSocket connections
  - Authenticate via JWT (Supabase) in handshake query param `?token=<jwt>`
  - Maintain `userId → socketId` mapping in Redis
  - Route incoming client events to Redis Streams
  - Subscribe to Redis Pub/Sub rooms and push to connected clients
  - Heartbeat/ping-pong to detect zombie connections
- **Forbidden:** Direct database access. HTTP calls to API only for auth validation.

### 2.2 API Service (`apps/api/`)
- **Language:** TypeScript (Node.js 20+, `tsx` runtime)
- **Port:** `3001`
- **Role:** Business logic, REST endpoints, database persistence.
- **Responsibilities:**
  - User management (delegated to Supabase Auth, but profile extensions)
  - Conversation CRUD
  - Message persistence and retrieval
  - Read receipt updates
  - Group membership management
- **Forbidden:** WebSocket handling. No `socket.io` or `ws` imports.

### 2.3 Web Client (`apps/web/`)
- **Language:** TypeScript (Next.js 14 App Router)
- **Port:** `3000`
- **Role:** UI, state management, WebSocket client.
- **Responsibilities:**
  - Supabase Auth integration (client-side)
  - Native WebSocket connection to Go Gateway
  - REST API consumption
  - Local state via Zustand
- **Forbidden:** Direct database access. Server-side WebSocket connections.

### 2.4 Shared Packages
- **`@chat-os/types`**: Zod schemas + TypeScript interfaces. Single source of truth.
- **`@chat-os/prisma`**: Prisma schema + generated client. No modifications after Phase 0.

---

## 3. Technology Stack

| Concern | Technology | Version |
|---------|-----------|---------|
| Frontend Framework | Next.js | 14.x (App Router) |
| Frontend Language | TypeScript | 5.4+ |
| Styling | Tailwind CSS | 3.4+ |
| State Management | Zustand | 4.5+ |
| API Framework | Express.js | 4.18+ |
| API Runtime | tsx | 4.x |
| Gateway Language | Go | 1.22+ |
| Gateway WebSocket | gorilla/websocket | 1.5+ |
| Gateway JWT | golang-jwt/jwt/v5 | 5.2+ |
| Database | PostgreSQL | 15+ (Supabase) |
| ORM | Prisma | 5.14+ |
| Cache/Queue | Redis | 7.x |
| Go Redis Client | go-redis/v9 | 9.5+ |
| Auth | Supabase Auth | 2.x |
| File Storage | Supabase Storage | 2.x |
| Validation | Zod | 3.23+ |
| Monorepo | pnpm workspaces + Turborepo | 8.x / 2.x |

---

## 4. Network & Ports

| Service | Internal Port | External Port | Protocol |
|---------|--------------|---------------|----------|
| Next.js Web | 3000 | 3000 | HTTP |
| Node.js API | 3001 | 3001 | HTTP |
| Go Gateway | 4000 | 4000 | HTTP (WS upgrade) |
| Redis | 6379 | 6379 | TCP |
| Supabase DB | 5432 | — | TCP (managed) |

---

## 5. Data Flow Patterns

### 5.1 Sending a Message (Happy Path)

1. **Client** calls `send_message` event via WebSocket to **Gateway**
2. **Gateway** validates JWT, parses payload
3. **Gateway** publishes to Redis Stream: `stream:messages:incoming`
4. **API Worker** (Node.js, consuming stream) reads the event
5. **API Worker** inserts message into Supabase PostgreSQL via Prisma
6. **API Worker** publishes to Redis Pub/Sub channel: `room:{conversationId}`
7. **Gateway** (subscribed to that room) receives the publish
8. **Gateway** writes `receive_message` event to all connected sockets in that room

### 5.2 User Comes Online

1. **Client** opens WebSocket to **Gateway** with `?token=<jwt>`
2. **Gateway** validates JWT against Supabase
3. **Gateway** stores `HSET user_socket_map {userId} {socketId}` in Redis (TTL: 24h)
4. **Gateway** publishes `user_online` to Redis Pub/Sub channel: `presence:broadcast`
5. All **Gateways** (if scaled) receive and broadcast to their connected clients

### 5.3 Fetching History (Not Real-Time)

1. **Client** makes HTTP `GET /api/conversations/:id/messages?cursor=<timestamp>` to **API**
2. **API** queries PostgreSQL via Prisma
3. **API** returns paginated messages (cursor-based, 50 per page)
4. **Client** renders in ChatWindow

---

## 6. Security Requirements

- All REST endpoints (except `/health` and auth callbacks) require valid Supabase JWT
- WebSocket connections require valid Supabase JWT in handshake
- Redis is NOT exposed externally (Docker internal network only in production)
- Supabase Row Level Security (RLS) must be enabled on all tables
- No plaintext secrets in code. All via environment variables.
- Gateway never touches the database. API never touches WebSockets.

---

## 7. Scaling Considerations (Future-Proofing)

- Gateway is stateless except for in-memory socket registry. Redis holds the source of truth.
- Multiple Gateway instances can run behind a load balancer using Redis Pub/Sub adapter.
- API can scale horizontally independently.
- PostgreSQL read replicas can be added for history queries.
- Redis should be upgraded to Redis Cluster or Redis Sentinel for HA.

---

## 8. Error Handling Philosophy

- **Gateway:** Connection-level errors result in socket close with code + reason.
- **API:** HTTP-standard status codes. 400 (bad input), 401 (unauth), 404, 500.
- **Client:** WebSocket auto-reconnect with exponential backoff (max 5s, 10 retries).
- **All services:** Structured logging (JSON). No `console.log` in production.

---

## 9. Frozen Artifacts

The following documents are immutable after Phase 0 approval:
- `ARCHITECTURE.md` (this document)
- `EVENT_PROTOCOL.md`
- `REST_API.md`
- `packages/prisma/schema.prisma`
- `packages/types/src/index.ts`

**Modification requires human approval and version bump.**

---

## 10. Glossary

- **Gateway:** Go WebSocket server. Connection layer only.
- **API:** Node.js REST server. Business logic only.
- **Client:** Next.js browser application.
- **Room:** Redis Pub/Sub channel named `room:{conversationId}`. All participants subscribe.
- **Stream:** Redis Stream named `stream:messages:incoming`. Durable message queue.
- **Presence:** Online/offline status tracked in Redis Hash `user_socket_map`.
