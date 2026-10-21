# Manual do Breathe

Como ligar e usar o Breathe nesta máquina. A arquitetura e as regras de código ficam no
`AGENTS.md`, e o escopo do produto no `CLAUDE.md`.

O Breathe **não tem acesso público**: o web e o PostgreSQL escutam apenas em `127.0.0.1`. Ele roda
nesta máquina para desenvolvimento e testes e, separado, numa VPS acessada só por túnel SSH
(`docs/vps.md`). Não há deploy público, proxy, Tailscale Serve nem Funnel.

## O que roda

O Breathe é a stack Docker Compose do OpenMonetis V2, com as imagens construídas a partir deste
repositório (`compose.yml` + `compose.breathe.yml`):

| Serviço            | Função                                                        | Porta no host      |
| ------------------ | ------------------------------------------------------------- | ------------------ |
| `db`               | PostgreSQL 16, dados no volume `breathe_OMv2_db`              | `127.0.0.1:7000`   |
| `migrator`         | Aplica as migrations e encerra                                | —                  |
| `api`              | API Hono (privada, acessada só pelo `web`)                    | —                  |
| `recurring-worker` | Sincroniza despesas recorrentes compartilhadas                | —                  |
| `web`              | Interface web e proxy da API                                  | `127.0.0.1:7002`   |

O projeto Compose se chama `breathe`. Isso o mantém separado de qualquer outra instalação do
OpenMonetis nesta máquina.

**O Docker fica desativado no boot.** Nada sobe sozinho; o comando `breathe` liga o Docker só
quando você pede.

## Comando `breathe`

O script `breathe` fica fora do repositório, em uma pasta do `PATH`.

| Comando                       | O que faz                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `breathe` ou `breathe up`     | Liga o Docker (pede a senha do sudo) e sobe a stack                                |
| `breathe up --build`          | Igual, mas reconstrói as imagens com o código atual do repositório                 |
| `breathe down`                | Para a stack e desliga o Docker                                                    |
| `breathe down --keep-docker`  | Para só a stack                                                                    |
| `breathe status`              | Mostra os containers e o endereço local                                            |
| `breathe logs [serviço]`      | Acompanha os logs (`web`, `api`, `migrator`, `recurring-worker`, `db`)             |
| `breathe dev`                 | Modo desenvolvimento: Postgres no Docker + API e web com hot reload               |
| `breathe backup`              | Gera um `pg_dump` compactado na pasta de backups do script                         |

Para usar outra cópia do repositório, defina `BREATHE_DIR`.

## Primeira execução

1. **Ligue:**

   ```bash
   breathe up
   ```

   Na primeira vez, o comando:
   - cria o `.env` a partir do `.env.example`, com permissão `600` e segredos novos gerados por
     `openssl rand`;
   - aponta as URLs para `http://localhost:7002`;
   - constrói as imagens, o que leva alguns minutos;
   - aplica as migrations e sobe tudo.
2. **Crie sua conta** em `http://localhost:7002`. Os dados começam vazios.

> [!WARNING]
> O OpenMonetis V2 não tem opção para desativar novos cadastros. Qualquer pessoa que alcance a URL
> pode criar uma conta. Por isso o Breathe fica só no `localhost`: não exponha a porta 7002 na rede
> nem na internet (proxy público, túnel, `tailscale serve` ou `tailscale funnel`).

## Como acessar

Só nesta máquina, em `http://localhost:7002`, com e-mail e senha. Passkeys ficam vinculadas ao
endereço de `WEB_URL`; as criadas em outro endereço deixam de funcionar.

### Banco de dados

O PostgreSQL escuta só em `127.0.0.1:7000`. Usuário, senha e banco ficam em `POSTGRES_USER`,
`POSTGRES_PASSWORD` e `POSTGRES_DB` no `.env`:

Na raiz do repositório:

```bash
set -a; source .env; set +a
psql "postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$DB_HOST_PORT/$POSTGRES_DB"
```

### Companion Android

O Companion envia capturas do celular para a caixa de entrada, então precisa alcançar o servidor
pela rede. Sem acesso público ao Breathe, ele fica indisponível. O protocolo está em
`docs/companion-api.md`.

## Usando os produtos

1. Crie a despesa da nota fiscal, por exemplo "DMA Distribuidora, R$ 53,34". No próprio formulário
   de nova despesa, a seção **Itens da compra** tem **Adicionar item** para cada linha da nota;
   os itens são salvos junto com a despesa. Para despesas já lançadas, abra o lançamento
   ("⋯" → **Ver detalhes**) e use a mesma seção. Para cada item:
   - **Nome na nota** é opcional: copie como está impresso, por exemplo `MONSTER TRAD 473ML`. Se
     esse nome já for conhecido, o produto é selecionado sozinho.
   - **Produto** e **Loja** podem ser criados ali mesmo, pelas opções "Criar produto…" e
     "Criar loja…".
   - Informe as **Unidades**. Para produtos com metragem (g ou mL), a **Metragem total** é
     calculada pelas unidades; preencha-a só para itens a granel, como 1430 g de batata.
   - Informe o **Valor pago** da linha, já com desconto, e o **Desconto**, se houver.
3. O resumo mostra quanto dos itens soma em relação ao valor da despesa.
4. Em **Consumo → Produtos**:
   - veja o último preço e o preço médio, mínimo e máximo, em R$/kg, R$/L ou R$/un;
   - abra um produto para ver os gráficos por data, por loja e por dia da semana;
   - gerencie os nomes da nota;
   - **mescle** produtos duplicados.
5. Em **Consumo → Lojas**, cadastre o bairro e o endereço de cada unidade.

Cada produto tem uma **metragem**: gramas, mililitros ou "sem metragem". Um produto sem metragem,
como um pacote de pão, é contado só por unidades e tem o preço em R$ por unidade.

Cada produto também tem uma **categoria** de despesa, que pode ser uma subcategoria, como
"Mercado › Hortifruti". Ela é obrigatória: um produto cadastrado antes sem categoria pede uma na
próxima edição. Uma categoria usada por produtos não pode ser excluída nem mudar de tipo.

A **informação nutricional** (calorias, proteínas, carboidratos, açúcar adicionado e gorduras, todos
opcionais) só aparece para produtos de categorias com a opção **Tem informação nutricional**, em
**Organização → Categorias**. Alimentação, Mercado, Restaurantes e Delivery já vêm com ela ligada. Uma
subcategoria nova começa com a escolha da categoria pai, mas pode mudar. Ao salvar um produto de
categoria sem essa opção, os valores nutricionais são apagados.

## Físico

- **Físico → Corpo** mostra o corpo de frente e de costas. Toque em um músculo para ver a medida
  ligada a ele, a variação e o histórico. **Registrar medidas** abre uma ficha com peso e todas as
  medidas da fita métrica para uma data; preencha só o que mediu. Medir de novo na mesma data
  substitui o valor.
- **Físico → Nutrição** estima calorias e macros pelos itens das compras dos últimos 7, 30 ou 90
  dias. Cada item conta no dia da compra, e a média diária divide o total pelos dias do período.
  Só entram produtos de categorias com informação nutricional. Os que ainda não têm calorias
  cadastradas ficam de fora da soma e aparecem marcados na tabela.

## Captura pelo WhatsApp

Mande do seu número (`SELF_WPP`) para o número conectado à sua instância da Evolution API:

- **uma despesa:** foto de nota fiscal (pode ter várias notas na mesma foto) ou um texto como "pão
  8,50 na padaria". Cada nota vira uma captura na **Caixa de entrada**.
- **peso ou medidas:** por exemplo "peso 82,4, cintura 84, braço direito 36" ou a foto da balança.
  Elas ficam pendentes em **Físico → Corpo**. Braço, antebraço, coxa e panturrilha precisam do lado.
- **uma pergunta:** por exemplo "quanto gastei com Monster este mês?" ou "quanto perdi desde o dia
  12?". A resposta vem no WhatsApp, a partir dos seus lançamentos dos últimos 120 dias, das compras
  de produtos dos últimos 180 dias, das medidas e da nutrição dos últimos 30 dias. Perguntas não
  gravam nada.

Uma mensagem pode misturar os três. O Breathe lê com `claude -p` e responde no WhatsApp com o que
entendeu.

1. Preencha no `.env` as variáveis da seção "Captura pelo WhatsApp" de
   `docs/environment-variables.md`.
2. Com o banco no ar (`breathe up`), rode na raiz do repositório e deixe o terminal aberto:

   ```bash
   pnpm --filter @openmonetis/api capture:whatsapp
   ```

   O processo consulta a Evolution a cada 20 s. Mensagens enviadas com a máquina desligada são lidas
   quando ele volta, até 48 h depois. `Ctrl+C` encerra.
3. Em **Lançamentos → Caixa de entrada**, cada nota aparece com a foto, a loja, os itens e os avisos.
   **Revisar** abre a despesa já preenchida com os itens da compra:
   - itens reconhecidos já vêm com o produto;
   - itens sem produto ou sem loja mostram **Associar**, onde dá para escolher ou criar o produto e
     a loja; também podem ser removidos;
   - a despesa só é confirmada quando todos os itens estiverem associados.
4. Em **Físico → Corpo**, o bloco **Recebidas pelo WhatsApp** mostra as medidas lidas, com o valor
   que cada uma substitui na mesma data. **Confirmar** salva, **Editar** abre a ficha preenchida para
   corrigir antes de salvar e a lixeira descarta.

Os textos que orientam a leitura e as respostas ficam em `apps/api/prompts/whatsapp-capture.md` e
`apps/api/prompts/whatsapp-answer.md`. Mensagens de outros
números são ignoradas e nunca respondidas.

## Atualizando depois de mudar o código

```bash
breathe up --build
```

O `migrator` aplica migrations novas antes de a API subir. Faça um `breathe backup` antes de
atualizações que mudem o banco.

## Modo desenvolvimento

```bash
breathe dev
```

O modo desenvolvimento:

- para os containers `web`, `api` e `recurring-worker` da stack;
- mantém o `db`;
- instala as dependências e aplica as migrations;
- roda `pnpm dev`, com o web em `http://localhost:7002` e a API em `http://localhost:7001`. O
  OpenAPI fica em `http://localhost:7001/openapi.json`.

Encerre com `Ctrl+C` e volte à stack com `breathe up`. O Node 22 e o pnpm ficam em
`~/.local/opt/node`, e o script os coloca no `PATH`. Para usá-los no terminal:

```bash
export PATH="$HOME/.local/opt/node/bin:$PATH"
pnpm check && pnpm test
```

## Backup e restauração

```bash
breathe backup                     # gera breathe-<data>.sql.gz na pasta de backups
```

Para restaurar em um banco **vazio**, por exemplo após recriar o volume, rode na raiz do
repositório:

```bash
gunzip -c <pasta-de-backups>/<arquivo>.sql.gz |
  docker compose -f compose.yml -f compose.breathe.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

O `.env` também precisa de backup. Sem o `BETTER_AUTH_SECRET` e os outros segredos, as sessões e
os tokens de dispositivo deixam de valer.

## Desligando

```bash
breathe down
```

Os dados continuam no volume `breathe_OMv2_db`. Para apagar tudo de forma irreversível, use
`docker volume rm breathe_OMv2_db`, com a stack parada.

## Problemas comuns

| Sintoma                                        | O que fazer                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| "o web não respondeu"                          | Veja `breathe logs migrator` e `breathe logs api`                               |
| Porta 7002 em uso                              | Um `breathe dev` ainda está aberto; encerre-o                                   |
| Login falha depois de mudar o endereço         | Ajuste `OPENMONETIS_URL`, `BETTER_AUTH_URL`, `WEB_URL` e `CORS_ORIGIN` no `.env` |
| `breathe` pede senha a cada uso                | É o sudo do `systemctl start docker`; é esperado com o Docker desativado no boot |
