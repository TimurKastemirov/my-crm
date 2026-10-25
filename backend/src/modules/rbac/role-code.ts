/** Machine role codes: `^[a-z][a-z0-9_]{1,39}$`, unique within an organization. */
const MAX_LENGTH = 40;

/**
 * A code derived from the role name (Latin letters and digits kept, the rest → "_"), made unique
 * against `taken` with a numeric suffix. Names without Latin letters (e.g. Cyrillic) become "role".
 */
export function roleCodeFromName(
  name: string,
  taken: ReadonlySet<string>,
): string {
  let base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, MAX_LENGTH);
  if (base.length < 2) base = 'role';

  let code = base;
  for (let n = 2; taken.has(code); n++) {
    const suffix = `_${n}`;
    code =
      base.slice(0, MAX_LENGTH - suffix.length).replace(/_+$/, '') + suffix;
  }
  return code;
}
