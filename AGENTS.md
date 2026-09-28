# AGENTS.md — repo-wide conventions (my-crm)

Monorepo via npm workspaces:
- `backend/` — NestJS API (modular monolith, TypeORM, PostgreSQL, Redis).
- `frontend/` — Angular app (standalone components, signals, Tailwind).
- `packages/shared/` — framework-free API contract (types, enums, permission codes).

Per-app rules: see `frontend/CLAUDE.md` and `frontend/AGENTS.md`.

## Language — English only

Everything in the codebase and the product is written in **English**:

- **Code comments** — `//`, `/* */`, JSDoc, HTML `<!-- -->`, and `#` in shell / YAML / Dockerfile / nginx configs.
- **UI text** — every visible string: titles, button labels, `placeholder`, `aria-label`, `<option>` text, empty/loading/error states.
- **API responses** — exception and validation messages returned to clients, and Swagger text (`@ApiTags` / `@ApiOperation` / `@ApiProperty`, title/description).
- **Seeded default display names** — system roles and the default pipeline with its stages.

Do not introduce Russian into code or product text. Two things are deliberately not affected:

- Real **user-entered data** (e.g. sample/demo records) stays exactly as entered.
- **Commit messages** follow the repository's existing convention (currently Russian — check `git log`).

## Skills

Skill files under `.claude/skills/` are written in English (the `/commit` skill included).
