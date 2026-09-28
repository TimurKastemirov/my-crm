---
name: commit
description: >-
  Creates a high-quality git commit for the current changes: works out WHAT
  changed and WHY, and writes a clear message (imperative subject + a "what and
  why" body). ALWAYS use it when the user asks to commit changes — "commit",
  "commit this", "закоммить", "сделай коммит", "зафиксируй" — even if the message
  format is not specified. The repo is a monorepo (npm workspaces): backend
  (NestJS), frontend (Angular), packages/shared.
---

# Commit — a high-quality git commit

Goal: a commit such that six months later `git log` makes it clear **what**
changed and **why**, without reading the whole diff. The diff shows the "what",
but almost never the "why" — and the "why" is the main value of the message.

## Process

### 1. Understand the changes (don't commit blind)
- `git status` — what is affected.
- `git diff` and `git diff --staged` — the actual substantive changes.
- `git log --oneline -10` — adopt the style and **language** of the repo's existing messages.

Determine which parts of the monorepo are touched (`backend`, `frontend`, `shared`,
`docker`, `ci`, repo root) — that becomes the `scope`.

### 2. Decide what goes into the commit
- If the index is empty, add what's relevant: `git add -A`, or selectively
  (`git add <path>`) if the working tree mixes unrelated changes.
- Re-check with `git status` that no secrets or artifacts are committed (`.env`,
  `node_modules`, `dist`) — they're in `.gitignore`, but make sure.
- If the changes are logically heterogeneous, propose splitting them into several
  commits, each with a single meaning. One meaningful commit > one dump.

### 3. Formulate the "what" and the "why"
The message must answer two questions:
- **What** was done — in substance, not a line-by-line retelling of the diff.
- **Why** — what task/problem is being solved and the expected effect. If the "why"
  is unclear, look at the context (related code, the `specification.md` spec) rather
  than inventing it.

### 4. Message format (Conventional Commits)
- **Subject:** `type(scope): short action` in the imperative mood, ≤ ~72 chars,
  no trailing period.
  - `type`: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`, `perf`, `style`.
  - `scope`: a monorepo area (`backend`, `frontend`, `shared`, `docker`, `ci`, `repo`)
    or, more narrowly, a domain module (`auth`, `deals`, `health`…).
- A blank line.
- **Body:** 1–5 bullets of "what changed", then a short "Why: …" phrase/bullet. Lines ~72–100 chars.
- **Language** — match the repository (commit messages here are currently in Russian;
  check `git log`). This skill's own text is in English, but the commit messages you
  write follow the repo's existing language.
- **Do NOT add attribution/co-authorship lines** (`Co-Authored-By`, "Generated with…"):
  by the repo owner's requirement, commits go without them.

### 5. Commit and report
- Write a multi-line message to a temp file and commit via `git commit -F <file>` —
  it's more reliable than `-m` with a body and doesn't break on quotes, `$`, or newlines.
- After committing, show `git log --oneline -1` and the final message.
- If a pre-commit hook ran and modified files, re-stage the changes and `git commit --amend --no-edit`.
- If the current branch is the default one (`main`/`master`) and the project uses PR
  branches, warn about it. In this repo, commits to `main` are the normal flow.
- **Do not `git push`** — commit only, unless the user explicitly asks to push.

## Template

```
type(scope): short action in the imperative mood

- what changed (bullet 1)
- what changed (bullet 2)

Why: one or two sentences about the reason/problem and the expected effect.
```

## Examples

**Example 1 — a backend feature.** Added a JWT module, argon2, refresh-token rotation:
```
feat(auth): добавить JWT-аутентификацию с ротацией refresh-токенов

- эндпоинты register/login/refresh/logout/logout-all
- argon2id для паролей, хранение только хеша refresh-токена
- guard проверки access-токена

Зачем: закрыть базовую аутентификацию перед RBAC — без контекста
пользователя остальные защищённые модули не имеют смысла.
```

**Example 2 — infrastructure:**
```
build(docker): добавить multi-stage сборку и docker-compose

- Dockerfile для backend и frontend (таргеты dev/runtime)
- docker-compose: postgres, redis, healthcheck-и, depends_on
- nginx: reverse-proxy /api и SPA-fallback

Зачем: единый `docker compose up` для локального запуска и
воспроизводимая прод-сборка образов.
```

(The example bodies stay in Russian on purpose — they show the repo's current commit language.)

**Example 3 — subject: bad vs good:**
- ❌ `изменения`, `fix bug`, `update files` — say neither what nor why.
- ✅ `fix(deals): не терять stage при перетаскивании между воронками`.

## Anti-patterns
- A line-by-line retelling of the diff instead of the meaning of the change.
- "WIP", "фиксы", "мелочи", "правки" — content-free.
- One huge commit for unrelated changes.
- Committing secrets or generated artifacts.
- An invented "why" not supported by the context.
