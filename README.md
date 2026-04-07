# mera-inference-gateway

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Privacy-first E2EE inference gateway. Proxies encrypted chat requests to [RedPill AI](https://docs.redpill.ai) TEE-protected inference without ever accessing user data.

## Why This Exists

**mera never sees your data.** Messages are end-to-end encrypted on the client using [RedPill's E2EE protocol](https://docs.redpill.ai/developers/guides/e2ee-encryption) before they reach this gateway. The gateway is an opaque pipe — it authenticates the request, then forwards the encrypted payload directly to RedPill AI running inside a Trusted Execution Environment (TEE). Decryption happens only inside the TEE.

```
Client (E2EE encrypt) --> mera-inference-gateway --> RedPill AI (TEE decrypt + infer)
         ^                    |                              |
         |                    | Auth only                    | Encrypted response
         |                    | (never reads                 |
         |                    |  message content)            v
         +----------------------------------------------------+
```

## API Endpoints

### `POST /api/chat`
Streaming chat completions (SSE). Accepts OpenAI-compatible request format with E2EE-encrypted message content.

**Headers:**
- `Authorization: Bearer <jwt-token>` (required)

**Request body:** Standard [OpenAI chat completions format](https://platform.openai.com/docs/api-reference/chat/create)

**Response:** Server-Sent Events stream

### `POST /api/batch-infer`
Batch non-streaming inference. Up to 10 batches with 50 prompts each.

**Headers:**
- `Authorization: Bearer <jwt-token>` (required)

### `GET /health`
Health check endpoint. Returns `{ "status": "ok" }`.

## Setup

### Prerequisites

- Node.js 20+
- A [RedPill AI](https://docs.redpill.ai) API key
- A `BETTER_AUTH_SECRET` (shared with your auth service for JWT verification)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RED_PILL_API_KEY` | Yes | — | RedPill AI API key |
| `BETTER_AUTH_SECRET` | Yes | — | Shared secret for JWT token verification |
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | Environment (`development` / `production`) |
| `DEFAULT_MODEL` | No | `phala/qwen3-vl-30b-a3b-instruct` | Default inference model |
| `CORS_ORIGIN` | No | `http://localhost:8081` | Allowed CORS origin |
| `THROTTLE_TTL` | No | `60` | Rate limit window in seconds |
| `THROTTLE_LIMIT` | No | `30` | Max requests per window |
| `LOG_LEVEL` | No | `debug` (dev) / `warn` (prod) | Pino log level |

### Running

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Deployment (Google Cloud Run)

### Build and push Docker image

```bash
docker build -t mera-inference-gateway .

# Tag and push to your container registry
docker tag mera-inference-gateway gcr.io/YOUR_PROJECT/mera-inference-gateway
docker push gcr.io/YOUR_PROJECT/mera-inference-gateway
```

### Deploy to Cloud Run

```bash
gcloud run deploy mera-inference-gateway \
  --image gcr.io/YOUR_PROJECT/mera-inference-gateway \
  --platform managed \
  --region us-central1 \
  --set-env-vars "RED_PILL_API_KEY=your-key,BETTER_AUTH_SECRET=your-secret,NODE_ENV=production" \
  --port 8080 \
  --allow-unauthenticated
```

## Model Configuration

The default model is configured in [`src/constants.ts`](src/constants.ts) and can be overridden via the `DEFAULT_MODEL` environment variable. Per-request model override is also supported via the `model` field in the request body.

**Current default:** `phala/qwen3-vl-30b-a3b-instruct` (RedPill Qwen3 30B A3B)

## Security

- **E2EE passthrough**: Gateway never decrypts or inspects message content
- **JWT authentication**: Stateless token verification — no database connection required
- **Rate limiting**: Configurable per-window throttling (default: 30 req/60s)
- **Helmet**: Standard security headers
- **Input validation**: DTO validation on all endpoints

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[Apache 2.0](LICENSE)
