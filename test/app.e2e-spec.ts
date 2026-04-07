import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('InferenceGateway (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Provide required env vars for test context
    process.env.RED_PILL_API_KEY = 'test-key';
    process.env.BETTER_AUTH_SECRET = 'test-secret-must-be-long-enough-for-jwt';

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
