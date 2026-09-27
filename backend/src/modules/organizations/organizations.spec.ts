import { describe, expect, it } from 'vitest';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService.slugify', () => {
  it('нормализует латиницу и разделители', () => {
    expect(OrganizationsService.slugify('Acme Inc.')).toBe('acme-inc');
    expect(OrganizationsService.slugify('  Hello   World  ')).toBe('hello-world');
    expect(OrganizationsService.slugify('Foo/Bar_Baz')).toBe('foo-bar-baz');
  });

  it('отдаёт запасной slug, если латиницы не осталось', () => {
    // Кириллица не транслитерируется — уникальность обеспечит суффикс при создании.
    expect(OrganizationsService.slugify('Ромашка')).toBe('org');
  });
});
