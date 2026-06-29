import {
  buildMetaOtpTemplatePayload,
  buildMetaTextPayload,
  extractMetaWebhookMessages,
  isSandexpressOtpRequest,
} from './meta-whatsapp';

describe('meta whatsapp otp payload', () => {
  it('builds an authentication template payload with copy-code button', () => {
    expect(buildMetaOtpTemplatePayload({
      to: '+5511999999999',
      templateName: 'sandexpress_otp_ptbr',
      language: 'pt_BR',
      code: '123456',
    })).toEqual({
      messaging_product: 'whatsapp',
      to: '+5511999999999',
      type: 'template',
      template: {
        name: 'sandexpress_otp_ptbr',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: '123456' }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: '123456' }],
          },
        ],
      },
    });
  });
});

describe('meta whatsapp inbound validation', () => {
  it('accepts the SandExpress validation phrase with flexible accents and spaces', () => {
    expect(isSandexpressOtpRequest('obter codigo de validação para o sandexpress')).toBe(true);
    expect(isSandexpressOtpRequest('  Obter Código de Validação para o SandExpress  ')).toBe(true);
    expect(isSandexpressOtpRequest('quero um codigo')).toBe(false);
  });

  it('extracts inbound text messages from the Meta webhook payload', () => {
    const messages = extractMetaWebhookMessages({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '5511999999999',
              id: 'wamid.123',
              timestamp: '1790000000',
              text: { body: 'obter codigo de validação para o sandexpress' },
            }],
          },
        }],
      }],
    });

    expect(messages).toEqual([{
      from: '5511999999999',
      id: 'wamid.123',
      timestamp: '1790000000',
      text: 'obter codigo de validação para o sandexpress',
    }]);
  });

  it('builds a plain text response payload for inbound customer initiated conversations', () => {
    expect(buildMetaTextPayload({
      to: '+5511999999999',
      text: 'Seu codigo SandExpress e 102121.',
    })).toEqual({
      messaging_product: 'whatsapp',
      to: '+5511999999999',
      type: 'text',
      text: {
        preview_url: false,
        body: 'Seu codigo SandExpress e 102121.',
      },
    });
  });
});
