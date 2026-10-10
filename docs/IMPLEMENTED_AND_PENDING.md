# Implementado e pendente

## Implementado nesta entrega

A plataforma tem fundação visual responsiva, catálogo, busca local, tema claro/escuro, upload com drag-and-drop, validação server-side de assinatura/MIME/extensão/tamanho, limites grátis de 25 MB por arquivo e 5 arquivos por tarefa, histórico persistente por sessão e rotas públicas documentadas.

As ferramentas funcionais são: juntar PDF; dividir por intervalo ou ZIP de páginas; imagens para PDF; PDF para imagens; girar; organizar; comprimir com Ghostscript; PDF para Word; Word para PDF; OCR em PDF ou imagem; extrair texto; marca d’água de texto; números de página; assinatura visual de texto; proteção com senha e criptografia qpdf; edição de título/autor/assunto/palavras-chave; e redação rasterizada com coordenadas. Todos os resultados são validados antes do download e tarefas registram apenas metadados técnicos.

Limitações são exibidas de forma explícita: PDF para Word extrai texto e não promete fidelidade visual de layouts complexos; OCR depende dos idiomas instalados e pode conter erros; assinatura visual não é assinatura digital criptográfica; redação rasteriza a página para remover o conteúdo subjacente da área selecionada; compressão permanece disponível quando Ghostscript estiver configurado.

## Pendente / requer evolução

- Persistência de objetos no storage privado, URLs assinadas, filas assíncronas, workers isolados e limpeza física.
- Limites avançados de páginas/CPU/memória, observabilidade e carga de produção.
- Manus OAuth, painel de conta, histórico autenticado, limites por assinatura e área administrativa.
- Stripe em sandbox, webhooks assinados, produtos/preços e histórico de cobranças.
- Edição de texto original, reconstrução avançada de layout DOCX, OCR com mais idiomas e assinatura digital criptográfica.
- Domínio público para canonical e Open Graph absolutos.
