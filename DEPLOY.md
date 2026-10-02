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
