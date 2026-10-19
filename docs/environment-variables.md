# Variáveis de ambiente

O arquivo `.env` configura o desenvolvimento local e a implantação com Docker Compose. Crie-o a
partir do exemplo:

```bash
cp .env.example .env
```

Não envie o `.env` ao repositório. Os valores de segredo presentes no exemplo servem somente para
desenvolvimento. Para segredos próprios, gere a senha do PostgreSQL com `openssl rand -hex 32` e os
demais segredos com `openssl rand -base64 48`.

## Docker Compose

| Variável | Descrição |
| --- | --- |
| `OPENMONETIS_PROJECT_NAME` | Nome do projeto Compose e prefixo dos recursos criados. |
| `OPENMONETIS_VERSION` | Tag das imagens do OpenMonetis original usadas só pelo `compose.yml` sem o `compose.breathe.yml`, que constrói as imagens localmente. |
| `APP_PORT` | Porta do cliente web, vinculada somente a `127.0.0.1`. Ao alterá-la, ajuste também as URLs da aplicação. |

## PostgreSQL

| Variável | Descrição |
| --- | --- |
| `POSTGRES_DB` | Nome do banco criado pelo container PostgreSQL. |
| `POSTGRES_USER` | Usuário do PostgreSQL. |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL. Use um valor forte em produção. |
| `DB_HOST_PORT` | Porta local do PostgreSQL, vinculada somente a `127.0.0.1`. |
| `EXTERNAL_DATABASE_URL` | Conexão opcional com um PostgreSQL externo, usada tanto por processos locais quanto pelos containers. |

Sem `EXTERNAL_DATABASE_URL`, a conexão é montada automaticamente com as variáveis acima. Processos
locais usam `localhost:DB_HOST_PORT`; containers recebem `db:5432`. Assim, usuário, senha e nome do
banco são declarados uma única vez.

As antigas entradas `DATABASE_URL` e `DOCKER_DATABASE_URL` podem ser removidas do `.env`; elas não
são mais necessárias.

## URLs da aplicação

| Variável | Descrição |
| --- | --- |
| `OPENMONETIS_URL` | URL principal da aplicação. Mantenha as três URLs abaixo alinhadas com ela. |
| `BETTER_AUTH_URL` | URL usada pelos endpoints de autenticação. |
| `WEB_URL` | Origem do cliente web, usada também por passkeys. |
| `CORS_ORIGIN` | Origens permitidas pela API, separadas por vírgula quando houver mais de uma. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Origens adicionais confiáveis para autenticação, separadas por vírgula. Pode ficar vazia. |

O projeto não tem acesso público. Nesta máquina, use `http://localhost:7002` (ou a porta de
`APP_PORT`) em `OPENMONETIS_URL`, `BETTER_AUTH_URL`, `WEB_URL` e `CORS_ORIGIN`, e deixe
`BETTER_AUTH_TRUSTED_ORIGINS` vazia. Na VPS, acessada por túnel SSH, use
`http://vps.localhost:8002` (ver `docs/vps.md`): um host `*.localhost` próprio evita que os cookies
das duas instalações se misturem. Não aponte essas URLs para um domínio público.

## Autenticação e integrações entre pessoas

| Variável | Descrição |
| --- | --- |
| `BETTER_AUTH_SECRET` | Assina e protege dados da autenticação. Deve ser exclusivo da instalação. |
| `DEVICE_TOKEN_SECRET` | Protege os tokens usados pelo Companion Android. Alterá-lo invalida as credenciais existentes. |
| `PERSON_CONNECTION_SECRET` | Protege os tokens das conexões entre pessoas. Deve ser diferente dos demais segredos. |
| `AUTH_SESSION_EXPIRES_IN_DAYS` | Quantidade de dias até a expiração da sessão. Deve ser um inteiro positivo. |
| `AUTH_SESSION_UPDATE_AGE_HOURS` | Intervalo, em horas, para renovação da sessão. Deve ser um inteiro positivo. |

Nunca reutilize a senha do PostgreSQL ou o mesmo segredo nessas três variáveis.

## Armazenamento de anexos

| Variável | Descrição |
| --- | --- |
| `S3_BUCKET` | Nome do bucket de anexos. |
| `S3_ACCESS_KEY_ID` | Identificador da credencial S3. |
| `S3_SECRET_ACCESS_KEY` | Segredo da credencial S3. |
| `S3_ENDPOINT` | Endpoint de um serviço compatível com S3. Deixe vazio para AWS S3; em produção, endpoints personalizados devem usar HTTPS. |
| `S3_REGION` | Região do bucket, como `us-east-1` ou `sa-east-1`. |

`S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` devem ser configuradas juntas. Se todas
ficarem vazias, o recurso de anexos permanece desabilitado.

## Google OAuth

| Variável | Descrição |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID criado no Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Client secret correspondente. |

Configure as duas variáveis juntas ou deixe ambas vazias. O callback autorizado deve ser
`<WEB_URL>/api/auth/callback/google`.

## Logo.dev

| Variável | Descrição |
| --- | --- |
| `LOGO_DEV_PUBLISHABLE_KEY` | Chave pública usada para carregar imagens do CDN da Logo.dev. |
| `LOGO_DEV_SECRET_KEY` | Chave secreta usada pela API para pesquisar estabelecimentos. |

Configure as duas variáveis para habilitar completamente a busca e a exibição de logos. Se não usar
a integração, deixe ambas vazias.

## Captura pelo WhatsApp

| Variável | Descrição |
| --- | --- |
| `SELF_WPP` | Seu número, com DDI e DDD (ex.: `5531999998888`). Só mensagens recebidas dele são lidas e respondidas. |
| `EVOLUTION_API_URL` | Endereço da sua instância da Evolution API. Prefira HTTPS ou a tailnet. |
| `EVOLUTION_API_KEY` | Chave da Evolution API (`AUTHENTICATION_API_KEY` da instância). |
| `EVOLUTION_INSTANCE` | Nome da instância conectada ao número que recebe as fotos. |
| `WHATSAPP_CAPTURE_USER_EMAIL` | E-mail da conta do Breathe que recebe as capturas. |
| `WHATSAPP_CAPTURE_CLAUDE_MODEL` | Opcional. Modelo passado ao `claude -p`; vazio usa o padrão do Claude Code. |
| `WHATSAPP_CAPTURE_POLL_SECONDS` | Intervalo entre as consultas à Evolution API. Padrão: `20`. |
| `WHATSAPP_CAPTURE_CLAUDE_BIN` | Opcional. Caminho do executável `claude`; padrão: `claude` no `PATH`. |
| `WHATSAPP_CAPTURE_TIMEOUT_SECONDS` | Opcional. Tempo máximo de cada leitura. Padrão: `180`. |

A captura roda no host, fora do Docker, com `pnpm --filter @openmonetis/api capture:whatsapp`, e
usa o `claude` já autenticado na máquina. Ela só faz chamadas de saída: consulta as mensagens
guardadas na Evolution API, baixa as fotos e envia a resposta. Nenhuma porta é aberta e não há
webhook. O `claude -p` roda sem ferramentas, sem MCP, sem `CLAUDE.md` e sem as variáveis do `.env`.
O que ele lê só cria rascunhos: despesas na Caixa de entrada e medidas em Físico → Corpo. Perguntas
recebem uma resposta montada a partir de um recorte somente leitura dos dados do usuário, enviado
ao Claude junto com a pergunta. Os prompts ficam em `apps/api/prompts/whatsapp-capture.md` e
`apps/api/prompts/whatsapp-answer.md`.

## Validando alterações

Depois de editar o `.env`, valide e aplique a configuração:

```bash
docker compose config --quiet
docker compose up -d
```

Use `docker compose config` sem `--quiet` somente em um ambiente privado, pois a saída resolvida
pode conter segredos.
