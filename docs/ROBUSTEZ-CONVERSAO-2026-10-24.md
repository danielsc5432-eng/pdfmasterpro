# Robustez PDF → Word — 24/10/2026

## Objetivo e limite

Ampliar a cobertura e impedir aprovação indevida de arquivos com perdas. Não há evidência de 100% de fidelidade em todo tipo de PDF. `checked` significa aprovação pelos critérios automatizados, não identidade universal nem validação em todas as versões do Microsoft Word.

## Correções implementadas

1. Conferência separada dos números no XML editável e no PDF renderizado, por página. Valores presentes no XML, mas invisíveis na renderização, não passam como corretos.
2. Preservação dos sinais e separadores na comparação; não confundir valores negativos com positivos ou números com os mesmos dígitos em formatos diferentes.
3. Detecção de valores extras/duplicados por precisão numérica, além da cobertura dos valores de referência.
4. Leitura somente do texto Word efetivo, ignorando coordenadas de desenhos, instruções de campos, revisões excluídas e duplicação de `mc:AlternateContent`.
5. Coordenadas numéricas transformadas para a orientação visual correta de páginas giradas.
6. Correção da inversão dupla das dimensões de páginas em paisagem pela biblioteca docx.
7. Uso das dimensões visuais do pdftohtml quando o pdftotext já girou coordenadas, mas mantém dimensões sem rotação. Tamanhos fracionários normais continuam preservados.
8. Digitalizações com camada OCR invisível ou transparente são sinalizadas para revisão. Quando detectada camada transparente sobre imagem de página inteira, o fluxo refaz OCR e limpa a região reconhecida do fundo, evitando texto rasterizado duplicado sob a edição.
9. Entrega bloqueada quando a conferência não está disponível, há perda de valores, tamanho/paginação incorretos, texto praticamente invisível ou desvio visual grosseiro. OCR permanece em revisão, sem aprovação automática irrestrita.

O SDK continua comparando candidatos; não altera o texto para forçar igualdade nas métricas. O importador alternativo do LibreOffice foi experimentado para texto girado, mas não preservou sua posição e não foi incorporado ao fluxo.

## Pesquisa e arquivos públicos

- [PyMuPDF: coordenadas e rotação](https://pymupdf.readthedocs.io/en/latest/page.html).
- [pdf2docx: arquivos de teste oficiais](https://github.com/ArtifexSoftware/pdf2docx/tree/3e1c2319d6a3fbf2ae4d46c3ab734b7fc87bd9b4/test/samples).
- [pdfplumber: PDFs de regressão](https://github.com/jsvine/pdfplumber/tree/4c64b92d5caccd71c645e98e0fabb0c4dba7ff45/tests/pdfs).
- [docx: implementação pública](https://github.com/dolanmiu/docx).

Foram usados arquivos públicos de tabelas, colunas, imagens sobrepostas e anotações giradas. Downloads fixados por revisão, com URL e SHA-256 registrados. Os PDFs ficam em diretório ignorado; não foram redistribuídos no repositório do projeto.

## Bateria ampliada

| Caso | Resultado observado |
| --- | --- |
| Valores positivos e negativos | Aprovado, números preservados |
| Duas colunas sintéticas com linhas desencontradas | Aprovado |
| Tamanhos mistos, paisagem e página em branco | Aprovado após correção de dimensões |
| Texto efetivamente girado | Bloqueado por divergência visual |
| Digitalização sem texto | Revisão OCR |
| Digitalização com OCR invisível | Revisão OCR |
| Digitalização com OCR transparente | Revisão OCR; reconhecido novamente e fundo limpo |
| Tabela asiática pública | Bloqueada por perdas numéricas e de texto |
| Colunas públicas | Revisão: sem perda numérica, diferenças de texto/layout |
| Imagens sobrepostas públicas | Revisão OCR |
| Anotações giradas públicas | Revisão: divergência visual residual |

Total dos onze casos públicos/sintéticos: **3 aprovados, 6 em revisão, 2 bloqueados**. Não equivale a onze conversões perfeitas. A revisão dos dois PDFs pessoais de referência também foi repetida, mantendo aprovação automatizada, páginas e valores preservados.

Validação de código: **95 testes TypeScript e nove testes nativos aprovados**, TypeScript e build aprovados. Os onze hashes do manifesto foram conferidos contra os arquivos usados. Essas aprovações de testes não transformam os seis casos em revisão e os dois bloqueados em conversões corretas.

O reconhecimento de texto em imagens não oferece referência textual independente para garantir que nomes e valores estão corretos. Os termos numéricos com fonte vazia têm cobertura matemática 1, mas não devem ser apresentados como comprovação de exatidão; `ocrReview=true` impede `checked`.

## Como repetir

Com Python e dependências nativas do worker configuradas:

```sh
python scripts/test-pdf-fidelity.py
pnpm test
pnpm typecheck
pnpm test:conversion
pnpm test:conversion --public
pnpm test:conversion --public --strict
pnpm test:conversion --case=transparent-searchable
```

`--strict` termina com erro se qualquer caso não alcançar `checked`. Com as limitações atuais, o corpus completo não passa nesse modo. A execução exploratória gera resultados detalhados; seu exit code zero não significa que todos os arquivos foram aprovados.

Arquivos sintéticos são gerados sem identificadores aleatórios de PDF. Manifesto, hashes, resultados e DOCX ficam em `.vercel/regression-pdf/`, nunca no repositório público. Execuções filtradas usam relatórios separados, preservando o histórico do conjunto completo.

## Limitações abertas

Reconstrução de texto em ângulos arbitrários, tabelas/fontes asiáticas complexas, anotações, segmentação de palavras e validação específica no Microsoft Word ainda exigem trabalho. Nenhum critério foi reduzido para declarar 100%. A confiança do resultado deve continuar visível e candidatos com perdas medidas permanecem bloqueados.
