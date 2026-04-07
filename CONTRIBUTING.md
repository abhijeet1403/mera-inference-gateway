# Contributing to mera-inference-gateway

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/mera-news/mera-inference-gateway.git
cd mera-inference-gateway

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in RED_PILL_API_KEY and BETTER_AUTH_SECRET

# Start development server
npm run start:dev
```

### Verify Setup

```bash
# Health check
curl http://localhost:8080/health
# Should return: {"status":"ok"}

# Auth check (should return 401 without valid token)
curl -X POST http://localhost:8080/api/chat
# Should return: 401 Unauthorized
```

## Code Style

This project uses **Prettier** and **ESLint** for code formatting and linting.

```bash
npm run format    # Auto-format with Prettier
npm run lint      # Lint and auto-fix with ESLint
```

Both run automatically via the existing configurations (`.prettierrc`, `eslint.config.mjs`).

## Testing

```bash
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage report
```

## Making Changes

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feat/your-feature`
3. **Make your changes** — keep commits focused and atomic
4. **Run checks**: `npm run lint && npm run test && npm run build`
5. **Open a pull request** against `main`

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Ensure all checks pass (lint, test, build)
- Update documentation if you change API behavior or configuration

## Architecture Notes

This gateway is intentionally minimal. Its sole purpose is to authenticate requests and proxy encrypted payloads to RedPill AI. When contributing, keep in mind:

- **Never add code that reads, logs, or transforms message content** — messages are E2EE-encrypted
- **No database dependencies** — auth is stateless JWT verification
- **Model configuration** lives in `src/constants.ts`

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS)

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
