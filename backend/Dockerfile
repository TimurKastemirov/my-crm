# syntax=docker/dockerfile:1
#
# Backend (NestJS). Build context is the monorepo ROOT (npm workspaces):
#   docker build -f backend/Dockerfile -t crm-backend .
#
# Size note: because of the shared workspace tree, node_modules also includes the
# frontend prod dependencies (@angular/*). For a slim image, bundle the backend via
# esbuild/ncc or use a separate lockfile. For now — simplicity and correctness.

########## deps: workspace dependencies (all manifests needed for npm ci + @crm/shared linking) ##########
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

########## dev: development mode (hot-reload via bind-mount in docker-compose) ##########
FROM deps AS dev
WORKDIR /app
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build -w @crm/shared
EXPOSE 3000
CMD ["npm", "run", "start:dev", "-w", "backend"]

########## build: build shared + backend and prune dev dependencies ##########
FROM deps AS build
WORKDIR /app
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build -w @crm/shared && npm run build -w backend
RUN npm prune --omit=dev

########## runtime: production image ##########
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
WORKDIR /app/backend
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
