import { PoolClient } from 'pg';
import { pool } from '../../../server/postgres.js';
import { ProposalLead } from '../../types/store.js';

export const LEAD_TABLES = {
  veiculo: 'autos.propostas',
  imovel: 'imoveis.propostas',
  produto: 'loja.pedidos',
  servico: 'servicos.orcamentos'
} as const;

export type SupportedLeadType = keyof typeof LEAD_TABLES;

export const leadRepository = {
  async findLeadById(id: string): Promise<{ id: string; storeId: string; itemType: SupportedLeadType } | null> {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT id, loja_id as "storeId", 'veiculo' as type FROM autos.propostas WHERE id = $1
        UNION ALL
        SELECT id, loja_id as "storeId", 'imovel' as type FROM imoveis.propostas WHERE id = $1
        UNION ALL
        SELECT id, loja_id as "storeId", 'produto' as type FROM loja.pedidos WHERE id = $1
        UNION ALL
        SELECT id, loja_id as "storeId", 'servico' as type FROM servicos.orcamentos WHERE id = $1
        LIMIT 1
      `, [id]);

      if (res.rows.length === 0) return null;
      return {
        id: res.rows[0].id,
        storeId: res.rows[0].storeId,
        itemType: res.rows[0].type as SupportedLeadType
      };
    } finally {
      client.release();
    }
  },

  async createLead(lead: ProposalLead, existingClient?: PoolClient): Promise<void> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const type = (lead.itemType as SupportedLeadType) || 'produto';
      const createdAt = new Date(lead.createdAt || Date.now());

      if (type === 'produto') {
        try {
          await client.query(`
            INSERT INTO loja.pedidos (
              id, loja_id, item_id, item_title, item_type, item_price,
              client_name, client_phone, client_email,
              client_message, proposal_value, payment_method, trade_details,
              order_type, delivery_address, quantity, change_for,
              status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              client_message = EXCLUDED.client_message
          `, [
            lead.id, lead.storeId, lead.itemId, lead.itemTitle, lead.itemType, lead.itemPrice || 0,
            lead.clientName, lead.clientPhone, lead.clientEmail || '',
            lead.clientMessage || '', lead.proposalValue || null, lead.paymentMethod || 'outro',
            lead.tradeDetails || '', lead.orderType || 'entrega', lead.deliveryAddress || null,
            lead.quantity || 1, lead.changeFor || null,
            lead.status || 'novo', createdAt
          ]);
          return;
        } catch {}
      }

      const table = LEAD_TABLES[type] || 'loja.pedidos';
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
        lead.tradeDetails || '', lead.status || 'novo', createdAt
      ]);
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  async updateLeadStatus(id: string, status: string, itemType?: SupportedLeadType): Promise<boolean> {
    const client = await pool.connect();
    try {
      if (itemType && LEAD_TABLES[itemType]) {
        const table = LEAD_TABLES[itemType];
        const res = await client.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [status, id]);
        return (res.rowCount || 0) > 0;
      }

      const res = await client.query(`
        WITH u1 AS (UPDATE autos.propostas SET status = $1 WHERE id = $2 RETURNING 1),
             u2 AS (UPDATE imoveis.propostas SET status = $1 WHERE id = $2 RETURNING 1),
             u3 AS (UPDATE loja.pedidos SET status = $1 WHERE id = $2 RETURNING 1),
             u4 AS (UPDATE servicos.orcamentos SET status = $1 WHERE id = $2 RETURNING 1)
        SELECT COUNT(*) FROM (
          SELECT * FROM u1 UNION ALL SELECT * FROM u2 UNION ALL SELECT * FROM u3 UNION ALL SELECT * FROM u4
        ) t
      `, [status, id]);

      return parseInt(res.rows[0].count, 10) > 0;
    } finally {
      client.release();
    }
  },

  async deleteLead(id: string, itemType?: SupportedLeadType): Promise<boolean> {
    const client = await pool.connect();
    try {
      if (itemType && LEAD_TABLES[itemType]) {
        const table = LEAD_TABLES[itemType];
        const res = await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
        return (res.rowCount || 0) > 0;
      }

      const res = await client.query(`
        WITH d1 AS (DELETE FROM autos.propostas WHERE id = $1 RETURNING 1),
             d2 AS (DELETE FROM imoveis.propostas WHERE id = $1 RETURNING 1),
             d3 AS (DELETE FROM loja.pedidos WHERE id = $1 RETURNING 1),
             d4 AS (DELETE FROM servicos.orcamentos WHERE id = $1 RETURNING 1)
        SELECT COUNT(*) FROM (
          SELECT * FROM d1 UNION ALL SELECT * FROM d2 UNION ALL SELECT * FROM d3 UNION ALL SELECT * FROM d4
        ) t
      `, [id]);

      return parseInt(res.rows[0].count, 10) > 0;
    } finally {
      client.release();
    }
  }
};
