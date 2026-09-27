import { describe, expect, it } from 'vitest';
import { parseDurationToMs } from './auth.util.js';

describe('parseDurationToMs', () => {
  it('парсит секунды/минуты/часы/дни', () => {
    expect(parseDurationToMs('45s')).toBe(45_000);
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('12h')).toBe(43_200_000);
    expect(parseDurationToMs('30d')).toBe(2_592_000_000);
  });

  it('игнорирует пробелы по краям', () => {
    expect(parseDurationToMs(' 10m ')).toBe(600_000);
  });

  it('бросает на некорректном формате', () => {
    expect(() => parseDurationToMs('abc')).toThrow();
    expect(() => parseDurationToMs('10y')).toThrow();
    expect(() => parseDurationToMs('')).toThrow();
  });
});
