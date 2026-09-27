# syntax=docker/dockerfile:1
#
# Backend (NestJS). Контекст сборки — КОРЕНЬ монорепо (npm workspaces):
#   docker build -f backend/Dockerfile -t crm-backend .
#
# Примечание по размеру: из-за общего workspace-дерева в node_modules попадают и
# prod-зависимости frontend (@angular/*). При необходимости слим-образа — бандлить
# backend через esbuild/ncc или выносить отдельный lockfile. Пока — простота и корректность.

########## deps: зависимости workspace (нужны все манифесты для npm ci + линковки @crm/shared) ##########
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

########## dev: режим разработки (hot-reload через bind-mount в docker-compose) ##########
FROM deps AS dev
WORKDIR /app
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build -w @crm/shared
EXPOSE 3000
CMD ["npm", "run", "start:dev", "-w", "backend"]

########## build: сборка shared + backend и прунинг dev-зависимостей ##########
FROM deps AS build
WORKDIR /app
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build -w @crm/shared && npm run build -w backend
RUN npm prune --omit=dev

########## runtime: продакшн-образ ##########
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
