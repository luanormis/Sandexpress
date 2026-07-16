import { createBrandedQrSvg, svgToDataUrl } from '@/lib/branded-qr';

describe('branded QR code', () => {
  it('creates a valid SVG with the SandExpress orange mark in the center', async () => {
    const svg = await createBrandedQrSvg('https://app.sandexpress.com.br/u/teste/guarda-sol-1');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('fill="#FF6B00"');
    expect(svg).toContain('<rect x="39" y="39" width="22" height="22"');
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('encodes the branded SVG as a browser-safe image data URL', () => {
    const value = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(value).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(value.split(',')[1], 'base64').toString()).toContain('<svg');
  });
});
