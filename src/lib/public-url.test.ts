import { buildUmbrellaQrTargetPath, buildUmbrellaQrTargetUrl, slugifyPathSegment } from './public-url';

describe('buildUmbrellaQrTargetUrl', () => {
  it('builds a stable unique QR target from vendor and umbrella ids', () => {
    expect(buildUmbrellaQrTargetUrl('https://app.sandexpress.com.br/', 'vendor-1', 'umbrella-1'))
      .toBe('https://app.sandexpress.com.br/u/vendor-1/umbrella-1');
  });

  it('builds a readable kiosk and umbrella path when names are provided', () => {
    expect(buildUmbrellaQrTargetUrl(
      'https://app.sandexpress.com.br/',
      'vendor-uuid',
      'umbrella-uuid',
      { vendorName: 'Quiosque Sol & Mar', umbrellaNumber: 27 }
    )).toBe('https://app.sandexpress.com.br/u/quiosque-sol-mar/guarda-sol-27-umbrella-uuid');
  });
});

describe('buildUmbrellaQrTargetPath', () => {
  it('stores the readable kiosk and umbrella subpath without the domain', () => {
    expect(buildUmbrellaQrTargetPath('vendor-uuid', 'umbrella-uuid', {
      vendorName: 'Quiosque X',
      umbrellaNumber: 123,
    })).toBe('/u/quiosque-x/guarda-sol-123-umbrella-uuid');
  });
});

describe('slugifyPathSegment', () => {
  it('normalizes accents, symbols and whitespace for public paths', () => {
    expect(slugifyPathSegment('Quiosque Água de Côco nº 10')).toBe('quiosque-agua-de-coco-n-10');
  });
});
