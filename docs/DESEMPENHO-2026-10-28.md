# Processamento — 28/10/2026

Medições HTTP desta sessão: health do site aproximadamente 430 ms; primeira resposta do processador Render 43.160 ms. Não são percentis nem garantia de latência futura. Um giro de PDF sintético de duas páginas, já com processador disponível, levou 5.499 ms e foi validado estruturalmente.

## Alterações

- Sete ferramentas executam diretamente na Vercel para corpos multipart de até 4 MiB, com tamanho conhecido: juntar, dividir, girar, organizar, metadados, marca d'água e numeração.
- Validação de arquivos, opções, plano, cotas e resultado continua na rota existente. Não há cache de documentos nem redução das verificações.
- Conversões nativas, OCR, resumo, detector, tamanhos desconhecidos e uploads maiores mantêm o processador anterior. Rotas auxiliares explícitas têm precedência. `PROCESSING_FAST_LOCAL=0` permite desativar a otimização.
- Após selecionar arquivos, a interface consulta uma preparação do processador: somente ferramenta e tamanho, sem arquivo, cookies ou conteúdo encaminhados ao worker. A chamada externa é apenas para /api/health. Requisições simultâneas compartilham a preparação por instância; estado pronto reaproveitado por 45 segundos. Não há cron, polling ou manutenção artificial de atividade.
- Resumo atualiza as capacidades quando a preparação termina, evitando exigir atualização manual após uma primeira consulta durante a inicialização.

## Validação

281 testes locais passaram, incluindo sete operações reais com PDFs sintéticos, isolamento do worker, origem da preparação, uploads desconhecidos/grandes e controle de acesso. Nenhuma chamada paga ou arquivo de usuário utilizado. Medições de produção após deploy ficam em `.vercel/review/performance/`.

Limitações: a preparação sobrepõe a inicialização ao tempo de configuração do usuário; não elimina o custo de OCR/IA ou a suspensão do serviço gratuito. As ferramentas executadas no navegador não dependem deste worker e continuam condicionadas ao dispositivo e ao tamanho dos arquivos. A referência sintética não representa PDFs grandes, concorrência, OCR ou conversão Word.
