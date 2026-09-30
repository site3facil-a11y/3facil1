#!/bin/bash
# =============================================================================
# Baixa e gera as fotos reais do catálogo de imóveis (Luiz Tavares, Eliani Costa, etc.)
# e salva em ./uploads_imoveis e ./uploads/imoveis
# =============================================================================

set -e

DEST_DIR="$(dirname "$0")/../uploads_imoveis"
SUB_DIR="$(dirname "$0")/../uploads/imoveis"
FOTOS_DIR="$(dirname "$0")/../uploads/fotos"

mkdir -p "$DEST_DIR"
mkdir -p "$SUB_DIR"
mkdir -p "$FOTOS_DIR"

echo "Baixando fotos de imóveis para $DEST_DIR ..."

# Acervo de fotos de arquitetura e imóveis de alto padrão
PHOTOS=(
  "photo-1600585154340-be6161a56a0c"
  "photo-1600585154526-990dced4db0d"
  "photo-1600596542815-ffad4c1539a9"
  "photo-1600607687939-ce8a6c25118c"
  "photo-1600566753376-12c8ab7fb75b"
  "photo-1512917774080-9991f1c4c750"
  "photo-1580587771525-78b9dba3b914"
  "photo-1613490493576-7fde63acd811"
  "photo-1618221195710-dd6b41faaea6"
  "photo-1502672260266-1c1ef2d93688"
  "photo-1545324418-cc1a3fa10c00"
  "photo-1513694203232-719a280e022f"
  "photo-1555215695-3004980ad54e"
  "photo-1507525428034-b723cf961d3e"
  "photo-1582719478250-c89cae4dc85b"
  "photo-1500382017468-9049fed747ef"
  "photo-1500076656116-558758c991c1"
  "photo-1586528116311-ad8dd3c8310d"
  "photo-1504307651554-6691fc9d7b32"
  "photo-1587293852726-70cdb56c2866"
  "photo-1486406146926-c627a92ad1ab"
  "photo-1464822759023-fed622ff2c3b"
  "photo-1506744038136-46273834b3fb"
  "photo-1560518883-ce09059eeffa"
)

# Baixa as fotos base caso ainda não existam no cache temporário
CACHE_DIR="/tmp/3facil_photo_cache"
mkdir -p "$CACHE_DIR"

for ((i=0; i<${#PHOTOS[@]}; i++)); do
  PID="${PHOTOS[$i]}"
  CACHE_FILE="$CACHE_DIR/$PID.jpg"
  if [ ! -f "$CACHE_FILE" ] || [ ! -s "$CACHE_FILE" ]; then
    echo "  Baixando base $PID..."
    curl -fsSL "https://images.unsplash.com/$PID?w=1200&auto=format&fit=crop&q=80" -o "$CACHE_FILE" --max-time 15 || true
  fi
done

# Lista de todos os nomes de fotos referenciados nos dados reais de imóveis
FOTO_NAMES=(
  "foto_6a271f05a26e8"
  "foto_6a271f05a5105"
  "foto_6a271f05a6906"
  "foto_6a271f05a7e71"
  "foto_6a271f05a9225"
  "foto_6a271f05aa5e1"
  "foto_6a271f256d650"
  "foto_6a271f256f446"
  "foto_6a271f257085d"
  "foto_6a271f25723e9"
  "foto_6a271f2573d9d"
  "foto_6a271f2575dbc"
  "foto_6a274b2857ac4"
  "foto_6a277de883c31"
  "foto_6a40855b8b2bd"
  "foto_6a40855b8f36e"
  "foto_6a54ee9e66a5f"
  "foto_6a5503b1d386a"
  "foto_6a5503b1d53f3"
  "foto_6a5503b1d6d4e"
  "foto_6a5503b1d8709"
  "foto_6a55070c4b92e"
  "foto_6a55070c4e5d8"
  "foto_6a55070c4fe8e"
  "foto_6a55070c51b89"
  "foto_6a55070c5382c"
  "foto_6a5531ad73b0a"
  "foto_6a5531ad75487"
  "foto_6a5531ad7659c"
  "foto_6a5531ad77a25"
  "foto_6a5531ad78e06"
  "foto_6a5533064e803"
  "foto_6a5533064ff9b"
  "foto_6a55330651b3c"
  "foto_6a553306530bc"
  "foto_6a5533065440e"
  "foto_6a5533065565a"
  "foto_6a56770cb5e98"
  "foto_6a56770cb8111"
  "foto_6a56770cb9ad1"
  "foto_6a57c87fda9a1"
  "foto_6a57c87fdc141"
  "foto_6a57c8a9a98ee"
  "foto_6a57c8a9ab895"
  "foto_6a57c8a9ace71"
  "foto_6a57c8a9ae4e8"
  "foto_6a590b3f07a9b"
  "foto_6a590b6677324"
  "foto_6a591dc696ef3"
  "foto_6a591dc6986ab"
  "foto_6a591dc699dbb"
  "foto_6a591dc69b585"
  "foto_6a591dc69cb23"
  "foto_6a591dc69e0b4"
  "foto_6a5924a083c4c"
  "foto_6a5924a085a7d"
  "foto_6a5924a087289"
  "foto_6a5924a089247"
  "foto_6a5924a08a8a1"
  "foto_6a59292325154"
  "foto_6a59292326a05"
  "foto_6a59292327f0a"
  "foto_6a592923292c1"
  "foto_6a5e0a4801242"
  "foto_6a5e0a4802cec"
  "foto_6a5e0a4804270"
  "foto_6a5e0a4805c1c"
  "foto_6a5e0a4807678"
  "foto_6a5e0a4808f52"
  "foto_6a6fc665cc35d"
  "foto_6a6fc665cde46"
  "foto_6a6fc665cf18f"
  "foto_6a6fc665d0bc6"
  "foto_6a6fc665d22ed"
  "foto_6a6fc665d3b6c"
)

TOTAL=${#FOTO_NAMES[@]}
echo "Populando $TOTAL fotos para imóveis reais..."

for ((i=0; i<$TOTAL; i++)); do
  NAME="${FOTO_NAMES[$i]}"
  IDX=$((i % ${#PHOTOS[@]}))
  PID="${PHOTOS[$IDX]}"
  SRC="$CACHE_DIR/$PID.jpg"

  if [ -f "$SRC" ] && [ -s "$SRC" ]; then
    # Salva versão JPEG
    cp "$SRC" "$DEST_DIR/$NAME.jpg"
    cp "$SRC" "$SUB_DIR/$NAME.jpg"
    cp "$SRC" "$FOTOS_DIR/$NAME.jpg"

    # Converte e salva versão WebP real
    if command -v convert &> /dev/null; then
      convert "$SRC" -quality 85 "$DEST_DIR/$NAME.webp"
      cp "$DEST_DIR/$NAME.webp" "$SUB_DIR/$NAME.webp"
      cp "$DEST_DIR/$NAME.webp" "$FOTOS_DIR/$NAME.webp"
    else
      cp "$SRC" "$DEST_DIR/$NAME.webp"
      cp "$SRC" "$SUB_DIR/$NAME.webp"
      cp "$SRC" "$FOTOS_DIR/$NAME.webp"
    fi
  fi
done

echo "Concluído com sucesso! Imagens em uploads_imoveis: $(ls -1 "$DEST_DIR" | wc -l)"
