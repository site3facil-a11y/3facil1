# 🔐 3facil.com — Documento Oficial de Credenciais, Acessos e Infraestrutura

Este documento reúne todas as credenciais de acesso, configurações de banco de dados, estrutura de diretórios e comandos operacionais do sistema **3facil.com**. Guarde este arquivo em local seguro.

---

## 1. Acesso aos Painéis da Aplicação Web

### A. Painel Master (Super Admin SaaS)
*Painel de gestão global de todas as lojas, assinaturas R$ 30,00/mês, configurações Pix e bancos de dados.*
- **URL de Acesso:** Na barra de navegação superior, clique no botão **"Painel Master"**
- **E-mail de Acesso:** `admin@3facil.com` *(ou qualquer e-mail com a palavra `admin`)*
- **Senha Padrão:** `admin123`

---

### B. Contas de Demonstração dos 4 Nichos (Lojistas)
*Painel de controle individual para gerenciamento de catálogo, estoque, propostas e leads.*

| Nicho | Loja Demo | E-mail de Acesso | Senha |
| :--- | :--- | :--- | :--- |
| **🚗 Veículos (Autos)** | AutoMotors Prime | `contato@automotors.com.br` | `admin123` |
| **🏡 Imóveis** | Prime Imóveis | `contato@primeimoveis.com.br` | `admin123` |
| **🛍️ Loja (Produtos)** | TechStore Eletrônicos | `contato@techstore.com.br` | `admin123` |
| **💼 Serviços** | Studio Design & Tech | `contato@studiodesign.com.br` | `admin123` |

---

## 2. Credenciais do Banco de Dados (PostgreSQL)

- **Host do Banco:** `localhost` (ou `127.0.0.1`)
- **Porta:** `5432`
- **Nome do Banco:** `3facil_db`
- **Superusuário do PostgreSQL:** `postgres`
- **Usuário da Aplicação (Role com Menor Privilégio):** `tresfacil_app_user`
- **Senha da Aplicação:** `SuaSenhaSeguraAqui123!`
- **String de Conexão (DATABASE_URL):**
  ```text
  postgresql://tresfacil_app_user:SuaSenhaSeguraAqui123!@localhost:5432/3facil_db
  ```

### 📂 Os 5 Schemas do PostgreSQL:
1. `usuarios` — Contas de lojistas, lojas/tenants, cobranças Pix e configurações
2. `autos` — Estoque de veículos, opcionais (JSONB), fotos e propostas de compra/troca
3. `imoveis` — Catálogo de imóveis (venda/locação), características e propostas
4. `loja` — Produtos físicos, categorias, controle de SKU, variações e pedidos
5. `servicos` — Catálogo de prestação de serviços, entregáveis e solicitações de orçamento

---

## 3. Servidor de Produção (Ubuntu / Oracle Cloud)

- **Usuário SSH:** `ubuntu`
- **Diretório da Aplicação:** `/var/www/3facil`
- **Porta da Aplicação Node.js:** `3000`
- **Portas Públicas:** `80` (HTTP) e `443` (HTTPS)
- **Repositório GitHub Oficial:** `https://github.com/site3facil-a11y/3facil`

---

## 4. Comandos de Operação e Manutenção

### A. Gerenciamento com PM2 (Node.js)
```bash
# Ver status do site e consumo de memória
pm2 status

# Ver logs em tempo real
pm2 logs 3facil

# Reiniciar a aplicação após atualizar o código
pm2 restart 3facil

# Parar a aplicação
pm2 stop 3facil
```

### B. Atualizar o Site com Novas Versões do GitHub
```bash
cd /var/www/3facil
git pull origin main
npm install
npm run build
pm2 restart 3facil
```

### C. Acessar o Banco de Dados PostgreSQL no Servidor
```bash
# Conectar como superusuário postgres
sudo -u postgres psql -d 3facil_db

# Conectar como usuário da aplicação
psql -h localhost -U tresfacil_app_user -d 3facil_db
```

### D. Backup e Restauração Rápida do Banco
```bash
# Fazer backup de todos os 5 schemas
pg_dump -U postgres 3facil_db > backup_3facil_$(date +%Y%m%d).sql

# Fazer backup de apenas 1 schema (ex: autos)
pg_dump -U postgres -n autos 3facil_db > backup_autos.sql
```

---

## 5. Variáveis de Ambiente Recomendadas (`.env`)

No arquivo `/var/www/3facil/.env`:
```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=3facil_db
DB_USER=tresfacil_app_user
DB_PASSWORD=SuaSenhaSeguraAqui123!
DATABASE_URL=postgresql://tresfacil_app_user:SuaSenhaSeguraAqui123!@localhost:5432/3facil_db
```
