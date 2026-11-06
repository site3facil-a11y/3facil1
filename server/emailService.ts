import fs from 'fs';
import path from 'path';
import net from 'net';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { StoreProfile, ProposalLead } from '../src/types/store.js';

export interface SmtpConfig {
  provider?: 'smtp' | 'resend';
  apiKey?: string; // Chave da API Resend (ex: re_...)
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
}

export type ConfigSource = 'env' | 'arquivo' | 'padrao';

export interface SmtpConfigWithSources {
  provider: { value: 'smtp' | 'resend'; origin: ConfigSource };
  apiKey: { value: string; masked: string; origin: ConfigSource };
  host: { value: string; origin: ConfigSource };
  port: { value: number; origin: ConfigSource };
  secure: { value: boolean; origin: ConfigSource };
  user: { value: string; origin: ConfigSource };
  pass: { value: string; masked: string; origin: ConfigSource };
  from: { value: string; origin: ConfigSource };
  replyTo: { value: string; origin: ConfigSource };
  isDocker: boolean;
  defaultLocalHost: string;
  allowedFromDomains: string[];
}

export interface DiagnosticStep {
  step: string;
  name: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface DiagnosticResult {
  success: boolean;
  provider: string;
  host?: string;
  port?: number;
  steps: DiagnosticStep[];
  queueId?: string;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), 'database_storage');
const SMTP_CONFIG_FILE = path.join(DATA_DIR, 'smtp_config.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[EmailService] Erro ao criar diretório:', err);
  }
}

/**
 * Detecta se o aplicativo está rodando dentro de um container Docker.
 */
export function isRunningInDocker(): boolean {
  try {
    return fs.existsSync('/.dockerenv') || process.env.RUNNING_IN_DOCKER === 'true';
  } catch {
    return false;
  }
}

/**
 * Retorna o host local padrão para comunicação com o host do Postfix:
 * - Dentro do Docker: 'host.docker.internal' (mapeado via extra_hosts no compose)
 * - Fora do Docker: '127.0.0.1'
 */
export function getDefaultLocalHost(): string {
  return isRunningInDocker() ? 'host.docker.internal' : '127.0.0.1';
}

/**
 * Verifica se o host informado é considerado local (loopback ou rede interna Docker).
 */
export function isLocalHost(host: string): boolean {
  if (!host) return false;
  const cleanHost = host.trim().toLowerCase();
  if (
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost === '::1' ||
    cleanHost === 'host.docker.internal'
  ) {
    return true;
  }
  // Sub-redes Docker privadas (172.16.0.0/12)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanHost)) {
    return true;
  }
  return false;
}

/**
 * Mascara e-mails para logs e auditoria sem vazar PII (ex: jo***@dominio.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const parts = email.trim().split('@');
  const user = parts[0];
  const domain = parts[1] || '';
  if (user.length <= 2) {
    return `${user.charAt(0)}***@${domain}`;
  }
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Mascara chaves de API e senhas (ex: re_•••••••• ou ••••••••)
 */
export function maskSecret(secret: string, isApiKey = false): string {
  if (!secret) return '';
  if (isApiKey && secret.startsWith('re_')) {
    if (secret.length > 7) {
      return `re_••••${secret.slice(-4)}`;
    }
    return 're_••••••••';
  }
  return '••••••••';
}

/**
 * Extrai o domínio do endereço informado no campo FROM
 */
export function extractFromDomain(from: string): string {
  if (!from) return '3facil.com';
  const match = from.match(/<([^>]+)>/);
  const email = match ? match[1] : from;
  if (email.includes('@')) {
    return email.split('@')[1].toLowerCase().trim();
  }
  return '3facil.com';
}

/**
 * Retorna os domínios autorizados para o remetente FROM
 */
export function getAllowedFromDomains(): string[] {
  const allowed = new Set<string>();
  allowed.add('3facil.com');
  allowed.add('mail.3facil.com');

  if (process.env.APP_URL) {
    try {
      const parsed = new URL(process.env.APP_URL);
      if (parsed.hostname) {
        allowed.add(parsed.hostname.toLowerCase());
        const stripped = parsed.hostname.replace(/^www\./, '');
        if (stripped) allowed.add(stripped.toLowerCase());
      }
    } catch {
      // Ignora erro de parsing de URL
    }
  }

  if (process.env.EMAIL_ALLOWED_FROM_DOMAINS) {
    process.env.EMAIL_ALLOWED_FROM_DOMAINS.split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean)
      .forEach(d => allowed.add(d));
  }

  return Array.from(allowed);
}

function readConfigFile(): Partial<SmtpConfig> {
  ensureDataDir();
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE)) {
      const raw = fs.readFileSync(SMTP_CONFIG_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('[EmailService] Erro ao ler smtp_config.json:', err);
  }
  return {};
}

/**
 * Obtém a configuração de e-mail efetiva com a precedência estrita:
 * 1. Variáveis de ambiente (.env)
 * 2. Arquivo de configuração persistente (database_storage/smtp_config.json)
 * 3. Valores padrão
 */
export function getSmtpConfig(): SmtpConfig {
  const fileConfig = readConfigFile();

  const envApiKey = process.env.RESEND_API_KEY;
  const envProvider = process.env.EMAIL_PROVIDER as 'smtp' | 'resend' | undefined;
  const envHost = process.env.SMTP_HOST;
  const envPort = process.env.SMTP_PORT;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  const envSecure = process.env.SMTP_SECURE;
  const envFrom = process.env.SMTP_FROM;
  const envReplyTo = process.env.SMTP_REPLY_TO;

  const apiKey = envApiKey ?? fileConfig.apiKey ?? '';
  const host = envHost ?? fileConfig.host ?? '';
  const port = Number(envPort ?? fileConfig.port) || 587;
  const user = envUser ?? fileConfig.user ?? '';
  const pass = envPass ?? fileConfig.pass ?? '';
  const secure = envSecure !== undefined ? envSecure === 'true' : (fileConfig.secure ?? (port === 465));
  const from = envFrom ?? fileConfig.from ?? `"3Fácil Plataforma" <${user || 'contato@3facil.com'}>`;
  const replyTo = envReplyTo ?? fileConfig.replyTo ?? '';

  // Determinar provider com precedência explícita:
  // 1. Se EMAIL_PROVIDER foi explicitamente definido no .env, vence tudo.
  // 2. Sem EMAIL_PROVIDER, use smtp quando houver host (SMTP_HOST) e resend apenas se não houver host.
  let provider: 'smtp' | 'resend';
  if (envProvider === 'smtp' || envProvider === 'resend') {
    provider = envProvider;
  } else if (host) {
    provider = 'smtp';
  } else if (fileConfig.provider === 'smtp' || fileConfig.provider === 'resend') {
    provider = fileConfig.provider;
  } else if (apiKey) {
    provider = 'resend';
  } else {
    provider = 'smtp';
  }


  return { provider, apiKey, host, port, secure, user, pass, from, replyTo };
}

/**
 * Devolve para o Superadmin a configuração mascarada juntamente com a ORIGEM de cada campo ('env' | 'arquivo' | 'padrao')
 * NUNCA expõe senhas ou chaves completas.
 */
export function getSmtpConfigWithSources(): SmtpConfigWithSources {
  const fileConfig = readConfigFile();
  const effective = getSmtpConfig();

  const resolveSource = <T>(envVal: any, fileVal: any): ConfigSource => {
    if (envVal !== undefined && envVal !== '') return 'env';
    if (fileVal !== undefined && fileVal !== '') return 'arquivo';
    return 'padrao';
  };

  const providerOrigin: ConfigSource = process.env.EMAIL_PROVIDER
    ? 'env'
    : (fileConfig.provider ? 'arquivo' : 'padrao');

  return {
    provider: {
      value: effective.provider || 'smtp',
      origin: providerOrigin
    },
    apiKey: {
      value: effective.apiKey ? maskSecret(effective.apiKey, true) : '',
      masked: maskSecret(effective.apiKey, true),
      origin: resolveSource(process.env.RESEND_API_KEY, fileConfig.apiKey)
    },
    host: {
      value: effective.host,
      origin: resolveSource(process.env.SMTP_HOST, fileConfig.host)
    },
    port: {
      value: effective.port,
      origin: resolveSource(process.env.SMTP_PORT, fileConfig.port)
    },
    secure: {
      value: effective.secure,
      origin: resolveSource(process.env.SMTP_SECURE, fileConfig.secure)
    },
    user: {
      value: effective.user,
      origin: resolveSource(process.env.SMTP_USER, fileConfig.user)
    },
    pass: {
      value: effective.pass ? maskSecret(effective.pass, false) : '',
      masked: maskSecret(effective.pass, false),
      origin: resolveSource(process.env.SMTP_PASS, fileConfig.pass)
    },
    from: {
      value: effective.from,
      origin: resolveSource(process.env.SMTP_FROM, fileConfig.from)
    },
    replyTo: {
      value: effective.replyTo || '',
      origin: resolveSource(process.env.SMTP_REPLY_TO, fileConfig.replyTo)
    },
    isDocker: isRunningInDocker(),
    defaultLocalHost: getDefaultLocalHost(),
    allowedFromDomains: getAllowedFromDomains()
  };
}

/**
 * Salva configurações exclusivamente em database_storage/smtp_config.json (volume persistente).
 * Não escreve em .env dentro do container para evitar conflitos com o host.
 */
export function saveSmtpConfig(config: Partial<SmtpConfig>): boolean {
  ensureDataDir();
  try {
    const currentFile = readConfigFile();
    const updated: Partial<SmtpConfig> = {
      ...currentFile
    };

    if (config.provider !== undefined) updated.provider = config.provider;
    if (config.apiKey !== undefined) updated.apiKey = config.apiKey.trim();
    if (config.host !== undefined) updated.host = config.host.trim();
    if (config.port !== undefined) updated.port = Number(config.port) || 587;
    if (config.secure !== undefined) updated.secure = Boolean(config.secure);
    if (config.user !== undefined) updated.user = config.user.trim();
    if (config.pass !== undefined && config.pass !== '••••••••' && config.pass !== '********') {
      updated.pass = config.pass.replace(/\s+/g, '');
    }
    if (config.from !== undefined) updated.from = config.from.trim();
    if (config.replyTo !== undefined) updated.replyTo = config.replyTo.trim();

    // Persistir no volume persistente database_storage/smtp_config.json
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    // Atualiza variáveis em memória apenas se não foram travadas pelo ambiente
    if (!process.env.EMAIL_PROVIDER && updated.provider) process.env.EMAIL_PROVIDER = updated.provider;
    if (!process.env.RESEND_API_KEY && updated.apiKey) process.env.RESEND_API_KEY = updated.apiKey;
    if (!process.env.SMTP_HOST && updated.host) process.env.SMTP_HOST = updated.host;
    if (!process.env.SMTP_PORT && updated.port) process.env.SMTP_PORT = String(updated.port);
    if (!process.env.SMTP_SECURE && updated.secure !== undefined) process.env.SMTP_SECURE = String(updated.secure);
    if (!process.env.SMTP_USER && updated.user) process.env.SMTP_USER = updated.user;
    if (!process.env.SMTP_PASS && updated.pass) process.env.SMTP_PASS = updated.pass;
    if (!process.env.SMTP_FROM && updated.from) process.env.SMTP_FROM = updated.from;
    if (!process.env.SMTP_REPLY_TO && updated.replyTo) process.env.SMTP_REPLY_TO = updated.replyTo;

    return true;
  } catch (err) {
    console.error('[EmailService] Erro ao salvar configurações de e-mail:', err);
    return false;
  }
}

/**
 * Valida se o serviço está configurado para envios reais.
 */
export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();

  // Modo Resend API
  if (config.provider === 'resend') {
    return Boolean(config.apiKey && config.apiKey.length > 5);
  }

  // Modo SMTP
  if (!config.host) return false;

  // Postfix local na porta 25: não exige usuário nem senha
  if (isLocalHost(config.host) && Number(config.port) === 25) {
    return true;
  }

  // SMTP externo tradicional exige usuário e senha
  return Boolean(config.user && config.pass);
}

/**
 * Criação do Transporter Nodemailer (para modo SMTP)
 * Regra crítica de segurança e conectividade:
 * - Se o host for local e a porta for 25, NUNCA define auth (evita erro de SASL no Postfix local)
 * - tls.rejectUnauthorized = false APENAS para hosts locais; para hosts externos, validação normal estrita (true)
 */
export function createTransporter(configOverride?: Partial<SmtpConfig>) {
  const config = configOverride ? { ...getSmtpConfig(), ...configOverride } : getSmtpConfig();
  if (!config.host) return null;

  const isLocal = isLocalHost(config.host);
  const isPort25 = Number(config.port) === 25;

  const transportOptions: any = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: {
      rejectUnauthorized: !isLocal, // Validação estrita para servidores remotos, flexível para Postfix local
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  };

  // Se o host for local e na porta 25, NUNCA defina auth mesmo que user/pass existam
  if (!(isLocal && isPort25)) {
    if (config.user && config.pass) {
      transportOptions.auth = {
        user: config.user,
        pass: config.pass ? config.pass.replace(/\s+/g, '') : '',
      };
    }
  }

  return nodemailer.createTransport(transportOptions);
}

/**
 * Envia e-mail via API REST HTTPS do Resend
 */
async function sendViaResend(
  apiKey: string,
  options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    headers?: Record<string, string>;
  }
): Promise<{ success: boolean; messageId?: string; error?: string; statusCode?: number }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo || undefined,
        headers: options.headers || undefined,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errMsg = data?.message || data?.error || `HTTP ${res.status}`;
      if (typeof errMsg === 'string') {
        if (errMsg.includes('only send testing emails to your own email address') || errMsg.includes('testing emails')) {
          errMsg = `Restrição do Resend Sandbox: Remetente de testes só entrega para o e-mail cadastrado na conta Resend. Valide o domínio em resend.com/domains.`;
        } else if (errMsg.includes('not verified') || errMsg.includes('domain')) {
          errMsg = `Domínio não verificado no Resend: O domínio "${options.from}" ainda não foi verificado com registros DNS em resend.com/domains.`;
        }
      }
      return { success: false, error: errMsg, statusCode: res.status };
    }

    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message, statusCode: 500 };
  }
}

/**
 * Extrai o ID da fila do Postfix a partir da resposta SMTP (ex: "250 2.0.0 Ok: queued as 4Zb7rQ48zGz1f4k")
 */
function extractQueueId(responseString?: string): string | undefined {
  if (!responseString) return undefined;
  const match = responseString.match(/queued as\s+([A-Za-z0-9]+)/i);
  return match ? match[1] : undefined;
}

/**
 * Traduz erros comuns de SMTP e rede para mensagens claras em português.
 */
export function translateSmtpError(err: any, host?: string, port?: number): string {
  if (!err) return 'Erro desconhecido de conexão com servidor de e-mail';
  const msg = String(err.message || err.code || err);
  const code = String(err.code || '');
  const response = String(err.response || '');

  if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return `Postfix não responde em ${host || 'host'}:${port || 25} (serviço parado ou firewall bloqueando porta 25)`;
  }
  if (code === 'ETIMEDOUT' || msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
    return `Tempo esgotado ao conectar no servidor de e-mail (${host || 'host'}:${port || 587})`;
  }
  if (code === 'EAUTH' || msg.includes('EAUTH') || response.includes('535') || msg.includes('535')) {
    if (isLocalHost(host || '')) {
      return 'Servidor não aceita autenticação; para Postfix local deixe usuário e senha vazios';
    }
    return 'Falha de autenticação no servidor SMTP: usuário ou senha inválidos. Para o Gmail, é obrigatório gerar uma Senha de App de 16 letras na Conta Google e preencher no SMTP_PASS.';
  }
  if (response.includes('550') || response.includes('553') || msg.includes('550') || msg.includes('553')) {
    return 'Remetente ou domínio não autorizado pelo servidor SMTP';
  }
  if (code === 'ENOTFOUND' || msg.includes('ENOTFOUND')) {
    return `Endereço de host não encontrado: ${host || 'host'}`;
  }
  return msg;
}

/**
 * Determina se o erro ocorrido é temporário/transiente (permite retry com backoff)
 * Erros 5xx de rejeição definitiva nunca sofrem retry.
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.code || error);
  const resp = String(error.response || '');
  const responseCode = Number(error.responseCode || error.statusCode);

  // Erros definitivos 5xx nunca devem sofrer retry
  if ((responseCode >= 500 && responseCode < 600) || /\b5\d{2}\b/.test(resp)) {
    return false;
  }

  // Falha de autenticação permanente
  if (error.code === 'EAUTH' || resp.includes('535')) {
    return false;
  }

  // Erros de conexão de rede ou timeout
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN|ESOCKETTIMEDOUT/i.test(msg)) {
    return true;
  }

  // Códigos de erro SMTP temporários 4xx (421, 450, 451, 452)
  if ((responseCode >= 400 && responseCode < 500) || /\b4\d{2}\b/.test(resp)) {
    return true;
  }

  return false;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envia mensagem com resiliência: 3 tentativas e backoff (2s, 10s, 30s) para erros temporários.
 */
async function sendWithRetry(
  options: {
    to: string;
    subject: string;
    text?: string;
    html: string;
    replyTo?: string;
  },
  type: string
): Promise<{ success: boolean; message: string; messageId?: string; queueId?: string; simulated?: boolean }> {
  const config = getSmtpConfig();
  const maskedTo = maskEmail(options.to);

  if (!isSmtpConfigured()) {
    console.log(`[EmailService - SIMULADO] [${type}] Destino: ${maskedTo} | Assunto: ${options.subject}`);
    return {
      success: true,
      simulated: true,
      message: `[Simulação] Mensagem preparada para ${maskedTo}. Configure o e-mail no Painel Master para envio real.`
    };
  }

  // Cabeçalhos de entregabilidade
  const fromDomain = extractFromDomain(config.from);
  const messageId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${fromDomain}>`;
  const customHeaders: Record<string, string> = {
    'Message-ID': messageId,
    'Auto-Submitted': 'auto-generated',
    'X-Auto-Response-Suppress': 'All'
  };

  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  // Delays de backoff: em ambiente de teste são curtos para velocidade da suíte
  const retryDelays = isTest ? [10, 20, 30] : [2000, 10000, 30000];
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // 1. Envio via Resend API (se provider for estritamente 'resend')
      if (config.provider === 'resend') {
        const resendResult = await sendViaResend(config.apiKey || '', {
          from: config.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo || config.replyTo,
          headers: customHeaders,
        });

        if (resendResult.success) {
          console.log(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: sent | Tentativa: ${attempt}/${maxAttempts} | MessageId: ${resendResult.messageId}`);
          return {
            success: true,
            message: `E-mail enviado com sucesso via Resend API para ${maskedTo}`,
            messageId: resendResult.messageId
          };
        }

        const transient = isTransientError({ message: resendResult.error, statusCode: resendResult.statusCode });
        if (!transient || attempt === maxAttempts) {
          console.warn(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: rejected | Tentativa: ${attempt}/${maxAttempts} | Motivo: ${resendResult.error}`);
          return {
            success: false,
            message: `Falha no envio via Resend API: ${resendResult.error}`
          };
        }

        const delay = retryDelays[attempt - 1] || 2000;
        console.warn(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: retry | Tentativa: ${attempt}/${maxAttempts} | Aguardando ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // 2. Envio via SMTP (Postfix Local ou Externo)
      const transporter = createTransporter();
      if (!transporter) {
        return { success: false, message: 'Cliente SMTP não pôde ser instanciado.' };
      }

      const info = await transporter.sendMail({
        from: config.from,
        replyTo: options.replyTo || config.replyTo || undefined,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        headers: customHeaders,
      });

      const queueId = extractQueueId(info.response);
      console.log(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: sent | Tentativa: ${attempt}/${maxAttempts} | QueueId: ${queueId || 'N/A'}`);

      return {
        success: true,
        message: `E-mail enviado com sucesso via SMTP para ${maskedTo}`,
        messageId: info.messageId,
        queueId
      };
    } catch (err: any) {
      const queueId = extractQueueId(err.response);
      const translatedMsg = translateSmtpError(err, config.host, config.port);
      const transient = isTransientError(err);

      if (!transient || attempt === maxAttempts) {
        console.warn(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: ${transient ? 'exhausted' : 'rejected'} | Tentativa: ${attempt}/${maxAttempts} | Motivo: ${translatedMsg}`);
        return {
          success: false,
          message: `Erro ao enviar e-mail: ${translatedMsg}`
        };
      }

      const delay = retryDelays[attempt - 1] || 2000;
      console.warn(`[EmailService] [${type}] Destinatário: ${maskedTo} | Status: retry | Tentativa: ${attempt}/${maxAttempts} | Motivo: ${translatedMsg} | Aguardando ${delay}ms...`);
      await sleep(delay);
    }
  }

  return { success: false, message: 'Tentativas de envio esgotadas.' };
}

/**
 * Executa diagnóstico passo a passo do canal de e-mail.
 */
export async function runEmailDiagnostic(testRecipient?: string): Promise<DiagnosticResult> {
  const config = getSmtpConfig();
  const steps: DiagnosticStep[] = [];
  let queueId: string | undefined;

  // Passo 1: Resolução de Provider e Host
  const isLocal = isLocalHost(config.host);
  const isPort25 = Number(config.port) === 25;
  const providerDesc = config.provider === 'resend'
    ? 'Resend API via HTTPS (Porta 443)'
    : (isLocal && isPort25
        ? `Postfix Local (${config.host}:${config.port} sem autenticação SASL)`
        : `SMTP Remoto (${config.host}:${config.port} com autenticação)`);

  steps.push({
    step: 'provider_resolution',
    name: 'Resolução de Provedor & Host',
    status: 'success',
    message: `Provedor efetivo: ${config.provider?.toUpperCase()} | ${providerDesc}`,
    details: {
      provider: config.provider,
      host: config.host,
      port: config.port,
      isLocal,
      isPort25,
      from: config.from
    }
  });

  // Se provider for Resend API
  if (config.provider === 'resend') {
    if (!config.apiKey) {
      steps.push({
        step: 'resend_auth',
        name: 'Autenticação Resend API',
        status: 'error',
        message: 'Chave RESEND_API_KEY não foi configurada.'
      });
      return { success: false, provider: 'resend', steps, error: 'Chave do Resend não configurada.' };
    }

    try {
      const res = await fetch('https://api.resend.com/api-keys', {
        headers: { 'Authorization': `Bearer ${config.apiKey.trim()}` }
      });
      if (res.ok) {
        steps.push({
          step: 'resend_auth',
          name: 'Autenticação Resend API',
          status: 'success',
          message: 'Chave do Resend validada com sucesso na API HTTPS.'
        });
      } else {
        const data: any = await res.json().catch(() => ({}));
        steps.push({
          step: 'resend_auth',
          name: 'Autenticação Resend API',
          status: 'error',
          message: `Chave rejeitada pelo Resend: ${data?.message || res.statusText}`
        });
        return { success: false, provider: 'resend', steps, error: 'Chave rejeitada pelo Resend.' };
      }
    } catch (e: any) {
      steps.push({
        step: 'resend_auth',
        name: 'Conexão HTTPS Resend',
        status: 'error',
        message: `Falha de rede com api.resend.com: ${e.message}`
      });
      return { success: false, provider: 'resend', steps, error: e.message };
    }

    if (testRecipient) {
      const testSend = await sendWithRetry({
        to: testRecipient,
        subject: '✅ Teste de Diagnóstico 3Fácil (Resend API)',
        text: 'E-mail de diagnóstico enviado com sucesso via Resend API.',
        html: '<p>E-mail de diagnóstico enviado com sucesso via Resend API.</p>'
      }, 'diagnostic');

      if (testSend.success) {
        steps.push({
          step: 'test_send',
          name: 'Disparo de Teste Real',
          status: 'success',
          message: `E-mail de teste entregue via Resend API para ${maskEmail(testRecipient)}. ID: ${testSend.messageId || 'OK'}`
        });
      } else {
        steps.push({
          step: 'test_send',
          name: 'Disparo de Teste Real',
          status: 'error',
          message: `Erro ao enviar teste: ${testSend.message}`
        });
        return { success: false, provider: 'resend', steps, error: testSend.message };
      }
    }

    return { success: true, provider: 'resend', steps };
  }

  // Se provider for SMTP
  if (!config.host) {
    steps.push({
      step: 'tcp_connection',
      name: 'Conexão TCP',
      status: 'error',
      message: 'Servidor SMTP_HOST não está configurado.'
    });
    return { success: false, provider: 'smtp', steps, error: 'SMTP_HOST ausente.' };
  }

  // Passo 2: Teste de Conexão TCP direta com socket
  const tcpResult = await new Promise<{ ok: boolean; message: string; elapsed: number }>((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host: config.host, port: config.port, timeout: 5000 });

    socket.on('connect', () => {
      const elapsed = Date.now() - start;
      socket.end();
      resolve({ ok: true, message: `Conexão TCP estabelecida em ${elapsed}ms`, elapsed });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, message: translateSmtpError({ code: 'ETIMEDOUT' }, config.host, config.port), elapsed: 5000 });
    });

    socket.on('error', (err) => {
      resolve({ ok: false, message: translateSmtpError(err, config.host, config.port), elapsed: Date.now() - start });
    });
  });

  if (!tcpResult.ok) {
    steps.push({
      step: 'tcp_connection',
      name: `Conexão TCP (${config.host}:${config.port})`,
      status: 'error',
      message: tcpResult.message
    });
    return {
      success: false,
      provider: 'smtp',
      host: config.host,
      port: config.port,
      steps,
      error: tcpResult.message
    };
  }

  steps.push({
    step: 'tcp_connection',
    name: `Conexão TCP (${config.host}:${config.port})`,
    status: 'success',
    message: tcpResult.message
  });

  // Passo 3: Handshake SMTP (EHLO / STARTTLS / Auth se configurada)
  const transporter = createTransporter();
  if (!transporter) {
    steps.push({
      step: 'smtp_handshake',
      name: 'Handshake SMTP (EHLO)',
      status: 'error',
      message: 'Falha ao inicializar o transporter Nodemailer.'
    });
    return { success: false, provider: 'smtp', host: config.host, port: config.port, steps };
  }

  try {
    await transporter.verify();
    steps.push({
      step: 'smtp_handshake',
      name: 'Handshake SMTP (EHLO / STARTTLS)',
      status: 'success',
      message: `Handshake SMTP concluído com sucesso com ${config.host}:${config.port}`
    });
  } catch (verifyErr: any) {
    const translated = translateSmtpError(verifyErr, config.host, config.port);
    steps.push({
      step: 'smtp_handshake',
      name: 'Handshake SMTP (EHLO / STARTTLS)',
      status: 'error',
      message: translated
    });
    return {
      success: false,
      provider: 'smtp',
      host: config.host,
      port: config.port,
      steps,
      error: translated
    };
  }

  // Passo 4: Envio de teste opcional
  if (testRecipient) {
    try {
      const fromDomain = extractFromDomain(config.from);
      const testMsgId = `<test.${Date.now()}.${crypto.randomBytes(6).toString('hex')}@${fromDomain}>`;

      const sendRes = await transporter.sendMail({
        from: config.from,
        to: testRecipient,
        subject: '✅ Teste de Diagnóstico 3Fácil (Postfix / SMTP)',
        text: 'E-mail de diagnóstico disparado pelo Painel Master da plataforma 3facil.com.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 10px;">
            <h2 style="color: #38bdf8;">✅ Teste de Diagnóstico SMTP Concluído!</h2>
            <p>Servidor: <strong>${config.host}:${config.port}</strong></p>
            <p>Destinatário: <strong>${testRecipient}</strong></p>
            <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        `,
        headers: {
          'Message-ID': testMsgId,
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All'
        }
      });

      queueId = extractQueueId(sendRes.response);
      steps.push({
        step: 'test_send',
        name: 'Disparo de Teste Real & Queue ID',
        status: 'success',
        message: queueId
          ? `E-mail aceito pelo Postfix! Fila: queued as ${queueId}`
          : `E-mail enviado com sucesso para ${maskEmail(testRecipient)} (${sendRes.response || 'OK'})`,
        details: { response: sendRes.response, queueId }
      });
    } catch (sendErr: any) {
      const translated = translateSmtpError(sendErr, config.host, config.port);
      steps.push({
        step: 'test_send',
        name: 'Disparo de Teste Real & Queue ID',
        status: 'error',
        message: translated
      });
      return {
        success: false,
        provider: 'smtp',
        host: config.host,
        port: config.port,
        steps,
        error: translated
      };
    }
  }

  return {
    success: true,
    provider: 'smtp',
    host: config.host,
    port: config.port,
    queueId,
    steps
  };
}

// Testar Conexão / Status simples
export async function testSmtpConnection(): Promise<{ success: boolean; message: string; configDetails?: any }> {
  const diag = await runEmailDiagnostic();
  if (diag.success) {
    return {
      success: true,
      message: diag.steps[diag.steps.length - 1]?.message || 'Conexão de e-mail verificada com sucesso!',
      configDetails: {
        provider: diag.provider,
        host: diag.host,
        port: diag.port
      }
    };
  }
  return {
    success: false,
    message: diag.error || diag.steps.find(s => s.status === 'error')?.message || 'Falha ao verificar serviço de e-mail.',
    configDetails: {
      provider: diag.provider,
      host: diag.host,
      port: diag.port
    }
  };
}

// Construtor do conteúdo de E-mail de Boas-Vindas e Confirmação de Cadastro (sem senhas em texto)
export function buildWelcomeEmailContent(
  store: StoreProfile,
  verificationUrl?: string,
  appUrl?: string
): { recipientEmail: string; recipientName: string; subject: string; text: string; html: string } {
  const recipientEmail = store.ownerEmail || store.email;
  const recipientName = store.ownerName || store.name;
  const siteUrl = appUrl || process.env.APP_URL || 'https://3facil.com';
  const storeUrl = `${siteUrl}/?loja=${store.slug || store.id}`;
  const adminUrl = `${siteUrl}/?admin=true&store=${store.id}`;

  const storeTypeLabels: Record<string, string> = {
    veiculo: 'Loja de Veículos & Autos',
    imovel: 'Imobiliária & Corretores',
    produto: 'Loja de Produtos Físicos',
    servico: 'Prestador de Serviços',
  };

  const tipoLabel = storeTypeLabels[store.type] || 'Loja / Catálogo';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmação de Cadastro - 3Fácil</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
        .logo span { color: #93c5fd; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
        .card { background-color: #0f172a; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; }
        .card-row:last-child { border-bottom: none; }
        .card-label { color: #94a3b8; font-size: 14px; }
        .card-value { color: #f8fafc; font-size: 14px; font-weight: 600; }
        .action-box { background: rgba(37, 99, 235, 0.1); border: 1px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; margin: 12px 0; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">3<span>fácil</span>.com</div>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Plataforma de Vitrines e Catálogos Digitais</p>
        </div>
        <div class="content">
          <h2 class="greeting">Olá, ${recipientName}! 🎉</h2>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Sua conta na <strong>3Fácil</strong> foi criada com sucesso! Para publicar sua vitrine e começar a receber visitas e propostas, por favor confirme seu endereço de e-mail clicando no botão abaixo:
          </p>

          ${verificationUrl ? `
          <div class="action-box">
            <h3 style="margin: 0 0 8px 0; color: #93c5fd; font-size: 16px;">Ativação de Cadastro</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #cbd5e1;">Link válido por 24 horas para uso único:</p>
            <a href="${verificationUrl}" class="button">Confirmar Cadastro e Publicar Vitrine</a>
            <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8; word-break: break-all;">
              Ou copie e cole no seu navegador:<br/>
              <span style="color: #60a5fa;">${verificationUrl}</span>
            </p>
          </div>
          ` : ''}

          <div class="card">
            <div class="card-row">
              <span class="card-label">Nome da Vitrine</span>
              <span class="card-value">${store.name}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Segmento</span>
              <span class="card-value">${tipoLabel}</span>
            </div>
            <div class="card-row">
              <span class="card-label">WhatsApp de Contato</span>
              <span class="card-value">${store.whatsapp || 'Não informado'}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Link da Vitrine</span>
              <span class="card-value"><a href="${storeUrl}" style="color: #60a5fa;" target="_blank">${storeUrl}</a></span>
            </div>
          </div>

          <div style="text-align: center; margin: 24px 0 12px 0;">
            <a href="${adminUrl}" style="color: #93c5fd; text-decoration: underline; font-size: 13px;">Acessar Painel do Lojista</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0;">Você recebeu esta mensagem porque se cadastrou na plataforma 3facil.com.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Olá ${recipientName}!\n\nSua loja "${store.name}" foi criada no 3facil.com.\n\nPara confirmar seu cadastro e publicar sua vitrine, acesse:\n${verificationUrl || adminUrl}\n\nLink da Vitrine: ${storeUrl}\nPainel: ${adminUrl}`;

  return {
    recipientEmail,
    recipientName,
    subject: `🎉 Confirmação de Cadastro: Ative sua loja na 3Fácil - ${store.name}`,
    text: textContent,
    html: htmlContent
  };
}

// Envio de E-mail de Boas-Vindas e Confirmação de Cadastro
export async function sendWelcomeEmail(
  store: StoreProfile,
  verificationUrl?: string,
  appUrl?: string
): Promise<{ success: boolean; message: string; simulated?: boolean; queueId?: string }> {
  const content = buildWelcomeEmailContent(store, verificationUrl, appUrl);
  return sendWithRetry({
    to: content.recipientEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  }, 'welcome_confirmation');
}

// Convite enviado pelo Superadmin ao lojista para definir a senha de uma nova loja
export async function sendStoreInviteEmail(
  store: StoreProfile,
  inviteUrl: string,
  appUrl?: string
): Promise<{ success: boolean; message: string; simulated?: boolean; queueId?: string }> {
  const recipientEmail = store.ownerEmail || store.email;
  const recipientName = store.ownerName || store.name;
  const siteUrl = appUrl || process.env.APP_URL || 'https://3facil.com';
  const storeUrl = `${siteUrl}/?loja=${store.slug || store.id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite de Acesso - 3Fácil</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
        .logo span { color: #93c5fd; }
        .content { padding: 32px 24px; }
        .action-box { background: rgba(37, 99, 235, 0.1); border: 1px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; margin: 12px 0; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">3<span>fácil</span>.com</div>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Convite de Acesso ao Painel do Lojista</p>
        </div>
        <div class="content">
          <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0;">Olá, ${recipientName}! 👋</h2>
          <p style="font-size: 15px; line-height: 1.6;">
            Sua vitrine online <strong>"${store.name}"</strong> foi criada na plataforma 3Fácil.
          </p>
          <div class="action-box">
            <h3 style="margin: 0 0 8px 0; color: #93c5fd; font-size: 16px;">Defina sua Senha de Acesso</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #cbd5e1;">Clique abaixo para cadastrar sua senha com segurança (link válido por 24 horas):</p>
            <a href="${inviteUrl}" class="button">Definir Minha Senha de Acesso</a>
            <p style="margin: 12px 0 0 0; font-size: 11px; color: #94a3b8; word-break: break-all;">
              Ou copie e cole no navegador:<br/>
              <span style="color: #60a5fa;">${inviteUrl}</span>
            </p>
          </div>
          <p style="font-size: 13px; color: #94a3b8;">
            Link da sua vitrine pública: <a href="${storeUrl}" style="color: #60a5fa;" target="_blank">${storeUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0;">Mensagem automática gerada pela plataforma 3facil.com.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendWithRetry({
    to: recipientEmail,
    subject: `Convite de Acesso à Plataforma 3Fácil - ${store.name}`,
    text: `Olá ${recipientName}!\n\nSua loja "${store.name}" foi criada no 3facil.com.\n\nPara definir sua senha de acesso e começar a gerenciar sua vitrine, acesse o link abaixo (válido por 24 horas):\n${inviteUrl}\n\nVitrine: ${storeUrl}`,
    html: htmlContent,
  }, 'store_invite');
}

// Envio de E-mail de Teste
export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; simulated?: boolean; queueId?: string }> {
  return sendWithRetry({
    to: toEmail,
    subject: `✅ Teste de Envio de E-mail - 3facil.com`,
    text: `Este é um e-mail de teste disparado pelo painel da plataforma 3facil.com.\n\nSe você está lendo isso, o serviço de envio de e-mails da sua plataforma está 100% operacional!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 520px; margin: 0 auto; border: 1px solid #334155;">
        <h2 style="color: #38bdf8; margin-top: 0;">✅ Teste de E-mail Concluído com Sucesso!</h2>
        <p style="font-size: 14px; line-height: 1.6;">O serviço de e-mails transacionais da plataforma <strong>3facil.com</strong> está configurado e funcionando perfeitamente.</p>
        <div style="background: rgba(255,255,255,0.06); padding: 14px; border-radius: 8px; margin: 18px 0; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Destinatário:</strong> ${toEmail}</p>
          <p style="margin: 0;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Seus clientes e lojistas receberão propostas e notificações normalmente.</p>
      </div>
    `
  }, 'test_email');
}

// Notificação por e-mail ao lojista quando um novo lead/proposta chega pela vitrine pública
export async function sendNewLeadEmail(
  store: StoreProfile,
  lead: ProposalLead,
  appUrl?: string
): Promise<{ success: boolean; message: string; simulated?: boolean; queueId?: string }> {
  const recipientEmail = store.ownerEmail || store.email;

  if (!recipientEmail) {
    return { success: false, message: 'A loja não tem e-mail cadastrado para receber notificações.' };
  }

  const siteUrl = appUrl || process.env.APP_URL || 'https://3facil.com';
  const adminUrl = `${siteUrl}/?admin=true&store=${store.id}`;

  const itemTypeLabels: Record<string, string> = {
    veiculo: 'Veículo',
    imovel: 'Imóvel',
    produto: 'Produto',
    servico: 'Serviço',
  };
  const tipoLabel = itemTypeLabels[lead.itemType] || 'Item';

  const cleanClientPhone = lead.clientPhone ? lead.clientPhone.replace(/\D/g, '') : '';
  const waReplyUrl = cleanClientPhone 
    ? `https://wa.me/55${cleanClientPhone}?text=${encodeURIComponent(`Olá ${lead.clientName}, vi seu interesse no anúncio "${lead.itemTitle}" na ${store.name}. Como posso ajudar?`)}`
    : '';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #334155;">
      <h2 style="color: #34d399; margin-top: 0; font-size: 22px;">💬 Novo Lead Recebido!</h2>
      <p style="font-size: 14px; line-height: 1.5;">Um novo cliente demonstrou interesse em um anúncio da sua vitrine na <strong>${store.name}</strong>:</p>

      <div style="background-color: #0f172a; border-radius: 12px; padding: 18px 20px; margin: 20px 0; border: 1px solid #334155;">
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">${tipoLabel}:</strong> <span style="color: #f8fafc; font-weight: 600;">${lead.itemTitle}</span></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">Cliente:</strong> <span style="color: #f8fafc;">${lead.clientName}</span></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">WhatsApp / Tel:</strong> <a href="tel:${lead.clientPhone}" style="color: #60a5fa; text-decoration: none;">${lead.clientPhone || 'Não informado'}</a></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">E-mail:</strong> ${lead.clientEmail || 'Não informado'}</p>
        ${lead.proposalValue ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Valor Proposta:</strong> <span style="color: #34d399; font-weight: bold;">R$ ${Number(lead.proposalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>` : ''}
        ${lead.tradeDetails ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Detalhes:</strong> <span style="color: #cbd5e1;">${lead.tradeDetails}</span></p>` : ''}
        ${lead.clientMessage ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Mensagem:</strong> <span style="color: #e2e8f0;">${lead.clientMessage}</span></p>` : ''}
      </div>

      <div style="margin: 24px 0; text-align: center;">
        ${waReplyUrl ? `
          <a href="${waReplyUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; margin-right: 10px; margin-bottom: 8px;">
            📲 Chamar no WhatsApp
          </a>
        ` : ''}
        <a href="${adminUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; margin-bottom: 8px;">
          Abrir no Painel
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Dica de Ouro: Leads atendidos nos primeiros 5 minutos convertem até 80% mais!</p>
    </div>
  `;

  return sendWithRetry({
    to: recipientEmail,
    replyTo: lead.clientEmail || undefined,
    subject: `💬 Novo lead na sua loja "${store.name}": ${lead.itemTitle}`,
    text: `Novo lead recebido!\n\n${tipoLabel}: ${lead.itemTitle}\nCliente: ${lead.clientName}\nTelefone: ${lead.clientPhone || 'Não informado'}\nE-mail: ${lead.clientEmail || 'Não informado'}\n${lead.clientMessage ? `Mensagem: ${lead.clientMessage}\n` : ''}\nAcesse seu painel: ${adminUrl}`,
    html: htmlContent,
  }, 'new_lead');
}

// Envio de E-mail de Redefinição de Senha
export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
  targetName?: string,
  role: 'store' | 'superadmin' = 'store'
): Promise<{ success: boolean; message: string; simulated?: boolean; queueId?: string }> {
  const isStore = role === 'store';
  const subject = isStore
    ? `🔑 Redefinição de senha — ${targetName || 'Sua Loja'} | 3fácil.com`
    : '🔑 Redefinição de senha — Painel Master 3fácil.com';

  const title = isStore
    ? `Redefinir Senha da Loja "${targetName || 'sua loja'}"`
    : 'Redefinir Senha do Painel Master';

  const bodyDescription = isStore
    ? `Recebemos um pedido para criar uma nova senha de acesso à sua loja <strong>${targetName || ''}</strong> na plataforma 3fácil.com.`
    : `Recebemos um pedido para redefinir a senha do <strong>Painel Master</strong> da plataforma 3fácil.com.`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 36px;">🔑</span>
        <h2 style="color: #ffffff; margin: 10px 0 6px 0; font-size: 22px;">${title}</h2>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">Plataforma 3fácil.com</p>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 18px; border-radius: 12px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">
          ${bodyDescription}
        </p>
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
          Criar Nova Senha
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
        Este link é seguro e expira em 30 minutos.<br />
        Se você não solicitou essa redefinição, fique tranquilo: sua conta permanece segura e sua senha atual não foi alterada.
      </p>
    </div>
  `;

  return sendWithRetry({
    to: toEmail,
    subject,
    text: `${title}\n\n${bodyDescription.replace(/<[^>]+>/g, '')}\n\nClique no link abaixo para criar sua nova senha (válido por 30 minutos):\n${resetLink}\n\nSe não foi você que solicitou, ignore este e-mail — sua senha atual continua válida e segura.`,
    html: htmlContent,
  }, 'password_reset');
}
