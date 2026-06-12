# Chat-OS Folder Structure Specification
## Version: 1.0.0 | Status: FROZEN
## Last Updated: 2026-05-19

---

## 1. Monorepo Root

```
chat-os/
├── apps/
│   ├── web/                 # Next.js 14 frontend
│   ├── api/                 # Node.js + Express API
│   └── gateway/             # Go WebSocket gateway
├── packages/
│   ├── types/               # Shared TypeScript types + Zod schemas
│   ├── prisma/              # Database schema + generated client
│   └── ts-config/           # Shared TypeScript configurations
├── docker-compose.yml       # Redis + optional local services
├── turbo.json               # Turborepo pipeline config
├── pnpm-workspace.yaml      # pnpm workspace definition
├── package.json             # Root package.json (scripts, dev deps)
├── .env.example             # Master env template
├── ARCHITECTURE.md          # FROZEN
├── EVENT_PROTOCOL.md        # FROZEN
├── REST_API.md              # FROZEN
└── .gitignore
```

---

## 2. Frontend (`apps/web/`)

```
apps/web/
├── package.json
├── tsconfig.json            # Extends @chat-os/ts-config/nextjs.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── .env.local.example
├── public/
│   ├── favicon.ico
│   └── assets/
├── src/
│   ├── app/                 # Next.js 14 App Router
│   │   ├── layout.tsx       # Root layout with providers
│   │   ├── page.tsx         # Landing / redirect to chat
│   │   ├── chat/
│   │   │   └── page.tsx     # Main chat interface
│   │   ├── login/
│   │   │   └── page.tsx     # Login page
│   │   └── register/
│   │       └── page.tsx     # Registration page
│   ├── components/          # React components
│   │   ├── ui/              # Primitive UI (Button, Input, Avatar)
│   │   ├── chat/
│   │   │   ├── ChatLayout.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── TypingIndicator.tsx
│   │   │   └── ChatHeader.tsx
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationItem.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── modals/
│   │   │   ├── CreateGroupModal.tsx
│   │   │   ├── GroupInfoModal.tsx
│   │   │   └── UserProfileModal.tsx
│   │   └── presence/
│   │       ├── OnlineIndicator.tsx
│   │       └── PresenceBadge.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useGateway.ts    # WebSocket connection manager
│   │   ├── useChatEvents.ts # Event listener dispatcher
│   │   ├── useConversations.ts
│   │   ├── useMessages.ts
│   │   └── useTyping.ts
│   ├── lib/                 # Utilities and configs
│   │   ├── supabase.ts      # Supabase client init
│   │   ├── api.ts           # Axios instance + typed API methods
│   │   ├── utils.ts         # General utilities
│   │   └── constants.ts     # App constants
│   ├── context/             # React contexts (minimal)
│   │   └── AuthContext.tsx
│   ├── store/               # Zustand stores
│   │   ├── chatStore.ts
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── types/               # Local type augmentations (rare)
│   └── styles/
│       └── globals.css
```

---

## 3. API Server (`apps/api/`)

```
apps/api/
├── package.json
├── tsconfig.json            # Extends @chat-os/ts-config/node.json
├── .env.example
├── src/
│   ├── index.ts             # Entry point: Express app init
│   ├── config/
│   │   ├── env.ts           # Validated env loader (zod)
│   │   ├── database.ts      # Prisma client singleton
│   │   └── redis.ts         # Redis client init
│   ├── routes/
│   │   ├── index.ts         # Route aggregator
│   │   ├── health.ts        # GET /health
│   │   ├── users.ts         # GET /users/*
│   │   ├── conversations.ts # GET/POST /conversations/*
│   │   ├── messages.ts      # GET/POST /messages/*
│   │   └── upload.ts        # POST /upload/*
│   ├── controllers/
│   │   ├── users.controller.ts
│   │   ├── conversations.controller.ts
│   │   ├── messages.controller.ts
│   │   └── upload.controller.ts
│   ├── services/
│   │   ├── users.service.ts
│   │   ├── conversations.service.ts
│   │   ├── messages.service.ts
│   │   └── presence.service.ts
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification middleware
│   │   ├── errorHandler.ts  # Global error handler
│   │   ├── rateLimiter.ts   # Express rate limiter
│   │   └── validate.ts      # Zod request validation
│   ├── workers/
│   │   └── messageWorker.ts # Redis Stream consumer
│   ├── types/
│   │   └── express.d.ts     # Extended Express Request type
│   └── utils/
│       ├── logger.ts        # Structured JSON logger
│       ├── errors.ts        # Custom error classes
│       └── helpers.ts       # General helpers
```

---

## 4. Gateway (`apps/gateway/`)

```
apps/gateway/
├── go.mod
├── go.sum
├── .env.example
├── Dockerfile
├── src/
│   ├── main.go              # Entry point
│   ├── config/
│   │   └── config.go        # Env loader + Config struct
│   ├── ws/
│   │   ├── server.go        # HTTP server + upgrader
│   │   ├── connection.go    # Connection struct + read/write loops
│   │   ├── handler.go       # Message routing logic
│   │   └── room.go          # Room subscription management
│   ├── redis/
│   │   ├── client.go        # Redis client wrapper
│   │   ├── presence.go      # Presence tracking (user_socket_map)
│   │   └── streams.go       # Redis Streams producer/consumer
│   ├── auth/
│   │   └── jwt.go           # Supabase JWT validation
│   ├── protocol/
│   │   ├── event.go         # Event struct definitions
│   │   └── validator.go     # Payload validation
│   └── utils/
│       ├── logger.go        # Structured logging
│       └── errors.go        # Error codes + messages
```

---

## 5. Shared Packages

### 5.1 Types (`packages/types/`)
```
packages/types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts             # Barrel export
│   ├── user.ts              # User-related types + Zod schemas
│   ├── conversation.ts      # Conversation types + Zod schemas
│   ├── message.ts           # Message types + Zod schemas
│   ├── presence.ts          # Presence types
│   ├── api.ts               # API request/response DTOs
│   └── gateway.ts           # WebSocket event payloads
```

### 5.2 Prisma (`packages/prisma/`)
```
packages/prisma/
├── package.json
├── tsconfig.json
├── schema.prisma            # FROZEN DATABASE SCHEMA
├── src/
│   └── index.ts             # Re-exports generated PrismaClient
└── generated/               # Prisma client output (gitignored)
```

### 5.3 TS Config (`packages/ts-config/`)
```
packages/ts-config/
├── package.json
├── base.json                # Shared base config
├── nextjs.json              # Next.js specific
└── node.json                # Node.js specific
```

---

## 6. Docker & DevOps

```
chat-os/
├── docker-compose.yml       # Redis, optional local Postgres
├── apps/
│   ├── api/
│   │   └── Dockerfile       # Multi-stage Node.ts build
│   ├── web/
│   │   └── Dockerfile       # Next.js standalone output
│   └── gateway/
│       └── Dockerfile       # Multi-stage Go build (distroless)
```

---

## 7. File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| React components | PascalCase | `ChatWindow.tsx` |
| Hooks | camelCase, prefix `use` | `useGateway.ts` |
| API routes | kebab-case | `conversations.ts` |
| Controllers | camelCase, suffix `.controller.ts` | `users.controller.ts` |
| Services | camelCase, suffix `.service.ts` | `users.service.ts` |
| Go files | snake_case or camelCase | `message_worker.go` |
| Types/Schemas | PascalCase | `SendMessagePayload` |
| Zod schemas | camelCase, suffix `Schema` | `sendMessageSchema` |

---

## 8. Import Rules

### TypeScript
```typescript
// Internal packages (always use aliases)
import { SendMessagePayload } from '@chat-os/types';
import { prisma } from '@chat-os/prisma';

// App-internal (use relative)
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
```

### Go
```go
// Internal modules
import "chat-os/gateway/internal/redis"
import "chat-os/gateway/internal/ws"
```

---

## 9. Environment Variable Scope

| Variable | Scope | Used By |
|----------|-------|---------|
| `DATABASE_URL` | API, Prisma | PostgreSQL connection |
| `REDIS_URL` | API, Gateway | Redis connection |
| `SUPABASE_URL` | Web, API | Supabase project URL |
| `SUPABASE_ANON_KEY` | Web | Supabase client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Supabase server-side operations |
| `SUPABASE_JWT_SECRET` | API, Gateway | JWT verification |
| `API_URL` | Web | REST API base URL |
| `GATEWAY_URL` | Web | WebSocket URL |
| `PORT` | API, Gateway | Server listen port |
| `NODE_ENV` | API, Web | "development" | "production" |
| `LOG_LEVEL` | API, Gateway | "debug" | "info" | "warn" | "error" |
