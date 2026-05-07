FROM node:20-alpine AS base
RUN apk add --no-cache git util-linux curl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types packages/shared-types
COPY apps/api apps/api

RUN chmod +x /app/apps/api/scripts/maintenance.sh

RUN pnpm --filter @sentinel/shared-types build
RUN pnpm --filter @sentinel/api build

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3500
CMD ["node", "dist/index.js"]
