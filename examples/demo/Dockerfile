# syntax=docker/dockerfile:1.7
# AC#40 demo Dockerfile - serves the Vite-built brand-showcase site via nginx.
# This file mirrors what `vbrand init-ci` would emit for a consumer app.

ARG BUN_VERSION=1.2
ARG NGINX_VERSION=1.27-alpine

FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM nginx:${NGINX_VERSION} AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=2s CMD wget -q -O- http://localhost/ >/dev/null || exit 1
