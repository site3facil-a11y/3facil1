# =========================================================================
# 3facil SaaS - Dockerfile para Produção (Multi-Stage Node.js)
# =========================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copia arquivos de pacotes e instala todas as dependências de compilação
COPY package*.json ./
RUN npm install

# 2. Copia todo o código fonte e compila frontend (Vite) + backend (esbuild bundle)
COPY . .
RUN npm run build

# =========================================================================
# Imagem Final de Execução (Node.js Leve e Otimizado)
# =========================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Variáveis de ambiente padrão para produção
ENV NODE_ENV=production
ENV PORT=3000

# 1. Copia manifests e instala apenas dependências de runtime
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# 2. Copia os arquivos compilados e estrutura de persistência
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/database_storage ./database_storage
COPY --from=builder /app/uploads_imoveis ./uploads_imoveis

# Cria diretórios de armazenamento e uploads seguros com permissões corretas
RUN mkdir -p /app/database_storage /app/uploads_imoveis /app/uploads && chmod -R 755 /app/database_storage /app/uploads_imoveis /app/uploads

# Porta padrão de escuta
EXPOSE 3000

# Execução do servidor compilado CommonJS
CMD ["node", "dist/server.cjs"]

