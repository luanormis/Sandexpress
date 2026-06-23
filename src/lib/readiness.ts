type ReadinessStatus = 'ok' | 'missing' | 'invalid';
type ReportStatus = 'ok' | 'degraded' | 'blocked';

type EnvSource = Record<string, string | undefined>;

export type ReadinessItem = {
  name: string;
  status: ReadinessStatus;
  requiredFor: string;
  action: string;
};

export type ReadinessReport = {
  status: ReportStatus;
  required: ReadinessItem[];
  external: ReadinessItem[];
  recommended: ReadinessItem[];
};

type EnvRequirement = {
  name: string;
  requiredFor: string;
  action: string;
  minLength?: number;
  validate?: (value: string) => boolean;
};

const REQUIRED_ENV: EnvRequirement[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    requiredFor: 'Conectar ao banco Supabase real.',
    action: 'Configure a URL do projeto Supabase, como https://SEU-PROJETO.supabase.co.',
    validate: isHttpUrl,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    requiredFor: 'Inicializar cliente Supabase no frontend.',
    action: 'Copie a anon public key do Supabase.',
    minLength: 32,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    requiredFor: 'Executar APIs server-side com acesso administrativo ao banco.',
    action: 'Copie a service role key do Supabase apenas para ambiente server-side.',
    minLength: 32,
  },
  {
    name: 'SESSION_SECRET',
    requiredFor: 'Assinar sessoes seguras de admin, quiosque e cliente.',
    action: 'Gere um segredo aleatorio com pelo menos 32 caracteres.',
    minLength: 32,
  },
  {
    name: 'ADMIN_PASSWORD',
    requiredFor: 'Acessar o painel administrativo da plataforma.',
    action: 'Defina uma senha administrativa forte.',
    minLength: 8,
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    requiredFor: 'Gerar QR Codes com o dominio publico correto.',
    action: 'Configure a URL publica do app usada no deploy.',
    validate: isHttpUrl,
  },
];

const EXTERNAL_ENV: EnvRequirement[] = [
  {
    name: 'META_WHATSAPP_PHONE_NUMBER_ID',
    requiredFor: 'Enviar OTP real pelo WhatsApp Cloud API.',
    action: 'Copie o Phone Number ID do numero conectado na Meta.',
  },
  {
    name: 'META_WHATSAPP_ACCESS_TOKEN',
    requiredFor: 'Autenticar chamadas na Meta WhatsApp Cloud API.',
    action: 'Configure token permanente de System User com permissao de WhatsApp.',
    minLength: 20,
  },
  {
    name: 'META_WHATSAPP_OTP_TEMPLATE_NAME',
    requiredFor: 'Usar template aprovado de OTP no WhatsApp.',
    action: 'Informe o nome do template aprovado, como sandexpress_otp_ptbr.',
  },
  {
    name: 'META_WHATSAPP_OTP_TEMPLATE_LANGUAGE',
    requiredFor: 'Selecionar o idioma aprovado do template OTP.',
    action: 'Informe o idioma aprovado, como pt_BR.',
  },
  {
    name: 'OTP_PEPPER',
    requiredFor: 'Proteger hashes dos codigos OTP gravados no banco.',
    action: 'Gere um segredo aleatorio com pelo menos 32 caracteres, diferente do SESSION_SECRET.',
    minLength: 32,
  },
];

const RECOMMENDED_ENV: EnvRequirement[] = [
  {
    name: 'OTP_TTL_SECONDS',
    requiredFor: 'Controlar expiracao dos codigos OTP.',
    action: 'Use 300 para codigos com validade de 5 minutos.',
  },
  {
    name: 'RESEND_API_KEY',
    requiredFor: 'Enviar emails reais de recuperacao quando habilitado.',
    action: 'Configure uma chave Resend se for usar recuperacao por email em producao.',
  },
  {
    name: 'EMAIL_FROM',
    requiredFor: 'Definir remetente real dos emails enviados pelo Resend.',
    action: 'Use um remetente de dominio verificado, como SandExpress <noreply@seudominio.com.br>.',
  },
];

export function buildReadinessReport(env: EnvSource = process.env): ReadinessReport {
  const required = REQUIRED_ENV.map((requirement) => evaluateRequirement(requirement, env));
  const external = EXTERNAL_ENV.map((requirement) => evaluateRequirement(requirement, env));
  const recommended = RECOMMENDED_ENV.map((requirement) => evaluateRequirement(requirement, env));

  return {
    status: getReportStatus(required, external),
    required,
    external,
    recommended,
  };
}

export function getBlockingReadinessIssues(report: ReadinessReport) {
  return report.required.filter((item) => item.status !== 'ok').map((item) => item.name);
}

function getReportStatus(required: ReadinessItem[], external: ReadinessItem[]): ReportStatus {
  if (required.some((item) => item.status !== 'ok')) return 'blocked';
  if (external.some((item) => item.status !== 'ok')) return 'degraded';
  return 'ok';
}

function evaluateRequirement(requirement: EnvRequirement, env: EnvSource): ReadinessItem {
  const value = env[requirement.name]?.trim();
  if (!value) return { ...toItem(requirement), status: 'missing' };
  if (requirement.minLength && value.length < requirement.minLength) {
    return { ...toItem(requirement), status: 'invalid' };
  }
  if (requirement.validate && !requirement.validate(value)) {
    return { ...toItem(requirement), status: 'invalid' };
  }
  return { ...toItem(requirement), status: 'ok' };
}

function toItem(requirement: EnvRequirement) {
  return {
    name: requirement.name,
    requiredFor: requirement.requiredFor,
    action: requirement.action,
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
