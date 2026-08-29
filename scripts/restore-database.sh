#!/bin/bash
# =============================================================================
# Restaura o PostgreSQL do 3fácil.com a partir de um arquivo de backup gerado
# por scripts/backup-database.sh.
#
# ⚠️ ATENÇÃO: Isso SUBSTITUI os dados atuais do banco pelos dados do backup.
# Use isso apenas para recuperação de desastre ou para restaurar um estado
# anterior conhecido.
#
# Como usar:
#   cd ~/3facil
#   chmod +x scripts/restore-database.sh
#   ./scripts/restore-database.sh backups/3facil_backup_2026-08-29_03-00-00.sql.gz
#
# Para listar os backups disponíveis:
#   ls -lh backups/
# =============================================================================

set -e

cd "$(dirname "$0")/.."

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: ./scripts/restore-database.sh caminho/do/backup.sql.gz"
  echo ""
  echo "Backups disponíveis:"
  ls -lh backups/*.sql.gz 2>/dev/null || echo "  (nenhum backup encontrado em ./backups)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERRO: Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERRO: arquivo .env não encontrado. Rode este script na pasta ~/3facil."
  exit 1
fi

DB_USER=$(grep -E '^DB_USER=' .env | cut -d '=' -f2-)
DB_NAME=$(grep -E '^DB_NAME=' .env | cut -d '=' -f2-)

echo "⚠️  Isso vai APAGAR e SUBSTITUIR todos os dados atuais do banco '$DB_NAME'"
echo "    pelo conteúdo do backup: $BACKUP_FILE"
echo ""
read -p "Tem certeza que deseja continuar? Digite 'sim' para confirmar: " CONFIRM

if [ "$CONFIRM" != "sim" ]; then
  echo "Operação cancelada."
  exit 0
fi

echo "Restaurando backup..."

gunzip -c "$BACKUP_FILE" | docker exec -i 3facil_postgres psql -U "$DB_USER" -d "$DB_NAME"

echo "✓ Restauração concluída. Reinicie a aplicação para garantir que ela recarregue os dados:"
echo "  docker compose restart app"
