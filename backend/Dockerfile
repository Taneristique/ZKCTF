# Self-contained: build context is backend/ (Railway Root Directory /backend).
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
COPY content ./content

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
