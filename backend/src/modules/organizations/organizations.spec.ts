import { describe, expect, it } from 'vitest';
import { OrganizationsService } from './organizations.service.js';

describe('OrganizationsService.slugify', () => {
  it('normalizes Latin letters and separators', () => {
    expect(OrganizationsService.slugify('Acme Inc.')).toBe('acme-inc');
    expect(OrganizationsService.slugify('  Hello   World  ')).toBe('hello-world');
    expect(OrganizationsService.slugify('Foo/Bar_Baz')).toBe('foo-bar-baz');
  });

  it('falls back to a default slug if no Latin letters remain', () => {
    // Cyrillic is not transliterated — uniqueness will be ensured by a suffix at creation time.
    expect(OrganizationsService.slugify('Ромашка')).toBe('org');
  });
});
