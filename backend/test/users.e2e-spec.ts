import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  SystemRole,
  type AuthResult,
  type AuthTokens,
  type MemberDto,
  type RoleRef,
  type UserDto,
} from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/** Users / profile / settings (§6.3): GET/PATCH /users/me, /settings, /password. */
describe.runIf(hasE2eDatabase)('Users / profile (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct-horse-42';
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(): Promise<AuthResult> {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        email: `user.${Date.now()}.${++seq}@e2e.test`,
        password: PASSWORD,
        firstName: 'Paula',
        lastName: 'Profile',
        organizationName: `Profile Org ${seq}`,
      })
      .expect(201);
    return res.body as AuthResult;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('profile', () => {
    it('GET /users/me returns the signed-in user; requires a token', async () => {
      const { user, tokens } = await register();
      const me = await api()
        .get('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .expect(200);
      expect(me.body).toMatchObject({
        id: user.id,
        email: user.email,
        firstName: 'Paula',
      });
      await api().get('/api/v1/users/me').expect(401);
    });

    it('PATCH /users/me updates trimmed names', async () => {
      const { tokens } = await register();
      const res = await api()
        .patch('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .send({ firstName: '  Pat ', lastName: ' Smith ' })
        .expect(200);
      expect(res.body).toMatchObject({ firstName: 'Pat', lastName: 'Smith' });
    });

    it('rejects blank names and does not allow changing the email', async () => {
      const { user, tokens } = await register();
      await api()
        .patch('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .send({ firstName: '   ' })
        .expect(400);
      await api()
        .patch('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .send({ lastName: '' })
        .expect(400);
      await api()
        .patch('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .send({ email: 'hijack@e2e.test' })
        .expect(400);
      const me = await api()
        .get('/api/v1/users/me')
        .set(bearer(tokens.accessToken))
        .expect(200);
      expect((me.body as UserDto).email).toBe(user.email);
    });
  });

  describe('settings', () => {
    it('PATCH /users/me/settings updates the language and an IANA time zone', async () => {
      const { tokens } = await register();
      const res = await api()
        .patch('/api/v1/users/me/settings')
        .set(bearer(tokens.accessToken))
        .send({ locale: 'uk', timezone: 'Europe/Kyiv' })
        .expect(200);
      expect(res.body).toMatchObject({ locale: 'uk', timezone: 'Europe/Kyiv' });
    });

    it('rejects an unknown time zone or language', async () => {
      const { tokens } = await register();
      await api()
        .patch('/api/v1/users/me/settings')
        .set(bearer(tokens.accessToken))
        .send({ timezone: 'Mars/Olympus_Mons' })
        .expect(400);
      await api()
        .patch('/api/v1/users/me/settings')
        .set(bearer(tokens.accessToken))
        .send({ locale: 'de' })
        .expect(400);
    });
  });

  describe('password', () => {
    it('a wrong current password is a 400 (not 401), and nothing changes', async () => {
      const { user, tokens } = await register();
      const res = await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(tokens.accessToken))
        .send({
          currentPassword: 'wrong-password-1',
          newPassword: 'brand-new-pass-1',
        })
        .expect(400);
      expect(res.body.message).toMatch(/current password/i);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
    });

    it('rejects a too short or unchanged new password', async () => {
      const { tokens } = await register();
      await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);
    });

    it('changes the password, ends every other session and keeps the current one', async () => {
      const { user, tokens } = await register();
      const otherDevice = (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: user.email, password: PASSWORD })
          .expect(200)
      ).body as AuthResult;

      const res = await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
        .expect(200);
      const fresh = res.body as AuthTokens;

      // Old sessions (this device's previous refresh token and the other device) are gone.
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: otherDevice.tokens.refreshToken })
        .expect(401);
      // The current session continues with the new pair.
      await api()
        .get('/api/v1/users/me')
        .set(bearer(fresh.accessToken))
        .expect(200);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: fresh.refreshToken })
        .expect(200);

      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(401);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'brand-new-pass-1' })
        .expect(200);
    });
  });

  describe('review follow-ups', () => {
    it('null fields are rejected with 400, never a 500', async () => {
      const { tokens } = await register();
      for (const body of [{ firstName: null }, { lastName: null }]) {
        await api()
          .patch('/api/v1/users/me')
          .set(bearer(tokens.accessToken))
          .send(body)
          .expect(400);
      }
      for (const body of [{ locale: null }, { timezone: null }]) {
        await api()
          .patch('/api/v1/users/me/settings')
          .set(bearer(tokens.accessToken))
          .send(body)
          .expect(400);
      }
    });

    it('a removed member cannot mint a new session by changing the password', async () => {
      const owner = await register();
      const ownerAuth = bearer(owner.tokens.accessToken);
      const roles = await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(ownerAuth)
        .expect(200);
      const viewerRole = (roles.body as RoleRef[]).find(
        (r) => r.code === SystemRole.Viewer,
      );
      const email = `removed.${Date.now()}@e2e.test`;
      const invite = await api()
        .post('/api/v1/organizations/members')
        .set(ownerAuth)
        .send({ email, roleId: viewerRole?.id })
        .expect(201);
      const member = (
        await api()
          .post('/api/v1/auth/invitations/accept')
          .send({
            token: invite.body.token,
            password: PASSWORD,
            firstName: 'Rem',
            lastName: 'Oved',
          })
          .expect(200)
      ).body as AuthResult;
      const members = await api()
        .get('/api/v1/organizations/members')
        .set(ownerAuth)
        .expect(200);
      const memberId = (members.body as MemberDto[]).find(
        (m) => m.userId === member.user.id,
      )?.id;
      await api()
        .delete(`/api/v1/organizations/members/${memberId}`)
        .set(ownerAuth)
        .expect(204);

      await api()
        .patch('/api/v1/users/me/password')
        .set(bearer(member.tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
        .expect(401);
      // Nothing changed: re-invited, the account still accepts with its old password.
      const again = await api()
        .post('/api/v1/organizations/members')
        .set(ownerAuth)
        .send({ email, roleId: viewerRole?.id })
        .expect(201);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token: again.body.token, password: PASSWORD })
        .expect(200);
    });

    it('guessing the current password is rate-limited per user', async () => {
      const { tokens } = await register();
      const attempt = () =>
        api()
          .patch('/api/v1/users/me/password')
          .set(bearer(tokens.accessToken))
          .send({
            currentPassword: 'wrong-password-1',
            newPassword: 'brand-new-pass-1',
          });
      for (let i = 0; i < 5; i++) await attempt().expect(400);
      await attempt().expect(429);
    });
  });
});
