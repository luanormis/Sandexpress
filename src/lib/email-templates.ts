type VendorEmailInput = {
  vendorName: string;
  ownerName?: string | null;
  login?: string | null;
};

type PasswordResetEmailInput = VendorEmailInput & {
  resetUrl: string;
  expiresIn: string;
};

type VendorVerificationEmailInput = VendorEmailInput & {
  verificationUrl: string;
  trialEndsAt?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shell(title: string, body: string) {
  return `
    <div style="margin:0;padding:0;background:#fff8f6;font-family:Arial,sans-serif;color:#261812">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px">
        <div style="background:#ffffff;border:1px solid #f0d5c8;border-radius:16px;padding:28px;line-height:1.5">
          <p style="margin:0 0 12px;color:#ff6b00;font-size:13px;font-weight:700;text-transform:uppercase">SandExpress</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#261812">${escapeHtml(title)}</h1>
          ${body}
        </div>
        <p style="margin:16px 0 0;text-align:center;color:#82533f;font-size:12px">Este email foi enviado pelo SandExpress.</p>
      </div>
    </div>
  `;
}

function button(label: string, href: string) {
  return `
    <p style="margin:24px 0">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#ff6b00;color:#ffffff;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput) {
  const vendorName = escapeHtml(input.vendorName);
  const ownerLine = input.ownerName ? `, ${escapeHtml(input.ownerName)}` : '';
  const html = shell(
    'Recuperacao de senha',
    `
      <p style="margin:0 0 14px">Ola${ownerLine}.</p>
      <p style="margin:0 0 14px">Recebemos uma solicitacao para criar uma nova senha do quiosque <strong>${vendorName}</strong>.</p>
      ${button('Criar nova senha', input.resetUrl)}
      <p style="margin:0 0 14px">O link vence em ${escapeHtml(input.expiresIn)}. Se voce nao pediu isso, ignore este email.</p>
      <p style="margin:0;color:#82533f;font-size:13px;word-break:break-all">Link de apoio: ${escapeHtml(input.resetUrl)}</p>
    `
  );
  const text = [
    `Recuperacao de senha SandExpress`,
    ``,
    `Quiosque: ${input.vendorName}`,
    input.ownerName ? `Responsavel: ${input.ownerName}` : '',
    `Use este link para criar uma nova senha: ${input.resetUrl}`,
    `O link vence em ${input.expiresIn}.`,
    `Se voce nao pediu isso, ignore este email.`,
  ].filter(Boolean).join('\n');

  return {
    subject: 'Recuperacao de senha SandExpress',
    html,
    text,
  };
}

export function buildVendorVerificationEmail(input: VendorVerificationEmailInput) {
  const ownerLine = input.ownerName ? `, ${escapeHtml(input.ownerName)}` : '';
  const trialLine = input.trialEndsAt
    ? `<p style="margin:0 0 14px">Seu teste gratis fica ativo ate ${escapeHtml(new Date(input.trialEndsAt).toLocaleDateString('pt-BR'))}.</p>`
    : '';
  const loginLine = input.login
    ? `<p style="margin:0 0 14px">Login do painel: <strong>${escapeHtml(input.login)}</strong></p>`
    : '';

  const html = shell(
    'Confirme o cadastro do quiosque',
    `
      <p style="margin:0 0 14px">Ola${ownerLine}.</p>
      <p style="margin:0 0 14px">O quiosque <strong>${escapeHtml(input.vendorName)}</strong> foi cadastrado no SandExpress.</p>
      <p style="margin:0 0 14px">Confirme este email para validar o cadastro, recuperar senha com seguranca e receber comunicados operacionais.</p>
      ${loginLine}
      ${trialLine}
      ${button('Validar meu email', input.verificationUrl)}
      <p style="margin:0;color:#82533f;font-size:13px;word-break:break-all">Link de apoio: ${escapeHtml(input.verificationUrl)}</p>
    `
  );
  const text = [
    `Confirme o cadastro do quiosque SandExpress`,
    ``,
    `Quiosque: ${input.vendorName}`,
    input.ownerName ? `Responsavel: ${input.ownerName}` : '',
    input.login ? `Login do painel: ${input.login}` : '',
    input.trialEndsAt ? `Teste gratis ativo ate ${new Date(input.trialEndsAt).toLocaleDateString('pt-BR')}.` : '',
    `Valide seu email neste link: ${input.verificationUrl}`,
  ].filter(Boolean).join('\n');

  return {
    subject: 'Valide o cadastro do seu quiosque SandExpress',
    html,
    text,
  };
}
