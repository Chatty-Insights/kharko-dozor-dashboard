# Chatty self-host image for the Dozor dashboard (runs in our EKS cluster,
# talks to an in-cluster Postgres). Migrations are not run here: the k8s
# Deployment runs `npx prisma migrate deploy` in an init container.

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS builder

# Build-only, for Sentry source-map upload. Unset = upload skipped.
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json .npmrc ./
# Scripts skipped here: postinstall (`prisma generate && fumadocs-mdx`) needs the
# sources, so it runs after the full copy below.
RUN npm ci --ignore-scripts

COPY . .

# `src/server/env.ts` validates env at module load, and `next build` loads it
# while collecting page data. Placeholders satisfy the schema for the build only;
# they are scoped to this RUN and never reach the runtime image.
RUN npm run postinstall && \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-placeholder" \
    AUTH_GOOGLE_ID="build-placeholder" \
    AUTH_GOOGLE_SECRET="build-placeholder" \
    NODE_ENV=production \
    npm run build

FROM base AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
# fumadocs `createMDX()` in next.config loads this on `next start` and rewrites
# `.source/`, so the app dir must be writable by the runtime user.
COPY --from=builder /app/source.config.ts ./source.config.ts
COPY --from=builder --chown=node:node /app/.source ./.source
# Read at request time by the API reference pages under /documentation.
COPY --from=builder /app/openapi.snapshot.json ./openapi.snapshot.json
RUN chown node:node /app

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
