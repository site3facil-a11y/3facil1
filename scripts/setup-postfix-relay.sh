#!/usr/bin/env bash
# ==============================================================================
# 3Fácil SaaS - Configuração Idempotente do Relay Postfix Local -> Resend
# ==============================================================================
# Este script roda no HOST (VPS Ubuntu/Debian) e configura o Postfix local para:
# 1. Escutar na porta 25 aberta para o container Docker (rede 172.16.0.0/12 e loopback).
# 2. Receber e-mails sem autenticação SASL local das lojas/container.
# 3. Retransmitir os e-mails com segurança TLS e autenticação SASL para [smtp.resend.com]:587.
#
# Uso:
#   RESEND_API_KEY="re_sua_chave_aqui" sudo bash scripts/setup-postfix-relay.sh [email_de_teste]
# ==============================================================================

set -euo pipefail

# 1. Verificação de Permissões de Root
if [ "$(id -u)" -ne 0 ]; then
  echo "❌ ERRO: Este script deve ser executado como root ou com sudo." >&2
  exit 1
fi

# 2. Validação da Chave da API do Resend (obrigatória)
RESEND_API_KEY="${RESEND_API_KEY:-}"
TEST_RECIPIENT="${1:-site3facil@gmail.com}"

if [ -z "$RESEND_API_KEY" ]; then
  # Tenta ler do arquivo .env local se existir
  if [ -f ".env" ]; then
    ENV_KEY=$(grep -E '^RESEND_API_KEY=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || true)
    if [ -n "$ENV_KEY" ]; then
      RESEND_API_KEY="$ENV_KEY"
      echo "ℹ️ Chave RESEND_API_KEY obtida do arquivo .env."
    fi
  fi
fi

if [ -z "$RESEND_API_KEY" ]; then
  echo "❌ ERRO CRÍTICO: RESEND_API_KEY não foi informada!" >&2
  echo "Defina a variável antes de rodar o script. Exemplo:" >&2
  echo "  sudo RESEND_API_KEY=\"re_123456789...\" bash scripts/setup-postfix-relay.sh" >&2
  exit 1
fi

# Mascarar a chave para não vazar em logs
KEY_PREFIX="${RESEND_API_KEY:0:5}"
KEY_SUFFIX="${RESEND_API_KEY: -4}"
echo "================================================================================"
echo "🚀 Iniciando configuração do Postfix Relay para 3Fácil (Host)"
echo "🔑 Chave Resend API identificada: ${KEY_PREFIX}••••••••${KEY_SUFFIX}"
echo "================================================================================"

# 3. Instalação de Pacotes Necessários (Postfix, SASL, Certificados)
echo "📦 Verificando dependências do sistema (postfix, libsasl2-modules, ca-certificates)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postfix libsasl2-modules bsd-mailx ca-certificates iptables > /dev/null

# 4. Configuração Idempotente do Postfix (/etc/postfix/main.cf)
echo "⚙️ Configurando /etc/postfix/main.cf com relay para [smtp.resend.com]:587..."

POSTFIX_CONFIG=(
  "myhostname = mail.3facil.com"
  "myorigin = 3facil.com"
  "mydestination = localhost.localdomain, localhost"
  "relayhost = [smtp.resend.com]:587"
  "smtp_sasl_auth_enable = yes"
  "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
  "smtp_sasl_security_options = noanonymous"
  "smtp_tls_security_level = encrypt"
  "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"
  "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128 172.16.0.0/12"
  "inet_interfaces = all"
  "inet_protocols = ipv4"
  "smtpd_banner = \$myhostname ESMTP 3Facil Relay"
)

# Atualiza ou adiciona cada chave no main.cf de forma idempotente
for entry in "${POSTFIX_CONFIG[@]}"; do
  key="${entry%% = *}"
  val="${entry#* = }"
  postconf -e "${key}=${val}"
done

# 5. Configuração Segura das Credenciais SASL (/etc/postfix/sasl_passwd)
echo "🔒 Gerando mapa de credenciais SASL para Resend..."
cat << EOF > /etc/postfix/sasl_passwd
[smtp.resend.com]:587 resend:${RESEND_API_KEY}
EOF

chmod 600 /etc/postfix/sasl_passwd
postmap /etc/postfix/sasl_passwd
if [ -f "/etc/postfix/sasl_passwd.db" ]; then
  chmod 600 /etc/postfix/sasl_passwd.db
fi

# 6. Liberação de Firewall no Host para a Rede Docker (172.16.0.0/12 -> Porta 25)
echo "🛡️ Configurando regras de firewall para porta 25 (apenas rede Docker e local)..."
if command -v iptables &> /dev/null; then
  # Evita duplicatas com -C
  if ! iptables -C INPUT -p tcp -s 172.16.0.0/12 --dport 25 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 1 -p tcp -s 172.16.0.0/12 --dport 25 -j ACCEPT
    echo "  ✓ Regra iptables inserida para subnet 172.16.0.0/12 na porta 25"
  else
    echo "  ✓ Regra iptables já existe para subnet 172.16.0.0/12 na porta 25"
  fi
fi

if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
  ufw allow from 172.16.0.0/12 to any port 25 proto tcp comment 'Postfix relay Docker' > /dev/null 2>&1 || true
  echo "  ✓ Regra UFW autorizada para rede Docker"
fi

# 7. Reinício do Serviço Postfix
echo "🔄 Reiniciando serviço Postfix..."
systemctl restart postfix
systemctl enable postfix > /dev/null 2>&1 || true

# 8. Teste de Conexão Local e Envio de E-mail de Teste
echo "🧪 Realizando teste de disparo via Postfix local para: ${TEST_RECIPIENT}..."
SEND_OUTPUT=$(
  sendmail -f "contato@3facil.com" "$TEST_RECIPIENT" << EOF || true
From: "3Fácil Relay Test" <contato@3facil.com>
To: $TEST_RECIPIENT
Subject: Teste de Relay Postfix + Resend (3facil.com)
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

Este e-mail confirma que o Postfix local no host está configurado e integrado
com sucesso ao Resend por meio da porta 587 TLS.
Data: $(date -R)
EOF
)

sleep 2

# 9. Verificação dos Logs do Postfix sem expor a chave
echo "📋 Verificando status nos logs do mail.log / journalctl..."
LOG_SNIPPET=""
if [ -f "/var/log/mail.log" ]; then
  LOG_SNIPPET=$(grep -E 'smtp.resend.com|queued as|status=' /var/log/mail.log | tail -n 5 || true)
elif command -v journalctl &> /dev/null; then
  LOG_SNIPPET=$(journalctl -u postfix -n 15 --no-pager | grep -E 'smtp.resend.com|queued as|status=' | tail -n 5 || true)
fi

if echo "$LOG_SNIPPET" | grep -q "status=sent"; then
  echo "✅ SUCESSO COMPLETO! E-mail entregue com status=sent pelo Resend."
elif echo "$LOG_SNIPPET" | grep -q "queued as"; then
  echo "✅ E-mail aceito pelo Postfix local e enfileirado para entrega."
else
  echo "ℹ️ Últimos registros do Postfix:"
  echo "$LOG_SNIPPET"
fi

echo "================================================================================"
echo "🎉 Postfix configurado e pronto para atender os containers via host.docker.internal:25"
echo "================================================================================"
