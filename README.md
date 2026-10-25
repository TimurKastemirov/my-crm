# my-crm

A multi-tenant B2B sales CRM. Monorepo on **npm workspaces**: NestJS (backend) + Angular (frontend) + a shared API contract (`@crm/shared`).

The full technical specification is in [specification.md](./specification.md).

## Stack

- **Backend:** NestJS 12 (ESM, TypeScript 6), TypeORM, PostgreSQL, Redis, Swagger, vitest, oxlint
- **Frontend:** Angular 22 (standalone, signals, Signal Forms), Tailwind CSS 4, vitest
- **Shared contract:** `packages/shared` (`@crm/shared`) — types, enums, permission codes, pagination
- **Infrastructure:** Docker + Docker Compose, Nginx

## Requirements

- **Node.js 22+** and npm 10+ (the project uses npm 12)
- To run with Docker: **Docker Desktop** (the daemon must be running)
- To run locally without Docker: **PostgreSQL 17** and **Redis 7**

---

## Quick start with Docker (recommended)

A single command brings up Postgres, Redis, the backend and the frontend:

```bash
docker compose up --build
# or the short alias:
npm run up
```

Default (dev) values are already baked into `docker-compose.yml`, so a separate `.env` is not required.
To override them, create a `.env` in the repo root (see the variables below).

Once started:

| What | URL |
|---|---|
| Frontend (ng serve) | http://localhost:4200 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Health (liveness) | http://localhost:3000/api/v1/health |
| Readiness (PG+Redis) | http://localhost:3000/api/v1/health/ready |

Stop: `docker compose down` (or `npm run down`). Postgres data is kept in the `pgdata` volume.

> The first build takes a while: dependencies of every workspace are installed into the images.

---

## Running locally without Docker

You need PostgreSQL 17 and Redis 7 running locally.

```bash
# 1. Backend environment variables (adjust the credentials to your database)
cp backend/.env.example backend/.env

# 2. Install dependencies — ONCE, in the repo root (monorepo)
npm install

# 3. Build the shared contract
npm run build:shared

# 4. Create the database (name as in backend/.env, crm_db by default)
createdb crm_db     # or via psql/a GUI

# 5. Migrations (none yet — the command safely does nothing)
npm run migration:run -w backend

# 6. Start in two terminals:
npm run dev:backend     # NestJS  → http://localhost:3000
npm run dev:frontend    # Angular → http://localhost:4200
```

> **Important:** environment validation requires `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD`
> to be set in `backend/.env` — otherwise the backend will not start (this is by design, see §4.1 of the spec).
>
> In Docker, Nginx proxies `/api` to the backend. With a local `ng serve`, once the frontend starts calling the API,
> add `frontend/proxy.conf.json` (`/api → http://localhost:3000`) and wire it up in `angular.json`.

---

## Useful commands (from the repo root)

| Command | Action |
|---|---|
| `npm run build` | Build shared → backend → frontend |
| `npm run build:shared` | Build only the shared contract `@crm/shared` |
| `npm run dev:backend` / `dev:frontend` | Backend / frontend dev server |
| `npm run dev:shared` | Rebuild `@crm/shared` in watch mode |
| `npm run lint` | Lint (oxlint) the backend |
| `npm test` | Backend + frontend tests (vitest) |
| `npm run test:backend` / `test:frontend` | Run tests separately |
| `npm run migration:generate -w backend -- src/migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:run -w backend` | Apply migrations (dev, via tsx) |
| `npm run up` / `npm run down` | Docker Compose up/down |

## Environment variables

Template: [backend/.env.example](backend/.env.example). The main ones:

```
POSTGRES_HOST / POSTGRES_PORT / POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_TLS_ENABLED
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / JWT_ACCESS_TTL / JWT_REFRESH_TTL   # for the Auth module
CORS_ORIGINS
```

`.env` files are **not tracked by git** (see `.gitignore`) — secrets are never committed.

## Repository layout

```
my-crm/
├── backend/            # NestJS API
├── frontend/           # Angular SPA
├── packages/shared/    # @crm/shared — shared API contract
├── docker-compose.yml  # dev environment
├── docker-compose.prod.yml
└── specification.md    # technical specification
```

---

## Publishing to GitHub

Git is already initialized in the repo root (branch `main`). Commit and push:

```bash
git add -A
git commit -m "chore: initial monorepo (NestJS + Angular + @crm/shared)"

# With the GitHub CLI (easiest):
gh repo create my-crm --private --source=. --push

# Or manually:
git remote add origin git@github.com:<username>/my-crm.git
git push -u origin main
```

## Setting up on another machine (from GitHub)

```bash
git clone git@github.com:<username>/my-crm.git
cd my-crm

# The repository contains no secrets — create .env from the template:
cp backend/.env.example backend/.env   # edit if needed

# Then use either way of running it:
docker compose up --build              # the Docker option (nothing else needed)
# OR locally:
npm install && npm run build:shared && npm run dev:backend   # + npm run dev:frontend
```

A new machine only needs **Node 22+** plus either **Docker** (for the Docker path) or **Postgres/Redis** (for the local path). `node_modules` and `.env` come from installing/copying — they are not in git.
