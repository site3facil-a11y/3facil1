export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: any) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Acesso não autorizado.', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Acesso negado: permissões insuficientes.', code = 'FORBIDDEN') {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, code, message);
  }

  static tooManyRequests(message = 'Muitas requisições. Tente novamente mais tarde.', code = 'TOO_MANY_REQUESTS') {
    return new AppError(429, code, message);
  }

  static serviceUnavailable(message = 'Serviço temporariamente indisponível.', code = 'SERVICE_UNAVAILABLE') {
    return new AppError(503, code, message);
  }

  static internal(message = 'Ocorreu um erro interno no servidor.', code = 'INTERNAL_ERROR') {
    return new AppError(500, code, message);
  }
}
