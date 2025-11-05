# syntax=docker/dockerfile:1.7
FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci || npm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
RUN npm prune --omit=dev

VOLUME ["/app/data"]
CMD ["node", "dist/index.js"]

