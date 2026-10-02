import { PoolClient } from 'pg';
import { pool } from '../../../server/postgres.js';
import { StoreItem, VehicleItem, RealEstateItem, ProductItem, ServiceItem } from '../../types/store.js';
import { AppError } from '../errors/AppError.js';

export const ITEM_TABLES = {
  veiculo: 'autos.estoque',
  imovel: 'imoveis.catalogo',
  produto: 'loja.produtos',
  servico: 'servicos.catalogo'
} as const;

export type SupportedItemType = keyof typeof ITEM_TABLES;

export const itemRepository = {
  /**
   * Localiza em qual tabela e loja o item está cadastrado
   */
  async findItemById(id: string, specificType?: SupportedItemType): Promise<{ id: string; storeId: string; itemType: SupportedItemType; data: any } | null> {
    const client = await pool.connect();
    try {
      if (specificType && ITEM_TABLES[specificType]) {
        const table = ITEM_TABLES[specificType];
        const res = await client.query(`SELECT id, loja_id as "storeId", dados_extras FROM ${table} WHERE id = $1`, [id]);
        if (res.rows.length > 0) {
          return { id: res.rows[0].id, storeId: res.rows[0].storeId, itemType: specificType, data: res.rows[0] };
        }
        return null;
      }

      // Procura nas tabelas na whitelist
      const queries = [
        client.query(`SELECT id, loja_id as "storeId", 'veiculo' as type FROM autos.estoque WHERE id = $1`, [id]),
        client.query(`SELECT id, loja_id as "storeId", 'imovel' as type FROM imoveis.catalogo WHERE id = $1`, [id]),
        client.query(`SELECT id, loja_id as "storeId", 'produto' as type FROM loja.produtos WHERE id = $1`, [id]),
        client.query(`SELECT id, loja_id as "storeId", 'servico' as type FROM servicos.catalogo WHERE id = $1`, [id])
      ];

      const results = await Promise.all(queries);
      for (const res of results) {
        if (res.rows.length > 0) {
          return {
            id: res.rows[0].id,
            storeId: res.rows[0].storeId,
            itemType: res.rows[0].type as SupportedItemType,
            data: res.rows[0]
          };
        }
      }
      return null;
    } finally {
      client.release();
    }
  },

  /**
   * Função genérica unificada para upsert de item por tipo
   */
  async upsertItem(item: StoreItem, existingClient?: PoolClient): Promise<void> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const type = item.itemType as SupportedItemType;
      const createdAt = new Date(item.createdAt || Date.now());
      let res: any;

      if (type === 'veiculo') {
        const v = item as VehicleItem;
        res = await client.query(`
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
            marca = EXCLUDED.marca,
            modelo = EXCLUDED.modelo,
            ano_fabricacao = EXCLUDED.ano_fabricacao,
            ano_modelo = EXCLUDED.ano_modelo,
            quilometragem = EXCLUDED.quilometragem,
            combustivel = EXCLUDED.combustivel,
            cambio = EXCLUDED.cambio,
            cor = EXCLUDED.cor,
            placa_final = EXCLUDED.placa_final,
            tabela_fipe_valor = EXCLUDED.tabela_fipe_valor,
            opcionais = EXCLUDED.opcionais,
            dados_extras = EXCLUDED.dados_extras,
            updated_at = CURRENT_TIMESTAMP
          WHERE autos.estoque.loja_id = EXCLUDED.loja_id
          RETURNING id
        `, [
          v.id, v.storeId, v.title, 'veiculo', v.price, v.promotionalPrice || null,
          v.description || '', JSON.stringify(v.images || []), v.featured || false, v.status || 'disponivel',
          v.brand || '', v.model || '', v.yearFab || 2023, v.yearModel || 2024,
          v.mileage || 0, v.fuel || 'flex', v.transmission || 'automatico', v.color || '',
          v.plateEnd || '', false, v.fipePrice || null,
          JSON.stringify(v.accessories || []), JSON.stringify(v), createdAt
        ]);
      } else if (type === 'imovel') {
        const im = item as RealEstateItem;
        res = await client.query(`
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
            tipo_imovel = EXCLUDED.tipo_imovel,
            tipo_transacao = EXCLUDED.tipo_transacao,
            area_util_m2 = EXCLUDED.area_util_m2,
            area_total_m2 = EXCLUDED.area_total_m2,
            quartos = EXCLUDED.quartos,
            suites = EXCLUDED.suites,
            banheiros = EXCLUDED.banheiros,
            vagas_garagem = EXCLUDED.vagas_garagem,
            valor_condominio = EXCLUDED.valor_condominio,
            valor_iptu = EXCLUDED.valor_iptu,
            bairro = EXCLUDED.bairro,
            cidade = EXCLUDED.cidade,
            estado = EXCLUDED.estado,
            endereco_completo = EXCLUDED.endereco_completo,
            caracteristicas = EXCLUDED.caracteristicas,
            dados_extras = EXCLUDED.dados_extras,
            updated_at = CURRENT_TIMESTAMP
          WHERE imoveis.catalogo.loja_id = EXCLUDED.loja_id
          RETURNING id
        `, [
          im.id, im.storeId, im.title, 'imovel', im.price, im.promotionalPrice || null,
          im.description || '', JSON.stringify(im.images || []), im.featured || false, im.status || 'disponivel',
          im.propertyType || 'apartamento', im.transactionType || 'venda', im.areaUtil || 80, im.areaTotal || 100,
          im.bedrooms || 2, im.suites || 1, im.bathrooms || 2, im.garageSpots || 1,
          im.condoFee || 0, im.iptu || 0, im.neighborhood || '', im.city || 'São Paulo', im.state || 'SP',
          im.address || '', JSON.stringify(im.amenities || []), JSON.stringify(im), createdAt
        ]);
      } else if (type === 'produto') {
        const pr = item as ProductItem;
        res = await client.query(`
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
            sku = EXCLUDED.sku,
            categoria = EXCLUDED.categoria,
            estoque_quantidade = EXCLUDED.estoque_quantidade,
            em_estoque = EXCLUDED.em_estoque,
            condicao = EXCLUDED.condicao,
            dados_extras = EXCLUDED.dados_extras,
            updated_at = CURRENT_TIMESTAMP
          WHERE loja.produtos.loja_id = EXCLUDED.loja_id
          RETURNING id
        `, [
          pr.id, pr.storeId, pr.title, 'produto', pr.price, pr.promotionalPrice || null,
          pr.description || '', JSON.stringify(pr.images || []), pr.featured || false, pr.status || 'ativo',
          pr.sku || '', pr.category || 'Geral', pr.stockQuantity || 10, pr.inStock !== false,
          pr.condition || 'novo', JSON.stringify(pr), createdAt
        ]);
      } else if (type === 'servico') {
        const sr = item as ServiceItem;
        res = await client.query(`
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
            tipo_preco = EXCLUDED.tipo_preco,
            duracao_estimada = EXCLUDED.duracao_estimada,
            itens_inclusos = EXCLUDED.itens_inclusos,
            dados_extras = EXCLUDED.dados_extras,
            updated_at = CURRENT_TIMESTAMP
          WHERE servicos.catalogo.loja_id = EXCLUDED.loja_id
          RETURNING id
        `, [
          sr.id, sr.storeId, sr.title, 'servico', sr.price || 0, sr.promotionalPrice || null,
          sr.description || '', JSON.stringify(sr.images || []), sr.featured || false, sr.status || 'ativo',
          sr.priceType || 'fixo', sr.estimatedDuration || 'A combinar',
          JSON.stringify(sr.includedItems || []), JSON.stringify(sr), createdAt
        ]);
      }

      if (res && (res.rowCount || 0) === 0) {
        throw AppError.forbidden('Acesso negado: o item especificado já existe e pertence a outra loja.');
      }
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  /**
   * Deleta item da tabela correta especificada pelo itemType (sem varredura desnecessária)
   */
  async deleteItem(id: string, itemType: SupportedItemType, existingClient?: PoolClient): Promise<boolean> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const table = ITEM_TABLES[itemType];
      if (!table) return false;
      const res = await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      return (res.rowCount || 0) > 0;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }
};
