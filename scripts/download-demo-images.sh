#!/bin/bash
# =============================================================================
# Baixa as imagens de demonstração (banners, logos, fotos de anúncios de
# exemplo) direto do Unsplash e salva localmente em ./uploads/demo/.
#
# Por que isso existe: essas imagens ficavam "hotlinked" direto do domínio
# images.unsplash.com. Em redes corporativas que bloqueiam domínios externos
# de imagem (comum em empresas com firewall restritivo), essas fotos não
# carregavam. Hospedando localmente, elas passam a vir do próprio domínio do
# site, resolvendo esse bloqueio.
#
# Como usar: rode este script UMA VEZ no servidor (fora do Docker), na pasta
# do projeto (~/3facil). Ele salva os arquivos em ./uploads/demo/, pasta que
# já é montada como volume dentro do container (docker-compose.yml), então
# não precisa reconstruir a imagem depois — um `docker compose restart app`
# (ou o próximo deploy) já é suficiente.
#
#   cd ~/3facil
#   chmod +x scripts/download-demo-images.sh
#   ./scripts/download-demo-images.sh
# =============================================================================

set -e

DEST_DIR="$(dirname "$0")/../uploads/demo"
mkdir -p "$DEST_DIR"

echo "Baixando imagens de demonstração para $DEST_DIR ..."

IDS=(
  "photo-1454165804606-c3d57bc86b40"
  "photo-1460925895917-afdab827c52f"
  "photo-1484704849700-f032a568e944"
  "photo-1486406146926-c627a92ad1ab"
  "photo-1500648767791-00dcc994a43e"
  "photo-1502672260266-1c1ef2d93688"
  "photo-1502877338535-766e1452684a"
  "photo-1503376780353-7e6692767b70"
  "photo-1505740420928-5e560c06d30e"
  "photo-1507003211169-0a1dd7228f2d"
  "photo-1507525428034-b723cf961d3e"
  "photo-1512917774080-9991f1c4c750"
  "photo-1513694203232-719a280e022f"
  "photo-1526738549149-8e07eca6c147"
  "photo-1527443224154-c4a3942d3acf"
  "photo-1533473359331-0135ef1b58bf"
  "photo-1534528741775-53994a69daeb"
  "photo-1545324418-cc1a3fa10c00"
  "photo-1549399542-7e3f8b79c341"
  "photo-1550745165-9bc0b252726f"
  "photo-1555215695-3004980ad54e"
  "photo-1560518883-ce09059eeffa"
  "photo-1573496359142-b8d87734a5a2"
  "photo-1580273916550-e323be2ae537"
  "photo-1580587771525-78b9dba3b914"
  "photo-1587829741301-dc798b83add3"
  "photo-1590362891988-f778047020a6"
  "photo-1600566753376-12c8ab7fb75b"
  "photo-1600585154340-be6161a56a0c"
  "photo-1600585154526-990dced4db0d"
  "photo-1600596542815-ffad4c1539a9"
  "photo-1600607687939-ce8a6c25118c"
  "photo-1613490493576-7fde63acd811"
  "photo-1618221195710-dd6b41faaea6"
  "photo-1621007947382-bb3c3994e3fb"
)

OK_COUNT=0
FAIL_COUNT=0

for ID in "${IDS[@]}"; do
  OUT_FILE="$DEST_DIR/$ID.jpg"
  if [ -f "$OUT_FILE" ]; then
    echo "  já existe: $ID.jpg (pulando)"
    OK_COUNT=$((OK_COUNT + 1))
    continue
  fi
  URL="https://images.unsplash.com/$ID?w=1200&auto=format&fit=crop&q=80"
  if curl -fsSL "$URL" -o "$OUT_FILE" --max-time 20; then
    echo "  ok: $ID.jpg"
    OK_COUNT=$((OK_COUNT + 1))
  else
    echo "  FALHOU: $ID (verifique sua conexão com a internet)"
    rm -f "$OUT_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "Concluído: $OK_COUNT imagens prontas, $FAIL_COUNT falharam."
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Rode o script de novo para tentar novamente as que falharam (as que já baixaram são puladas)."
fi
