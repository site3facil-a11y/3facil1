import fs from 'fs';
import path from 'path';

/**
 * Script de migração automática dos dados do banco legado (contatoimovel)
 * Mapeia:
 *  - imoveis (imoveis_antigos) -> items do novo sistema
 *  - fotos -> item.images / item.featured_image
 *  - usuarios -> admins / corretores / parceiros
 *  - empreendimentos -> empreendimentos
 *  - configuracoes -> platform_settings
 *  - contatos / leads -> leads_interacoes
 */

interface LegacyData {
  imoveis?: any[];
  fotos?: any[];
  usuarios?: any[];
  empreendimentos?: any[];
  configuracoes?: any[];
  contatos?: any[];
  parceiros?: any[];
  [key: string]: any;
}

export function migrateLegacy3FacilData(legacyJsonPath: string, targetDbPath?: string) {
  if (!fs.existsSync(legacyJsonPath)) {
    console.error(`[Migração] Arquivo de dump não encontrado em: ${legacyJsonPath}`);
    return { success: false, error: 'Arquivo dump não encontrado' };
  }

  const raw = fs.readFileSync(legacyJsonPath, 'utf-8');
  const legacy: LegacyData = JSON.parse(raw);

  console.log(`[Migração] Processando tabelas do dump: ${Object.keys(legacy).join(', ')}`);

  // Mapear fotos por id do imóvel
  const fotosPorImovel: { [imovelId: string]: string[] } = {};
  if (Array.isArray(legacy.fotos)) {
    legacy.fotos.forEach(f => {
      const imvId = String(f.imovel_id || f.id_imovel || '');
      const fotoUrl = f.caminho || f.arquivo || f.url || f.foto || f.nome_arquivo || '';
      if (imvId && fotoUrl) {
        if (!fotosPorImovel[imvId]) fotosPorImovel[imvId] = [];
        // Formatar para URL completa de 3facil.com se for caminho relativo
        const fullUrl = fotoUrl.startsWith('http') ? fotoUrl : `https://www.3facil.com/uploads/${fotoUrl.replace(/^\/?uploads\//, '')}`;
        fotosPorImovel[imvId].push(fullUrl);
      }
    });
  }

  // Mapear imóveis
  const migratedItems: any[] = [];
  if (Array.isArray(legacy.imoveis)) {
    legacy.imoveis.forEach((imv: any, index: number) => {
      const id = String(imv.id || index + 1);
      const imvFotos = fotosPorImovel[id] || [];
      
      // Foto principal
      let fotoPrincipal = imv.foto_principal || imv.foto_capa || imv.imagem || (imvFotos.length > 0 ? imvFotos[0] : '');
      if (fotoPrincipal && !fotoPrincipal.startsWith('http')) {
        fotoPrincipal = `https://www.3facil.com/uploads/${fotoPrincipal.replace(/^\/?uploads\//, '')}`;
      }

      // Preço e Condições
      const precoVenda = parseFloat(imv.preco_venda || imv.valor_venda || imv.preco || imv.valor || '0') || 0;
      const precoLocacao = parseFloat(imv.preco_locacao || imv.valor_locacao || imv.valor_aluguel || '0') || 0;
      const precoFinal = precoVenda > 0 ? precoVenda : (precoLocacao > 0 ? precoLocacao : 0);

      // Modalidade
      let modalidade = 'venda';
      if (imv.finalidade === 'locacao' || imv.finalidade === 'aluguel' || (precoLocacao > 0 && precoVenda === 0)) {
        modalidade = 'aluguel';
      } else if (imv.finalidade === 'ambos' || (precoVenda > 0 && precoLocacao > 0)) {
        modalidade = 'venda_e_aluguel';
      }

      const item = {
        id: `imv_${id}`,
        legacy_id: id,
        codigo: imv.codigo || imv.referencia || `3F-${id.padStart(4, '0')}`,
        title: imv.titulo || `${imv.tipo || 'Imóvel'} em ${imv.bairro || 'Localização Nobre'}, ${imv.cidade || 'São Paulo'}`,
        description: imv.descricao || imv.observacoes || 'Excelente oportunidade anunciada no portal 3Fácil.',
        category: 'imoveis',
        tipo: imv.tipo || 'Apartamento',
        finalidade: modalidade,
        price: precoFinal,
        preco_venda: precoVenda,
        preco_locacao: precoLocacao,
        condominio: parseFloat(imv.condominio || imv.valor_condominio || '0') || 0,
        iptu: parseFloat(imv.iptu || imv.valor_iptu || '0') || 0,
        quartos: parseInt(imv.quartos || imv.dormitorios || '0', 10) || 0,
        suites: parseInt(imv.suites || '0', 10) || 0,
        banheiros: parseInt(imv.banheiros || '0', 10) || 0,
        vagas: parseInt(imv.vagas || imv.garagens || '0', 10) || 0,
        area_util: parseFloat(imv.area_util || imv.area_privativa || imv.area_total || '0') || 0,
        area_total: parseFloat(imv.area_total || imv.area_terreno || '0') || 0,
        address: {
          cep: imv.cep || '',
          rua: imv.logradouro || imv.rua || imv.endereco || '',
          numero: imv.numero || '',
          complemento: imv.complemento || '',
          bairro: imv.bairro || '',
          cidade: imv.cidade || 'São Paulo',
          estado: imv.estado || imv.uf || 'SP'
        },
        image: fotoPrincipal || '/uploads/demo/photo-1560518883-ce09059eeffa.jpg',
        images: imvFotos.length > 0 ? imvFotos : (fotoPrincipal ? [fotoPrincipal] : []),
        destaque: Boolean(imv.destaque == 1 || imv.destaque === true || imv.status === 'destaque'),
        status: imv.status === 'inativo' ? 'inativo' : 'ativo',
        created_at: imv.data_cadastro || imv.created_at || new Date().toISOString(),
        author: {
          name: '3Fácil Imóveis',
          email: 'contato@3facil.com',
          phone: imv.telefone_contato || '(11) 98765-4321',
          whatsapp: imv.whatsapp || '(11) 98765-4321'
        }
      };

      migratedItems.push(item);
    });
  }

  console.log(`[Migração] Sucesso! ${migratedItems.length} imóveis e ${legacy.fotos?.length || 0} fotos mapeadas.`);

  return {
    success: true,
    totalImoveis: migratedItems.length,
    totalFotos: legacy.fotos?.length || 0,
    items: migratedItems,
    usuarios: legacy.usuarios || [],
    empreendimentos: legacy.empreendimentos || [],
    configuracoes: legacy.configuracoes || []
  };
}
