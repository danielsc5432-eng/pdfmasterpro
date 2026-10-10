# Implantação

## Build

O container instala dependências com `pnpm-lock.yaml`, executa `pnpm build` e sobe `pnpm start` na porta 3000 (ou `PORT`). Antes de iniciar uma versão com alterações de schema, execute `pnpm db:migrate` com `DATABASE_URL`; o runner é aditivo e idempotente.

## Dependências nativas

A imagem de produção instala Poppler (`pdftotext`, `pdftoppm`), Ghostscript (`gs`, compressão), qpdf (proteção/verificação), Tesseract e `tesseract-ocr-por` (OCR), Python/Pillow (redação rasterizada) e LibreOffice Writer (Word→PDF). Fixe versões, revise licenças, limite CPU/memória/tempo e execute conversores em workers isolados antes de uma operação de produção em escala.

## Variáveis

`PORT` é lida pelo runtime. `PDF_RENDERER`, `PDF_COMPRESSOR` e `DATABASE_URL` são server-side. OAuth, storage e Stripe devem ser configurados como segredos; nunca copie valores reais para `.env.example`.

## Persistência e retenção

A aplicação persiste metadados de tarefas em MySQL (`processing_tasks`) por hash de sessão anônima: ferramenta, quantidade/tamanho, status, tipo/tamanho do resultado e timestamps. Conteúdo e nomes não entram no banco. Os bytes ainda são temporários; antes do lançamento em escala, adicionar storage privado, URLs assinadas, fila/worker e deleção física.
