#!/bin/bash
# =============================================================================
# Backup automático do PostgreSQL do 3fácil.com
#
# O que faz:
#   1. Gera um dump completo do banco (dados + estrutura) via pg_dump,
#      rodando dentro do próprio container do Postgres (não precisa de
#      cliente psql instalado no host).
#   2. Comprime o resultado (.sql.gz) e salva em ~/3facil/backups/.
#   3. Apaga automaticamente backups com mais de RETENTION_DAYS dias, para
#      não lotar o disco do servidor com o tempo.
#
# Como usar manualmente:
#   cd ~/3facil
#   chmod +x scripts/backup-database.sh
#   ./scripts/backup-database.sh
#
# Como automatizar (rodar todo dia de madrugada, sem precisar lembrar):
#   crontab -e
#   Adicione a linha (roda todo dia às 3h da manhã):
#   0 3 * * * cd /home/ubuntu/3facil && ./scripts/backup-database.sh >> /home/ubuntu/3facil/backups/backup.log 2>&1
# =============================================================================

set -e

cd "$(dirname "$0")/.."

RETENTION_DAYS=14
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Lê as credenciais do banco a partir do .env (sem expor no terminal)
if [ ! -f .env ]; then
  echo "[Backup] ERRO: arquivo .env não encontrado. Rode este script na pasta ~/3facil."
  exit 1
fi

DB_USER=$(grep -E '^DB_USER=' .env | cut -d '=' -f2-)
DB_NAME=$(grep -E '^DB_NAME=' .env | cut -d '=' -f2-)

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  echo "[Backup] ERRO: DB_USER ou DB_NAME não encontrados no .env."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/3facil_backup_${TIMESTAMP}.sql.gz"

echo "[Backup] $(date): Iniciando backup do banco '$DB_NAME'..."

if docker exec 3facil_postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[Backup] $(date): Backup concluído com sucesso: $BACKUP_FILE ($SIZE)"
else
  echo "[Backup] $(date): FALHA ao gerar o backup. Verifique se o container 3facil_postgres está rodando."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Remove backups mais antigos que RETENTION_DAYS dias
DELETED=$(find "$BACKUP_DIR" -name "3facil_backup_*.sql.gz" -mtime +$RETENTION_DAYS -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[Backup] $(date): $DELETED backup(s) antigo(s) removido(s) (mais de $RETENTION_DAYS dias)."
fi

TOTAL=$(find "$BACKUP_DIR" -name "3facil_backup_*.sql.gz" | wc -l)
echo "[Backup] $(date): Total de backups mantidos: $TOTAL"
