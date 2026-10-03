# Build stage
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# Runtime stage. Astro's node adapter in standalone mode serves both the static
# client assets and the on-demand /api/stats route from one process.
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=80

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 80

CMD ["node", "dist/server/entry.mjs"]
