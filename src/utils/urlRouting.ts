import { StoreType } from '../types/store';

export const RESERVED_ROUTE_SEGMENTS = new Set([
  'admin',
  'painel',
  'master',
  'landing',
  'login',
  'api',
]);

export interface ParsedAppUrl {
  pathSlug: string;
  queryStoreSlug: string;
  queryStoreId: string;
  requestedSlug: string;
  isAdminRoute: boolean;
  isMasterRoute: boolean;
  resetToken: string | null;
}

export function parseAppUrl(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): ParsedAppUrl {
  const pathSlug = (pathname || '')
    .replace(/^\/+/, '')
    .split('/')[0]
    ?.toLowerCase()
    .trim() || '';

  const params = new URLSearchParams(search || '');
  const queryStoreSlug = (params.get('loja') || '').toLowerCase().trim();
  const queryStoreId = (params.get('store') || '').trim();
  const isAdminParam = params.get('admin') === 'true';

  const isPathAdmin = pathSlug === 'admin' || pathSlug === 'painel';
  const isMasterRoute = pathSlug === 'master';
  const isAdminRoute = isPathAdmin || isAdminParam;

  const pathPublicSlug =
    pathSlug && !RESERVED_ROUTE_SEGMENTS.has(pathSlug) ? pathSlug : '';

  const requestedSlug = queryStoreSlug || pathPublicSlug;

  const resetToken =
    params.get('reset-token') ||
    (params.get('reset') === 'true' ? params.get('token') : null);

  return {
    pathSlug,
    queryStoreSlug,
    queryStoreId,
    requestedSlug,
    isAdminRoute,
    isMasterRoute,
    resetToken,
  };
}

export function normalizeClientStoreType(rawType?: string | null): StoreType {
  const val = (rawType || '').toLowerCase().trim();
  const map: Record<string, StoreType> = {
    veiculo: 'veiculo',
    veiculos: 'veiculo',
    imovel: 'imovel',
    imoveis: 'imovel',
    produto: 'produto',
    produtos: 'produto',
    servico: 'servico',
    servicos: 'servico',
    locadora: 'locadora',
    locadoras: 'locadora',
  };
  return map[val] || 'produto';
}
