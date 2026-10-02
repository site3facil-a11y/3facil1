/**
 * Script de CLI: dbMigrateFromDisk.ts
 * Uso: npm run db:migrate-from-disk
 * Migra todos os registros persistidos em disco (JSON) diretamente para as tabelas do PostgreSQL.
 */
import { pool, initDatabase, isPostgresAvailable } from '../server/postgres.js';
import { diskStorage } from '../server/diskStorage.js';
import { VehicleItem, RealEstateItem, ProductItem, ServiceItem } from '../src/types/store.js';

async function runMigration() {
  console.log('--- Iniciando Migração: Disco (JSON) -> PostgreSQL ---');

  const ready = await isPostgresAvailable();
  if (!ready) {
    console.error('ERRO: Não foi possível conectar ao PostgreSQL. Verifique DATABASE_URL no seu arquivo .env.');
    process.exit(1);
  }

  await initDatabase();

  const stores = diskStorage.getStores();
  const items = diskStorage.getItems();
  const leads = diskStorage.getLeads();
  const settings = diskStorage.getSettings();

  console.log(`Encontrados em disco: ${stores.length} lojas, ${items.length} itens, ${leads.length} leads.`);

  const client = await pool.connect();
  let migratedStores = 0;
  let migratedItems = 0;
  let migratedLeads = 0;
  const errors: string[] = [];

  try {
    await client.query('BEGIN');

    // 1. Migrar Lojas
    for (const store of stores) {
      try {
        await client.query(`
          INSERT INTO usuarios.lojas (
            id, nome, slug, tipo, descricao, logo_url, banner_url,
            whatsapp, email, telefone, endereco, cidade, estado, cep,
            plano, status_assinatura, mensalidade, data_adesao,
            data_ultimo_pagamento, vencimento_mensalidade, configuracoes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            slug = EXCLUDED.slug,
            tipo = EXCLUDED.tipo,
            descricao = EXCLUDED.descricao,
            logo_url = EXCLUDED.logo_url,
            banner_url = EXCLUDED.banner_url,
            whatsapp = EXCLUDED.whatsapp,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            endereco = EXCLUDED.endereco,
            cidade = EXCLUDED.cidade,
            estado = EXCLUDED.estado,
            cep = EXCLUDED.cep,
            plano = EXCLUDED.plano,
            status_assinatura = EXCLUDED.status_assinatura,
            mensalidade = EXCLUDED.mensalidade,
            data_adesao = EXCLUDED.data_adesao,
            data_ultimo_pagamento = EXCLUDED.data_ultimo_pagamento,
            vencimento_mensalidade = EXCLUDED.vencimento_mensalidade,
            configuracoes = EXCLUDED.configuracoes,
            updated_at = CURRENT_TIMESTAMP
        `, [
          store.id, store.name, store.slug, store.type, store.description,
          store.logoUrl || null, store.bannerUrl || null, store.whatsapp,
          store.email || '', store.phone || '', store.address || '',
          (store as any).city || 'São Paulo', (store as any).state || 'SP', (store as any).zipCode || '',
          store.plan || 'pro', store.subscriptionStatus || 'ativo',
          store.monthlyFee || 30.00, new Date((store as any).joinDate || store.createdAt || Date.now()),
          store.lastPaymentDate ? new Date(store.lastPaymentDate) : null,
          store.nextDueDate ? new Date(store.nextDueDate) : null,
          JSON.stringify(store), new Date(store.createdAt || Date.now())
        ]);
        migratedStores++;
      } catch (e: any) {
        errors.push(`Loja ${store.name} (${store.id}): ${e.message}`);
      }
    }

    // 2. Migrar Itens
    for (const item of items) {
      try {
        if (item.itemType === 'veiculo') {
          const v = item as VehicleItem;
          await client.query(`
            INSERT INTO autos.estoque (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, marca, modelo, ano_fabricacao, ano_modelo, quilometragem,
              combustivel, cambio, cor, placa_final, blindado,
              tabela_fipe_valor, opcionais, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            v.id, v.storeId, v.title, 'veiculo', v.price, null,
            v.description, JSON.stringify(v.images || []), v.featured || false, v.status || 'disponivel',
            v.brand || '', v.model || '', v.yearFab || 2023, v.yearModel || 2024,
            v.mileage || 0, v.fuel || 'flex', v.transmission || 'automatico', v.color || '',
            v.plateEnd || '', false, v.fipePrice || null,
            JSON.stringify(v.accessories || []), JSON.stringify(v), new Date(v.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'imovel') {
          const im = item as RealEstateItem;
          await client.query(`
            INSERT INTO imoveis.catalogo (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, tipo_imovel, tipo_transacao, area_util_m2, area_total_m2,
              quartos, suites, banheiros, vagas_garagem, valor_condominio, valor_iptu,
              bairro, cidade, estado, endereco_completo, caracteristicas, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            im.id, im.storeId, im.title, 'imovel', im.price, null,
            im.description, JSON.stringify(im.images || []), im.featured || false, im.status || 'disponivel',
            im.propertyType || 'apartamento', im.transactionType || 'venda', im.areaUtil || 80, im.areaTotal || 100,
            im.bedrooms || 2, im.suites || 1, im.bathrooms || 2, im.garageSpots || 1,
            im.condoFee || 0, im.iptu || 0, im.neighborhood || '', im.city || 'São Paulo', im.state || 'SP',
            im.address || '', JSON.stringify(im.amenities || []), JSON.stringify(im),
            new Date(im.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'produto') {
          const pr = item as ProductItem;
          await client.query(`
            INSERT INTO loja.produtos (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, sku, categoria, estoque_quantidade, em_estoque,
              condicao, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              estoque_quantidade = EXCLUDED.estoque_quantidade,
              em_estoque = EXCLUDED.em_estoque,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            pr.id, pr.storeId, pr.title, 'produto', pr.price, pr.promotionalPrice || null,
            pr.description, JSON.stringify(pr.images || []), pr.featured || false, pr.status || 'ativo',
            pr.sku || '', pr.category || 'Geral', pr.stockQuantity || 10, pr.inStock !== false,
            pr.condition || 'novo', JSON.stringify(pr), new Date(pr.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'servico') {
          const sr = item as ServiceItem;
          await client.query(`
            INSERT INTO servicos.catalogo (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, tipo_preco, duracao_estimada,
              itens_inclusos, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            sr.id, sr.storeId, sr.title, 'servico', sr.price || 0, null,
            sr.description, JSON.stringify(sr.images || []), sr.featured || false, sr.status || 'ativo',
            sr.priceType || 'fixo', sr.estimatedDuration || 'A combinar',
            JSON.stringify(sr.includedItems || []), JSON.stringify(sr), new Date(sr.createdAt || Date.now())
          ]);
        }
        migratedItems++;
      } catch (e: any) {
        errors.push(`Item ${item.title} (${item.id}): ${e.message}`);
      }
    }

    // 3. Migrar Leads
    for (const lead of leads) {
      try {
        const table = lead.itemType === 'veiculo' ? 'autos.propostas'
                    : lead.itemType === 'imovel' ? 'imoveis.propostas'
                    : lead.itemType === 'produto' ? 'loja.pedidos'
                    : 'servicos.orcamentos';

        await client.query(`
          INSERT INTO ${table} (
            id, loja_id, item_id, item_title, item_type, item_price,
            client_name, client_phone, client_email,
            client_message, proposal_value, payment_method, trade_details, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            client_message = EXCLUDED.client_message
        `, [
          lead.id, lead.storeId, lead.itemId, lead.itemTitle, lead.itemType, lead.itemPrice || 0,
          lead.clientName, lead.clientPhone, lead.clientEmail || '',
          lead.clientMessage || '', lead.proposalValue || null, lead.paymentMethod || 'outro',
          lead.tradeDetails || '', lead.status || 'novo', new Date(lead.createdAt || Date.now())
        ]);
        migratedLeads++;
      } catch (e: any) {
        errors.push(`Lead ${lead.clientName} (${lead.id}): ${e.message}`);
      }
    }

    // 4. Migrar Configurações Globais
    if (settings) {
      await client.query(`
        INSERT INTO usuarios.configuracoes_gerais (id, chave, valor)
        VALUES ('saas_config', 'platform_settings', $1)
        ON CONFLICT (chave) DO UPDATE SET
          valor = EXCLUDED.valor,
          updated_at = CURRENT_TIMESTAMP
      `, [JSON.stringify(settings)]);
    }

    await client.query('COMMIT');
    console.log(`✓ Migração concluída com sucesso: ${migratedStores} lojas, ${migratedItems} itens, ${migratedLeads} leads.`);
    if (errors.length > 0) {
      console.warn('Avisos durante a migração:', errors);
    }
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('ERRO na transação de migração:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Falha ao executar db:migrate-from-disk:', err);
  process.exit(1);
});
