type OtpPayloadInput = {
  to: string;
  templateName: string;
  language: string;
  code: string;
};

type TextPayloadInput = {
  to: string;
  text: string;
};

export type MetaInboundMessage = {
  from: string;
  id?: string;
  timestamp?: string;
  text: string;
};

const SANDEXPRESS_OTP_PHRASE = 'obter codigo de validacao para o sandexpress';

function normalizeInboundText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isSandexpressOtpRequest(value: unknown) {
  return normalizeInboundText(value) === SANDEXPRESS_OTP_PHRASE;
}

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

export function buildMetaTextPayload(input: TextPayloadInput) {
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'text',
    text: {
      preview_url: false,
      body: input.text,
    },
  };
}

export function extractMetaWebhookMessages(payload: any): MetaInboundMessage[] {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  return entries.flatMap((entry: any) => {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    return changes.flatMap((change: any) => {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      return messages
        .filter((message: any) => message?.type === 'text' || message?.text?.body)
        .map((message: any) => ({
          from: String(message.from || ''),
          id: message.id ? String(message.id) : undefined,
          timestamp: message.timestamp ? String(message.timestamp) : undefined,
          text: String(message.text?.body || ''),
        }))
        .filter((message: MetaInboundMessage) => message.from && message.text);
    });
  });
}

async function sendMetaMessage(payload: unknown) {
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
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao enviar mensagem pela Meta.');
  }

  return data;
}

export async function sendMetaOtp(input: OtpPayloadInput) {
  return sendMetaMessage(buildMetaOtpTemplatePayload(input));
}

export async function sendMetaText(input: TextPayloadInput) {
  return sendMetaMessage(buildMetaTextPayload(input));
}
