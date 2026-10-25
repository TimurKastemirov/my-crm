import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  SystemRole,
  type AuthResult,
  type RoleRef,
  type SessionInfo,
} from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * UI language of the account: new accounts start in the language they were created in (default en),
 * and a language picked before signing in wins over the saved one and is stored in the profile.
 */
describe.runIf(hasE2eDatabase)('Account language (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct-horse-42';
  let seq = 0;

  const api = () => request(app.getHttpServer());
  const uniqueEmail = (prefix: string) =>
    `${prefix}.${Date.now()}.${++seq}@e2e.test`;

  function register(extra: Record<string, unknown> = {}) {
    return api()
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('lang'),
        password: PASSWORD,
        firstName: 'Lena',
        lastName: 'Lang',
        organizationName: `Lang Org ${seq}`,
        ...extra,
      });
  }

  async function me(accessToken: string): Promise<SessionInfo> {
    const res = await api()
      .get('/api/v1/auth/me')
      .set({ Authorization: `Bearer ${accessToken}` })
      .expect(200);
    return res.body as SessionInfo;
  }

  async function inviteToken(
    owner: AuthResult,
    email: string,
  ): Promise<string> {
    const auth = { Authorization: `Bearer ${owner.tokens.accessToken}` };
    const roles = await api()
      .get('/api/v1/organizations/members/assignable-roles')
      .set(auth)
      .expect(200);
    const viewer = (roles.body as RoleRef[]).find(
      (r) => r.code === SystemRole.Viewer,
    );
    const res = await api()
      .post('/api/v1/organizations/members')
      .set(auth)
      .send({ email, roleId: viewer?.id })
      .expect(201);
    return res.body.token as string;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('a new account defaults to English', async () => {
    const res = await register().expect(201);
    expect((res.body as AuthResult).user.locale).toBe('en');
  });

  it('a new account starts in the language it was registered in', async () => {
    const res = await register({ locale: 'uk' }).expect(201);
    expect((res.body as AuthResult).user.locale).toBe('uk');
  });

  it('rejects an unsupported language', async () => {
    await register({ locale: 'de' }).expect(400);
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'x@e2e.test', password: PASSWORD, locale: 'de' })
      .expect(400);
  });

  it('a language picked before signing in wins and is saved to the profile', async () => {
    const registered = (await register({ locale: 'ru' }).expect(201))
      .body as AuthResult;
    const email = registered.user.email;

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, locale: 'en' })
      .expect(200);
    expect((login.body as AuthResult).user.locale).toBe('en');
    expect(
      (await me((login.body as AuthResult).tokens.accessToken)).user.locale,
    ).toBe('en');

    // A wrong password never changes the profile language.
    await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-1', locale: 'uk' })
      .expect(401);

    // Without a pick, the saved language is kept.
    const again = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect((again.body as AuthResult).user.locale).toBe('en');
  });

  it('accepting an invitation: new accounts get the given language, existing ones save a pick', async () => {
    const owner = (await register().expect(201)).body as AuthResult;

    const fresh = await api()
      .post('/api/v1/auth/invitations/accept')
      .send({
        token: await inviteToken(owner, uniqueEmail('fresh')),
        password: PASSWORD,
        firstName: 'F',
        lastName: 'Fresh',
        locale: 'uk',
      })
      .expect(200);
    expect((fresh.body as AuthResult).user.locale).toBe('uk');

    const other = (await register({ locale: 'ru' }).expect(201))
      .body as AuthResult;
    const existing = await api()
      .post('/api/v1/auth/invitations/accept')
      .send({
        token: await inviteToken(owner, other.user.email),
        password: PASSWORD,
        locale: 'en',
      })
      .expect(200);
    expect((existing.body as AuthResult).user.locale).toBe('en');
    expect(
      (await me((existing.body as AuthResult).tokens.accessToken)).user.locale,
    ).toBe('en');
  });
});
