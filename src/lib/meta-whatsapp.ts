type OtpPayloadInput = {
  to: string;
  templateName: string;
  language: string;
  code: string;
};

export function buildMetaOtpTemplatePayload(input: OtpPayloadInput) {
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.language },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: input.code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: input.code }],
        },
      ],
    },
  };
}

export async function sendMetaOtp(input: OtpPayloadInput) {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !token) {
    throw new Error('Meta WhatsApp nao configurado.');
  }

  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0';
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildMetaOtpTemplatePayload(input)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao enviar OTP pela Meta.');
  }

  return data;
}
