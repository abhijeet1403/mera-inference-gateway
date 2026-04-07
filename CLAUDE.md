# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Standalone NestJS inference gateway that proxies E2EE-encrypted chat requests to RedPill AI. The gateway **never decrypts or inspects message content** — it authenticates requests via JWT and forwards encrypted payloads to RedPill's TEE-protected inference.

## Commands

```bash
npm run start:dev      # Development with watch mode
npm run build          # Compile TypeScript
npm run start:prod     # Run compiled output
npm run lint           # ESLint with auto-fix
npm run format         # Prettier formatting
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
npm run test:cov       # Test coverage
```

## Architecture

```
src/
  main.ts              # Bootstrap: helmet, CORS, validation, exception filter
  app.module.ts        # Root module: config, logging (Pino/GCP), throttling, chat module
  constants.ts         # DEFAULT_MODEL, DEFAULT_LLM_TEMPERATURE, REDPILL_BASE_URL
  auth/
    auth.guard.ts      # JWT verification using BETTER_AUTH_SECRET (no DB)
  chat/
    chat.module.ts     # Registers controller + service
    chat.controller.ts # POST /api/chat (SSE streaming), POST /api/batch-infer
    chat.service.ts    # RedPill AI proxy: streamChat() + generateTextResponse()
    dto/
      chat.dto.ts          # ChatRequestBody interface (OpenAI-compatible)
      batch-infer.dto.ts   # BatchInferRequestDto with class-validator
  health/
    health.controller.ts   # GET /health
  filters/
    http-exception.filter.ts  # Global exception filter
```

## Key Design Principle: E2EE Passthrough

The gateway is intentionally ignorant of message content. `ChatRequestBody.messages[].content` contains E2EE-encrypted payloads. The `ChatService` serializes the request body and forwards it to RedPill without inspection.

**Never add code that reads, logs, or transforms message content.**

## Auth

- Stateless JWT verification using `BETTER_AUTH_SECRET`
- No database connection — token signature is verified locally
- Bearer token extracted from `Authorization` header
- Requires the auth service to issue JWTs signed with the same secret

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `RED_PILL_API_KEY` | Yes | — |
| `BETTER_AUTH_SECRET` | Yes | — |
| `PORT` | No | `8080` |
| `DEFAULT_MODEL` | No | `phala/qwen3-vl-30b-a3b-instruct` |
| `NODE_ENV` | No | `development` |
| `CORS_ORIGIN` | No | `http://localhost:8081` |
| `THROTTLE_TTL` | No | `60` |
| `THROTTLE_LIMIT` | No | `30` |
| `LOG_LEVEL` | No | `debug` / `warn` |

## Deployment

Deployed as a Google Cloud Run service. The Dockerfile uses a multi-stage build with `node:20-alpine`. Default port is 8080 (Cloud Run convention). Non-root user in production image.

## Patterns

- Uses NestJS `ConfigService` for all env access (never raw `process.env` in services)
- GCP-compatible structured logging via Pino (severity levels mapped to GCP format)
- Rate limiting via `@nestjs/throttler` (global guard)
- Global `ValidationPipe` with `transform: true, whitelist: true`
