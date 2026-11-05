# Guia Completo de Instalação e Hospedagem em Servidor (3Fácil SaaS)

Este guia contém as instruções passo a passo para instalar, configurar e implantar o **3Fácil** em qualquer VPS ou Servidor Dedicado Linux (Ubuntu 22.04 / 24.04 LTS, Debian 12, AWS EC2, DigitalOcean, Oracle Cloud, Hetzner, etc.).

---

## 🔒 Variáveis de Ambiente Críticas (.env)

Antes de iniciar a aplicação em produção, certifique-se de configurar as seguintes variáveis no seu arquivo `.env`:

| Variável | Obrigatória? | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Sim | Modo de execução | `production` |
| `PORT` | Sim | Porta de escuta do backend | `3000` |
| `APP_URL` | Sim | URL canônica pública | `https://3facil.com` |
| `ALLOWED_ORIGINS` | Sim | Origens permitidas para CORS | `https://3facil.com` |
| `JWT_SECRET` | **Sim** | Chave secreta de autenticação (**mínimo 32 caracteres**) | `openssl rand -hex 32` |
| `ADMIN_EMAIL` | Sim | E-mail do Administrador Master | `admin@3facil.com` |
| `ADMIN_PASSWORD` | Sim | Senha do Administrador Master (hasheada com Bcrypt no startup) | `SuaSenhaForteAqui123!` |
| `DATABASE_URL` | Recomendado | Conexão PostgreSQL | `postgresql://user:pass@localhost:5432/3facil_db` |
| `ENABLE_SELF_UPDATE` | Não | Habilita auto-atualização remota via API | `false` |
| `SEED_DEMO` | Não | Semeia dados demo (deve ser `false` em produção) | `false` |

> ⚠️ **IMPORTANTE:** O servidor recusará a inicialização se `JWT_SECRET` for menor que 32 caracteres.

---

## 🐳 Método 1: Deploy com Docker e Docker Compose (Recomendado)

O script `deploy-docker.sh` automatiza o ciclo completo de build e deploy:
- Valida a presença do Docker e Docker Compose.
- Valida o arquivo `.env` e gera chaves seguras se não existirem.
- Monta volumes persistentes para uploads e dados locais.
- Constrói e sobe os containers com healthcheck automático.

```bash
cd /var/www/3facil

# 1. Dar permissão de execução
chmod +x deploy-docker.sh

# 2. Executar o deploy automatizado
./deploy-docker.sh

# Opções extras:
# ./deploy-docker.sh --pull       (Puxa as novidades do Git antes de compilar)
# ./deploy-docker.sh --no-cache   (Força o rebuild completo do Docker sem cache)
# ./deploy-docker.sh --logs       (Mostra os logs do container após o deploy)
```

---

## ⚡ Método 2: Instalação Automatizada no Host (PM2 + Nginx)

1. Conecte ao seu servidor via SSH:
   ```bash
   ssh root@ip-do-seu-servidor
   ```

2. Clone o repositório na pasta `/var/www/3facil`:
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO> /var/www/3facil
   cd /var/www/3facil
   ```

3. Dê permissão e execute o script de instalação:
   ```bash
   chmod +x setup-server.sh
   sudo bash setup-server.sh
   ```

4. O instalador configurará automaticamente Node.js 20, Nginx como proxy reverso, PM2, Firewall e certificado SSL Let's Encrypt gratuito.

---

## 💾 Comandos Úteis de Manutenção e Migração

```bash
# Executar a suíte de testes
npm test

# Semear o banco de dados PostgreSQL com dados padrão
npm run db:seed

# Migrar dados do armazenamento local em disco (JSON) para o PostgreSQL
npm run db:migrate-from-disk

# Verificar status do processo no PM2
pm2 status
pm2 logs 3facil
```

---

## 📧 E-mail com Postfix + Resend (Solução Definitiva para VPS)

Em provedores como **Oracle Cloud** e **AWS**, a **porta 25 de saída para a internet é bloqueada por padrão**. Para contornar essa restrição mantendo máxima confiabilidade e entregabilidade sem cair em spam, utilizamos uma arquitetura em 2 etapas:

```
┌─────────────────────────────────┐           ┌─────────────────────────────┐           ┌──────────────────────┐
│  Container Docker (3Fácil App)  │ ──porta ──▶│  Postfix Local no HOST      │ ──porta ──▶│  Resend SMTP Relay   │ ──▶ Destinatário
│  SMTP_HOST=host.docker.internal │    25     │  myhostname=mail.3facil.com │    587    │  [smtp.resend.com]   │     (Inbox)
│  (Sem autenticação local)       │           │  (Autenticação SASL TLS)    │    TLS    │  (SPF/DKIM 100%)     │
└─────────────────────────────────┘           └─────────────────────────────┘           └──────────────────────┘
```

1. A aplicação no container se conecta ao Postfix do host via `host.docker.internal:25` (porta local permitida pela rede Docker `172.16.0.0/12`).
2. O Postfix do host autentica no Resend pela **porta 587 (TLS com STARTTLS)**, retransmitindo os e-mails com SPF, DKIM e DMARC alinhados.
3. Se a rede oscilar, o Postfix armazena na fila local e faz novas tentativas automáticas (exponential backoff).

---

### 🌐 1. Pré-requisitos DNS no Cloudflare

No painel do Cloudflare (ou provedor DNS do domínio `3facil.com`), configure os seguintes registros:

| Tipo | Nome | Conteúdo / Destino | TTL / Proxy | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| **TXT** | `@` | `v=spf1 include:resend.com ~all` | Auto (DNS Only) | Autoriza o Resend a enviar pelo domínio |
| **CNAME** / **TXT** | `resend._domainkey` | *(Chave DKIM fornecida em resend.com/domains)* | Auto (DNS Only) | Assinatura criptográfica anti-spoofing |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@3facil.com; pct=100; adkim=r; aspf=r` | Auto (DNS Only) | Política DMARC de entregabilidade |
| **MX** | `feedback` | `feedback-smtp.resend.com` (Prioridade `10`) | Auto (DNS Only) | Tratamento de bounces e reclamações |

---

### 🚀 2. Passo a Passo de Execução dos Scripts

Conecte-se via SSH ao host VPS e execute:

```bash
cd /var/www/3facil # ou diretório onde o projeto está clonado

# 1. Configurar o Postfix do host como relay autenticado no Resend:
sudo RESEND_API_KEY="re_sua_chave_real_aqui" bash scripts/setup-postfix-relay.sh seuemail@gmail.com

# 2. Ajustar as variáveis de ambiente do .env para usar o relay:
bash scripts/setup-env-email.sh

# 3. Recriar os containers Docker para ler as novas variáveis:
docker compose down && docker compose up -d
```

---

### 🧪 3. Como Testar e Validar

1. **Pelo Painel Master (Interface Web):**
   - Acesse o Painel Master na aba **"Envio de E-mails & SMTP"**.
   - Clique em **"Diagnóstico do Postfix"**: o sistema executa em tempo real o teste de socket TCP, handshake SMTP e captura o `Queue ID` retornado pelo Postfix (ex: `250 2.0.0 Ok: queued as 4Zb7rQ48zGz1f4k`).
   - Informe seu e-mail no campo "Disparar E-mail de Teste" e clique em **"Diagnóstico Completo"**.

2. **Pela Linha de Comando no Host (SSH):**
   ```bash
   # Teste manual direto no Postfix do host
   echo "Teste de entrega via Postfix" | mail -s "Teste 3Fácil" seuemail@gmail.com -a "From: contato@3facil.com"

   # Acompanhar a entrega em tempo real
   tail -f /var/log/mail.log
   ```

---

### 🛠️ 4. Tabela de Troubleshooting (Resolução de Erros Comuns)

| Erro Observado | Causa Raiz | Solução Definitiva |
| :--- | :--- | :--- |
| `ECONNREFUSED` em `host.docker.internal:25` | Postfix está parado no host ou firewall bloqueando o container. | Execute `systemctl restart postfix` e libere a subnet Docker: `iptables -I INPUT 1 -p tcp -s 172.16.0.0/12 --dport 25 -j ACCEPT`. |
| `535 5.7.8 Error: authentication not enabled` | A aplicação tentou autenticar SASL com o Postfix local na porta 25 (ele só aceita relay confiado sem auth). | Mantenha `SMTP_USER` e `SMTP_PASS` vazios. O `emailService.ts` remove o bloco de auth automaticamente para hosts locais na porta 25. |
| `ETIMEDOUT` ao conectar no SMTP | Tentativa de conexão direta na porta 25 externa para servidores remotos (bloqueada pela VPS). | Verifique se `SMTP_HOST=host.docker.internal` e porta `25`. O Postfix do host cuidará de sair pela porta `587`. |
| `550 / 553 Domain not authorized` | O domínio do remetente (`SMTP_FROM`) não foi validado no Resend. | Adicione e valide os registros DNS do domínio em `resend.com/domains`. Para testes imediatos, use `onboarding@resend.dev`. |
| `queued as XXXXX` | E-mail aceito pelo Postfix local e despachado para a fila. | Comportamento esperado de sucesso! O Postfix entregará em milissegundos ao Resend. |
| Variáveis no `.env` sendo sobrescritas | Modificações manuais de `.env` de dentro do container. | O app grava preferências em `database_storage/smtp_config.json` e lê do `.env` do host sem sobrescrever o arquivo do servidor. |

