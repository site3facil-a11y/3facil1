/**
 * Justificativa de Armazenamento de Token no Frontend:
 * O token JWT é gerenciado de forma segura no frontend com envio obrigatório do cabeçalho
 * "Authorization: Bearer <token>" e espelhamento em cookie httpOnly + SameSite (Lax).
 * Em aplicações SaaS com múltiplos subdomínios e ambiente embarcado de visualização (iframe do Dev/Preview),
 * o cabeçalho Authorization: Bearer garante que as requisições não sofram bloqueios de cookies
 * de terceiros (Third-Party Cookie Restrictions dos navegadores modernos), enquanto o cookie httpOnly
 * assegura persistência e defesa em profundidade em rotas do mesmo domínio.
 */

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
};

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { 
    ...options, 
    headers,
    credentials: 'include' // Envia cookies httpOnly + SameSite em conjunto com o header Authorization: Bearer
  });

  if ((response.status === 401 || response.status === 403) && token && !url.includes('/api/auth/login')) {
    // Token expirado ou sem permissão suficiente: limpa token e despacha evento para UI redirecionar ao login
    removeAuthToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: { status: response.status, url } }));
    }
  }

  return response;
};
