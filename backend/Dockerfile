FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY prisma ./prisma
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --omit=dev && npx prisma generate

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
USER node
EXPOSE 4000
CMD ["npm", "run", "start:container"]
