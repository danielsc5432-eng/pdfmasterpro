# Processadores auxiliares — 26/10/2026

Preparado no código, sem ativação e sem alteração das variáveis de produção.

## Railway

O cadastro de novas contas está pausado conforme aviso ativo no [status oficial](https://status.railway.com/). Não é possível concluir a hospedagem até haver uma conta disponível. A integração não exige contratar Hobby: o plano pretendido é Free, com crédito limitado de US$ 1/mês e 0,5 GB de RAM. [Planos](https://docs.railway.com/pricing/plans).

Arquivos: `deploy/railway-aux/Dockerfile` e `deploy/railway-aux/railway.json`. Na configuração do serviço, selecionar o arquivo de configuração `deploy/railway-aux/railway.json`, mantendo a raiz do repositório como contexto. O perfil executa apenas juntar, dividir, girar, organizar e editar metadados; não instala Python, Java, LibreOffice ou motores de OCR. Suspensão automática quando inativo está habilitada na configuração, mas disponibilidade e consumo precisam de teste real na conta.

No auxiliar, definir somente o segredo dedicado `BILLING_SIGNING_SECRET` compartilhado com o site. Não copiar banco, chaves de IA, autenticação de usuário ou credenciais de pagamento. O Dockerfile já define `PROCESSING_WORKER_ONLY=1`, ferramentas permitidas e limite de 8 MiB por requisição.

No site principal, manter `PROCESSING_WORKER_URL` apontando ao Render. Após testar o auxiliar e atualizar a informação de tratamento dos documentos, configurar, por exemplo:

```json
{"girar-pdf":{"url":"https://SEU-AUX.up.railway.app","maxRequestBytes":8388608}}
```

Esse JSON é o valor de `PROCESSING_WORKER_ROUTES`. Nenhum endereço fictício foi inserido no ambiente ativo. Arquivos maiores ou sem tamanho declarado continuam no processador principal. O auxiliar exige assinatura do plano, recusa ferramentas fora da lista e não tenta encaminhar novamente. Cotas e histórico permanecem no site principal. Cookies de sessão e credenciais pessoais não são enviados ao auxiliar; cookies vindos dele não substituem a sessão do site. Não há repetição automática de uploads após erro de um destino.

Testes do roteamento cobrem tamanho, destino padrão, configurações inválidas, autenticação dos cabeçalhos, isolamento de cookies e prevenção de ciclos. A compilação Next passou. Ainda não foram medidos a imagem auxiliar no Railway, o seu tamanho final nem a memória de processamento nesse provedor.

## Outra opção pesquisada

[Back4app Containers Free](https://www.back4app.com/pricing/container-as-a-service): anuncia US$ 0/mês, sem cartão, 256 MB de RAM, 0,25 CPU e 100 GB de transferência. É candidato para testes de tarefas leves; tem menos RAM que o Render e não resolve os motores pesados. [Cadastro](https://www.back4app.com/signup-containers). Página de cadastro acessível na pesquisa; criação de conta e execução não testadas. Não foi confirmada disponibilidade operacional por página de status.

Supabase Free também foi pesquisado para apoio de armazenamento (1 GB), não como hospedagem de Java/Python. Não aumenta a RAM dos conversores. Nenhuma conta ou armazenamento externo foi criado.
