# Motores complementares — 26/10/2026

Integração local, sem publicação automática.

- OCRmyPDF 17.13.0: OCR seletivo, preservando páginas nativas. O resultado é conferido por quantidade de páginas, presença de texto e diferença visual antes da entrega. Tesseract permanece como alternativa.
- PDFium (pypdfium2 5.14.0): inspeção, extração e renderização alternativa.
- Apache PDFBox 3.0.8: extração de texto e renderização alternativa via Java, com heap de 128 MB. Download no build com SHA-512 fixado, sem download durante a conversão.

Poppler continua como primeira opção para texto e imagens. Os novos motores não reconstroem documentos Word; o fluxo existente de PDF para Word permanece separado. Não há novas opções técnicas na interface.

## Operação

O Docker instala um ambiente Python separado, Java e os motores. Fora do Docker, configurar `PDF_ENGINES_PYTHON`, `PDFBOX_JAR` e opcionalmente `PDFBOX_JAVA`. Sem o ambiente complementar, os motores existentes continuam disponíveis.

Limites dos fluxos integrados: 25 MB por PDF, 60 páginas para extração/renderização e 30 páginas para OCR com inspeção complementar. Imagens de saída: até 4 milhões de pixels por página e 32 MB no conjunto. Um trabalho nativo por processo; concorrência excedente recebe aviso para tentar novamente. Arquivos temporários são excluídos ao concluir ou falhar. Subprocessos recebem somente variáveis necessárias, sem chaves da aplicação.

PDFs protegidos são recusados. OCR de arquivos com formulários, assinaturas ou anotações é recusado quando exigiria alteração desses elementos. Páginas inteiramente textuais são devolvidas sem mudanças. OCR vazio, parcial em páginas sem texto ou com alteração visual acima do limiar não é entregue.

## Validação e limites

Script de integração: `scripts/test-native-engines.ts`. Usa somente documentos sintéticos já criados pelo benchmark. Resultados em `.vercel/review/pdf24-research/integration-results.json`. O script precisa dos caminhos dos motores e dos dados Tesseract por+eng.

Validação local concluída: 260 testes automatizados passaram; TypeScript e compilação Next passaram. Os 16 cenários de integração nativa passaram: extração/renderização com os três motores configurados, ausência simulada de Poppler, exclusão de credenciais do ambiente, preservação byte a byte de PDF nativo, quatro PDFs digitalizados/mistos e rejeição de entradas inválidas, corrompidas ou protegidas. Nenhum arquivo de cliente foi utilizado.

A inspeção detecta ausência de texto, mas não prova que todo número reconhecido esteja correto. PDFs mistos dentro da mesma página, fontes incomuns e digitalizações degradadas podem exigir revisão. A comparação visual admite pequenas diferenças e rotações. Não representa fidelidade universal de 100%.

Sem cobrança de API; há consumo de CPU, memória e disco da hospedagem. O container Linux e a capacidade real do plano gratuito Render ainda precisam ser validados antes da ativação em produção. Testes Windows não comprovam capacidade no Render.

Licenças: PDFBox Apache-2.0, OCRmyPDF MPL-2.0, PDFium BSD com avisos de terceiros. Ghostscript e outras dependências já existentes têm obrigações próprias, inclusive AGPL; não declarar toda a cadeia como MIT.
