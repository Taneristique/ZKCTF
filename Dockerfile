# One service: Next.js on $PORT, Express API on 127.0.0.1:8787 in the same container.
# Railway: Root Directory "/" (this file is auto-detected).
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml backend/
RUN cd backend && pnpm install --frozen-lockfile --prod

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/
RUN cd frontend && pnpm install --frozen-lockfile

COPY backend/src backend/src
COPY backend/content backend/content
COPY frontend frontend

# NEXT_PUBLIC_* are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
ARG NEXT_PUBLIC_PROGRAM_ID=34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7
ENV NEXT_PUBLIC_SOLANA_RPC=$NEXT_PUBLIC_SOLANA_RPC \
    NEXT_PUBLIC_PROGRAM_ID=$NEXT_PUBLIC_PROGRAM_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN cd frontend && pnpm build

COPY scripts/start.sh scripts/start.sh

ENV NODE_ENV=production
CMD ["bash", "scripts/start.sh"]
