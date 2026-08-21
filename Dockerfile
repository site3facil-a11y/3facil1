# =========================================================================
# VitrineHub SaaS - Dockerfile para Produção (Multi-Stage Build)
# =========================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copia arquivos de pacotes e instala dependências de compilação
COPY package*.json ./
RUN npm install

# 2. Copia todo o código fonte e compila o frontend com Vite
COPY . .
RUN npm run build

# =========================================================================
# Imagem Final de Execução (Leve e Segura com Nginx Alpine)
# =========================================================================
FROM nginx:alpine AS runner

# Copia build estático gerado na etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração do Nginx para suportar SPA (Single Page Application)
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    error_page 500 502 503 504 /50x.html;\n\
    location = /50x.html {\n\
        root /usr/share/nginx/html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
