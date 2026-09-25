import QRCode from 'qrcode';

const SAND_EXPRESS_MARK = `
  <rect x="39" y="39" width="22" height="22" rx="4" fill="#ffffff"/>
  <g transform="translate(41 41) scale(.18)">
    <path d="M50 50 L50 10 L78 22 Z" fill="#FF6B00"/>
    <path d="M50 50 L78 22 L90 50 Z" fill="#FFF8F6"/>
    <path d="M50 50 L90 50 L78 78 Z" fill="#3D1A0A"/>
    <path d="M50 50 L78 78 L50 90 Z" fill="#FF6B00"/>
    <path d="M50 50 L50 90 L22 78 Z" fill="#FFF8F6"/>
    <path d="M50 50 L22 78 L10 50 Z" fill="#3D1A0A"/>
    <path d="M50 50 L10 50 L22 22 Z" fill="#FF6B00"/>
    <path d="M50 50 L22 22 L50 10 Z" fill="#FFF8F6"/>
    <circle cx="50" cy="50" r="2" fill="#1A0D06"/>
  </g>`;

export async function createBrandedQrSvg(value: string) {
  const source = await QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
  });

  // Normaliza o viewBox para 100 unidades e reserva uma area branca pequena
  // no centro. O nivel H mantem o QR legivel mesmo com a marca sobreposta.
  const normalized = source
    .replace(/viewBox="0 0 ([\d.]+) ([\d.]+)"/, 'viewBox="0 0 100 100"')
    .replace(/<path /, '<g transform="scale(100) translate(0 0)"><path ')
    .replace('</svg>', `</g>${SAND_EXPRESS_MARK}</svg>`);

  const originalSize = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)?.[1];
  if (!originalSize) return source.replace('</svg>', `${SAND_EXPRESS_MARK}</svg>`).trim();
  return normalized
    .replace('transform="scale(100) translate(0 0)"', `transform="scale(${100 / Number(originalSize)})"`)
    .trim();
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function createQrLabelSvg(value: string, umbrellaNumber: number) {
  const qr = (await createBrandedQrSvg(value)).replace('<svg ', '<svg x="325" y="100" width="340" height="340" ');
  const number = Number.isInteger(umbrellaNumber) ? umbrellaNumber : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="55.8mm" viewBox="0 0 990 558"><rect width="990" height="558" fill="white"/><text x="495" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="black">Faça seu pedido aqui</text>${qr}<text x="495" y="495" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="bold" fill="black">Guarda-sol ${number}</text></svg>`;
}
