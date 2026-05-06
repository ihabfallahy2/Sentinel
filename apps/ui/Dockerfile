FROM node:20-alpine AS build
ARG VITE_API_URL=http://localhost:3500
ARG VITE_API_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_KEY=$VITE_API_KEY
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/ui/package.json apps/ui/

RUN pnpm install --frozen-lockfile

COPY packages/shared-types packages/shared-types
COPY apps/ui apps/ui

RUN pnpm --filter @sentinel/shared-types build
WORKDIR /app/apps/ui
RUN pnpm run build

FROM nginx:1.27-alpine
COPY apps/ui/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/ui/dist /usr/share/nginx/html
EXPOSE 80
