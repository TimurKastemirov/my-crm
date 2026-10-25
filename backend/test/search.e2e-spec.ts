import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { AuthResult, Paginated, PipelineDto } from '@crm/shared';
import { createE2eApp, hasE2eDatabase } from './support/e2e-app.js';

/**
 * Full-text search (§6.3): word-prefix matching over a GIN-indexed tsvector (`simple` config),
 * email parts and phone digits, leads/deals also by their linked contact and company,
 * always scoped to the organization.
 */
describe.runIf(hasE2eDatabase)('Search (e2e)', () => {
  let app: INestApplication;
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const bearer = (s: AuthResult) => ({
    Authorization: `Bearer ${s.tokens.accessToken}`,
  });

  async function registerOwner(): Promise<AuthResult> {
    return (
      await api()
        .post('/api/v1/auth/register')
        .send({
          email: `search.${Date.now()}.${++seq}@e2e.test`,
          password: 'correct-horse-42',
          firstName: 'Sam',
          lastName: 'Search',
          organizationName: `Search Org ${seq}`,
        })
        .expect(201)
    ).body as AuthResult;
  }

  async function create(
    owner: AuthResult,
    path: string,
    body: object,
  ): Promise<{ id: string }> {
    return (
      await api()
        .post(`/api/v1/${path}`)
        .set(bearer(owner))
        .send(body)
        .expect(201)
    ).body as { id: string };
  }

  /** Ids found by `search` on the list endpoint (extra query params allowed). */
  async function find(
    owner: AuthResult,
    path: string,
    search: string,
    extra: object = {},
  ): Promise<string[]> {
    const res = await api()
      .get(`/api/v1/${path}`)
      .query({ search, limit: 100, ...extra })
      .set(bearer(owner))
      .expect(200);
    return (res.body as Paginated<{ id: string }>).data.map((r) => r.id);
  }

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('contacts', () => {
    let owner: AuthResult;
    let ivan: { id: string };
    let olena: { id: string };

    beforeAll(async () => {
      owner = await registerOwner();
      ivan = await create(owner, 'contacts', {
        firstName: 'Ivan',
        lastName: 'Petrov',
        email: 'ivan.petrov@gmail.com',
        phone: '+380 (50) 123-45-67',
      });
      olena = await create(owner, 'contacts', {
        firstName: 'Олена',
        lastName: 'Шевченко',
        email: 'olena@acme.ua',
      });
    });

    it('matches word prefixes, in any order and any case', async () => {
      expect(await find(owner, 'contacts', 'pet')).toEqual([ivan.id]);
      expect(await find(owner, 'contacts', 'PETROV ivan')).toEqual([ivan.id]);
      expect(await find(owner, 'contacts', 'олен шев')).toEqual([olena.id]);
    });

    it('every word must match; the middle of a word does not', async () => {
      expect(await find(owner, 'contacts', 'ivan olena')).toEqual([]);
      expect(await find(owner, 'contacts', 'trov')).toEqual([]);
    });

    it('finds by parts of the email and by phone digits however they are typed', async () => {
      expect(await find(owner, 'contacts', 'gmail')).toEqual([ivan.id]);
      expect(await find(owner, 'contacts', 'olena@acme')).toEqual([olena.id]);
      expect(await find(owner, 'contacts', '38050')).toEqual([ivan.id]);
      expect(await find(owner, 'contacts', '+380 (50) 123')).toEqual([ivan.id]);
    });

    it('special characters are harmless and match nothing', async () => {
      expect(await find(owner, 'contacts', '%')).toEqual([]);
      expect(await find(owner, 'contacts', "' & | ! :*")).toEqual([]);
    });

    it('deleted contacts are not found', async () => {
      const temp = await create(owner, 'contacts', {
        firstName: 'Tempo',
        lastName: 'Rary',
      });
      expect(await find(owner, 'contacts', 'tempo')).toEqual([temp.id]);
      await api()
        .delete(`/api/v1/contacts/${temp.id}`)
        .set(bearer(owner))
        .expect(204);
      expect(await find(owner, 'contacts', 'tempo')).toEqual([]);
    });
  });

  it('companies by name, website parts and industry', async () => {
    const owner = await registerOwner();
    const acme = await create(owner, 'companies', {
      name: 'Acme Logistics',
      website: 'https://acme-cargo.io',
      industry: 'Transport',
    });
    await create(owner, 'companies', { name: 'Globex', industry: 'Energy' });
    expect(await find(owner, 'companies', 'logist')).toEqual([acme.id]);
    expect(await find(owner, 'companies', 'cargo')).toEqual([acme.id]);
    expect(await find(owner, 'companies', 'transp acme')).toEqual([acme.id]);
  });

  describe('leads and deals also match their contact and company', () => {
    let owner: AuthResult;
    let lead: { id: string };
    let deal: { id: string };
    let otherDeal: { id: string };

    beforeAll(async () => {
      owner = await registerOwner();
      const contact = await create(owner, 'contacts', {
        firstName: 'Maria',
        lastName: 'Kovalenko',
      });
      const company = await create(owner, 'companies', { name: 'Initech' });
      lead = await create(owner, 'leads', {
        source: 'Website form',
        contactId: contact.id,
        companyId: company.id,
      });
      const pipelines = (
        await api().get('/api/v1/pipelines').set(bearer(owner)).expect(200)
      ).body as PipelineDto[];
      const stageId = pipelines[0].stages[0].id;
      deal = await create(owner, 'deals', {
        pipelineId: pipelines[0].id,
        stageId,
        title: 'Annual license',
        contactId: contact.id,
        companyId: company.id,
      });
      otherDeal = await create(owner, 'deals', {
        pipelineId: pipelines[0].id,
        stageId,
        title: 'Annual support',
      });
    });

    it('a lead by its source, contact name or company', async () => {
      expect(await find(owner, 'leads', 'websi')).toEqual([lead.id]);
      expect(await find(owner, 'leads', 'kovalen')).toEqual([lead.id]);
      expect(await find(owner, 'leads', 'initech')).toEqual([lead.id]);
    });

    it('a deal by title, contact and company — words may come from different places', async () => {
      expect((await find(owner, 'deals', 'annual')).sort()).toEqual(
        [deal.id, otherDeal.id].sort(),
      );
      expect(await find(owner, 'deals', 'annual maria')).toEqual([deal.id]);
      expect(await find(owner, 'deals', 'initech lic')).toEqual([deal.id]);
    });

    it('search combines with the other filters', async () => {
      expect(await find(owner, 'deals', 'annual', { status: 'won' })).toEqual(
        [],
      );
      expect(await find(owner, 'leads', 'kovalen', { status: 'new' })).toEqual([
        lead.id,
      ]);
    });
  });

  it('never returns records of another organization (BOLA)', async () => {
    const ownerA = await registerOwner();
    const ownerB = await registerOwner();
    const contact = await create(ownerA, 'contacts', {
      firstName: 'Secretive',
      lastName: 'Client',
    });
    await create(ownerA, 'leads', {
      source: 'Referral',
      contactId: contact.id,
    });
    await create(ownerA, 'companies', { name: 'Secretive Corp' });

    for (const path of ['contacts', 'companies', 'leads', 'deals']) {
      expect(await find(ownerB, path, 'secretive')).toEqual([]);
    }
  });

  it('task search treats % and _ literally', async () => {
    const owner = await registerOwner();
    const sale = await create(owner, 'tasks', { title: 'Offer 50% off' });
    await create(owner, 'tasks', { title: 'Offer 50 boxes' });
    expect(await find(owner, 'tasks', '50%')).toEqual([sale.id]);
    expect(await find(owner, 'tasks', '_')).toEqual([]);
  });

  it('the search uses the GIN index on search_vector', async () => {
    const runner = app.get(DataSource).createQueryRunner();
    try {
      await runner.startTransaction();
      // Tiny test tables would otherwise be scanned sequentially.
      await runner.query('SET LOCAL enable_seqscan = off');
      const plan: Array<{ 'QUERY PLAN': string }> = await runner.query(
        `EXPLAIN SELECT id FROM contacts
          WHERE organization_id = gen_random_uuid() AND search_vector @@ to_tsquery('simple', 'ivan:*')`,
      );
      expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toContain(
        'idx_contacts_search',
      );
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  describe('review follow-ups', () => {
    it('dotted names, hyphens, apostrophes, decimals and dates are found by their words', async () => {
      const owner = await registerOwner();
      const booking = await create(owner, 'companies', {
        name: 'Booking.com',
        industry: 'Travel',
      });
      const jean = await create(owner, 'contacts', {
        firstName: 'Jean-Paul',
        lastName: "O'Brien",
      });
      const pipelines = (
        await api().get('/api/v1/pipelines').set(bearer(owner)).expect(200)
      ).body as PipelineDto[];
      const deal = await create(owner, 'deals', {
        pipelineId: pipelines[0].id,
        stageId: pipelines[0].stages[0].id,
        title: 'Renewal v2.5 2024-05-01',
      });

      expect(await find(owner, 'companies', 'booking.com')).toEqual([
        booking.id,
      ]);
      expect(await find(owner, 'companies', 'booking')).toEqual([booking.id]);
      expect(await find(owner, 'contacts', 'jean-paul')).toEqual([jean.id]);
      expect(await find(owner, 'contacts', 'paul')).toEqual([jean.id]);
      expect(await find(owner, 'contacts', "o'brien")).toEqual([jean.id]);
      expect(await find(owner, 'deals', 'v2.5')).toEqual([deal.id]);
      expect(await find(owner, 'deals', '2024-05')).toEqual([deal.id]);
      expect(await find(owner, 'deals', '2024 05')).toEqual([deal.id]);
    });

    it('a soft-deleted linked contact no longer makes its deals match', async () => {
      const owner = await registerOwner();
      const contact = await create(owner, 'contacts', {
        firstName: 'Ghostly',
        lastName: 'Buyer',
      });
      const lead = await create(owner, 'leads', {
        source: 'Fair',
        contactId: contact.id,
      });
      expect(await find(owner, 'leads', 'ghostly')).toEqual([lead.id]);
      await api()
        .delete(`/api/v1/contacts/${contact.id}`)
        .set(bearer(owner))
        .expect(204);
      expect(await find(owner, 'leads', 'ghostly')).toEqual([]);
      expect(await find(owner, 'leads', 'fair')).toEqual([lead.id]);
    });

    it('every searchable table has its GIN index used', async () => {
      const runner = app.get(DataSource).createQueryRunner();
      try {
        await runner.startTransaction();
        await runner.query('SET LOCAL enable_seqscan = off');
        for (const table of ['contacts', 'companies', 'leads', 'deals']) {
          const plan: Array<{ 'QUERY PLAN': string }> = await runner.query(
            `EXPLAIN SELECT id FROM ${table}
              WHERE organization_id = gen_random_uuid() AND search_vector @@ to_tsquery('simple', 'acme:* | ivan:*')`,
          );
          expect(plan.map((r) => r['QUERY PLAN']).join('\n')).toContain(
            `idx_${table}_search`,
          );
        }
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });
});
