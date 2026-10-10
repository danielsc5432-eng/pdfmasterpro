FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PDF_RENDERER=pdftoppm
ENV PDF_COMPRESSOR=gs
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils ghostscript qpdf tesseract-ocr tesseract-ocr-por python3 python3-pil libreoffice-writer && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=builder /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm start"]
