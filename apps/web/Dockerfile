# Build from the repo root: docker build -f apps/web/Dockerfile . (AD-13)

# deps: full npm ci with the toolchain better-sqlite3 needs; identical in apps/api/Dockerfile for cache sharing.
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# build: contract first, then the web bundle (tsc -b type-checks tests, so dev deps stay until prune).
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contract packages/contract
COPY apps/web apps/web
RUN npm run build -w packages/contract && npm run build -w apps/web && npm prune --omit=dev

# runtime: static files behind nginx, non-root on 8080; only the server block is replaced.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
