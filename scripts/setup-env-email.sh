#!/usr/bin/env bash
# ==============================================================================
# 3Fácil SaaS - Ajuste do .env do Host para Relay Postfix
# ==============================================================================
# Este script:
# 1. Cria backup timestamped do arquivo .env atual.
# 2. Move database_storage/smtp_config.json para backup (evita conflitos).
# 3. Define EMAIL_PROVIDER=smtp e SMTP_HOST=host.docker.internal (porta 25, sem auth).
# ==============================================================================

set -euo pipefail

ENV_FILE=".env"
DATA_DIR="database_storage"
SMTP_JSON="${DATA_DIR}/smtp_config.json"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "================================================================================"
echo "🔧 Configurando variáveis de ambiente do .env para Postfix Local (Porta 25)"
echo "================================================================================"

# 1. Backup do arquivo .env
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.backup_${TIMESTAMP}"
  echo "✓ Backup criado: ${ENV_FILE}.backup_${TIMESTAMP}"
else
  touch "$ENV_FILE"
  echo "✓ Arquivo .env criado."
fi

# 2. Deslocamento do arquivo smtp_config.json se existir
if [ -f "$SMTP_JSON" ]; then
  mv "$SMTP_JSON" "${SMTP_JSON}.backup_${TIMESTAMP}"
  echo "✓ Arquivo ${SMTP_JSON} movido para ${SMTP_JSON}.backup_${TIMESTAMP} para evitar conflitos."
fi

# 3. Atualização Idempotente das Chaves de E-mail no .env
update_or_add_env() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # Substitui
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    # Adiciona
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

echo "📝 Aplicando configurações definitivas de SMTP local..."
update_or_add_env "EMAIL_PROVIDER" "smtp"
update_or_add_env "SMTP_HOST" "host.docker.internal"
update_or_add_env "SMTP_PORT" "25"
update_or_add_env "SMTP_SECURE" "false"
update_or_add_env "SMTP_USER" ""
update_or_add_env "SMTP_PASS" ""
update_or_add_env "SMTP_FROM" '"3Fácil Plataforma" <contato@3facil.com>'
update_or_add_env "SMTP_REPLY_TO" 'contato@3facil.com'
update_or_add_env "EMAIL_ALLOWED_FROM_DOMAINS" "3facil.com,mail.3facil.com"

echo ""
echo "✅ Configuração aplicada com sucesso no .env:"
grep -E '^(EMAIL_PROVIDER|SMTP_|EMAIL_ALLOWED)' "$ENV_FILE" || true
echo ""
echo "================================================================================"
echo "Próximo passo recomendado:"
echo "  docker compose down && docker compose up -d"
echo "  (ou: pm2 restart 3facil)"
echo "================================================================================"
