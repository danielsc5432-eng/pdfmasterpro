FROM node:22-trixie-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-trixie-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-trixie-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PDF_RENDERER=pdftoppm
ENV PDF_COMPRESSOR=gs
ENV PDF_TO_WORD_PYTHON=/opt/pdf2docx/bin/python
COPY deploy/pdf-fonts.conf /etc/fonts/conf.d/99-pdfmaster.conf
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils ghostscript qpdf tesseract-ocr tesseract-ocr-por tesseract-ocr-eng fontconfig fonts-liberation fonts-noto-core fonts-noto-cjk libreoffice-writer python3 python3-venv libgomp1 && fc-cache -f && rm -rf /var/lib/apt/lists/*
COPY requirements-pdf2docx.txt /tmp/requirements-pdf2docx.txt
RUN python3 -m venv /opt/pdf2docx && /opt/pdf2docx/bin/pip install --no-cache-dir -r /tmp/requirements-pdf2docx.txt
COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
