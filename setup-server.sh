#!/bin/bash
# ==============================================================================
# Script de Instalação e Deploy Automatizado - VitrineHub SaaS
# Sistema Operacional Recomendado: Ubuntu 22.04 LTS / 24.04 LTS ou Debian 12
# ==============================================================================

set -e

# Cores para saída no terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sem Cor

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   Instalador Automatizado de Infraestrutura       ${NC}"
echo -e "${BLUE}              VitrineHub SaaS                      ${NC}"
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
read -p "Digite o seu domínio ou subdomínio (ex: vitrinehub.com.br ou app.meusite.com): " USER_DOMAIN

if [ -z "$USER_DOMAIN" ]; then
  USER_DOMAIN="localhost"
  echo -e "${YELLOW}Nenhum domínio informado. Configurando como localhost.${NC}"
fi

read -p "Digite seu e-mail para o certificado SSL Let's Encrypt (opcional, pressione Enter para pular): " USER_EMAIL

# 1. Atualização do Sistema
echo ""
echo -e "${GREEN}[1/6] Atualizando pacotes do sistema operacional...${NC}"
apt update -y && apt upgrade -y
apt install -y curl wget git ufw nginx certbot python3-certbot-nginx build-essential

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
APP_DIR="/var/www/vitrinehub"
echo ""
echo -e "${GREEN}[3/6] Configurando pasta da aplicação em ${APP_DIR}...${NC}"

mkdir -p $APP_DIR

# Se o script estiver sendo executado dentro do repositório clonado, copia os arquivos
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
  echo "Copiando arquivos da pasta atual ($CURRENT_DIR) para $APP_DIR..."
  cp -r "$CURRENT_DIR"/* $APP_DIR/
  cp -r "$CURRENT_DIR"/.* $APP_DIR/ 2>/dev/null || true
fi

cd $APP_DIR

# 4. Instalação de Dependências e Compilação do Backend e Frontend
echo ""
echo -e "${GREEN}[4/6] Instalando dependências e compilando o projeto...${NC}"
npm install
npm run build

# Instalar PM2 para manter o backend Node.js ativo e resiliente
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# Iniciar / Reiniciar serviço Node.js com PM2
pm2 delete vitrinehub 2>/dev/null || true
pm2 start npm --name "vitrinehub" -- run start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 5. Configuração do Servidor Web Nginx como Proxy Reverso
echo ""
echo -e "${GREEN}[5/6] Configurando o Nginx como Proxy Reverso...${NC}"

NGINX_CONF="/etc/nginx/sites-available/vitrinehub"

cat > $NGINX_CONF <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $USER_DOMAIN www.$USER_DOMAIN;

    # Encaminhar requisições para o backend Node.js na porta 3000
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

    # Ativar compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Proteções básicas de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
EOF

# Ativar o site no Nginx
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
# Remover default do nginx se existir
rm -f /etc/nginx/sites-enabled/default

# Testar configuração e reiniciar Nginx
nginx -t
systemctl restart nginx

# 6. Configuração de Firewall e SSL HTTPS
echo ""
echo -e "${GREEN}[6/6] Configurando Firewall e Certificado SSL...${NC}"

ufw allow 'Nginx Full'
ufw allow 'OpenSSH'
ufw --force enable

# Se foi fornecido um domínio real (diferente de localhost) e e-mail, tentar emitir SSL
if [ "$USER_DOMAIN" != "localhost" ] && [ -n "$USER_EMAIL" ]; then
  echo ""
  echo -e "${YELLOW}Tentando emitir certificado SSL Let's Encrypt para $USER_DOMAIN...${NC}"
  certbot --nginx -d $USER_DOMAIN --non-interactive --agree-tos -m $USER_EMAIL --redirect || {
    echo -e "${YELLOW}Aviso: Não foi possível emitir o certificado SSL automaticamente.${NC}"
    echo "Verifique se o seu domínio ($USER_DOMAIN) já está apontando o DNS tipo A para o IP deste servidor."
  }
fi

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}   Instalação concluída com sucesso! 🎉            ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Aplicação hospedada em: ${BLUE}$APP_DIR/dist${NC}"
echo -e "Acesse pelo navegador em: ${BLUE}http://$USER_DOMAIN${NC}"
if [ -n "$USER_EMAIL" ]; then
  echo -e "Ou seguro em: ${BLUE}https://$USER_DOMAIN${NC}"
fi
echo ""
echo -e "Para atualizar o site no futuro com novas versões, execute:"
echo -e "  cd $APP_DIR && git pull && npm install && npm run build && systemctl restart nginx"
echo -e "${BLUE}====================================================${NC}"
