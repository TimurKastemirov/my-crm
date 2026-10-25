import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  PERMISSIONS,
  SystemRole,
  type AuthResult,
  type MemberDto,
  type Permission,
  type RoleRef,
  type RoleSummaryDto,
} from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * Roles & permissions (§6.3): no privilege escalation through roles.manage, immediate effect of
 * permission changes, deletion only of unused roles, generated codes and organization isolation.
 */
describe.runIf(hasE2eDatabase)('Roles (e2e)', () => {
  let app: INestApplication;
  const PASSWORD = 'correct-horse-42';
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (s: AuthResult) => ({
    Authorization: `Bearer ${s.tokens.accessToken}`,
  });
  const uniqueEmail = (p: string) => `${p}.${Date.now()}.${++seq}@e2e.test`;

  async function registerOwner(): Promise<AuthResult> {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail('owner'),
        password: PASSWORD,
        firstName: 'Rita',
        lastName: 'Roles',
        organizationName: `Roles Org ${seq}`,
      })
      .expect(201);
    return res.body as AuthResult;
  }

  async function roles(actor: AuthResult): Promise<RoleSummaryDto[]> {
    return (await api().get('/api/v1/roles').set(bearer(actor)).expect(200))
      .body as RoleSummaryDto[];
  }

  async function roleByCode(
    actor: AuthResult,
    code: string,
  ): Promise<RoleSummaryDto> {
    const role = (await roles(actor)).find((r) => r.code === code);
    if (!role) throw new Error(`no role ${code}`);
    return role;
  }

  function createRole(
    actor: AuthResult,
    name: string,
    permissions: Permission[],
  ) {
    return api()
      .post('/api/v1/roles')
      .set(bearer(actor))
      .send({ name, permissions });
  }

  /** Invites a new user with the role id and accepts; returns their session. */
  async function join(owner: AuthResult, roleId: string): Promise<AuthResult> {
    const invite = await api()
      .post('/api/v1/organizations/members')
      .set(bearer(owner))
      .send({ email: uniqueEmail('m'), roleId })
      .expect(201);
    return (
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token: invite.body.token,
          password: PASSWORD,
          firstName: 'M',
          lastName: 'M',
        })
        .expect(200)
    ).body as AuthResult;
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists system and custom roles with usage counts', async () => {
    const owner = await registerOwner();
    const list = await roles(owner);
    expect(
      list
        .filter((r) => r.isSystem)
        .map((r) => r.code)
        .sort(),
    ).toEqual(['admin', 'agent', 'manager', 'owner', 'viewer']);
    expect(list.find((r) => r.code === SystemRole.Owner)).toMatchObject({
      memberCount: 1,
      invitationCount: 0,
      assignedToMe: true,
    });
    expect(list.find((r) => r.code === SystemRole.Viewer)?.assignedToMe).toBe(
      false,
    );
  });

  it('generates a unique code from the name (also for non-Latin names)', async () => {
    const owner = await registerOwner();
    const a = (
      await createRole(owner, 'Sales Lead', [PERMISSIONS.DEALS_READ]).expect(
        201,
      )
    ).body as RoleSummaryDto;
    const b = (
      await createRole(owner, 'Sales Lead', [PERMISSIONS.DEALS_READ]).expect(
        201,
      )
    ).body as RoleSummaryDto;
    const c = (await createRole(owner, 'Менеджер', []).expect(201))
      .body as RoleSummaryDto;
    expect([a.code, b.code, c.code]).toEqual([
      'sales_lead',
      'sales_lead_2',
      'role',
    ]);
    expect(a).toMatchObject({
      isSystem: false,
      memberCount: 0,
      permissions: [PERMISSIONS.DEALS_READ],
    });
  });

  it('rejects unknown permission codes and blank names', async () => {
    const owner = await registerOwner();
    await createRole(owner, 'X', ['deals.fly' as Permission]).expect(400);
    await createRole(owner, '', []).expect(400);
    const role = (await createRole(owner, 'Temp', []).expect(201))
      .body as RoleSummaryDto;
    await api()
      .patch(`/api/v1/roles/${role.id}`)
      .set(bearer(owner))
      .send({ name: null })
      .expect(400);
  });

  describe('no privilege escalation', () => {
    it('an admin cannot create or extend a role with permissions it lacks', async () => {
      const owner = await registerOwner();
      const admin = await join(
        owner,
        (await roleByCode(owner, SystemRole.Admin)).id,
      );
      await createRole(admin, 'Super', [
        PERMISSIONS.ORGANIZATIONS_MANAGE,
      ]).expect(403);

      const custom = (
        await createRole(admin, 'Helper', [PERMISSIONS.DEALS_READ]).expect(201)
      ).body as RoleSummaryDto;
      await api()
        .patch(`/api/v1/roles/${custom.id}`)
        .set(bearer(admin))
        .send({
          permissions: [
            PERMISSIONS.DEALS_READ,
            PERMISSIONS.ORGANIZATIONS_MANAGE,
          ],
        })
        .expect(403);
    });

    it('a role manager cannot edit their own role or a stronger one', async () => {
      const owner = await registerOwner();
      const mgrRole = (
        await createRole(owner, 'Role Manager', [
          PERMISSIONS.ROLES_MANAGE,
          PERMISSIONS.DEALS_READ,
        ]).expect(201)
      ).body as RoleSummaryDto;
      const manager = await join(owner, mgrRole.id);

      // Own role: can't add (escalate) or even rename it.
      await api()
        .patch(`/api/v1/roles/${mgrRole.id}`)
        .set(bearer(manager))
        .send({ permissions: [...ALL_FOR_TEST] })
        .expect(403);
      await api()
        .patch(`/api/v1/roles/${mgrRole.id}`)
        .set(bearer(manager))
        .send({ name: 'Mine' })
        .expect(403);

      const strong = (
        await createRole(owner, 'Strong', [
          PERMISSIONS.DEALS_READ,
          PERMISSIONS.MEMBERS_MANAGE,
        ]).expect(201)
      ).body as RoleSummaryDto;
      await api()
        .patch(`/api/v1/roles/${strong.id}`)
        .set(bearer(manager))
        .send({ name: 'Weak' })
        .expect(403);
      await api()
        .delete(`/api/v1/roles/${strong.id}`)
        .set(bearer(manager))
        .expect(403);

      // A weaker role is fine.
      const weak = (
        await createRole(manager, 'Reader', [PERMISSIONS.DEALS_READ]).expect(
          201,
        )
      ).body as RoleSummaryDto;
      await api()
        .patch(`/api/v1/roles/${weak.id}`)
        .set(bearer(manager))
        .send({ name: 'Deal reader' })
        .expect(200);
    });

    it('system roles are immutable', async () => {
      const owner = await registerOwner();
      const viewer = await roleByCode(owner, SystemRole.Viewer);
      await api()
        .patch(`/api/v1/roles/${viewer.id}`)
        .set(bearer(owner))
        .send({ name: 'X' })
        .expect(403);
      await api()
        .delete(`/api/v1/roles/${viewer.id}`)
        .set(bearer(owner))
        .expect(403);
    });

    it('without roles.manage every roles route is 403', async () => {
      const owner = await registerOwner();
      const agent = await join(
        owner,
        (await roleByCode(owner, SystemRole.Agent)).id,
      );
      await api().get('/api/v1/roles').set(bearer(agent)).expect(403);
      await api().get('/api/v1/permissions').set(bearer(agent)).expect(403);
      await createRole(agent, 'Nope', []).expect(403);
    });
  });

  it('a permission change applies to holders on their very next request', async () => {
    const owner = await registerOwner();
    const role = (
      await createRole(owner, 'Contacts editor', [
        PERMISSIONS.CONTACTS_READ,
        PERMISSIONS.CONTACTS_CREATE,
      ]).expect(201)
    ).body as RoleSummaryDto;
    const member = await join(owner, role.id);
    const contact = { firstName: 'Cora', lastName: 'Contact' };

    await api()
      .post('/api/v1/contacts')
      .set(bearer(member))
      .send(contact)
      .expect(201);
    await api()
      .patch(`/api/v1/roles/${role.id}`)
      .set(bearer(owner))
      .send({ permissions: [PERMISSIONS.CONTACTS_READ] })
      .expect(200);
    await api()
      .post('/api/v1/contacts')
      .set(bearer(member))
      .send(contact)
      .expect(403);
    await api().get('/api/v1/contacts').set(bearer(member)).expect(200);
  });

  describe('deleting', () => {
    it('a role assigned to a member or a pending invitation cannot be deleted', async () => {
      const owner = await registerOwner();
      const used = (
        await createRole(owner, 'Used', [PERMISSIONS.DEALS_READ]).expect(201)
      ).body as RoleSummaryDto;
      const member = await join(owner, used.id);
      const res = await api()
        .delete(`/api/v1/roles/${used.id}`)
        .set(bearer(owner))
        .expect(409);
      expect(res.body.message).toMatch(/1 member/);
      expect((await roleByCode(owner, used.code)).memberCount).toBe(1);

      const invited = (await createRole(owner, 'Invited', []).expect(201))
        .body as RoleSummaryDto;
      await api()
        .post('/api/v1/organizations/members')
        .set(bearer(owner))
        .send({ email: uniqueEmail('p'), roleId: invited.id })
        .expect(201);
      await api()
        .delete(`/api/v1/roles/${invited.id}`)
        .set(bearer(owner))
        .expect(409);

      // After reassigning the member the role can go.
      const members = (
        await api()
          .get('/api/v1/organizations/members')
          .set(bearer(owner))
          .expect(200)
      ).body as MemberDto[];
      const memberId = members.find((m) => m.userId === member.user.id)?.id;
      const viewer = await roleByCode(owner, SystemRole.Viewer);
      await api()
        .patch(`/api/v1/organizations/members/${memberId}`)
        .set(bearer(owner))
        .send({ roleId: viewer.id })
        .expect(200);
      await api()
        .delete(`/api/v1/roles/${used.id}`)
        .set(bearer(owner))
        .expect(204);
      expect((await roles(owner)).map((r) => r.id)).not.toContain(used.id);
    });
  });

  it('roles of another organization are invisible and untouchable (BOLA)', async () => {
    const ownerA = await registerOwner();
    const ownerB = await registerOwner();
    const roleA = (await createRole(ownerA, 'Private', []).expect(201))
      .body as RoleSummaryDto;

    expect((await roles(ownerB)).map((r) => r.id)).not.toContain(roleA.id);
    await api()
      .patch(`/api/v1/roles/${roleA.id}`)
      .set(bearer(ownerB))
      .send({ name: 'Hacked' })
      .expect(404);
    await api()
      .delete(`/api/v1/roles/${roleA.id}`)
      .set(bearer(ownerB))
      .expect(404);
    const assignable = (
      await api()
        .get('/api/v1/organizations/members/assignable-roles')
        .set(bearer(ownerB))
        .expect(200)
    ).body as RoleRef[];
    expect(assignable.map((r) => r.id)).not.toContain(roleA.id);
  });

  describe('review follow-ups', () => {
    it('a whitespace-only name is rejected on create and update', async () => {
      const owner = await registerOwner();
      await createRole(owner, '   ', []).expect(400);
      const role = (await createRole(owner, '  Trimmed  ', []).expect(201))
        .body as RoleSummaryDto;
      expect(role.name).toBe('Trimmed');
      await api()
        .patch(`/api/v1/roles/${role.id}`)
        .set(bearer(owner))
        .send({ name: '  ' })
        .expect(400);
    });

    it('simultaneous creates with the same name get distinct codes, never a 500', async () => {
      const owner = await registerOwner();
      const results = await Promise.all(
        [1, 2, 3].map(() => createRole(owner, 'Twin', [])),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      const codes = results.map((r) => (r.body as RoleSummaryDto).code).sort();
      expect(new Set(codes).size).toBe(3);
    });

    it('deleting a role while it is being assigned: exactly one wins, never a 500', async () => {
      const owner = await registerOwner();
      const viewer = await roleByCode(owner, SystemRole.Viewer);
      const member = await join(owner, viewer.id);
      const members = (
        await api()
          .get('/api/v1/organizations/members')
          .set(bearer(owner))
          .expect(200)
      ).body as MemberDto[];
      const memberId = members.find((m) => m.userId === member.user.id)?.id;

      for (let i = 0; i < 5; i++) {
        const role = (
          await createRole(owner, `Race ${i}`, [PERMISSIONS.DEALS_READ]).expect(
            201,
          )
        ).body as RoleSummaryDto;
        const [del, assign] = await Promise.all([
          api().delete(`/api/v1/roles/${role.id}`).set(bearer(owner)),
          api()
            .patch(`/api/v1/organizations/members/${memberId}`)
            .set(bearer(owner))
            .send({ roleId: role.id }),
        ]);
        const outcome = [del.status, assign.status];
        // Deleted first → the assignment is refused; assigned first → the delete is refused.
        expect([
          [204, 409],
          [204, 400],
          [409, 200],
        ]).toContainEqual(outcome);
        // Restore a role for the next round if the assignment won.
        if (assign.status === 200) {
          await api()
            .patch(`/api/v1/organizations/members/${memberId}`)
            .set(bearer(owner))
            .send({ roleId: viewer.id })
            .expect(200);
        }
      }
    });

    it('an invitation is refused once its role gains permissions the inviter lacks', async () => {
      const owner = await registerOwner();
      const admin = await join(
        owner,
        (await roleByCode(owner, SystemRole.Admin)).id,
      );
      const role = (
        await createRole(owner, 'Grows', [PERMISSIONS.DEALS_READ]).expect(201)
      ).body as RoleSummaryDto;
      const invite = await api()
        .post('/api/v1/organizations/members')
        .set(bearer(admin))
        .send({ email: uniqueEmail('grow'), roleId: role.id })
        .expect(201);
      await api()
        .patch(`/api/v1/roles/${role.id}`)
        .set(bearer(owner))
        .send({
          permissions: [
            PERMISSIONS.DEALS_READ,
            PERMISSIONS.ORGANIZATIONS_MANAGE,
          ],
        })
        .expect(200);
      await api()
        .post('/api/v1/auth/invitations/accept')
        .send({
          token: invite.body.token,
          password: PASSWORD,
          firstName: 'G',
          lastName: 'G',
        })
        .expect(400);
    });
  });
});

const ALL_FOR_TEST = Object.values(PERMISSIONS);
