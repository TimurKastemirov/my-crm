/**
 * Парсит длительность вида "15m", "30d", "12h", "45s" в миллисекунды.
 * Используется для срока жизни refresh-токена (expires_at).
 */
export function parseDurationToMs(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Некорректный формат длительности: "${input}" (ожидается напр. 15m, 12h, 30d)`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * multiplier;
}
