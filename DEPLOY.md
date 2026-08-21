# Guia Completo de Instalação e Hospedagem em Servidor / VM (VitrineHub SaaS)

Este guia contém as instruções passo a passo para instalar e executar a infraestrutura necessária do **VitrineHub SaaS** em qualquer Máquina Virtual (VM) ou VPS com Linux (Ubuntu 22.04 / 24.04, Debian, AWS EC2, DigitalOcean, Hetzner, GCP Compute Engine, etc.).

---

## ⚡ Método 1: Instalação Automática via Script (Recomendado)

Criamos um script que automatiza 100% da instalação: atualiza o sistema, instala Node.js 20 LTS, Nginx, Certbot SSL, compila a aplicação e configura o firewall.

### Como executar no seu servidor:

1. Acesse o seu servidor via SSH:
   ```bash
   ssh root@ip-do-seu-servidor
   ```

2. Clone o repositório ou envie os arquivos para o servidor:
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO> /var/www/vitrinehub
   cd /var/www/vitrinehub
   ```

3. Dê permissão de execução e rode o instalador:
   ```bash
   chmod +x setup-server.sh
   sudo bash setup-server.sh
   ```

4. O script solicitará:
   - O seu domínio (ex: `meudominio.com.br` ou subdomínio `app.meusite.com`).
   - O seu e-mail para emissão do certificado SSL HTTPS gratuito (Let's Encrypt).

---

## 🛠️ Método 2: Instalação Manual Passo a Passo

Caso prefira executar cada etapa manualmente:

### 1. Atualizar o Sistema e Instalar Pacotes Essenciais
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw nginx certbot python3-certbot-nginx build-essential
```

### 2. Instalar o Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Deve exibir v20.x
npm -v
```

### 3. Baixar o Código e Compilar a Aplicação
```bash
sudo mkdir -p /var/www/vitrinehub
sudo chown -R $USER:$USER /var/www/vitrinehub

cd /var/www/vitrinehub
git clone <URL_DO_SEU_REPOSITORIO> .

npm install
npm run build
```

### 4. Configurar o Nginx
Crie o arquivo de configuração do Nginx:
```bash
sudo nano /etc/nginx/sites-available/vitrinehub
```

Cole o conteúdo abaixo (substituindo `seu-dominio.com.br` pelo seu domínio real):
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name seu-dominio.com.br www.seu-dominio.com.br;

    root /var/www/vitrinehub/dist;
    index index.html;

    # Suporte a SPA (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de alta performance para arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/vitrinehub /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Ativar Firewall e SSL Grátis (HTTPS)
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow 'OpenSSH'
sudo ufw enable

# Gerar o certificado SSL gratuito
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

---

## 🐳 Método 3: Hospedagem com Docker & Docker Compose

Se o seu servidor já possui o **Docker** e **Docker Compose** instalados:

1. Inicie a aplicação com um único comando:
   ```bash
   docker-compose up -d --build
   ```

2. A aplicação estará ativa na porta `80` (ou na porta configurada no `docker-compose.yml`).

---

## 🔄 Como Atualizar o Site no Futuro (Deploy Contínuo)

Sempre que fizer alterações no código e enviar para o GitHub/Git:

```bash
cd /var/www/vitrinehub
git pull origin main
npm install
npm run build
sudo systemctl restart nginx
```
*(Leva menos de 10 segundos para compilar e atualizar em produção)*
