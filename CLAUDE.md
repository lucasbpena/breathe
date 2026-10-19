# CLAUDE.md — Breathe

Breathe é um fork do OpenMonetis V2 (`github.com/lucasbpena/breathe`) para acompanhar despesas
pessoais junto com calorias e peso: relacionar gasto financeiro com saúde/fitness, identificar
padrões de consumo, relacionar preço/calorias/nutrientes e acompanhar a flutuação de preços por
local e tempo (dia da semana, data etc.).

As regras de arquitetura, pastas, segurança e idioma continuam sendo as do `AGENTS.md`. Este
arquivo só define **de onde vêm os requisitos do produto e qual é o escopo atual**.

## Fonte de requisitos: notas do Obsidian

Os requisitos vivem no vault do Obsidian (`~/GoogleDrive/Obsidian`), nas notas com a tag
`projects/breathe`. Releia as notas no início de cada tarefa, porque elas mudam com frequência.

| Nota                   | Caminho                                            | URL                                                              |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Breathe Project        | `~/GoogleDrive/Obsidian/Breathe Project.md`        | `obsidian://open?vault=Obsidian&file=Breathe%20Project`          |
| Breathe Project Kanban | `~/GoogleDrive/Obsidian/Breathe Project Kanban.md` | `obsidian://open?vault=Obsidian&file=Breathe%20Project%20Kanban` |
| Campos de Produto      | `~/GoogleDrive/Obsidian/Campos de Produto.md`      | `obsidian://open?vault=Obsidian&file=Campos%20de%20Produto`      |
| Notas fiscais 2026-10  | `~/GoogleDrive/Obsidian/Notas fiscais 2026-10.md`  | `obsidian://open?vault=Obsidian&file=Notas%20fiscais%202026-10`  |
| Breathe LOG            | `~/GoogleDrive/Obsidian/Breathe LOG.md`            | `obsidian://open?vault=Obsidian&file=Breathe%20LOG`              |

- **Breathe Project** é a nota principal: visão, objetivos atuais, não-prioridades e o que já foi feito.
- **Campos de Produto** detalha os atributos de produto, loja e compra.
- **Notas fiscais 2026-10** traz NFC-e reais já extraídas. Use essa nota como referência de dados
  (nomes divergentes do mesmo produto, peso a granel, descontos, lojas da mesma rede em bairros
  diferentes), não como escopo de extração.

- **Breathe LOG** é o dump de detalhes discutidos nas sessões (ver abaixo).

Assim como o repo original do OpenMonetis, as notas são referência de produto e não de modelagem.
Antes de existir no código, cada campo proposto nelas passa pela mesma revisão crítica de dados,
contratos e nomes que o `AGENTS.md` exige. Só edite as notas quando o usuário pedir; a exceção é o
*Breathe LOG*.

O vault tem regras de privacidade próprias (`~/GoogleDrive/Obsidian/CLAUDE.md`): leia só
as notas da tabela acima e peça permissão antes de abrir qualquer outra nota do vault (notas
periódicas, finanças, journal etc.), mesmo que ela mencione o Breathe.

## Tarefa contínua: registrar no Breathe LOG

Ao fim de cada tarefa ou sessão em que algo relevante foi discutido, acrescente uma entrada no fim de
*Breathe LOG*:

- Use um cabeçalho `## AAAA-MM-DD — <assunto>` com bullets sobre:
  - decisões tomadas e o porquê;
  - detalhes passados pelo usuário que não estão nas outras notas;
  - perguntas em aberto;
  - próximos passos.
- Só acrescente entradas. Não reescreva nem apague entradas anteriores.
- Registre decisões como decisões só quando o usuário as confirmou. Propostas suas entram como
  perguntas em aberto.
- Não copie o que o git já guarda (código, diffs, mensagens de commit). Cite o arquivo ou commit.
- Use wikilinks (`[[Breathe Project]]`) para notas e crases para caminhos do repo.
- O log é rascunho. Quem promove algo para *Breathe Project* ou *Campos de Produto* é o usuário,
  então não altere essas notas com base no log.

## Escopo atual

Trabalhe **apenas** nas tarefas da seção **"Objetivos atuais"** de *Breathe Project*. Hoje são:

- Database pessoal de produtos consumidos (ver *Campos de Produto*)
  - Nome padrão (nome journal) que unifica as diferentes nomeações do mesmo produto nas NFs das lojas
  - Flutuação de preço por tempo e lugar, com gráficos
  - Campos de produto: nome extraído, nome journal, metragem (unidades, g/mL), loja e
    bairro/endereço, histórico de preço (compra, médio, mín., máx.), categoria e dados nutricionais
- Registro de fitness
  - Registrar peso e medidas com fita métrica (feito; o usuário descartou "nomear fita métrica")
  - Database para buscar informações nutricionais
  - Integrar o Google Fit (caminhadas), ainda com "?" na nota
  - Registrar exercícios e repetições a partir do Keep (`#workout` → `#extracted`)

A seção **Físico** do app (pedida em 2026-10-19) reúne o registro de fitness: ingestão de calorias e
macros, peso e medidas, e um mapa do corpo inicial, que é a base do item MuscleView do Kanban.

**Captura pelo WhatsApp** (pedida em 2026-10-19, apesar de estar em "Não-prioridade" na nota):
mensagens do número `SELF_WPP` para a instância da Evolution API do usuário são lidas com
`claude -p`, que separa três coisas.

- Despesas (fotos de NF ou texto) viram capturas pendentes na Caixa de entrada.
- Peso e medidas viram rascunhos pendentes em Físico → Corpo.
- Perguntas são respondidas na conversa a partir de um recorte somente leitura dos dados.

Nada é gravado sem revisão humana. Os prompts (`apps/api/prompts/whatsapp-capture.md` e
`whatsapp-answer.md`) ainda serão definidos pelo usuário.

**Fora de escopo** sem pedido explícito: o restante de "Não-prioridade" (bounding boxes numeradas
para correção, espelhamento com notas do Obsidian) e os itens do Kanban que não
estão em "Objetivos atuais" (Capture e a referência de exercícios por API do MuscleView). Não altere
a instância da Evolution API nem a VPS onde ela roda. Se uma tarefa do escopo parecer depender de um desses itens,
pergunte ao usuário antes de implementá-lo.

**Sem acesso público.** O projeto roda nesta máquina (desenvolvimento) e, desde 2026-10-19, também
na VPS do usuário ao lado da Evolution API (`docs/vps.md`), presa ao `127.0.0.1` e acessada só por
túnel SSH (`ssh -L`), em `http://vps.localhost:8002`. Não altere os containers da Evolution nem
outros serviços da VPS. Não reintroduza deploy público, publicação de imagens, proxy, túnel público
ou acesso pela tailnet sem pedido explícito. Não grave IPs, caminhos absolutos da máquina
(`/home/<usuário>/...`) nem segredos em arquivos do repositório. A captura pelo WhatsApp só faz
chamadas de saída para a Evolution API; não crie webhook nem porta de entrada para ela. URLs, chaves
e números ficam só no `.env`.
