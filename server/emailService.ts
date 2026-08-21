import nodemailer from 'nodemailer';
import { StoreProfile, ProposalLead } from '../src/types/store.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.SMTP_FROM || `"3Fácil Plataforma" <${user || 'contato@3facil.com'}>`;

  return { host, port, secure, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
}

// Criação do Transporter Nodemailer
export function createTransporter() {
  const config = getSmtpConfig();
  if (!isSmtpConfigured()) return null;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false, // Evita falhas com certificados autoassinados em VPS
    },
  });
}

// Testar Conexão SMTP
export async function testSmtpConnection(): Promise<{ success: boolean; message: string; configDetails?: any }> {
  const config = getSmtpConfig();
  
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP não configurado no .env. Configure SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.',
      configDetails: {
        host: config.host || '(não definido)',
        port: config.port,
        user: config.user || '(não definido)',
        hasPassword: Boolean(config.pass),
      }
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Falha ao instanciar o cliente SMTP.' };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: `Conexão SMTP com ${config.host}:${config.port} autenticada com sucesso!`,
      configDetails: {
        host: config.host,
        port: config.port,
        user: config.user,
        from: config.from,
      }
    };
  } catch (error: any) {
    console.error('[EmailService] Erro ao verificar SMTP:', error);
    return {
      success: false,
      message: `Erro na autenticação SMTP: ${error.message}`,
      configDetails: {
        host: config.host,
        port: config.port,
        user: config.user,
      }
    };
  }
}

// Envio de E-mail de Boas-Vindas e Confirmação de Cadastro
export async function sendWelcomeEmail(store: StoreProfile, appUrl?: string): Promise<{ success: boolean; message: string; simulated?: boolean }> {
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
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; margin: 10px 0; }
        .button-secondary { background-color: #334155; margin-left: 8px; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
        .badge { display: inline-block; background-color: #10b981; color: #ffffff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
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
          <p style="color: #cbd5e1; line-height: 1.6; margin-top: 0;">
            Seu cadastro foi realizado com sucesso na plataforma <strong>3facil.com</strong>! Sua vitrine profissional já está configurada e pronta para receber produtos e clientes.
          </p>

          <div class="card">
            <div style="margin-bottom: 12px;">
              <span class="badge">Cadastro Confirmado</span>
            </div>
            <div class="card-row">
              <span class="card-label">Nome da Loja:</span>
              <span class="card-value">${store.name}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Segmento / Modelo:</span>
              <span class="card-value">${tipoLabel}</span>
            </div>
            <div class="card-row">
              <span class="card-label">WhatsApp de Vendas:</span>
              <span class="card-value">${store.whatsapp}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Plano Selecionado:</span>
              <span class="card-value">${store.planName || store.plan || 'Profissional'} (R$ ${Number(store.monthlyFee || 30).toFixed(2)}/mês)</span>
            </div>
            <div class="card-row">
              <span class="card-label">Próximo Vencimento:</span>
              <span class="card-value">${store.nextDueDate || '30 dias'}</span>
            </div>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${adminUrl}" class="button">Acessar Meu Painel de Gestão</a>
            <br>
            <a href="${storeUrl}" style="color: #60a5fa; font-size: 13px; text-decoration: underline; display: inline-block; margin-top: 12px;">
              Visualizar Minha Vitrine Pública Online (${store.slug})
            </a>
          </div>

          <div style="background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 10px; padding: 14px; font-size: 13px; color: #93c5fd; line-height: 1.5;">
            💡 <strong>Próximos passos:</strong> Cadastre suas primeiras fotos, produtos ou veículos e compartilhe o link direto com seus clientes no WhatsApp e redes sociais.
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0 0 6px 0;">© ${new Date().getFullYear()} 3facil.com - Todos os direitos reservados.</p>
          <p style="margin: 0;">Você recebeu este e-mail porque cadastrou sua loja em nossa plataforma.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isSmtpConfigured()) {
    console.log(`[EmailService - SIMULADO] Confirmação de Cadastro para: ${recipientEmail} | Loja: ${store.name}`);
    return {
      success: true,
      simulated: true,
      message: `[Simulação] E-mail de confirmação preparado para ${recipientEmail}. Para envio real via internet, configure o SMTP no arquivo .env.`
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
  }

  try {
    const config = getSmtpConfig();
    const info = await transporter.sendMail({
      from: config.from,
      to: recipientEmail,
      subject: `🎉 Cadastro Confirmado: Bem-vindo à 3Fácil - ${store.name}`,
      text: `Olá ${recipientName}! Sua loja "${store.name}" foi criada com sucesso no 3facil.com.\n\nAcesse seu painel em: ${adminUrl}\nVeja sua vitrine em: ${storeUrl}`,
      html: htmlContent,
    });

    console.log('[EmailService] E-mail de boas-vindas enviado com sucesso:', info.messageId);
    return { success: true, message: `E-mail de confirmação enviado para ${recipientEmail}!` };
  } catch (error: any) {
    console.error('[EmailService] Falha ao enviar e-mail de boas-vindas:', error);
    return { success: false, message: `Erro ao enviar e-mail: ${error.message}` };
  }
}

// Envio de E-mail de Teste
export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      simulated: true,
      message: 'SMTP não configurado no .env. Adicione SMTP_HOST, SMTP_USER e SMTP_PASS para disparar e-mails reais.'
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
  }

  try {
    const config = getSmtpConfig();
    await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject: `✅ Teste de Envio de E-mail - 3facil.com`,
      text: `Este é um e-mail de teste disparado pelo painel da plataforma 3facil.com.\n\nSe você está lendo isso, a configuração SMTP do seu servidor está 100% funcional!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #38bdf8;">✅ Teste de E-mail Concluído com Sucesso!</h2>
          <p>O serviço de envio de e-mails transacionais da plataforma <strong>3facil.com</strong> está configurado e funcionando corretamente.</p>
          <p style="color: #94a3b8; font-size: 13px;">Disparado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `
    });

    return { success: true, message: `E-mail de teste enviado com sucesso para ${toEmail}!` };
  } catch (error: any) {
    return { success: false, message: `Falha no envio do teste: ${error.message}` };
  }
}
