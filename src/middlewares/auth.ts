import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub?: string;
  userId?: string;
  role: 'superadmin' | 'lojista' | string;
  storeId?: string | null;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware: authenticate (alias authenticateToken)
 * Valida o cabeçalho Authorization: Bearer <token>.
 * Retorna 401 quando não houver token ou for inválido/expirado.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || (req as any).cookies?.auth_token;

  if (!token) {
    res.status(401).json({ error: 'Acesso não autorizado. Token de autenticação não fornecido.' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    res.status(500).json({ error: 'Erro crítico de configuração: JWT_SECRET não configurado adequadamente no servidor.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload;
    if (decoded.sub && !decoded.userId) {
      decoded.userId = decoded.sub;
    }
    if (decoded.userId && !decoded.sub) {
      decoded.sub = decoded.userId;
    }
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
    return;
  }
};

// Alias para compatibilidade com chamadas existentes
export const authenticateToken = authenticate;

/**
 * Middleware opcional: autentica se o token for enviado, prossegue sem erro se não for
 */
export const optionalAuthenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || (req as any).cookies?.auth_token;

  if (!token) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload;
    if (decoded.sub && !decoded.userId) {
      decoded.userId = decoded.sub;
    }
    if (decoded.userId && !decoded.sub) {
      decoded.sub = decoded.userId;
    }
    req.user = decoded;
  } catch {
    // Ignora token inválido em rotas com autenticação opcional
  }
  next();
};

/**
 * Middleware: requireRole(role | role[])
 * Exige um ou mais papéis específicos (ex: 'superadmin').
 * Retorna 401 se não estiver autenticado e 403 se o papel for insuficiente.
 */
export const requireRole = (allowedRoles: string | string[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado. Token de acesso obrigatório.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso negado: permissões insuficientes.' });
      return;
    }

    next();
  };
};

/**
 * Middleware: requireSuperAdmin
 * Atalho equivalente a requireRole('superadmin')
 */
export const requireSuperAdmin = requireRole('superadmin');

/**
 * Middleware: requireStoreOwner
 * O lojista só pode acessar recursos onde loja_id == req.user.storeId.
 * Superadmin acessa todos os recursos.
 * Retorna 401 se não autenticado e 403 se faltar permissão.
 */
export const requireStoreOwner = (
  targetExtractor?: string | ((req: Request) => string | undefined | null)
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado. Token de acesso obrigatório.' });
      return;
    }

    // Superadmin tem permissão total
    if (req.user.role === 'superadmin') {
      return next();
    }

    let targetStoreId: string | undefined | null;

    if (typeof targetExtractor === 'function') {
      targetStoreId = targetExtractor(req);
    } else if (typeof targetExtractor === 'string') {
      targetStoreId = (req.params as any)[targetExtractor] || (req.body as any)?.[targetExtractor] || (req.query as any)?.[targetExtractor];
    } else {
      // Padrão: tenta param 'id', 'storeId', body.storeId, body.loja_id, param.loja_id
      targetStoreId = req.params.storeId || req.params.id || req.body?.storeId || req.body?.loja_id || (req.query?.storeId as string);
    }

    if (req.user.role === 'lojista' && req.user.storeId && targetStoreId && req.user.storeId === targetStoreId) {
      return next();
    }

    res.status(403).json({ error: 'Acesso negado: você não tem permissão para acessar ou modificar dados desta loja.' });
  };
};

// Alias para compatibilidade
export const requireStoreOwnerOrAdmin = requireStoreOwner;
