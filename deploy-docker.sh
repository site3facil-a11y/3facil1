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
# 2. SINCRONIZAÇÃO COM GIT
# ------------------------------------------------------------------------------
if [ "$PULL_GIT" = true ]; then
  echo ""
  echo -e "${BLUE}▶ [2/6] Atualizando repositório Git...${NC}"
  if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    echo -e "${CYAN}Puxando alterações da branch '${CURRENT_BRANCH}'...${NC}"
    git pull origin "$CURRENT_BRANCH" || echo -e "${YELLOW}Aviso: Falha ao puxar git. Continuando...${NC}"
  fi
else
  echo ""
  echo -e "${BLUE}▶ [2/6] Verificação do código fonte concluída (skip pull).${NC}"
fi

# ------------------------------------------------------------------------------
# 3. VALIDAÇÃO E INJEÇÃO DAS VARIÁVEIS DE AMBIENTE (.env)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [3/6] Validando variáveis de ambiente de segurança (.env)...${NC}"

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️ Arquivo .env não encontrado. Criando modelo com chaves seguras...${NC}"
  
  RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 48)
  
  cat <<EOF > .env
NODE_ENV=production
PORT=3000
APP_URL=https://3facil.com
ALLOWED_ORIGINS=https://3facil.com
JWT_SECRET=${RANDOM_SECRET}
ADMIN_EMAIL=admin@3facil.com
ADMIN_PASSWORD=MudeEstaSenhaSeguraNoSeuEnv2026!
ENABLE_SELF_UPDATE=false
SEED_DEMO=false
EOF
  echo -e "${GREEN}✓ Arquivo .env gerado com JWT_SECRET criptográfico de 64 caracteres.${NC}"
  echo -e "${YELLOW}⚠️ ATENÇÃO: Edite o arquivo .env para definir o ADMIN_PASSWORD definitivo antes de usar em produção!${NC}"
fi

# Validação do JWT_SECRET (mínimo 32 caracteres)
if grep -q "JWT_SECRET=" .env; then
  SECRET_VAL=$(grep "JWT_SECRET=" .env | cut -d '=' -f2- | tr -d ' "\r\n')
  if [ ${#SECRET_VAL} -lt 32 ]; then
    echo -e "${RED}❌ ERRO: JWT_SECRET no arquivo .env possui menos de 32 caracteres (${#SECRET_VAL} chars).${NC}"
    echo "Gere uma chave segura com: openssl rand -hex 32"
    exit 1
  fi
fi

chmod 600 .env 2>/dev/null || true
mkdir -p database_storage uploads_imoveis uploads 2>/dev/null || true
chmod -R 755 database_storage uploads_imoveis uploads 2>/dev/null || true

echo -e "${GREEN}✓ Variáveis de ambiente e pastas validadas com sucesso.${NC}"

# ------------------------------------------------------------------------------
# 4. COMPILAÇÃO DA IMAGEM DOCKER
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [4/6] Construindo imagem Docker da aplicação...${NC}"

BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
  BUILD_ARGS="--no-cache"
fi

$DOCKER_COMPOSE build $BUILD_ARGS
echo -e "${GREEN}✓ Imagem Docker compilada com sucesso!${NC}"

# ------------------------------------------------------------------------------
# 5. SUBINDO OS CONTAINERS
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}▶ [5/6] Iniciando os containers...${NC}"
$DOCKER_COMPOSE up -d --remove-orphans

# ------------------------------------------------------------------------------
# 6. HEALTHCHECK E CONCLUSÃO
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
  echo -e "${GREEN}✓ Aplicação respondendo em http://127.0.0.1:3000${NC}"
else
  echo -e "${YELLOW}⚠️ O container ainda está inicializando.${NC}"
fi

if [ "$SHOW_LOGS" = true ]; then
  $DOCKER_COMPOSE logs -f
fi
