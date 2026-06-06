type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'SandExpress <onboarding@resend.dev>';

  if (!resendKey) {
    return {
      ok: false,
      reason: 'missing_provider',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Email send error:', response.status, detail);
    return {
      ok: false,
      reason: 'provider_error',
    };
  }

  return { ok: true };
}

export function getAppBaseUrl(req?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const url = new URL(req.url);
    return url.origin;
  }
  return 'http://localhost:3000';
}
