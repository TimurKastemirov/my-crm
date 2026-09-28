# syntax=docker/dockerfile:1
#
# Frontend (Angular). Build context is the monorepo ROOT:
#   docker build -f frontend/Dockerfile -t crm-frontend .

########## deps ##########
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

########## dev: ng serve (hot-reload via bind-mount) ##########
FROM deps AS dev
WORKDIR /app
COPY packages/shared ./packages/shared
COPY frontend ./frontend
RUN npm run build -w @crm/shared
EXPOSE 4200
CMD ["npm", "run", "start", "-w", "frontend", "--", "--host", "0.0.0.0", "--poll", "1000"]

########## build: build shared + frontend ##########
FROM deps AS build
WORKDIR /app
COPY packages/shared ./packages/shared
COPY frontend ./frontend
RUN npm run build -w @crm/shared && npm run build -w frontend

########## runtime: nginx serves static assets + reverse-proxy /api ##########
FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
# @angular/build:application → dist/<project>/browser
COPY --from=build /app/frontend/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
