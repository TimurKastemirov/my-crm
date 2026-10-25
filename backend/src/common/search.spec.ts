import { describe, expect, it } from 'vitest';
import { escapeLike, toSearchQuery } from './search.js';

const all = (raw: string | undefined, phone = false) => toSearchQuery(raw, { phone })?.all ?? null;

describe('toSearchQuery', () => {
  it('turns every word into a required prefix, lower-cased; "any" joins them with OR', () => {
    expect(toSearchQuery('Ivan  Pet')).toEqual({ all: 'ivan:* & pet:*', any: 'ivan:* | pet:*' });
    expect(all('Іван Петренко')).toBe('іван:* & петренко:*');
  });

  it('splits on punctuation like the indexed text does', () => {
    expect(all('ivan@gmail.com')).toBe('ivan:* & gmail:* & com:*');
    expect(all('Booking.com')).toBe('booking:* & com:*');
    expect(all("Jean-Paul O'Brien")).toBe('jean:* & paul:* & o:* & brien:*');
    expect(all('2024-05-01')).toBe('2024:* & 05:* & 01:*');
  });

  it('joins adjacent phone-like words only when searching phones', () => {
    expect(all('+380 (50) 123-45', true)).toBe('3805012345:*');
    expect(all('ivan 050 12 petrov', true)).toBe('ivan:* & 05012:* & petrov:*');
    expect(all('2026 01')).toBe('2026:* & 01:*');
  });

  it('keeps letters with combining marks whole (NFC)', () => {
    expect(all('Андрей')).toBe('андрей:*');
    expect(all('café')).toBe('café:*');
  });

  it('only letters, marks and digits reach the query — tsquery syntax cannot be injected', () => {
    expect(all("a & b | !c <-> d:* '")).toBe('a:* & b:* & c:* & d:*');
    expect(toSearchQuery('%%% ___ ***')).toBeNull();
    expect(toSearchQuery('   ')).toBeNull();
    expect(toSearchQuery(undefined)).toBeNull();
  });

  it('caps the number and length of terms and drops duplicates', () => {
    expect(all('a a a')).toBe('a:*');
    expect(all('w1 w2 w3 w4 w5 w6 w7 w8 w9 w10')?.split(' & ')).toHaveLength(8);
    expect(all('x'.repeat(100))).toBe(`${'x'.repeat(64)}:*`);
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
