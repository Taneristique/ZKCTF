# One service: Next.js on $PORT, Express API on 127.0.0.1:8787 in the same container.
# Railway: Root Directory "/" (this file is auto-detected).
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml backend/
RUN cd backend && pnpm install --frozen-lockfile --prod

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/
RUN cd frontend && pnpm install --frozen-lockfile

# Groth16 prover: snarkjs deps, wasm + verification key from git, zkey (163 MB) from a GitHub release.
COPY circuits/package.json circuits/pnpm-lock.yaml circuits/
RUN cd circuits && pnpm install --frozen-lockfile --prod
COPY circuits/scripts/fetch-zkey.mjs circuits/scripts/
ARG ZKCTF_ZKEY_URL=https://github.com/Taneristique/ZKCTF/releases/download/zkey-v1/relation.zkey
ARG ZKCTF_ZKEY_SHA256=ce3e0a710c4d5d93dd8b280a98d9c7b8de4f5e60d2a7abeca6424ef2044f37ee
RUN cd circuits && ZKCTF_ZKEY_REQUIRED=1 ZKCTF_ZKEY_URL=$ZKCTF_ZKEY_URL ZKCTF_ZKEY_SHA256=$ZKCTF_ZKEY_SHA256 node scripts/fetch-zkey.mjs
COPY circuits/lib circuits/lib
COPY circuits/scripts/prove.mjs circuits/scripts/
COPY circuits/artifacts/relation.wasm circuits/build/relation_js/relation.wasm
COPY circuits/artifacts/verification_key.json circuits/build/verification_key.json

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
