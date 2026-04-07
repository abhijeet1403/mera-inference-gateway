import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Static Ed25519 test key in JWK format (for testing only — never use in production)
const TEST_PUBLIC_KEY_JWK = JSON.stringify({
  crv: 'Ed25519',
  x: 'XJbFrdPrRJPI-LsILQVGs6e2Orl6mHYLjl2_c9UdyyI',
  kty: 'OKP',
  alg: 'EdDSA',
  kid: 'test-key-001',
});

describe('InferenceGateway (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.RED_PILL_API_KEY = 'test-key';
    process.env.JWT_PUBLIC_KEY = TEST_PUBLIC_KEY_JWK;

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
