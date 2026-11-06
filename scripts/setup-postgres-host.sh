#!/usr/bin/env bash
# ==============================================================================
# 3Fácil - Script de Configuração Rápida do PostgreSQL no Host da VPS (Oracle/Ubuntu)
# Conecta o PostgreSQL nativo do servidor ao container Docker via host.docker.internal
# ==============================================================================

set -e

echo "========================================================"
echo " 🚀 3Fácil - Configurando PostgreSQL no Host da VPS"
echo "========================================================"

# 1. Verificar se é root/sudo
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute este script com sudo:"
  echo "   sudo bash scripts/setup-postgres-host.sh"
  exit 1
fi

# 2. Instalar PostgreSQL se ainda não estiver instalado
if ! command -v psql &> /dev/null; then
  echo "📦 Instalando PostgreSQL e extensões..."
  if command -v apt-get &> /dev/null; then
    apt-get update -y
    apt-get install -y postgresql postgresql-contrib
  elif command -v dnf &> /dev/null; then
    dnf install -y postgresql-server postgresql-contrib
    postgresql-setup --initdb || true
  else
    echo "❌ Gerenciador de pacotes não reconhecido. Instale o postgresql manualmente."
    exit 1
  fi
else
  echo "✓ PostgreSQL já está instalado."
fi

# 3. Iniciar e habilitar o serviço PostgreSQL
echo "⚙️ Garantindo que o serviço PostgreSQL esteja ativo..."
systemctl enable --now postgresql
systemctl start postgresql

# 4. Criar o Banco e Usuário da Aplicação
DB_NAME="3facil_db"
DB_USER="tresfacil_app_user"
DB_PASS="SuaSenhaSeguraAqui123!"

echo "🔑 Criando/Verificando banco de dados '${DB_NAME}' e usuário '${DB_USER}'..."
sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  ELSE
    ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER ${DB_USER} ENCODING 'UTF8';"

# 5. Executar o script SQL com schemas se existir
SQL_FILE="$(dirname "$0")/init_3facil_db.sql"
if [ -f "$SQL_FILE" ]; then
  echo "📄 Aplicando schemas e permissões via init_3facil_db.sql..."
  sudo -u postgres psql -d "${DB_NAME}" -f "$SQL_FILE" > /dev/null 2>&1 || true
fi

# 6. Localizar arquivos postgresql.conf e pg_hba.conf
PG_CONF=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW config_file;")
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;")

echo "📝 Configurando ${PG_CONF}..."
# Habilitar escuta em todas as interfaces para aceitar conexões vindas da bridge Docker
sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" "$PG_CONF"

echo "📝 Configurando ${PG_HBA}..."
# Adicionar liberação da rede Docker (172.16.0.0/12) se ainda não existir
if ! grep -q "172.16.0.0/12" "$PG_HBA"; then
  cat << 'EOF' >> "$PG_HBA"

# 3Facil - Liberar acesso para containers Docker (bridge)
host    all             all             172.16.0.0/12           md5
host    all             all             172.17.0.0/16           md5
host    all             all             127.0.0.1/32            md5
EOF
fi

# 7. Reiniciar PostgreSQL para aplicar configurações de rede
echo "🔄 Reiniciando o PostgreSQL..."
systemctl restart postgresql

# 8. Testar autenticação localmente
echo "🧪 Testando autenticação com ${DB_USER}..."
PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 'Conexão PostgreSQL bem-sucedida!' as status;"

echo ""
echo "========================================================"
echo "✅ PostgreSQL configurado com sucesso no host da VPS!"
echo "========================================================"
echo "Configurações ativas:"
echo " - Banco: ${DB_NAME}"
echo " - Usuário: ${DB_USER}"
echo " - Senha: ${DB_PASS}"
echo " - Host a partir do Docker: host.docker.internal:5432"
echo ""
echo "Próximo passo na VPS:"
echo "1. No seu .env da VPS, garanta que as variáveis estejam:"
echo "   DB_HOST=host.docker.internal"
echo "   DB_PORT=5432"
echo "   DB_USER=${DB_USER}"
echo "   DB_PASSWORD=${DB_PASS}"
echo "   DB_NAME=${DB_NAME}"
echo ""
echo "2. Recrie o container da aplicação:"
echo "   docker compose down && docker compose up -d"
echo "========================================================"
