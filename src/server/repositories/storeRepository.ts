import { PoolClient } from 'pg';
import { pool } from '../../../server/postgres.js';
import { StoreProfile } from '../../types/store.js';
import { normalizeStoreType, normalizeStateUF } from '../validation/schemas.js';

export const storeRepository = {
  async slugExists(slug: string, existingClient?: PoolClient): Promise<boolean> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;
    try {
      const res = await client.query('SELECT 1 FROM usuarios.lojas WHERE LOWER(slug) = LOWER($1) LIMIT 1', [slug]);
      return res.rows.length > 0;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  async findById(id: string, existingClient?: PoolClient): Promise<StoreProfile | null> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;
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
        type: normalizeStoreType(r.tipo),
        description: r.descricao,
        slogan: r.slogan,
        themeColor: r.theme_color,
        logoUrl: r.logo_url,
        bannerUrl: r.banner_url,
        whatsapp: r.whatsapp,
        email: r.email || r.owner_email || '',
        phone: r.telefone,
        city: r.cidade,
        state: r.estado,
        plan: r.plano || r.plano_tier,
        monthlyFee: parseFloat(r.mensalidade) || 30,
        subscriptionStatus: r.status_assinatura,
        nextDueDate: r.vencimento_mensalidade ? new Date(r.vencimento_mensalidade).toISOString() : undefined,
        lastPaymentDate: r.data_ultimo_pagamento ? new Date(r.data_ultimo_pagamento).toISOString() : undefined,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email || r.email || '',
        ownerPhone: r.owner_phone,
        isPublished: r.is_published !== false
      } as StoreProfile;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  async createStore(store: StoreProfile, existingClient?: PoolClient): Promise<StoreProfile> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const normalizedType = normalizeStoreType(store.type);
      const normalizedState = normalizeStateUF(store.state);
      const safeWhatsapp = String(store.whatsapp || store.phone || '').slice(0, 20);
      const safePhone = String(store.phone || store.whatsapp || '').slice(0, 20);
      const safeInstagram = store.instagram ? String(store.instagram).slice(0, 50) : null;
      const safeThemeColor = String(store.themeColor || '#2563eb').slice(0, 20);
      const safePlan = String(store.plan || 'pro').slice(0, 20);
      const safeStatus = String(store.subscriptionStatus || 'ativo').slice(0, 20);
      const nextDueDate = store.nextDueDate ? String(store.nextDueDate).slice(0, 30) : null;
      const lastPaymentDate = store.lastPaymentDate ? String(store.lastPaymentDate).slice(0, 30) : null;

      await client.query(`
        INSERT INTO usuarios.lojas (
          id, nome, slug, tipo, descricao, slogan, theme_color, logo_url, banner_url,
          whatsapp, email, telefone, instagram, cidade, estado, endereco,
          plano_tier, mensalidade, status_assinatura, vencimento_mensalidade, data_ultimo_pagamento,
          owner_name, owner_email, owner_phone, configuracoes, is_published, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25::jsonb, $26, $27, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          slug = EXCLUDED.slug,
          tipo = EXCLUDED.tipo,
          descricao = EXCLUDED.descricao,
          slogan = EXCLUDED.slogan,
          theme_color = EXCLUDED.theme_color,
          logo_url = EXCLUDED.logo_url,
          banner_url = EXCLUDED.banner_url,
          whatsapp = EXCLUDED.whatsapp,
          email = EXCLUDED.email,
          telefone = EXCLUDED.telefone,
          instagram = EXCLUDED.instagram,
          cidade = EXCLUDED.cidade,
          estado = EXCLUDED.estado,
          endereco = EXCLUDED.endereco,
          plano_tier = EXCLUDED.plano_tier,
          mensalidade = EXCLUDED.mensalidade,
          status_assinatura = EXCLUDED.status_assinatura,
          vencimento_mensalidade = EXCLUDED.vencimento_mensalidade,
          data_ultimo_pagamento = EXCLUDED.data_ultimo_pagamento,
          owner_name = EXCLUDED.owner_name,
          owner_email = EXCLUDED.owner_email,
          owner_phone = EXCLUDED.owner_phone,
          configuracoes = EXCLUDED.configuracoes,
          is_published = EXCLUDED.is_published,
          updated_at = CURRENT_TIMESTAMP
      `, [
        store.id,
        store.name,
        store.slug,
        normalizedType,
        store.description || '',
        store.slogan || '',
        safeThemeColor,
        store.logoUrl || null,
        store.bannerUrl || null,
        safeWhatsapp,
        store.email || store.ownerEmail || '',
        safePhone,
        safeInstagram,
        store.city || 'São Paulo',
        normalizedState,
        store.address || null,
        safePlan,
        store.monthlyFee ?? 30,
        safeStatus,
        nextDueDate,
        lastPaymentDate,
        store.ownerName || store.name,
        store.ownerEmail || store.email || '',
        store.ownerPhone || store.whatsapp || '',
        JSON.stringify({ ...store, type: normalizedType, state: normalizedState }),
        store.isPublished !== false,
        store.createdAt ? new Date(store.createdAt) : new Date()
      ]);

      const created = await this.findById(store.id, client);
      return created || { ...store, type: normalizedType, state: normalizedState };
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  },

  async updateStore(id: string, updates: Partial<StoreProfile>, existingClient?: PoolClient): Promise<StoreProfile | null> {
    const client = existingClient || (await pool.connect());
    const shouldRelease = !existingClient;

    try {
      const normalizedType = updates.type ? normalizeStoreType(updates.type) : null;
      const normalizedState = updates.state ? normalizeStateUF(updates.state) : null;
      const safeWhatsapp = updates.whatsapp ? String(updates.whatsapp).slice(0, 20) : null;
      const safePhone = updates.phone ? String(updates.phone).slice(0, 20) : null;
      const safeInstagram = updates.instagram ? String(updates.instagram).slice(0, 50) : null;
      const safeThemeColor = updates.themeColor ? String(updates.themeColor).slice(0, 20) : null;
      const safePlan = updates.plan ? String(updates.plan).slice(0, 20) : null;
      const safeStatus = updates.subscriptionStatus ? String(updates.subscriptionStatus).slice(0, 20) : null;

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
        normalizedType,
        updates.description ?? null,
        updates.slogan ?? null,
        safeThemeColor,
        updates.logoUrl ?? null,
        updates.bannerUrl ?? null,
        safeWhatsapp,
        updates.email || null,
        safePhone,
        safeInstagram,
        updates.city || null,
        normalizedState,
        updates.address ?? null,
        updates.ownerName || null,
        updates.ownerEmail || null,
        updates.ownerPhone || null,
        safePlan,
        updates.monthlyFee ?? null,
        safeStatus,
        updates.nextDueDate ? String(updates.nextDueDate).slice(0, 30) : null,
        updates.lastPaymentDate ? String(updates.lastPaymentDate).slice(0, 30) : null,
        updates.isPublished !== undefined ? updates.isPublished : null,
        JSON.stringify({
          ...updates,
          ...(normalizedType ? { type: normalizedType } : {}),
          ...(normalizedState ? { state: normalizedState } : {})
        }),
        id
      ]);

      if (res.rows.length === 0) return null;
      return await this.findById(id, client);
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
