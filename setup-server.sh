#!/bin/bash
# ==============================================================================
# Script de Instalação e Deploy Automatizado - 3Fácil SaaS
# Sistema Operacional Recomendado: Ubuntu 22.04 LTS / 24.04 LTS ou Debian 12
# ==============================================================================

set -e

# Cores para saída no terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   Instalador Automatizado de Infraestrutura       ${NC}"
echo -e "${BLUE}               3Fácil SaaS                         ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Verificar permissão de root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, execute este script como root ou com sudo:${NC}"
  echo "sudo bash setup-server.sh"
  exit 1
fi

# Solicitar Domínio do Usuário
echo ""
echo -e "${YELLOW}>> Configuração do Domínio:${NC}"
read -p "Digite o seu domínio ou subdomínio (ex: 3facil.com.br ou app.meusite.com): " USER_DOMAIN

if [ -z "$USER_DOMAIN" ]; then
  USER_DOMAIN="localhost"
  echo -e "${YELLOW}Nenhum domínio informado. Configurando como localhost.${NC}"
fi

read -p "Digite seu e-mail para o certificado SSL Let's Encrypt (opcional, Enter para pular): " USER_EMAIL

# 1. Atualização do Sistema
echo ""
echo -e "${GREEN}[1/6] Atualizando pacotes do sistema operacional...${NC}"
apt update -y && apt upgrade -y
apt install -y curl wget git ufw nginx certbot python3-certbot-nginx build-essential openssl

# 2. Instalação do Node.js 20 LTS e NPM
echo ""
echo -e "${GREEN}[2/6] Instalando Node.js v20 LTS...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo -e "Node.js versão: $(node -v)"
echo -e "NPM versão: $(npm -v)"

# 3. Preparação do Diretório da Aplicação
APP_DIR="/var/www/3facil"
echo ""
echo -e "${GREEN}[3/6] Configurando pasta da aplicação em ${APP_DIR}...${NC}"

mkdir -p $APP_DIR

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
  echo "Copiando arquivos da pasta atual ($CURRENT_DIR) para $APP_DIR..."
  cp -r "$CURRENT_DIR"/* $APP_DIR/
  cp -r "$CURRENT_DIR"/.* $APP_DIR/ 2>/dev/null || true
fi

cd $APP_DIR

# 4. Configuração Segura do Arquivo .env
if [ ! -f ".env" ]; then
  echo ""
  echo -e "${YELLOW}>> Configuração das Credenciais do Administrador Master:${NC}"
  read -p "Digite o e-mail do Super Admin: " INPUT_ADMIN_EMAIL
  read -s -p "Digite a senha do Super Admin (mínimo 8 caracteres): " INPUT_ADMIN_PASS
  echo ""

  INPUT_ADMIN_EMAIL=${INPUT_ADMIN_EMAIL:-admin@3facil.com}
  INPUT_ADMIN_PASS=${INPUT_ADMIN_PASS:-AdminMudeEstaSenha2026!}
  GENERATED_SECRET=$(openssl rand -hex 32)

  cat <<EOF > .env
NODE_ENV=production
PORT=3000
APP_URL=https://${USER_DOMAIN}
ALLOWED_ORIGINS=https://${USER_DOMAIN}
JWT_SECRET=${GENERATED_SECRET}
ADMIN_EMAIL=${INPUT_ADMIN_EMAIL}
ADMIN_PASSWORD=${INPUT_ADMIN_PASS}
ENABLE_SELF_UPDATE=false
SEED_DEMO=false
EOF
  chmod 600 .env
  echo -e "${GREEN}✓ Arquivo .env gerado com chaves criptográficas seguras.${NC}"
fi

# 5. Instalação de Dependências e Compilação
echo ""
echo -e "${GREEN}[4/6] Instalando dependências e compilando o projeto...${NC}"
npm install
npm run build

# PM2
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

pm2 delete 3facil 2>/dev/null || true
pm2 start npm --name "3facil" -- run start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 6. Configuração do Servidor Web Nginx como Proxy Reverso
echo ""
echo -e "${GREEN}[5/6] Configurando o Nginx como Proxy Reverso...${NC}"

NGINX_CONF="/etc/nginx/sites-available/3facil"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $USER_DOMAIN www.$USER_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
EOF

ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Firewall e Certificado SSL
echo ""
echo -e "${GREEN}[6/6] Configurando Firewall e Certificado SSL...${NC}"

ufw allow 'Nginx Full' 2>/dev/null || true
ufw allow 'OpenSSH' 2>/dev/null || true

if [ "$USER_DOMAIN" != "localhost" ] && [ -n "$USER_EMAIL" ]; then
  certbot --nginx -d $USER_DOMAIN --non-interactive --agree-tos -m $USER_EMAIL --redirect || true
fi

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}   Instalação concluída com sucesso! 🎉            ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Aplicação online em: ${BLUE}http://$USER_DOMAIN${NC}"
