# Implantação

## Build

O container instala dependências com `pnpm-lock.yaml`, executa `pnpm build` e sobe `pnpm start` na porta 3000 (ou `PORT`). Antes de iniciar uma versão com alterações de schema, execute `pnpm db:migrate` com `DATABASE_URL`; o runner é aditivo e idempotente.

## Dependências nativas

A imagem de produção instala Poppler (`pdftotext`, `pdftoppm`), Ghostscript (`gs`, compressão), qpdf (proteção/verificação), Tesseract e `tesseract-ocr-por` (OCR) e LibreOffice Writer (reserva do Word→PDF). Em Windows com Microsoft Word instalado, defina `PDF_TO_WORD_CONVERTER=msword` e `WORD_CONVERTER=msword` para usar o Word como motor das conversões Word↔PDF (automação COM; exige PowerShell e permissão para iniciar processos); sem Word (por exemplo, no contêiner Linux) os motores caem automaticamente na reserva (`rebuild` para PDF→DOCX e LibreOffice para DOCX→PDF). A redação rasterizada é feita em Node com `pngjs`, sem dependência de Python. Fixe versões, revise licenças, limite CPU/memória/tempo e execute conversores em workers isolados antes de uma operação de produção em escala.

## Variáveis

`PORT` é lida pelo runtime. `PDF_RENDERER`, `PDF_COMPRESSOR` e `DATABASE_URL` são server-side. OAuth, storage e Stripe devem ser configurados como segredos; nunca copie valores reais para `.env.example`.

## Persistência e retenção

A aplicação persiste metadados de tarefas em MySQL (`processing_tasks`) por hash de sessão anônima: ferramenta, quantidade/tamanho, status, tipo/tamanho do resultado e timestamps. Conteúdo e nomes não entram no banco. Os bytes ainda são temporários; antes do lançamento em escala, adicionar storage privado, URLs assinadas, fila/worker e deleção física.
