type VendorEmailInput = {
  vendorName: string;
  ownerName?: string | null;
  login?: string | null;
};

type PasswordResetEmailInput = VendorEmailInput & {
  resetUrl: string;
  expiresIn: string;
};

type VendorRegistrationConfirmationEmailInput = VendorEmailInput & {
  trialEndsAt?: string | null;
};

type NewVendorAlertEmailInput = VendorEmailInput & {
  ownerPhone: string;
  ownerEmail: string;
  cpf?: string | null;
  cnpj?: string | null;
  beachName: string;
  city: string;
  state: string;
  address?: string | null;
  planType?: string | null;
  trialEndsAt?: string | null;
  registeredAt?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBrandLogoUrl() {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  return publicUrl ? `${publicUrl}/sandexpress-logo-fluid.png` : '/sandexpress-logo-fluid.png';
}

function shell(title: string, body: string) {
  const logoUrl = getBrandLogoUrl();
  return `
    <div style="margin:0;padding:0;background:#fff8f6;font-family:Arial,sans-serif;color:#261812">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px">
        <div style="background:#ffffff;border:1px solid #f0d5c8;border-radius:16px;padding:28px;line-height:1.5">
          <img src="${escapeHtml(logoUrl)}" alt="SandExpress" width="128" height="72" style="display:block;margin:0 auto 16px;max-width:128px;height:auto" />
          <p style="margin:0 0 12px;color:#ff6b00;font-size:13px;font-weight:700;text-transform:uppercase;text-align:center">SandExpress</p>
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

export function buildVendorRegistrationConfirmationEmail(input: VendorRegistrationConfirmationEmailInput) {
  const ownerLine = input.ownerName ? `, ${escapeHtml(input.ownerName)}` : '';
  const trialLine = input.trialEndsAt
    ? `<p style="margin:0 0 14px">Seu teste gratis fica ativo ate ${escapeHtml(new Date(input.trialEndsAt).toLocaleDateString('pt-BR'))}.</p>`
    : '';
  const loginLine = input.login
    ? `<p style="margin:0 0 14px">Login do painel: <strong>${escapeHtml(input.login)}</strong></p>`
    : '';

  const html = shell(
    'Cadastro recebido',
    `
      <p style="margin:0 0 14px">Ola${ownerLine}.</p>
      <p style="margin:0 0 14px">O quiosque <strong>${escapeHtml(input.vendorName)}</strong> foi cadastrado no SandExpress.</p>
      <p style="margin:0 0 14px">Seu acesso já está liberado. Use o login e a senha criados no cadastro para entrar no painel do quiosque.</p>
      ${loginLine}
      ${trialLine}
    `
  );
  const text = [
    `Cadastro recebido no SandExpress`,
    ``,
    `Quiosque: ${input.vendorName}`,
    input.ownerName ? `Responsavel: ${input.ownerName}` : '',
    input.login ? `Login do painel: ${input.login}` : '',
    input.trialEndsAt ? `Teste gratis ativo ate ${new Date(input.trialEndsAt).toLocaleDateString('pt-BR')}.` : '',
    `Seu acesso já está liberado. Use o login e a senha criados no cadastro para entrar no painel do quiosque.`,
  ].filter(Boolean).join('\n');

  return {
    subject: 'Cadastro recebido no SandExpress',
    html,
    text,
  };
}

export function buildNewVendorAlertEmail(input: NewVendorAlertEmailInput) {
  const rows = [
    ['Quiosque', input.vendorName],
    ['Responsavel', input.ownerName || 'Nao informado'],
    ['Telefone', input.ownerPhone],
    ['Email', input.ownerEmail],
    ['CPF', input.cpf || 'Nao informado'],
    ['CNPJ', input.cnpj || 'Nao informado'],
    ['Praia', input.beachName],
    ['Cidade/UF', `${input.city} / ${input.state}`],
    ['Endereco', input.address || 'Nao informado'],
    ['Login', input.login || 'Nao informado'],
    ['Plano', input.planType || 'trial'],
    ['Fim do teste', input.trialEndsAt ? new Date(input.trialEndsAt).toLocaleDateString('pt-BR') : 'Nao informado'],
    ['Cadastrado em', input.registeredAt ? new Date(input.registeredAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')],
  ];
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f0d5c8;color:#82533f;font-weight:700;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0d5c8;color:#261812;word-break:break-word">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  return {
    subject: `Novo potencial cliente: ${input.vendorName}`,
    html: shell(
      'Voce tem um novo potencial cliente',
      `
        <p style="margin:0 0 16px">Um novo quiosque acabou de concluir o cadastro no SandExpress.</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f0d5c8;border-radius:10px;overflow:hidden;font-size:14px">
          <tbody>${htmlRows}</tbody>
        </table>
      `
    ),
    text: [
      'Voce tem um novo potencial cliente',
      '',
      'Um novo quiosque acabou de concluir o cadastro no SandExpress.',
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ].join('\n'),
  };
}
