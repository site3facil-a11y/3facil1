/**
 * Script de CLI: dbSeed.ts
 * Uso: npm run db:seed
 * Reseta e semeia o banco de dados PostgreSQL com os dados demonstrativos padrão.
 */
import { pool, initDatabase, seedDatabase } from '../server/postgres.js';
import { diskStorage } from '../server/diskStorage.js';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_PLATFORM_SETTINGS } from '../src/data/demoStores.js';

async function runSeed() {
  console.log('--- Iniciando rotina de Seed do Banco de Dados ---');

  // 1. Inicializa schemas no PostgreSQL
  await initDatabase();
  console.log('✓ Schemas do PostgreSQL verificados/criados.');

  // 2. Semeia PostgreSQL
  await seedDatabase();
  console.log('✓ Dados demonstrativos semeados no PostgreSQL.');

  // 3. Atualiza armazenamento em disco com os dados padrão
  diskStorage.saveStores(INITIAL_STORES);
  diskStorage.saveItems(INITIAL_ITEMS);
  diskStorage.saveLeads(INITIAL_LEADS);
  diskStorage.saveSettings(DEFAULT_PLATFORM_SETTINGS);
  console.log('✓ Armazenamento de fallback em disco sincronizado com os dados padrão.');

  console.log('--- Seed concluído com sucesso! ---');
  await pool.end();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Falha ao executar db:seed:', err);
  process.exit(1);
});
