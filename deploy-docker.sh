#!/bin/bash
# ==============================================================================
# Script de Automação de Build e Deploy Docker - 3facil.com
# ==============================================================================
# Uso:
#   chmod +x deploy-docker.sh
#   ./deploy-docker.sh               # Executa o deploy com as variáveis do .env
#   ./deploy-docker.sh --pull        # Puxa atualizações do Git antes do build
#   ./deploy-docker.sh --no-cache    # Reconstrói a imagem Docker do zero sem cache
#   ./deploy-docker.sh --logs        # Exibe os logs do container após o deploy
# ==============================================================================

set -e

# Cores para mensagens no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # Sem Cor

echo -e "${CYAN}${BOLD}"
echo "================================================================"
echo "          🚀 3FACIL.COM - DEPLOY AUTOMATIZADO DOCKER            "
echo "================================================================"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Flags opcionais
PULL_GIT=false
NO_CACHE=false
SHOW_LOGS=false

for arg in "$@"; do
  case $arg in
    --pull|-p)
      PULL_GIT=true
      shift
      ;;
    --no-cache|-nc)
      NO_CACHE=true
      shift
      ;;
    --logs|-l)
      SHOW_LOGS=true
      shift
      ;;
    --help|-h)
      echo -e "${BOLD}Opções disponíveis:${NC}"
      echo "  --pull, -p        Puxa as atualizações mais recentes do Git (git pull)"
      echo "  --no-cache, -nc   Compila a imagem Docker sem utilizar o cache"
      echo "  --logs, -l        Exibe os logs do container em tempo real ao finalizar"
      echo "  --help, -h        Mostra esta mensagem de ajuda"
      exit 0
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 1. VERIFICAÇÃO DE PRÉ-REQUISITOS (DOCKER & DOCKER COMPOSE)
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ [1/6] Verificando Docker e Docker Compose...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Erro: O Docker não está instalado no servidor.${NC}"
  echo "Instale o Docker antes de continuar: https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

# Detecta a versão do Docker Compose (plugin 'docker compose' ou 'docker-compose')
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  echo -e "${RED}❌ Erro: Nem 'docker compose' nem 'docker-compose' foram encontrados.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Docker detectado: $(docker --version)${NC}"
echo -e "${GREEN}✓ Compose detectado: $($DOCKER_COMPOSE version)${NC}"

# ------------------------------------------------------------------------------
# 2. SINCRONIZAÇÃO COM GIT (OPCIONAL OU AUTOMÁTICA SE SOLICITADA)
# ------------------------------------------------------------------------------
if [ "$PULL_GIT" = true ]; then
  echo ""
  echo -e "${BLUE}▶ [2/6] Atualizando repositório Git...${NC}"
  if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    echo -e "${CYAN}Puxando alterações da branch '${CURRENT_BRANCH}'...${NC}"
    git pull origin "$CURRENT_BRANCH" || echo -e "${YELLOW}Aviso: Falha ao puxar git (verifique suas chaves SSH ou conexão). Continuando...${NC}"
  else
    echo -e "${YELLOW}Aviso: Diretório não é um repositório git inicializado. Pulando git pull.${NC}"
  fi
else
  echo ""
  echo -e "${BLUE}▶ [2/6] Verificação do código fonte concluída (skip pull).${NC}"
fi

# ------------------------------------------------------------------------------
# 3. VALIDAÇÃO E INJEÇÃO DAS VARIÁVEIS DE AMBIENTE (.env)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [3/6] Validando e configurando variáveis de ambiente (.env)...${NC}"

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️ Arquivo .env não encontrado. Criando a partir de .env.example...${NC}"
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    cat <<EOF > .env
APP_URL=https://3facil.com
PORT=3000
NODE_ENV=production
DATABASE_URL=
JWT_SECRET=$(head -c 32 /dev/urandom | base64 2>/dev/null || echo "3facil_secret_key_prod_2026")
EOF
  fi
  echo -e "${GREEN}✓ Arquivo .env criado com sucesso.${NC}"
fi

# Garante permissões adequadas no .env
chmod 600 .env

# Cria as pastas de persistência e uploads no host se não existirem
mkdir -p database_storage uploads_imoveis uploads
chmod -R 755 database_storage uploads_imoveis uploads

echo -e "${GREEN}✓ Variáveis de ambiente prontas para injeção no container.${NC}"

# ------------------------------------------------------------------------------
# 4. COMPILAÇÃO DA IMAGEM DOCKER
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [4/6] Construindo imagem Docker da aplicação...${NC}"

BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
  BUILD_ARGS="--no-cache"
  echo -e "${CYAN}Modo --no-cache ativado. Recompilando todas as camadas...${NC}"
fi

$DOCKER_COMPOSE build $BUILD_ARGS

echo -e "${GREEN}✓ Imagem Docker compilada com sucesso!${NC}"

# ------------------------------------------------------------------------------
# 5. SUBINDO / REINICIANDO OS CONTAINERS
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [5/6] Iniciando o container da aplicação com injeção do .env...${NC}"

# Executa o compose com injeção do .env
$DOCKER_COMPOSE up -d --remove-orphans

# ------------------------------------------------------------------------------
# 6. VERIFICAÇÃO DE SAÚDE (HEALTHCHECK) E CONCLUSÃO
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [6/6] Verificando saúde da aplicação (Healthcheck)...${NC}"

MAX_RETRIES=15
RETRY_COUNT=0
HEALTH_OK=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 2
  if curl -s -f http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -n "."
done
echo ""

if [ "$HEALTH_OK" = true ]; then
  echo -e "${GREEN}${BOLD}🎉 DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
  echo -e "${GREEN}✓ Backend e Frontend rodando na porta 3000${NC}"
  echo -e "${GREEN}✓ Persistência conectada em ./database_storage${NC}"
else
  echo -e "${YELLOW}⚠️ O container está subindo ou a porta 3000 ainda está inicializando.${NC}"
fi

# Limpeza opcional de imagens antigas sem tag (dangling)
echo ""
echo -e "${CYAN}Limpando imagens antigas não utilizadas...${NC}"
docker image prune -f > /dev/null 2>&1 || true

echo ""
echo -e "${BOLD}Status atual do container:${NC}"
$DOCKER_COMPOSE ps

if [ "$SHOW_LOGS" = true ]; then
  echo ""
  echo -e "${CYAN}Exibindo logs do container (Ctrl+C para sair):${NC}"
  $DOCKER_COMPOSE logs -f
fi
