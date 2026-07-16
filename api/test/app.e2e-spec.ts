import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Smoke test: บูต AppModule จริงบน SQLite ในหน่วยความจำ (ไม่แตะ dev.sqlite)
 * ตรวจว่า DI graph ประกอบได้ และ global JwtAuthGuard ทำงาน
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SQLITE_PATH = ':memory:';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('ปฏิเสธการเข้าถึง route ที่ต้องล็อกอินด้วย 401', () => {
    return request(app.getHttpServer()).get('/loans').expect(401);
  });

  it('ล็อกอินด้วย admin ที่ระบบ seed ให้ แล้วได้ token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin1234' })
      .expect(201);
    const body = res.body as { accessToken?: string };
    expect(body.accessToken).toEqual(expect.any(String));
  });
});
