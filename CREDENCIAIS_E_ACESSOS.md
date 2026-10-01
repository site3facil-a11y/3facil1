# 🔐 3facil.com — Guia de Configuração de Acessos e Infraestrutura

Este documento descreve como configurar credenciais de acesso, bancos de dados e variáveis de ambiente do sistema **3facil.com**.
**Atenção:** Nunca versionar senhas ou credenciais de produção no repositório. Todas as credenciais devem ser injetadas exclusivamente via variáveis de ambiente (`.env`).

---

## 1. Acesso aos Painéis da Aplicação Web

### A. Painel Master (Super Admin SaaS)
*Painel de gestão global de todas as lojas, assinaturas, configurações e monitoramento.*
- **URL de Acesso:** Botão **"Painel Master"** na navegação ou `/master`
- **E-mail de Acesso:** Definido pela variável `ADMIN_EMAIL` no `.env`
- **Senha de Acesso:** Definida pela variável `ADMIN_PASSWORD` no `.env` (hasheada com bcrypt custo >= 12 no primeiro startup)
- **Bloqueio de Segurança:** Bloqueio temporário automático após 5 tentativas consecutivas incorretas.

---

### B. Contas de Demonstração (Ambiente de Desenvolvimento)
*Disponíveis apenas quando `NODE_ENV !== 'production'` e `SEED_DEMO=true`.* Em produção, nenhuma conta demo é gerada automaticamente.

| Nicho | Loja Demo | E-mail de Demonstração | Senha em Modo Demo |
| :--- | :--- | :--- | :--- |
| **🚗 Veículos (Autos)** | AutoMotors Prime | `contato@automotors.com.br` | `admin123` |
| **🏡 Imóveis** | Prime Imóveis | `contato@primeimoveis.com.br` | `admin123` |
| **🛍️ Loja (Produtos)** | TechStore Eletrônicos | `contato@techstore.com.br` | `admin123` |
| **💼 Serviços** | Studio Design & Tech | `contato@studiodesign.com.br` | `admin123` |

---

## 2. Configuração do Banco de Dados (PostgreSQL)

Configurado via variáveis no arquivo `.env` ou `DATABASE_URL`:
- `DB_HOST`: Host do servidor PostgreSQL
- `DB_PORT`: Porta (padrão: 5432)
- `DB_NAME`: Nome do banco (ex: `3facil_db`)
- `DB_USER`: Usuário do banco
- `DB_PASSWORD`: Senha do usuário do banco
- `DATABASE_URL`: `postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>`

### 📂 Schemas do PostgreSQL:
1. `usuarios` — Contas de autenticação (`usuarios.contas`), lojas/tenants (`usuarios.lojas`), configurações e Pix.
2. `autos` — Estoque de veículos, opcionais (JSONB), fotos e propostas.
3. `imoveis` — Catálogo de imóveis, características e propostas.
4. `loja` — Produtos físicos, categorias, estoque e pedidos.
5. `servicos` — Catálogo de serviços, orçamentos e solicitações.

---

## 3. Segurança e Variáveis de Ambiente (`.env`)

Configure o arquivo `.env` com valores fortes e exclusivos:
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=gere_uma_chave_aleatoria_com_mais_de_32_caracteres_hex_ou_base64
ADMIN_EMAIL=admin@seu-dominio.com
ADMIN_PASSWORD=SenhaForteComLetrasNumerosSimbolos!
SEED_DEMO=false
DB_HOST=localhost
DB_PORT=5432
DB_NAME=3facil_db
DB_USER=tresfacil_app_user
DB_PASSWORD=senha_forte_do_postgres
```

---

## 4. Comandos Operacionais

### Gerenciamento de Processos (PM2)
```bash
pm2 status
pm2 logs 3facil
pm2 restart 3facil
pm2 stop 3facil
```

### Backup do Banco de Dados
```bash
pg_dump -U postgres 3facil_db > backup_3facil_$(date +%Y%m%d).sql
```
