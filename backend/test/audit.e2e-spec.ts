import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  AUDIT_ACTIONS,
  PERMISSIONS,
  SystemRole,
  type AuditLogDto,
  type AuthResult,
  type MemberDto,
  type Paginated,
  type PipelineDto,
  type RoleRef,
  type RoleSummaryDto,
} from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * Audit log (§6.3 / §5.3): key operations are recorded with actor, IP and a short snapshot,
 * the log is append-only, readable only with audit.read and only within the organization.
 */
describe.runIf(hasE2eDatabase)('Audit log (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct-horse-42';
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (s: AuthResult) => ({
    Authorization: `Bearer ${s.tokens.accessToken}`,
  });
  const uniqueEmail = (p: string) => `${p}.${Date.now()}.${++seq}@e2e.test`;

  async function registerOwner(): Promise<AuthResult> {
    return (
      await api()
        .post('/api/v1/auth/register')
        .set('User-Agent', 'e2e-agent/1.0')
        .send({
          email: uniqueEmail('owner'),
          password: PASSWORD,
          firstName: 'Ada',
          lastName: 'Auditor',
          organizationName: `Audit Org ${seq}`,
        })
        .expect(201)
    ).body as AuthResult;
  }

  async function logs(
    actor: AuthResult,
    query: Record<string, string> = {},
  ): Promise<AuditLogDto[]> {
    const res = await api()
      .get('/api/v1/audit-logs')
      .query({ limit: 100, ...query })
      .set(bearer(actor))
      .expect(200);
    return (res.body as Paginated<AuditLogDto>).data;
  }

  async function roleId(owner: AuthResult, code: string): Promise<string> {
    const roles = (
      await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(bearer(owner))
        .expect(200)
    ).body as RoleRef[];
    return roles.find((r) => r.code === code)?.id as string;
  }

  async function join(
    owner: AuthResult,
    code: string,
    email = uniqueEmail(code),
  ): Promise<AuthResult> {
    const invite = await api()
      .post('/api/v1/organizations/members')
      .set(bearer(owner))
      .send({ email, roleId: await roleId(owner, code) })
      .expect(201);
    return (
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token: invite.body.token,
          password: PASSWORD,
          firstName: 'Mo',
          lastName: 'Member',
        })
        .expect(200)
    ).body as AuthResult;
  }

  async function memberId(owner: AuthResult, userId: string): Promise<string> {
    const members = (
      await api()
        .get('/api/v1/organizations/members')
        .set(bearer(owner))
        .expect(200)
    ).body as MemberDto[];
    return members.find((m) => m.userId === userId)?.id as string;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('authentication', () => {
    it('registration and sign-in are recorded with actor, IP and user agent', async () => {
      const owner = await registerOwner();
      await api()
        .post('/api/v1/auth/login')
        .set('User-Agent', 'e2e-agent/1.0')
        .send({ email: owner.user.email, password: PASSWORD })
        .expect(200);

      const entries = await logs(owner);
      const register = entries.find(
        (e) => e.action === AUDIT_ACTIONS.AuthRegister,
      );
      const login = entries.find((e) => e.action === AUDIT_ACTIONS.AuthLogin);
      expect(register?.actor?.email).toBe(owner.user.email);
      expect(login).toMatchObject({
        actor: { id: owner.user.id },
        userAgent: 'e2e-agent/1.0',
      });
      expect(login?.ip).toBeTruthy();
    });

    it('a failed sign-in to an existing account is recorded in every organization of the person', async () => {
      const ownerA = await registerOwner();
      const ownerB = await registerOwner();
      const email = uniqueEmail('both');
      await join(ownerA, SystemRole.Agent, email);
      await join(ownerB, SystemRole.Viewer, email);

      await api()
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password-1' })
        .expect(401);
      for (const owner of [ownerA, ownerB]) {
        const failed = await logs(owner, {
          action: AUDIT_ACTIONS.AuthLoginFailed,
        });
        expect(failed).toHaveLength(1);
        expect(failed[0]).toMatchObject({
          actor: { email },
          after: { reason: 'invalid_password' },
        });
      }
    });

    it('an unknown email leaves no trace', async () => {
      const owner = await registerOwner();
      await api()
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail('ghost'), password: PASSWORD })
        .expect(401);
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.AuthLoginFailed }),
      ).toHaveLength(0);
    });

    it('password change and signing out everywhere are recorded', async () => {
      const owner = await registerOwner();
      const fresh = (
        await api()
          .patch('/api/v1/users/me/password')
          .set(bearer(owner))
          .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })
          .expect(200)
      ).body as AuthResult['tokens'];
      const session = { ...owner, tokens: fresh };
      await api()
        .post('/api/v1/auth/logout-all')
        .set(bearer(session))
        .expect(204);

      const relogin = (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: owner.user.email, password: 'brand-new-pass-1' })
          .expect(200)
      ).body as AuthResult;
      const actions = (await logs(relogin)).map((e) => e.action);
      expect(actions).toContain(AUDIT_ACTIONS.AuthPasswordChanged);
      expect(actions).toContain(AUDIT_ACTIONS.AuthLogoutAll);
    });
  });

  describe('access control', () => {
    it('member lifecycle: invited, joined, role changed, suspended, reactivated, removed', async () => {
      const owner = await registerOwner();
      const email = uniqueEmail('life');
      const agent = await join(owner, SystemRole.Agent, email);
      const id = await memberId(owner, agent.user.id);
      const patch = (body: object) =>
        api()
          .patch(`/api/v1/organizations/members/${id}`)
          .set(bearer(owner))
          .send(body)
          .expect(200);
      await patch({ roleId: await roleId(owner, SystemRole.Viewer) });
      await patch({ status: 'suspended' });
      await patch({ status: 'active' });
      await api()
        .delete(`/api/v1/organizations/members/${id}`)
        .set(bearer(owner))
        .expect(204);

      const entries = await logs(owner);
      const byAction = (a: string) => entries.find((e) => e.action === a);
      expect(byAction(AUDIT_ACTIONS.MemberInvited)).toMatchObject({
        after: { email, role: 'Agent' },
      });
      expect(byAction(AUDIT_ACTIONS.MemberJoined)).toMatchObject({
        actor: { email },
      });
      expect(byAction(AUDIT_ACTIONS.MemberRoleChanged)).toMatchObject({
        actor: { id: owner.user.id },
        before: { email, role: 'Agent' },
        after: { email, role: 'Viewer' },
      });
      expect(byAction(AUDIT_ACTIONS.MemberSuspended)).toMatchObject({
        entityId: id,
      });
      expect(byAction(AUDIT_ACTIONS.MemberReactivated)).toMatchObject({
        entityId: id,
      });
      expect(byAction(AUDIT_ACTIONS.MemberRemoved)).toMatchObject({
        before: { email, role: 'Viewer' },
      });
    });

    it('re-assigning the same role is not reported as a role change', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      await api()
        .patch(
          `/api/v1/organizations/members/${await memberId(owner, agent.user.id)}`,
        )
        .set(bearer(owner))
        .send({ roleId: await roleId(owner, SystemRole.Agent) })
        .expect(200);
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.MemberRoleChanged }),
      ).toHaveLength(0);
    });

    it('revoking an invitation, role changes and renaming the organization are recorded', async () => {
      const owner = await registerOwner();
      const invite = await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({
          email: 'revoked@e2e.test',
          roleId: await roleId(owner, SystemRole.Viewer),
        })
        .expect(201);
      await api()
        .delete(
          `/api/v1/organizations/invitations/${invite.body.invitation.id}`,
        )
        .set(bearer(owner))
        .expect(204);

      const role = (
        await api()
          .post('/api/v1/roles')
          .set(bearer(owner))
          .send({ name: 'Audited', permissions: [PERMISSIONS.DEALS_READ] })
          .expect(201)
      ).body as RoleSummaryDto;
      await api()
        .patch(`/api/v1/roles/${role.id}`)
        .set(bearer(owner))
        .send({
          permissions: [PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE],
        })
        .expect(200);
      await api()
        .delete(`/api/v1/roles/${role.id}`)
        .set(bearer(owner))
        .expect(204);
      await api()
        .patch('/api/v1/organizations/current')
        .set(bearer(owner))
        .send({ name: 'Renamed Audit Org' })
        .expect(200);

      const entries = await logs(owner);
      const byAction = (a: string) => entries.find((e) => e.action === a);
      expect(byAction(AUDIT_ACTIONS.InvitationRevoked)).toMatchObject({
        before: { email: 'revoked@e2e.test' },
      });
      expect(byAction(AUDIT_ACTIONS.RoleCreated)).toMatchObject({
        after: { name: 'Audited', permissions: [PERMISSIONS.DEALS_READ] },
      });
      expect(byAction(AUDIT_ACTIONS.RoleUpdated)).toMatchObject({
        before: { permissions: [PERMISSIONS.DEALS_READ] },
        after: {
          permissions: [PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE],
        },
      });
      expect(byAction(AUDIT_ACTIONS.RoleDeleted)).toMatchObject({
        entityId: role.id,
        before: { name: 'Audited' },
      });
      expect(byAction(AUDIT_ACTIONS.OrganizationUpdated)).toMatchObject({
        after: { name: 'Renamed Audit Org' },
      });
    });

    it('a refused operation leaves no entry (the entry is written in the same transaction)', async () => {
      const owner = await registerOwner();
      const role = (
        await api()
          .post('/api/v1/roles')
          .set(bearer(owner))
          .send({ name: 'Busy', permissions: [] })
          .expect(201)
      ).body as RoleSummaryDto;
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({ email: uniqueEmail('busy'), roleId: role.id })
        .expect(201);
      await api()
        .delete(`/api/v1/roles/${role.id}`)
        .set(bearer(owner))
        .expect(409);
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.RoleDeleted }),
      ).toHaveLength(0);
    });
  });

  describe('deletions', () => {
    it('keeps only id and a name — no contact details of the deleted record', async () => {
      const owner = await registerOwner();
      const contact = await api()
        .post('/api/v1/contacts')
        .set(bearer(owner))
        .send({
          firstName: 'Ivan',
          lastName: 'Petrov',
          email: 'ivan@client.test',
          phone: '+380000000',
        })
        .expect(201);
      await api()
        .delete(`/api/v1/contacts/${contact.body.id}`)
        .set(bearer(owner))
        .expect(204);
      const task = await api()
        .post('/api/v1/tasks')
        .set(bearer(owner))
        .send({ title: 'Call Ivan' })
        .expect(201);
      await api()
        .delete(`/api/v1/tasks/${task.body.id}`)
        .set(bearer(owner))
        .expect(204);

      const [deletedContact] = await logs(owner, {
        action: AUDIT_ACTIONS.ContactDeleted,
      });
      expect(deletedContact).toMatchObject({
        entityType: 'contact',
        entityId: contact.body.id,
        before: { name: 'Ivan Petrov' },
      });
      expect(JSON.stringify(deletedContact)).not.toContain('ivan@client.test');
      expect(JSON.stringify(deletedContact)).not.toContain('+380000000');
      const [deletedTask] = await logs(owner, {
        action: AUDIT_ACTIONS.TaskDeleted,
      });
      expect(deletedTask).toMatchObject({
        entityId: task.body.id,
        before: { title: 'Call Ivan' },
      });
    });

    it('deleting a pipeline stage and a pipeline is recorded', async () => {
      const owner = await registerOwner();
      const pipeline = (
        await api()
          .post('/api/v1/pipelines')
          .set(bearer(owner))
          .send({ name: 'Temp funnel' })
          .expect(201)
      ).body as PipelineDto;
      const stage = (
        await api()
          .post(`/api/v1/pipelines/${pipeline.id}/stages`)
          .set(bearer(owner))
          .send({ name: 'Extra' })
          .expect(201)
      ).body as { id: string };
      await api()
        .delete(`/api/v1/pipelines/${pipeline.id}/stages/${stage.id}`)
        .set(bearer(owner))
        .expect(204);
      await api()
        .delete(`/api/v1/pipelines/${pipeline.id}`)
        .set(bearer(owner))
        .expect(204);

      const entries = await logs(owner);
      expect(
        entries.find((e) => e.action === AUDIT_ACTIONS.StageDeleted),
      ).toMatchObject({ before: { name: 'Extra' } });
      expect(
        entries.find((e) => e.action === AUDIT_ACTIONS.PipelineDeleted),
      ).toMatchObject({ before: { name: 'Temp funnel' } });
    });
  });

  describe('reading the log', () => {
    it('requires audit.read: managers can read, agents cannot', async () => {
      const owner = await registerOwner();
      const manager = await join(owner, SystemRole.Manager);
      const agent = await join(owner, SystemRole.Agent);
      await api().get('/api/v1/audit-logs').set(bearer(manager)).expect(200);
      await api().get('/api/v1/audit-logs').set(bearer(agent)).expect(403);
      await api().get('/api/v1/audit-logs').expect(401);
    });

    it('is isolated per organization (BOLA)', async () => {
      const ownerA = await registerOwner();
      const ownerB = await registerOwner();
      const entriesB = await logs(ownerB);
      expect(
        entriesB.every((e) => e.organizationId === entriesB[0].organizationId),
      ).toBe(true);
      expect(entriesB.map((e) => e.actor?.id)).not.toContain(ownerA.user.id);
      const entityId = (await logs(ownerA))[0].entityId as string;
      expect(await logs(ownerB, { entityId })).toHaveLength(0);
    });

    it('is newest first, paginated and filterable by period and action', async () => {
      const owner = await registerOwner();
      for (let i = 0; i < 3; i++) {
        await api()
          .post('/api/v1/auth/login')
          .send({ email: owner.user.email, password: PASSWORD })
          .expect(200);
      }
      const all = await logs(owner);
      const times = all.map((e) => e.createdAt);
      expect([...times].sort().reverse()).toEqual(times);

      const page = (
        await api()
          .get('/api/v1/audit-logs')
          .query({ limit: 2, page: 2 })
          .set(bearer(owner))
          .expect(200)
      ).body as Paginated<AuditLogDto>;
      expect(page.data).toHaveLength(2);
      expect(page.meta.total).toBe(all.length);

      expect(
        await logs(owner, {
          from: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).toHaveLength(0);
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.AuthLogin }),
      ).toHaveLength(3);
      await api()
        .get('/api/v1/audit-logs')
        .query({ action: 'auth.hack' })
        .set(bearer(owner))
        .expect(400);
    });

    it('the log is append-only: the database refuses updates and deletes', async () => {
      const owner = await registerOwner();
      const [entry] = await logs(owner);
      const db = app.get(DataSource);
      await expect(
        db.query(`UPDATE audit_logs SET action = 'x' WHERE id = $1`, [
          entry.id,
        ]),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.query(`DELETE FROM audit_logs WHERE id = $1`, [entry.id]),
      ).rejects.toThrow(/append-only/);
    });
  });

  describe('review follow-ups', () => {
    it('records the client IP from X-Forwarded-For behind the trusted proxy', async () => {
      const owner = await registerOwner();
      await api()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ email: owner.user.email, password: PASSWORD })
        .expect(200);
      const [login] = await logs(owner, { action: AUDIT_ACTIONS.AuthLogin });
      expect(login.ip).toBe('203.0.113.7');
    });

    it('repeated failed sign-ins are recorded once per minute, not per attempt', async () => {
      const owner = await registerOwner();
      for (let i = 0; i < 3; i++) {
        await api()
          .post('/api/v1/auth/login')
          .send({ email: owner.user.email, password: 'wrong-password-1' })
          .expect(401);
      }
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.AuthLoginFailed }),
      ).toHaveLength(1);
    });

    it('two simultaneous deletes of one record: one succeeds, one entry', async () => {
      const owner = await registerOwner();
      const contact = await api()
        .post('/api/v1/contacts')
        .set(bearer(owner))
        .send({ firstName: 'Dup', lastName: 'Licate' })
        .expect(201);
      const results = await Promise.all(
        [1, 2].map(() =>
          api()
            .delete(`/api/v1/contacts/${contact.body.id}`)
            .set(bearer(owner)),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([204, 404]);
      expect(
        await logs(owner, { action: AUDIT_ACTIONS.ContactDeleted }),
      ).toHaveLength(1);
    });

    it('reuse of a revoked refresh token is recorded as a security event', async () => {
      const owner = await registerOwner();
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: owner.tokens.refreshToken })
        .expect(200);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: owner.tokens.refreshToken })
        .expect(401);
      const relogin = (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: owner.user.email, password: PASSWORD })
          .expect(200)
      ).body as AuthResult;
      const [reuse] = await logs(relogin, {
        action: AUDIT_ACTIONS.AuthTokenReuse,
      });
      expect(reuse).toMatchObject({ actor: { id: owner.user.id } });
    });
  });
});
