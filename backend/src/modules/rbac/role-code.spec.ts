import { describe, expect, it } from 'vitest';
import { roleCodeFromName } from './role-code.js';

const valid = /^[a-z][a-z0-9_]{1,39}$/;

describe('roleCodeFromName', () => {
  it('derives a snake_case code from a Latin name', () => {
    expect(roleCodeFromName('Sales Lead', new Set())).toBe('sales_lead');
    expect(roleCodeFromName('  Support (L2)! ', new Set())).toBe('support_l2');
  });

  it('starts with a letter and stays within 40 characters', () => {
    const code = roleCodeFromName('2nd line — very long role name that goes on and on and on', new Set());
    expect(code).toMatch(valid);
    expect(code.startsWith('nd_line')).toBe(true);
  });

  it('falls back to "role" when the name has no Latin letters', () => {
    expect(roleCodeFromName('Менеджер продаж', new Set())).toBe('role');
    expect(roleCodeFromName('!!!', new Set())).toBe('role');
  });

  it('adds a numeric suffix until the code is unique (system codes included)', () => {
    expect(roleCodeFromName('Owner', new Set(['owner']))).toBe('owner_2');
    expect(roleCodeFromName('Менеджер', new Set(['role', 'role_2']))).toBe('role_3');
  });

  it('keeps suffixed long codes valid', () => {
    const base = 'x'.repeat(60);
    const code = roleCodeFromName(base, new Set(['x'.repeat(40)]));
    expect(code).toMatch(valid);
    expect(code.endsWith('_2')).toBe(true);
  });
});
