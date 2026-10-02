import { PoolClient } from 'pg';
import { pool } from '../../../server/postgres.js';
import { StoreProfile } from '../../types/store.js';

export const storeRepository = {
  async findById(id: string): Promise<StoreProfile | null> {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM usuarios.lojas WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      const config = typeof r.configuracoes === 'string' ? JSON.parse(r.configuracoes) : (r.configuracoes || {});
      return {
        ...config,
        id: r.id,
        name: r.nome,
        slug: r.slug,
        type: r.tipo,
        description: r.descricao,
        slogan: r.slogan,
        themeColor: r.theme_color,
        logoUrl: r.logo_url,
        bannerUrl: r.banner_url,
        whatsapp: r.whatsapp,
        email: r.email,
        phone: r.telefone,
        city: r.cidade,
        state: r.estado,
        plan: r.plano || r.plano_tier,
        monthlyFee: parseFloat(r.mensalidade) || 30,
        subscriptionStatus: r.status_assinatura,
        nextDueDate: r.vencimento_mensalidade ? new Date(r.vencimento_mensalidade).toISOString() : undefined,
        lastPaymentDate: r.data_ultimo_pagamento ? new Date(r.data_ultimo_pagamento).toISOString() : undefined,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        ownerPhone: r.owner_phone,
        isPublished: r.is_published !== false
      } as StoreProfile;
    } finally {
      client.release();
    }
  },

  async updateStore(id: string, updates: Partial<StoreProfile>, existingClient?: PoolClient): Promise<StoreProfile | null> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const res = await client.query(`
        UPDATE usuarios.lojas SET
          nome = COALESCE($1, nome),
          slug = COALESCE($2, slug),
          tipo = COALESCE($3, tipo),
          descricao = COALESCE($4, descricao),
          slogan = COALESCE($5, slogan),
          theme_color = COALESCE($6, theme_color),
          logo_url = COALESCE($7, logo_url),
          banner_url = COALESCE($8, banner_url),
          whatsapp = COALESCE($9, whatsapp),
          email = COALESCE($10, email),
          telefone = COALESCE($11, telefone),
          instagram = COALESCE($12, instagram),
          cidade = COALESCE($13, cidade),
          estado = COALESCE($14, estado),
          endereco = COALESCE($15, endereco),
          owner_name = COALESCE($16, owner_name),
          owner_email = COALESCE($17, owner_email),
          owner_phone = COALESCE($18, owner_phone),
          plano = COALESCE($19, plano),
          plano_tier = COALESCE($19, plano_tier),
          mensalidade = COALESCE($20, mensalidade),
          status_assinatura = COALESCE($21, status_assinatura),
          vencimento_mensalidade = COALESCE($22, vencimento_mensalidade),
          data_ultimo_pagamento = COALESCE($23, data_ultimo_pagamento),
          is_published = COALESCE($24, is_published),
          configuracoes = CASE 
            WHEN configuracoes IS NULL THEN $25::jsonb 
            ELSE configuracoes || $25::jsonb 
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $26
        RETURNING *
      `, [
        updates.name || null,
        updates.slug || null,
        updates.type || null,
        updates.description || null,
        updates.slogan || null,
        updates.themeColor || null,
        updates.logoUrl || null,
        updates.bannerUrl || null,
        updates.whatsapp || null,
        updates.email || null,
        updates.phone || null,
        updates.instagram || null,
        updates.city || null,
        updates.state || null,
        updates.address || null,
        updates.ownerName || null,
        updates.ownerEmail || null,
        updates.ownerPhone || null,
        updates.plan || null,
        updates.monthlyFee ?? null,
        updates.subscriptionStatus || null,
        updates.nextDueDate ? new Date(updates.nextDueDate) : null,
        updates.lastPaymentDate ? new Date(updates.lastPaymentDate) : null,
        updates.isPublished !== undefined ? updates.isPublished : null,
        JSON.stringify(updates),
        id
      ]);

      if (res.rows.length === 0) return null;
      return await this.findById(id);
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  async deleteStore(id: string, existingClient?: PoolClient): Promise<boolean> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM autos.propostas WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM imoveis.propostas WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM loja.pedidos WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM servicos.orcamentos WHERE loja_id = $1', [id]);

      await client.query('DELETE FROM autos.estoque WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM imoveis.catalogo WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM loja.produtos WHERE loja_id = $1', [id]);
      await client.query('DELETE FROM servicos.catalogo WHERE loja_id = $1', [id]);

      await client.query('DELETE FROM usuarios.contas WHERE loja_id = $1', [id]);
      const res = await client.query('DELETE FROM usuarios.lojas WHERE id = $1', [id]);
      await client.query('COMMIT');
      return (res.rowCount || 0) > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }
};
