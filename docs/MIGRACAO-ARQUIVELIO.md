# Migração para Arquivelio

Domínio principal: https://www.arquivelio.com.br.

## Preparado no código

- Nome público em páginas, atendimento e documentos gerados.
- Paleta azul e turquesa.
- Metadados, sitemap e robots com endereço principal novo.
- Identificadores de sessão, banco de dados e cookies preservados.
- Normalização de arquivelio.com.br para www nas origens de autenticação, mantendo compatibilidade com o domínio anterior. Onze testes de autenticação/cadastro passaram.

## Endereços para configurar nos provedores

- Origem pública: `https://www.arquivelio.com.br`.
- Callback OAuth: `https://www.arquivelio.com.br/api/auth/callback` (confirmar o provedor utilizado antes de editar).
- Webhook de cobrança: `https://www.arquivelio.com.br/api/billing/webhook` (não remover a URL anterior antes da validação).
- Cadastrar os endereços novos no provedor Google quando aplicável, preservando os anteriores durante a transição.
- Os cookies do domínio antigo não são enviados pelo navegador ao domínio novo; será necessário entrar novamente, mesmo preservando os registros de usuários.

## Pendências antes de publicar

- Logotipos recebidos em JPEG e aplicados ao cabeçalho, rodapé (variantes clara/escura), compartilhamento e ícones. Os arquivos originais foram preservados; a prancha é exibida por janelas de visualização, sem títulos/paleta. Build de produção passou. Falta inspeção visual em navegador antes da publicação.
- Conferir NEXT_PUBLIC_SITE_URL na Vercel e os endereços autorizados do Google OAuth e demais provedores de login.
- Antes de mudar NEXT_PUBLIC_SITE_URL, verificar MANUS_PROJECT_ID: a implementação atual usa SITE_URL como identificador de sessão quando PROJECT_ID não existe. Preservar o identificador anterior evita invalidar sessões pela mudança de configuração.
- Conferir URLs de retorno e webhook no Mercado Pago, mantendo o webhook antigo durante a transição.
- Configurar e verificar o domínio no Resend e recebimento na Cloudflare antes de trocar remetente ou suporte. O endereço de suporte anterior permanece em uso.
- Validar login, recuperação de senha, checkout sem cobrança real e envio do chat no novo domínio.
- Só redirecionar o domínio antigo após esses testes, preservando caminhos e parâmetros.
- Atualizar AdSense/Search Console e conferir ads.txt no domínio novo.

## Publicação de 28/10/2026

- Publicado na Vercel: `dpl_AHSNyVYXrBLEMjRk5QMcfLtsbQNB`, estado READY, domínio `https://www.arquivelio.com.br`.
- A publicação foi preparada sobre origin/main, sem incorporar as alterações do worker auxiliar.
- `APP_PUBLIC_ORIGIN=https://www.arquivelio.com.br` configurada na produção. NEXT_PUBLIC_SITE_URL foi preservada para não trocar o identificador das sessões existentes.
- Usuário confirmou ter salvo os endereços Google. HTML público de /entrar usa o callback novo. O login completo exige teste interativo do titular; não foi declarado concluído automaticamente.
- 271 testes da suíte local passaram, usando o Python já instalado em `.vercel/tools/pdf2docx-venv`. Compilação remota de produção passou.
- Inspeção por navegador em produção: 390px e 1440px, temas claro/escuro, imagens carregadas, sem overflow horizontal ou exceção JavaScript.
- HTTP 200: início, entrar, criar-conta, contato, icon, apple-icon, sitemap.xml, ads.txt e api/health. Domínio raiz retorna 308 ao www.
- Webhook antigo não foi redirecionado; GET retorna 405, coerente com endpoint POST. Isso não comprova processamento de um evento de pagamento real.
- E-mail de suporte e remetente anteriores mantidos para preservar o canal verificado. Não foi configurada uma nova caixa @arquivelio.com.br nem realizado envio real nesta etapa.

Pendências externas: teste interativo de login Google, nome exibido na tela de consentimento Google, migração da caixa de suporte/remetente e revisão do domínio no AdSense/Search Console. Não houve cobrança ou alteração de chaves.
