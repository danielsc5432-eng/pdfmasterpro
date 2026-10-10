# PDF Master Pro

Plataforma web em pt-BR para tarefas reais de PDF, conversões e segurança documental.

## Executar localmente

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

A aplicação abre em `http://localhost:3000`. O build de produção é validado com `pnpm test && pnpm typecheck && pnpm build`.

## Ferramentas funcionais

Juntar, dividir, imagens para PDF, PDF↔Word, OCR, extração de texto, compressão, marca d’água, numeração, assinatura visual, proteção por senha, metadados e redação rasterizada estão conectados ao backend real.

As limitações são honestas: PDF para Word e Word para PDF podem alterar layouts complexos; OCR pode conter erros; assinatura visual não é assinatura digital criptográfica; redação recria a página como imagem para remover o conteúdo da área, sacrificando texto editável.

## Limites e persistência

O modo convidado/grátis limita cada arquivo a 25 MB e cada tarefa a 5 arquivos. A validação ocorre no servidor com conteúdo real, extensão, MIME e tamanho. Status, ferramenta, quantidade/tamanho e timestamps são persistidos por hash de sessão anônima em `/historico`; bytes e nomes dos documentos não entram no banco.

## Ambiente nativo

A imagem de produção instala Poppler, Ghostscript, qpdf, Tesseract com português, Python/Pillow e LibreOffice Writer. `DATABASE_URL` é usado pelo banco gerenciado; aplique schema com `pnpm db:migrate`. Não coloque segredos no navegador.

## Próximas fases

Storage privado, filas/workers, OAuth, limites de assinatura, administração, Stripe, OCR com mais idiomas, reconstrução avançada de layout e assinatura digital criptográfica estão documentados em `docs/IMPLEMENTED_AND_PENDING.md`.
