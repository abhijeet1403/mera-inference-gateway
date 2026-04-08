import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import http from 'http';
import { AppModule } from './../src/app.module';
import { exportJWK, generateKeyPair } from 'jose';

describe('InferenceGateway (e2e)', () => {
  let app: INestApplication<App>;
  let jwksServer: http.Server;

  beforeAll(async () => {
    // Generate a test Ed25519 keypair and serve the public key via a local JWKS server
    const { publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = 'EdDSA';
    publicJwk.kid = 'test-key-001';

    jwksServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, resolve));
    const jwksPort = (jwksServer.address() as { port: number }).port;

    process.env.RED_PILL_API_KEY = 'test-key';
    process.env.AUTH_JWKS_URL = `http://localhost:${jwksPort}/jwks`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jwksServer.close();
  });

  it('GET /health should return 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('POST /api/chat without auth should return 401', () => {
    return request(app.getHttpServer())
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(401);
  });

  it('POST /api/batch-infer without auth should return 401', () => {
    return request(app.getHttpServer())
      .post('/api/batch-infer')
      .send({
        batches: [
          {
            system: 'test',
            prompts: [{ id: '1', prompt: 'hello' }],
          },
        ],
      })
      .expect(401);
  });
});
