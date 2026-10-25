import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PERMISSIONS,
  SystemRole,
  type AuthResult,
  type CreateInvitationResult,
  type MemberDto,
  type RoleRef,
  type SessionInfo,
} from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * Organizations & members (§6.3): invitations, member management, permission checks,
 * immediate access revocation and organization isolation (BOLA, §6.2 / §9).
 * Every test creates its own organizations with unique emails, so no cleanup is needed.
 */
describe.runIf(hasE2eDatabase)('Organizations & members (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct-horse-42';
  let seq = 0;

  interface Session {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
  }

  const api = () => request(app.getHttpServer());
  const bearer = (s: Session) => ({ Authorization: `Bearer ${s.accessToken}` });
  const uniqueEmail = (prefix: string) =>
    `${prefix}.${Date.now()}.${++seq}@e2e.test`;

  const toSession = (body: AuthResult): Session => ({
    accessToken: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    userId: body.user.id,
    email: body.user.email,
  });

  async function registerOwner(): Promise<Session> {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('owner'),
        password: PASSWORD,
        firstName: 'Olivia',
        lastName: 'Owner',
        organizationName: `Org ${seq}`,
      })
      .expect(201);
    return toSession(res.body as AuthResult);
  }

  async function roleId(actor: Session, code: string): Promise<string> {
    const res = await api()
      .get('/api/v1/organizations/members/assignable-roles')
      .set(bearer(actor))
      .expect(200);
    const role = (res.body as RoleRef[]).find((r) => r.code === code);
    if (!role) throw new Error(`Role ${code} is not assignable by this actor`);
    return role.id;
  }

  async function invite(
    actor: Session,
    email: string,
    code: string,
  ): Promise<CreateInvitationResult> {
    const res = await api()
      .post('/api/v1/organizations/members')
      .set(bearer(actor))
      .send({ email, roleId: await roleId(actor, code) })
      .expect(201);
    return res.body as CreateInvitationResult;
  }

  /** Invites a brand-new user with the given role and accepts the invitation. */
  async function join(actor: Session, code: string): Promise<Session> {
    const { token } = await invite(actor, uniqueEmail(code), code);
    const res = await api()
      .post('/api/v1/auth/invitations/accept')
      .send({ token, password: PASSWORD, firstName: 'Mia', lastName: 'Member' })
      .expect(200);
    return toSession(res.body as AuthResult);
  }

  async function members(actor: Session): Promise<MemberDto[]> {
    const res = await api()
      .get('/api/v1/organizations/members')
      .set(bearer(actor))
      .expect(200);
    return res.body as MemberDto[];
  }

  async function memberIdOf(actor: Session, userId: string): Promise<string> {
    const member = (await members(actor)).find((m) => m.userId === userId);
    if (!member) throw new Error('Member not found');
    return member.id;
  }

  async function me(session: Session): Promise<SessionInfo> {
    const res = await api()
      .get('/api/v1/auth/me')
      .set(bearer(session))
      .expect(200);
    return res.body as SessionInfo;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('current organization', () => {
    it('any member reads it; only organizations.manage can rename it', async () => {
      const owner = await registerOwner();
      const admin = await join(owner, SystemRole.Admin);

      const current = await api()
        .get('/api/v1/organizations/current')
        .set(bearer(admin))
        .expect(200);
      expect(current.body.id).toBe((await me(owner)).organizationId);

      await api()
        .patch('/api/v1/organizations/current')
        .set(bearer(admin))
        .send({ name: 'Hijacked' })
        .expect(403);
      const renamed = await api()
        .patch('/api/v1/organizations/current')
        .set(bearer(owner))
        .send({ name: '  Renamed Inc  ' })
        .expect(200);
      expect(renamed.body.name).toBe('Renamed Inc');
    });

    it('/auth/me returns the permissions of the active organization', async () => {
      const owner = await registerOwner();
      expect((await me(owner)).permissions).toContain(
        PERMISSIONS.MEMBERS_MANAGE,
      );
    });
  });

  describe('invitations', () => {
    it('a new user accepts an invitation and joins with the invited role', async () => {
      const owner = await registerOwner();
      const email = uniqueEmail('new');
      const { token, invitation } = await invite(
        owner,
        email,
        SystemRole.Agent,
      );
      expect(invitation.email).toBe(email);
      expect(invitation.role.code).toBe(SystemRole.Agent);

      const preview = await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token })
        .expect(200);
      expect(preview.body).toMatchObject({
        email,
        roleName: 'Agent',
        userExists: false,
      });

      const accepted = await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: PASSWORD, firstName: 'Nora', lastName: 'New' })
        .expect(200);
      const agent = toSession(accepted.body as AuthResult);

      const session = await me(agent);
      expect(session.organizationId).toBe((await me(owner)).organizationId);
      expect(session.permissions).toContain(PERMISSIONS.DEALS_CREATE);
      expect(session.permissions).not.toContain(PERMISSIONS.MEMBERS_MANAGE);

      const list = await members(owner);
      expect(list).toHaveLength(2);
      expect(list.find((m) => m.userId === agent.userId)).toMatchObject({
        email,
        status: 'active',
        role: { code: SystemRole.Agent },
      });

      // The new account can sign in with its own password.
      await api()
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
    });

    it('an invitation link works only once', async () => {
      const owner = await registerOwner();
      const { token } = await invite(
        owner,
        uniqueEmail('once'),
        SystemRole.Viewer,
      );
      const body = {
        token,
        password: PASSWORD,
        firstName: 'Una',
        lastName: 'Once',
      };
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send(body)
        .expect(200);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send(body)
        .expect(400);
      await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token })
        .expect(400);
    });

    it('a new account requires names, and a failed attempt does not consume the link', async () => {
      const owner = await registerOwner();
      const { token } = await invite(
        owner,
        uniqueEmail('names'),
        SystemRole.Viewer,
      );
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: PASSWORD })
        .expect(400);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token,
          password: PASSWORD,
          firstName: 'Ned',
          lastName: 'Names',
        })
        .expect(200);
    });

    it('an existing account joins after confirming its own password', async () => {
      const ownerA = await registerOwner();
      const ownerB = await registerOwner();
      const { token } = await invite(ownerA, ownerB.email, SystemRole.Manager);

      const preview = await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token })
        .expect(200);
      expect(preview.body.userExists).toBe(true);

      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: 'wrong-password-1' })
        .expect(401);
      const accepted = await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: PASSWORD })
        .expect(200);

      const session = await me(toSession(accepted.body as AuthResult));
      expect(session.organizationId).toBe((await me(ownerA)).organizationId);
      expect(session.permissions).toContain(PERMISSIONS.DEALS_DELETE);
    });

    it('re-inviting replaces the pending link; revoked links stop working', async () => {
      const owner = await registerOwner();
      const email = uniqueEmail('again');
      const first = await invite(owner, email, SystemRole.Agent);
      const second = await invite(owner, email, SystemRole.Viewer);

      await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token: first.token })
        .expect(400);
      const pending = await api()
        .get('/api/v1/organizations/invitations')
        .set(bearer(owner))
        .expect(200);
      expect(pending.body).toHaveLength(1);
      expect(pending.body[0]).toMatchObject({
        id: second.invitation.id,
        role: { code: SystemRole.Viewer },
      });

      await api()
        .delete(`/api/v1/organizations/invitations/${second.invitation.id}`)
        .set(bearer(owner))
        .expect(204);
      await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token: second.token })
        .expect(400);
      await api()
        .delete(`/api/v1/organizations/invitations/${second.invitation.id}`)
        .set(bearer(owner))
        .expect(404);
    });

    it('an existing member cannot be invited again', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({
          email: agent.email.toUpperCase(),
          roleId: await roleId(owner, SystemRole.Viewer),
        })
        .expect(409);
    });

    it('rejects invalid input', async () => {
      const owner = await registerOwner();
      const viewerRole = await roleId(owner, SystemRole.Viewer);
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({ email: 'not-an-email', roleId: viewerRole })
        .expect(400);
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({ email: uniqueEmail('x'), roleId: viewerRole, isAdmin: true })
        .expect(400);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token: 'garbage',
          password: PASSWORD,
          firstName: 'G',
          lastName: 'G',
        })
        .expect(400);
    });
  });

  describe('permissions', () => {
    it('members without members.manage get 403 on every members route', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      const ownerMemberId = await memberIdOf(owner, owner.userId);

      await api()
        .get('/api/v1/organizations/members')
        .set(bearer(agent))
        .expect(403);
      await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(bearer(agent))
        .expect(403);
      await api()
        .get('/api/v1/organizations/invitations')
        .set(bearer(agent))
        .expect(403);
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(agent))
        .send({
          email: uniqueEmail('x'),
          roleId: await roleId(owner, SystemRole.Viewer),
        })
        .expect(403);
      await api()
        .patch(`/api/v1/organizations/members/${ownerMemberId}`)
        .set(bearer(agent))
        .send({ status: 'suspended' })
        .expect(403);
      await api()
        .delete(`/api/v1/organizations/members/${ownerMemberId}`)
        .set(bearer(agent))
        .expect(403);
      await api().get('/api/v1/organizations/members').expect(401);
    });

    it('an admin cannot grant the owner role or touch an owner', async () => {
      const owner = await registerOwner();
      const admin = await join(owner, SystemRole.Admin);
      const ownerRole = await roleId(owner, SystemRole.Owner);

      const assignable = await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(bearer(admin))
        .expect(200);
      expect((assignable.body as RoleRef[]).map((r) => r.code)).not.toContain(
        SystemRole.Owner,
      );

      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(admin))
        .send({ email: uniqueEmail('esc'), roleId: ownerRole })
        .expect(403);

      const ownerMemberId = await memberIdOf(admin, owner.userId);
      await api()
        .patch(`/api/v1/organizations/members/${ownerMemberId}`)
        .set(bearer(admin))
        .send({ status: 'suspended' })
        .expect(403);
      await api()
        .delete(`/api/v1/organizations/members/${ownerMemberId}`)
        .set(bearer(admin))
        .expect(403);

      // The admin still manages ordinary members.
      const agent = await join(admin, SystemRole.Agent);
      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(admin, agent.userId)}`,
        )
        .set(bearer(admin))
        .send({ roleId: await roleId(admin, SystemRole.Viewer) })
        .expect(200);
    });

    it('nobody can change their own membership', async () => {
      const owner = await registerOwner();
      const selfId = await memberIdOf(owner, owner.userId);
      await api()
        .patch(`/api/v1/organizations/members/${selfId}`)
        .set(bearer(owner))
        .send({ roleId: await roleId(owner, SystemRole.Viewer) })
        .expect(403);
      await api()
        .delete(`/api/v1/organizations/members/${selfId}`)
        .set(bearer(owner))
        .expect(403);
    });

    it('a role change takes effect on the very next request', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      const contact = { firstName: 'Carl', lastName: 'Contact' };

      await api()
        .post('/api/v1/contacts')
        .set(bearer(agent))
        .send(contact)
        .expect(201);
      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(owner, agent.userId)}`,
        )
        .set(bearer(owner))
        .send({ roleId: await roleId(owner, SystemRole.Viewer) })
        .expect(200);
      await api()
        .post('/api/v1/contacts')
        .set(bearer(agent))
        .send(contact)
        .expect(403);
      await api().get('/api/v1/contacts').set(bearer(agent)).expect(200);
    });
  });

  describe('access revocation', () => {
    it('suspension cuts access immediately (same access token) and reactivation restores it', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      const memberId = await memberIdOf(owner, agent.userId);

      await api().get('/api/v1/deals').set(bearer(agent)).expect(200);
      const suspended = await api()
        .patch(`/api/v1/organizations/members/${memberId}`)
        .set(bearer(owner))
        .send({ status: 'suspended' })
        .expect(200);
      expect(suspended.body.status).toBe('suspended');

      await api().get('/api/v1/deals').set(bearer(agent)).expect(403);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: agent.refreshToken })
        .expect(401);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: agent.email, password: PASSWORD })
        .expect(401);

      await api()
        .patch(`/api/v1/organizations/members/${memberId}`)
        .set(bearer(owner))
        .send({ status: 'active' })
        .expect(200);
      await api().get('/api/v1/deals').set(bearer(agent)).expect(200);
    });

    it('removal cuts access, drops the member from the list and allows a fresh invitation', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);

      await api()
        .delete(
          `/api/v1/organizations/members/${await memberIdOf(owner, agent.userId)}`,
        )
        .set(bearer(owner))
        .expect(204);

      await api().get('/api/v1/deals').set(bearer(agent)).expect(403);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: agent.refreshToken })
        .expect(401);
      expect((await members(owner)).map((m) => m.userId)).not.toContain(
        agent.userId,
      );

      const { token } = await invite(owner, agent.email, SystemRole.Viewer);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: PASSWORD })
        .expect(200);
    });

    it('rejects an update with nothing to change', async () => {
      const owner = await registerOwner();
      const agent = await join(owner, SystemRole.Agent);
      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(owner, agent.userId)}`,
        )
        .set(bearer(owner))
        .send({})
        .expect(400);
    });
  });

  describe('organization isolation (BOLA)', () => {
    it('an owner of another organization cannot see or change members and invitations', async () => {
      const ownerA = await registerOwner();
      const ownerB = await registerOwner();
      const agentA = await join(ownerA, SystemRole.Agent);
      const memberIdA = await memberIdOf(ownerA, agentA.userId);
      const { invitation } = await invite(
        ownerA,
        uniqueEmail('a'),
        SystemRole.Viewer,
      );

      expect((await members(ownerB)).map((m) => m.userId)).not.toContain(
        agentA.userId,
      );
      const invitationsB = await api()
        .get('/api/v1/organizations/invitations')
        .set(bearer(ownerB))
        .expect(200);
      expect(invitationsB.body).toHaveLength(0);

      await api()
        .patch(`/api/v1/organizations/members/${memberIdA}`)
        .set(bearer(ownerB))
        .send({ status: 'suspended' })
        .expect(404);
      await api()
        .delete(`/api/v1/organizations/members/${memberIdA}`)
        .set(bearer(ownerB))
        .expect(404);
      await api()
        .delete(`/api/v1/organizations/invitations/${invitation.id}`)
        .set(bearer(ownerB))
        .expect(404);

      // A role of organization A cannot be granted from organization B.
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(ownerB))
        .send({ email: uniqueEmail('b'), roleId: invitation.role.id })
        .expect(400);

      await api().get('/api/v1/deals').set(bearer(agentA)).expect(200);
    });
  });

  describe('invitation lifecycle edge cases', () => {
    it('an expired invitation cannot be previewed or accepted', async () => {
      const owner = await registerOwner();
      const { token, invitation } = await invite(
        owner,
        uniqueEmail('late'),
        SystemRole.Viewer,
      );
      await app
        .get(DataSource)
        .query(
          `UPDATE organization_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1`,
          [invitation.id],
        );
      await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token })
        .expect(400);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({ token, password: PASSWORD, firstName: 'Lea', lastName: 'Late' })
        .expect(400);
      const pending = await api()
        .get('/api/v1/organizations/invitations')
        .set(bearer(owner))
        .expect(200);
      expect(pending.body).toHaveLength(0);
    });

    it('two simultaneous accepts of one link produce exactly one membership', async () => {
      const owner = await registerOwner();
      const { token } = await invite(
        owner,
        uniqueEmail('race'),
        SystemRole.Viewer,
      );
      const body = {
        token,
        password: PASSWORD,
        firstName: 'Ray',
        lastName: 'Race',
      };
      const results = await Promise.all([
        api().post('/api/v1/auth/invitations/accept').send(body),
        api().post('/api/v1/auth/invitations/accept').send(body),
      ]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses[0]).toBe(200);
      expect(statuses[1]).toBeGreaterThanOrEqual(400);
      expect(statuses[1]).toBeLessThan(500);
      expect(await members(owner)).toHaveLength(2);
    });

    it('links of a suspended inviter stop working', async () => {
      const owner = await registerOwner();
      const admin = await join(owner, SystemRole.Admin);
      const { token } = await invite(
        admin,
        uniqueEmail('via-admin'),
        SystemRole.Admin,
      );

      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(owner, admin.userId)}`,
        )
        .set(bearer(owner))
        .send({ status: 'suspended' })
        .expect(200);
      await api()
        .post('/api/v1/auth/invitations/preview')
        .send({ token })
        .expect(400);
    });

    it('links of a demoted inviter stop working', async () => {
      const owner = await registerOwner();
      const admin = await join(owner, SystemRole.Admin);
      const { token } = await invite(
        admin,
        uniqueEmail('via-admin'),
        SystemRole.Manager,
      );

      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(owner, admin.userId)}`,
        )
        .set(bearer(owner))
        .send({ roleId: await roleId(owner, SystemRole.Viewer) })
        .expect(200);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token,
          password: PASSWORD,
          firstName: 'Dee',
          lastName: 'Demoted',
        })
        .expect(400);
    });
  });

  describe('hierarchy', () => {
    it('a member manager cannot touch members with permissions they lack', async () => {
      const owner = await registerOwner();
      const crmReads = [
        PERMISSIONS.CONTACTS_READ,
        PERMISSIONS.COMPANIES_READ,
        PERMISSIONS.LEADS_READ,
        PERMISSIONS.DEALS_READ,
        PERMISSIONS.TASKS_READ,
        PERMISSIONS.COMMENTS_READ,
        PERMISSIONS.ATTACHMENTS_READ,
      ];
      await api()
        .post('/api/v1/roles')
        .set(bearer(owner))
        .send({
          name: 'HR',
          code: 'hr',
          permissions: [PERMISSIONS.MEMBERS_MANAGE, ...crmReads],
        })
        .expect(201);
      const hr = await join(owner, 'hr');
      const viewer = await join(owner, SystemRole.Viewer);
      const agent = await join(owner, SystemRole.Agent);

      const assignable = await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(bearer(hr))
        .expect(200);
      expect((assignable.body as RoleRef[]).map((r) => r.code).sort()).toEqual([
        'hr',
        SystemRole.Viewer,
      ]);

      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(hr, viewer.userId)}`,
        )
        .set(bearer(hr))
        .send({ status: 'suspended' })
        .expect(200);
      await api()
        .patch(
          `/api/v1/organizations/members/${await memberIdOf(hr, agent.userId)}`,
        )
        .set(bearer(hr))
        .send({ status: 'suspended' })
        .expect(403);
      await api()
        .delete(
          `/api/v1/organizations/members/${await memberIdOf(hr, agent.userId)}`,
        )
        .set(bearer(hr))
        .expect(403);
    });
  });
});
