# Breathe na VPS

Este guia sobe o Breathe numa VPS ao lado da Evolution API, sem tocar nos containers que já estão
lá. Ao final:

- o web e o PostgreSQL do Breathe ficam presos ao `127.0.0.1` da VPS, sem nenhuma porta pública;
- você acessa a VPS por um túnel SSH, em `http://vps.localhost:8002`;
- a captura pelo WhatsApp roda na própria VPS e fica sempre ligada;
- este computador continua com a stack de desenvolvimento em `http://localhost:7002`, com banco
  próprio.

| Onde | Endereço | O quê |
| --- | --- | --- |
| VPS | `127.0.0.1:8002` | Web do Breathe |
| VPS | `127.0.0.1:8000` | PostgreSQL do Breathe (usado só pela captura) |
| VPS | `:7777` | Evolution API (já existe) |
| Este computador | `vps.localhost:8002` → túnel → VPS `8002` | Breathe da VPS |
| Este computador | `localhost:7777` → túnel → VPS `7777` | Gerenciador da Evolution (`/manager`) |

> **Por que `vps.localhost` e não `localhost:8002`?** Os cookies de login valem por host, não por
> porta. Se as duas stacks usassem `localhost`, entrar numa derrubaria a sessão da outra. O
> navegador resolve qualquer `*.localhost` para o próprio computador, e a API só aceita `WEB_URL`
> em HTTPS ou em `localhost`/`*.localhost`, então `127.0.0.1` também não serve.

Nos comandos, troque `<IP>` pelo IP da VPS e `<usuário>` pelo seu usuário nela.

## 1. Neste computador: acesso SSH

O código que vai para a VPS é o que está commitado. Confira se `git status` está limpo antes de
continuar.

Acrescente em `~/.ssh/config`:

```sshconfig
Host breathe-vps
  HostName <IP>
  Port 2222
  User <usuário>
```

Teste com `ssh breathe-vps 'echo ok'`.

## 2. Na VPS: conferir o terreno sem mexer em nada

```bash
ssh breathe-vps
uname -m                                    # x86_64 ou aarch64 (usado no passo 7)
free -h && df -h ~                          # o build das imagens usa ~2 GB de RAM e alguns GB de disco
docker compose ls                           # não pode existir um projeto chamado "breathe"
docker ps --format '{{.Names}}\t{{.Ports}}' # anote o que já roda (evolution_api, postgres, redis…)
ss -ltn | grep -E ':(8000|8002)\b' || echo "portas 8000 e 8002 livres"
```

Se 8000 ou 8002 estiverem ocupadas, escolha outras portas e use-as em todo o guia.

## 3. Levar o código para a VPS

Sem depender do GitHub, empurre direto por SSH para um repositório na VPS:

```bash
# na VPS
git init --bare ~/repos/breathe.git

# neste computador, na pasta do repositório
git remote add vps ssh://breathe-vps/~/repos/breathe.git
git push vps main

# na VPS
git clone ~/repos/breathe.git ~/breathe
```

## 4. Na VPS: `.env`

```bash
cd ~/breathe
cp .env.example .env
chmod 600 .env
set_env() { sed -i "s|^$1=.*|$1=$2|" .env; }
set_env OPENMONETIS_PROJECT_NAME breathe
set_env APP_PORT 8002
set_env DB_HOST_PORT 8000
set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
for name in OPENMONETIS_URL BETTER_AUTH_URL WEB_URL CORS_ORIGIN; do
  set_env "$name" http://vps.localhost:8002
done
for name in BETTER_AUTH_SECRET DEVICE_TOKEN_SECRET PERSON_CONNECTION_SECRET; do
  set_env "$name" "$(openssl rand -hex 32)"
done
grep -E '^(APP_PORT|DB_HOST_PORT|WEB_URL)=' .env
```

## 5. Na VPS: subir os containers

```bash
cd ~/breathe
docker compose -p breathe -f compose.yml -f compose.breathe.yml up -d --build
docker compose -p breathe -f compose.yml -f compose.breathe.yml ps
docker ps --format '{{.Names}}\t{{.Ports}}'          # os containers da Evolution seguem iguais
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8002/   # 200
```

O projeto `breathe` cria seus próprios nomes, sem tocar nos da Evolution:

- containers `breathe-*`;
- rede `breathe_default`;
- volume `breathe_OMv2_db`.

Ele não entra na `evolution-net` e não usa as portas 7777, 5433, 4000 nem 6379. O `migrator` aplica
as migrations sozinho. Os containers voltam depois de um reboot (`restart: unless-stopped`).

Para não repetir os arquivos a cada comando, você pode criar um alias:

```bash
echo "alias bcompose='docker compose -p breathe -f ~/breathe/compose.yml -f ~/breathe/compose.breathe.yml'" >> ~/.bashrc
```

## 6. Neste computador: túnel e primeiro acesso

```bash
ssh -N -L 8002:127.0.0.1:8002 -L 7777:127.0.0.1:7777 breathe-vps
```

O comando fica parado enquanto o túnel está aberto; `Ctrl+C` fecha. O destino é `127.0.0.1`, e não
`localhost`, porque na VPS o web escuta só em IPv4. Para não digitar as portas,
acrescente ao bloco do passo 1 e use só `ssh -N breathe-vps`:

```sshconfig
  LocalForward 8002 127.0.0.1:8002
  LocalForward 7777 127.0.0.1:7777
```

Com o túnel aberto:

- **Breathe da VPS:** abra `http://vps.localhost:8002` e crie sua conta. Use o mesmo e-mail que vai
  em `WHATSAPP_CAPTURE_USER_EMAIL`.
- **Evolution:** fica em `http://localhost:7777/manager`.
- **Stack deste computador:** continua em `http://localhost:7002`.

O cadastro de contas não pode ser desativado, então a porta 8002 nunca deve ser publicada na VPS.

## 7. Na VPS: Node, pnpm e Claude Code (para a captura)

```bash
# Node 22 sem sudo (use linux-arm64 se o uname -m do passo 2 deu aarch64)
mkdir -p ~/.local/opt ~/.local/bin
curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-linux-x64.tar.xz | tar -xJ -C ~/.local/opt
ln -sfn ~/.local/opt/node-v22.16.0-linux-x64 ~/.local/opt/node
echo 'export PATH="$HOME/.local/opt/node/bin:$HOME/.local/bin:$PATH"' >> ~/.bashrc
echo 'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0' >> ~/.bashrc
source ~/.bashrc

# pnpm na versão do repositório
corepack enable --install-directory ~/.local/bin
cd ~/breathe && pnpm install --frozen-lockfile

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash
claude              # faça o login: abra o link no navegador deste computador e cole o código; depois /exit
claude -p "responda só ok"
```

## 8. Na VPS: configurar e testar a captura

Preencha no `~/breathe/.env` as variáveis da seção "Captura pelo WhatsApp" de
`docs/environment-variables.md`. Elas já vêm vazias do `.env.example`:

```bash
SELF_WPP=55DD9XXXXXXXX                 # seu número, que manda as fotos
EVOLUTION_API_URL=http://localhost:7777
EVOLUTION_API_KEY=                     # AUTHENTICATION_API_KEY do .env da Evolution
EVOLUTION_INSTANCE=                    # nome da instância do número bot
WHATSAPP_CAPTURE_USER_EMAIL=           # e-mail da conta criada no passo 6
```

Para achar os valores sem alterar nada na Evolution:

```bash
grep '^AUTHENTICATION_API_KEY=' ~/evolution/.env
curl -s -H "apikey: <chave>" http://localhost:7777/instance/fetchInstances | grep -o '"name":"[^"]*"'
```

Teste em primeiro plano:

```bash
cd ~/breathe
pnpm --filter @openmonetis/api capture:whatsapp
```

1. Espere a linha `{"event":"whatsapp_capture_started"}`.
2. Mande uma foto de nota do seu número para o número bot. A resposta chega no WhatsApp, e a nota
   aparece em **Lançamentos → Caixa de entrada** em `http://vps.localhost:8002`.
3. Encerre com `Ctrl+C`.

## 9. Na VPS: deixar a captura sempre ligada

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/breathe-capture.service <<'EOF'
[Unit]
Description=Breathe: captura pelo WhatsApp
After=network-online.target

[Service]
WorkingDirectory=%h/breathe
Environment=PATH=%h/.local/opt/node/bin:%h/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ExecStart=%h/.local/bin/pnpm --filter @openmonetis/api capture:whatsapp
KillSignal=SIGINT
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now breathe-capture
sudo loginctl enable-linger "$USER"   # mantém o serviço sem sessão SSH aberta e depois de reboot
journalctl --user -u breathe-capture -f
```

O serviço é reiniciado se cair, inclusive quando sobe antes do banco depois de um reboot.
`systemctl --user stop breathe-capture` o desliga.

## 10. Atualizar depois de mudar o código

```bash
# neste computador
git push vps main

# na VPS
cd ~/breathe
git pull
pnpm install --frozen-lockfile
docker compose -p breathe -f compose.yml -f compose.breathe.yml up -d --build
systemctl --user restart breathe-capture
```

## 11. Backup do banco da VPS

```bash
mkdir -p ~/backups/breathe
docker exec breathe-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip > ~/backups/breathe/breathe-$(date +%F-%H%M%S).sql.gz
```

## 12. O que não fazer na VPS

- Não use `docker system prune`, `docker volume prune` nem `docker rm $(docker ps -aq)`. Eles
  apagam containers e volumes da Evolution também.
- Não rode `docker compose` dentro de `~/evolution` para mexer no Breathe. Sempre use
  `-p breathe` com os arquivos do Breathe.
- Para parar só o Breathe, use `stop` ou `down`, nunca `down -v`, que apaga o banco:

  ```bash
  docker compose -p breathe -f compose.yml -f compose.breathe.yml stop
  ```

- Não publique 8000 ou 8002 em `0.0.0.0`. Também não coloque proxy, Tailscale Serve/Funnel ou
  túnel público na frente: o acesso é só pelo túnel SSH.
