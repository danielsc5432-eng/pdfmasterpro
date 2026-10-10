# Arquitetura atual

A aplicação usa Next.js App Router, `pdf-lib` para operações estruturais, `jszip` para resultados múltiplos, `pdftotext`/Poppler para texto e renderização, `docx` para geração de Word, LibreOffice Writer para Word→PDF, Tesseract para OCR, qpdf para criptografia/verificação e Pillow para queimar redações em páginas rasterizadas. O MySQL gerenciado persiste metadados de tarefas por hash de sessão.

A API valida assinatura binária, extensão, MIME e tamanho antes de processar. Cada tarefa concluída ou falha persiste somente hash de sessão, ferramenta, quantidade/tamanho, status, tipo/tamanho do resultado e timestamps. Nenhum conteúdo documental ou nome de arquivo é gravado no banco.

As operações PDF com `pdf-lib` desenham marcas, numeração, assinatura visual e metadados sobre cópias do documento. Proteção usa qpdf com AES-256. OCR renderiza as páginas, executa Tesseract por página e recompõe um PDF pesquisável. Redação renderiza as páginas, desenha o retângulo em pixels com Pillow e recria o PDF somente com a imagem queimada, impedindo a extração do trecho ocultado; a saída deixa de ser texto editável.

PDF para Word extrai texto com `pdftotext -layout` e gera DOCX com quebras aproximadas. Word para PDF usa LibreOffice em perfil temporário isolado e sem rede. Nenhuma dessas conversões promete fidelidade universal de layout, fontes, caixas ou tabelas complexas.

Os arquivos continuam somente em memória e temporários durante a requisição; resultados não são persistidos em storage durável. Registros de tarefa expiram logicamente após 2 horas. A próxima evolução deve mover tarefas longas para workers, usar storage privado com URLs assinadas e implementar deleção física.
