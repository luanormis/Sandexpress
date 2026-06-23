import { buildMetaOtpTemplatePayload } from './meta-whatsapp';

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
