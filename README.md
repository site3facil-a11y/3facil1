# 3Fácil - Plataforma Multi-Loja SaaS (Autos, Imóveis, Varejo & Serviços)

Plataforma SaaS multi-tenancy para catálogos comerciais, geração de leads e vitrines online para revendas de veículos, imobiliárias, lojas de produtos e prestadores de serviços.

---

## 🛠️ Arquitetura e Tecnologias

- **Backend**: Node.js 20+, Express 4, TypeScript, Zod, JWT (`HS256`), BcryptJS (custo 12).
- **Banco de Dados**: PostgreSQL 14+ organizado em 5 schemas (`usuarios`, `autos`, `imoveis`, `loja`, `servicos`) com persistência relacional transacional e fallback seguro em disco.
- **Frontend**: React 19, Vite 6, Tailwind CSS, Lucide Icons, Motion.
- **Segurança**: Helmet, CORS parametrizado via whitelist, Rate Limiting multinível, Cookies `httpOnly` + `SameSite=Lax`, verificação de tokens Bearer e prevenção de Path Traversal.
- **Testes & CI**: Vitest, Supertest, GitHub Actions.

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 20+
- PostgreSQL 14+ (opcional em desenvolvimento, obrigatório em produção)

### 1. Clonar e Instalar Dependências
```bash
git clone <url-do-repositorio>
cd site3facil
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o modelo de ambiente e preencha com suas configurações:
```bash
cp .env.example .env
```

> **Atenção:** `JWT_SECRET` deve conter **no mínimo 32 caracteres**. Se ausente ou menor que 32 caracteres, o servidor recusará a inicialização por segurança.

### 3. Criar o Primeiro Super Administrador
O Super Administrador é criado ou sincronizado automaticamente no primeiro startup a partir das variáveis:
```env
ADMIN_EMAIL=admin@seudominio.com.br
ADMIN_PASSWORD=SuaSenhaForteDeAdminAqui123!
```
Ao iniciar a aplicação, a conta será registrada com hash Bcrypt na tabela `usuarios.contas` e os privilégios de `superadmin` serão atribuídos.

### 4. Executar em Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação em `http://localhost:3000`.

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Node.js + Vite em modo de desenvolvimento com hot-reload |
| `npm run build` | Compila o bundle do frontend (Vite) e do backend (esbuild) para `dist/` |
| `npm run start` | Executa o bundle de produção compilado |
| `npm run lint` | Executa a verificação estática de tipos do TypeScript (`tsc --noEmit`) |
| `npm test` | Executa a suíte de testes automatizados com Vitest e Supertest |
| `npm run test:coverage` | Executa a suíte de testes gerando relatório de cobertura |
| `npm run db:seed` | Semeia os dados demonstrativos padrão no PostgreSQL e no armazenamento local |
| `npm run db:migrate-from-disk` | Migra todos os registros armazenados em disco (JSON) para as tabelas do PostgreSQL |

---

## 🔒 Segurança e Regras de Autorização

1. **Separação de Catálogo Público e Privado**:
   - `GET /api/public/bootstrap`: Retorna apenas lojas publicadas e seus itens disponíveis. Nunca inclui leads, e-mails do dono, mensalidade, dados de assinatura ou Pix.
   - `GET /api/bootstrap`: Requer autenticação. O lojista recebe exclusivamente os dados da sua loja, seus itens e seus leads. O superadmin tem visão global.
2. **Controle de Acesso Baseado em Papéis (RBAC)**:
   - `POST/PUT/DELETE /api/stores`: Criação via `/api/auth/register`. Atualizações e exclusões apenas pelo proprietário ou superadmin. Campos sensíveis (`mensalidade`, `status_assinatura`, `plano`, `vencimentos`, `is_published`) são bloqueados para lojistas.
   - `POST/DELETE /api/items`: Itens só podem ser criados ou excluídos pelo lojista titular da loja ou superadmin.
   - `PUT/DELETE /api/leads/:id`: Apenas o lojista destinatário do lead ou superadmin.
   - `PUT /api/settings`: Exclusivo do superadmin.
3. **Fluxo Criptográfico de Recuperação de Senha**:
   - Tokens gerados com `crypto.randomBytes(32)` e armazenados exclusivamente como hash **SHA-256**.
   - Expiração estrita de 30 minutos e uso único.
   - Resposta uniforme em tempo constante para mitigar ataques de enumeração de contas.

---

## 📦 Deploy em Produção

Consulte as instruções completas no arquivo [`DEPLOY.md`](./DEPLOY.md).
