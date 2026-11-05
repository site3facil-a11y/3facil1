import rateLimit from 'express-rate-limit';

const isTest = () => Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest() ? 10000 : 300,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições originadas deste IP. Aguarde alguns instantes antes de tentar novamente.'
    }
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest() ? 10000 : 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Muitas tentativas de autenticação consecutivas. Por segurança, tente novamente em 15 minutos.'
    }
  }
});

export const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isTest() ? 10000 : 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_PROPOSALS',
      message: 'Limite de propostas por hora atingido. Aguarde antes de enviar novas mensagens.'
    }
  }
});

export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest() ? 10000 : 10,
  skip: isTest,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_EMAILS',
      message: 'Limite de envio de e-mails atingido temporariamente. Tente novamente mais tarde.'
    }
  }
});

/**
 * Rate limit para diagnóstico de e-mail: máximo 6 requisições por minuto por IP.
 */
export const emailDiagnosticLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isTest() ? 10000 : 6,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_DIAGNOSTICS',
      message: 'Limite de testes de diagnóstico atingido (máx 6 por minuto). Aguarde um instante.'
    }
  }
});


/**
 * Rate limit específico de cadastro público: 5 por hora por IP.
 * Aplica-se tanto em dev quanto em testes para garantir que a proteção funcione.
 */
export const registerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 cadastros por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_REGISTRATIONS',
      message: 'Muitas tentativas de cadastro a partir deste IP. Aguarde 1 hora antes de tentar novamente.'
    }
  }
});

const emailRegistrationLog: Map<string, number[]> = new Map();

/**
 * Rate limit por e-mail: máximo 3 cadastros por dia por e-mail.
 */
export function checkEmailRegistrationRateLimit(email: string): boolean {
  const cleanEmail = email.toLowerCase().trim();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const attempts = (emailRegistrationLog.get(cleanEmail) || []).filter(ts => now - ts < oneDay);
  if (attempts.length >= 3) {
    return false;
  }
  attempts.push(now);
  emailRegistrationLog.set(cleanEmail, attempts);
  return true;
}

const resendVerificationLog: Map<string, number[]> = new Map();

/**
 * Rate limit de reenvio de confirmação: máximo 3 por hora por e-mail.
 */
export function checkResendVerificationRateLimit(email: string): boolean {
  const cleanEmail = email.toLowerCase().trim();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const attempts = (resendVerificationLog.get(cleanEmail) || []).filter(ts => now - ts < oneHour);
  if (attempts.length >= 3) {
    return false;
  }
  attempts.push(now);
  resendVerificationLog.set(cleanEmail, attempts);
  return true;
}
