# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine

# -------------------------
# Base Node
# -------------------------
FROM ${NODE_IMAGE} AS base

WORKDIR /app

COPY package.json package-lock.json ./

# -------------------------
# Dependencies
# -------------------------
FROM base AS deps

RUN npm ci

# -------------------------
# Development
# -------------------------
FROM deps AS dev

COPY . .

EXPOSE 4200

CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000"]

# -------------------------
# Build Angular
# -------------------------
FROM deps AS build

ARG BUILD_CONFIGURATION=production
ARG APP_VERSION=dev

ENV APP_VERSION=$APP_VERSION

COPY . .

RUN node scripts/write-app-version.mjs \
 && npm run build -- --configuration ${BUILD_CONFIGURATION}

# -------------------------
# Production with Nginx
# -------------------------
FROM ${NGINX_IMAGE} AS prod

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/my-warehouse/browser/ /usr/share/nginx/html/

EXPOSE 8080
