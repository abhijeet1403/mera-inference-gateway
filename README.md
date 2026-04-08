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

#### E2EE mode

When E2EE headers are present, the endpoint switches to **non-streaming** mode (required by RedPill's E2EE protocol). The gateway forwards the headers to RedPill and relays the E2EE response headers back to the client.

**Additional E2EE headers (all forwarded to RedPill):**

| Header | Required | Description |
|--------|----------|-------------|
| `X-E2EE-Version` | Yes | Protocol version (`1` or `2`, v2 recommended). Presence of this header triggers the E2EE path. |
| `X-Signing-Algo` | Yes | `ecdsa` or `ed25519` |
| `X-Client-Pub-Key` | Yes | Client ephemeral public key (hex) |
| `X-Model-Pub-Key` | Yes | Model public key from attestation (hex) |
| `X-E2EE-Nonce` | v2 | Unique value (>=16 chars, required for v2) |
| `X-E2EE-Timestamp` | v2 | Unix seconds (required for v2) |

**E2EE response headers (returned to client):**
- `X-E2EE-Applied` — `true` if E2EE was applied
- `X-E2EE-Version` — protocol version used
- `X-E2EE-Algo` — algorithm used

**Response:** JSON (non-streaming) with encrypted `choices[*].message.content`

### `GET /api/attestation/report`
Fetches the TEE attestation report from RedPill, including the model's signing public key needed for E2EE encryption. The resolved model name is included in the response so the client can use it for Additional Authenticated Data (AAD).

**Headers:**
- `Authorization: Bearer <jwt-token>` (required)

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `model` | No | `DEFAULT_MODEL` | Model ID (e.g. `phala/qwen-2.5-7b-instruct`) |
| `nonce` | No | — | 32-byte hex string (64 chars) for replay prevention |
| `signing_address` | No | — | Filter for multi-server setups |

**Response:** RedPill attestation report JSON with an additional `model` field containing the resolved model name. Key fields include `signing_public_key`, `signing_address`, `signing_algo`, `intel_quote`, and `nvidia_payload`.

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
| `JWT_PUBLIC_KEY` | Yes | — | Ed25519 public key in JWK format (copy a key object from auth service's `/api/auth/jwks`) |
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
  --set-env-vars "RED_PILL_API_KEY=your-key,NODE_ENV=production" \
  --set-env-vars "JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMCo..." \
  --port 8080 \
  --allow-unauthenticated
```

## Model Configuration

The default model is configured in [`src/constants.ts`](src/constants.ts) and can be overridden via the `DEFAULT_MODEL` environment variable. Per-request model override is also supported via the `model` field in the request body.

**Current default:** `phala/qwen3-vl-30b-a3b-instruct` (RedPill Qwen3 30B A3B)

## Security

- **E2EE passthrough**: Gateway never decrypts or inspects message content
- **JWT authentication**: Ed25519 asymmetric verification using only the public key — no shared secret, no database
- **Rate limiting**: Configurable per-window throttling (default: 30 req/60s)
- **Helmet**: Standard security headers
- **Input validation**: DTO validation on all endpoints

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[Apache 2.0](LICENSE)
