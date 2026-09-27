# my-crm

Мультиарендная B2B sales CRM. Монорепо на **npm workspaces**: NestJS (backend) + Angular (frontend) + общий контракт API (`@crm/shared`).

Полное техническое задание — в [specification.md](./specification.md).

## Стек

- **Backend:** NestJS 12 (ESM, TypeScript 6), TypeORM, PostgreSQL, Redis, Swagger, vitest, oxlint
- **Frontend:** Angular 22 (standalone, signals, Signal Forms), Tailwind CSS 4, vitest
- **Общий контракт:** `packages/shared` (`@crm/shared`) — типы, enum'ы, коды прав, пагинация
- **Инфраструктура:** Docker + Docker Compose, Nginx

## Требования

- **Node.js 22+** и npm 10+ (в проекте — npm 12)
- Для запуска через Docker: **Docker Desktop** (демон должен быть запущен)
- Для локального запуска без Docker: **PostgreSQL 17** и **Redis 7**

---

## Быстрый старт через Docker (рекомендуется)

Один командой поднимает Postgres, Redis, backend и frontend:

```bash
docker compose up --build
# или короткий алиас:
npm run up
```

Значения по умолчанию (dev) уже зашиты в `docker-compose.yml` — отдельный `.env` не обязателен.
Чтобы переопределить — создайте `.env` в корне (см. переменные ниже).

После старта:

| Что | URL |
|---|---|
| Frontend (ng serve) | http://localhost:4200 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Health (liveness) | http://localhost:3000/api/v1/health |
| Readiness (PG+Redis) | http://localhost:3000/api/v1/health/ready |

Остановить: `docker compose down` (или `npm run down`). Данные Postgres хранятся в volume `pgdata`.

> Первая сборка небыстрая: в образы ставятся зависимости всех workspace.

---

## Локальный запуск без Docker

Нужны запущенные локально PostgreSQL 17 и Redis 7.

```bash
# 1. Переменные окружения backend (правьте креды под свою БД)
cp backend/.env.example backend/.env

# 2. Установка зависимостей — ОДИН раз в корне (монорепо)
npm install

# 3. Сборка общего контракта
npm run build:shared

# 4. Создать базу (имя — как в backend/.env, по умолчанию crm_db)
createdb crm_db     # или через psql/GUI

# 5. Миграции (пока их нет — команда безопасно ничего не делает)
npm run migration:run -w backend

# 6. Запуск в двух терминалах:
npm run dev:backend     # NestJS  → http://localhost:3000
npm run dev:frontend    # Angular → http://localhost:4200
```

> **Важно:** валидация окружения требует заполненных `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
> в `backend/.env` — иначе backend не стартует (это by design, см. §4.1 ТЗ).
>
> В Docker Nginx проксирует `/api` на backend. При локальном `ng serve`, когда фронт начнёт вызывать API,
> добавьте `frontend/proxy.conf.json` (`/api → http://localhost:3000`) и подключите его в `angular.json`.

---

## Полезные команды (из корня)

| Команда | Действие |
|---|---|
| `npm run build` | Собрать shared → backend → frontend |
| `npm run build:shared` | Собрать только общий контракт `@crm/shared` |
| `npm run dev:backend` / `dev:frontend` | Dev-сервер backend / frontend |
| `npm run dev:shared` | Пересборка `@crm/shared` в watch-режиме |
| `npm run lint` | Линт (oxlint) backend |
| `npm test` | Тесты backend + frontend (vitest) |
| `npm run test:backend` / `test:frontend` | Тесты по отдельности |
| `npm run migration:generate -w backend -- src/migrations/<Имя>` | Сгенерировать миграцию по изменениям сущностей |
| `npm run migration:run -w backend` | Применить миграции (dev, через tsx) |
| `npm run up` / `npm run down` | Docker Compose вверх/вниз |

## Переменные окружения

Шаблон — [backend/.env.example](backend/.env.example). Основное:

```
POSTGRES_HOST / POSTGRES_PORT / POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_TLS_ENABLED
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / JWT_ACCESS_TTL / JWT_REFRESH_TTL   # для модуля Auth
CORS_ORIGINS
```

Файлы `.env` **в git не попадают** (см. `.gitignore`) — секреты не коммитятся.

## Структура репозитория

```
my-crm/
├── backend/            # NestJS API
├── frontend/           # Angular SPA
├── packages/shared/    # @crm/shared — общий контракт API
├── docker-compose.yml  # dev-окружение
├── docker-compose.prod.yml
└── specification.md    # техническое задание
```

---

## Публикация на GitHub

Git уже инициализирован в корне (ветка `main`). Закоммитьте и запушьте:

```bash
git add -A
git commit -m "chore: initial monorepo (NestJS + Angular + @crm/shared)"

# Через GitHub CLI (проще всего):
gh repo create my-crm --private --source=. --push

# Либо вручную:
git remote add origin git@github.com:<username>/my-crm.git
git push -u origin main
```

## Установка на другом компьютере (из GitHub)

```bash
git clone git@github.com:<username>/my-crm.git
cd my-crm

# Секреты в репозитории отсутствуют — создайте .env из шаблона:
cp backend/.env.example backend/.env   # правьте при необходимости

# Дальше — любой из способов запуска:
docker compose up --build              # вариант с Docker (ничего больше не нужно)
# ИЛИ локально:
npm install && npm run build:shared && npm run dev:backend   # + npm run dev:frontend
```

На новой машине нужны только: **Node 22+** и **Docker** (для Docker-пути) либо **Postgres/Redis** (для локального). `node_modules` и `.env` подтянутся установкой/копированием — в git их нет.
