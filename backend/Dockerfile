FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=mysql://prisma-build@127.0.0.1:3306/smarturl npm ci

FROM dependencies AS build
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN DATABASE_URL=mysql://prisma-build@127.0.0.1:3306/smarturl npx prisma generate && npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=mysql://prisma-build@127.0.0.1:3306/smarturl npm ci --omit=dev \
  && DATABASE_URL=mysql://prisma-build@127.0.0.1:3306/smarturl npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 4000
CMD ["npm", "run", "start:container"]
