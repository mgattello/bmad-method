# Build from the repo root: docker build -f apps/api/Dockerfile . (AD-13)

# deps: full npm ci with the toolchain better-sqlite3 needs; identical in apps/web/Dockerfile for cache sharing.
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# build: contract first, then the api, then drop dev dependencies.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contract packages/contract
COPY apps/api apps/api
RUN npm run build -w packages/contract && npm run build -w apps/api && npm prune --omit=dev

# runtime: workspace layout kept so node_modules/@todo/contract resolves; npm never runs here.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/todos.db LOG_LEVEL=info
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/contract/package.json packages/contract/
COPY --from=build /app/packages/contract/dist packages/contract/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
