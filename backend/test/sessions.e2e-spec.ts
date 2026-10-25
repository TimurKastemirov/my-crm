import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { AuthResult, AuthTokens } from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * Immediate access-token revocation: a password change or "sign out everywhere" bumps the
 * user's session version, and access tokens issued before stop working at once (not after 15 min).
 */
describe.runIf(hasE2eDatabase)('Session revocation (e2e)', () => {
  let app: INestApplication;
  let seq = 0;
  const PASSWORD = 'correct-horse-42';
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(): Promise<AuthResult> {
    return (
      await api()
        .post('/api/v1/auth/register')
        .send({
          email: `session.${Date.now()}.${++seq}@e2e.test`,
          password: PASSWORD,
          firstName: 'Sid',
          lastName: 'Session',
          organizationName: `Session Org ${seq}`,
        })
        .expect(201)
    ).body as AuthResult;
  }

  async function login(
    email: string,
    password = PASSWORD,
  ): Promise<AuthResult> {
    return (
      await api()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200)
    ).body as AuthResult;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('a password change kills every earlier access token immediately; the new pair works', async () => {
    const me = await register();
    const otherDevice = await login(me.user.email);
    // Warm the cached session version first, so the test also proves the cache is updated.
    await api()
      .get('/api/v1/users/me')
      .set(bearer(otherDevice.tokens.accessToken))
      .expect(200);

    const fresh = (
      await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(me.tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
        .expect(200)
    ).body as AuthTokens;

    const revoked = await api()
      .get('/api/v1/users/me')
      .set(bearer(otherDevice.tokens.accessToken))
      .expect(401);
    expect(revoked.body.message).toMatch(/revoked/);
    await api()
      .get('/api/v1/users/me')
      .set(bearer(me.tokens.accessToken))
      .expect(401);
    await api()
      .get('/api/v1/users/me')
      .set(bearer(fresh.accessToken))
      .expect(200);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: fresh.refreshToken })
      .expect(200);
  });

  it('signing out everywhere kills the current access token too', async () => {
    const me = await register();
    await api()
      .get('/api/v1/users/me')
      .set(bearer(me.tokens.accessToken))
      .expect(200);
    await api()
      .post('/api/v1/auth/logout-all')
      .set(bearer(me.tokens.accessToken))
      .expect(204);
    await api()
      .get('/api/v1/users/me')
      .set(bearer(me.tokens.accessToken))
      .expect(401);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: me.tokens.refreshToken })
      .expect(401);

    // Signing in again works with the new version.
    const again = await login(me.user.email);
    await api()
      .get('/api/v1/users/me')
      .set(bearer(again.tokens.accessToken))
      .expect(200);
  });

  it('tokens issued before this change (no version claim) keep working until the first bump', async () => {
    const me = await register();
    const jwt = app.get(JwtService);
    const legacy = await jwt.signAsync({
      sub: me.user.id,
      organizationId: (
        await api()
          .get('/api/v1/auth/me')
          .set(bearer(me.tokens.accessToken))
          .expect(200)
      ).body.organizationId,
      email: me.user.email,
    });

    await api().get('/api/v1/users/me').set(bearer(legacy)).expect(200);
    await api().post('/api/v1/auth/logout-all').set(bearer(legacy)).expect(204);
    await api().get('/api/v1/users/me').set(bearer(legacy)).expect(401);
  });

  it('other users are not affected by someone else’s sign-out', async () => {
    const a = await register();
    const b = await register();
    await api()
      .post('/api/v1/auth/logout-all')
      .set(bearer(a.tokens.accessToken))
      .expect(204);
    await api()
      .get('/api/v1/users/me')
      .set(bearer(b.tokens.accessToken))
      .expect(200);
  });

  it('two simultaneous refreshes with one token: exactly one succeeds (no forked family)', async () => {
    const me = await register();
    const results = await Promise.all(
      [1, 2].map(() =>
        api()
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: me.tokens.refreshToken }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });
});
