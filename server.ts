import { createApp } from './src/server/app.js';
import { setupSpaAndSeo } from './src/server/web/spaHandler.js';
import { initDatabase, seedDatabase } from './server/postgres.js';
import { initAuthAccounts } from './server/authService.js';
import { env } from './src/server/config/env.js';

async function startServer() {
  console.log(`[3Fácil Server] Inicializando em modo '${env.NODE_ENV}'...`);

  // 1. Inicializar infraestrutura de banco de dados
  let pgReady = false;
  try {
    pgReady = await initDatabase();
    if (pgReady && env.NODE_ENV !== 'production' && env.SEED_DEMO === 'true') {
      await seedDatabase();
    }
  } catch (err: any) {
    console.warn('[3Fácil Server] Aviso na inicialização do PostgreSQL:', err.message);
  }

  if (!pgReady) {
    console.warn('[3Fácil Server] PostgreSQL não detectado no startup. Operando com armazenamento local persistente.');
  }

  // 2. Inicializar contas de autenticação (Superadmin & Demo se configurado)
  await initAuthAccounts();

  // 3. Criar aplicação Express configurada com middlewares e rotas
  const app = createApp();

  // 4. Configurar SPA do React (Vite em dev / estáticos em prod) e SEO
  await setupSpaAndSeo(app);

  // 5. Iniciar escuta HTTP
  const PORT = env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [3Fácil Server] Servidor online em http://localhost:${PORT}`);
    console.log(`🔒 [Segurança] JWT, Helmet, CORS restrito e Rate Limiting ativos.`);
  });
}

startServer().catch((err) => {
  console.error('❌ Falha fatal ao iniciar o servidor:', err);
  process.exit(1);
});
