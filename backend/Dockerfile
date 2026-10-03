# Build from the repo root: lessons in content/ live outside backend/.
#   docker build -f backend/Dockerfile .
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY backend/src ./src
COPY content /app/content

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
