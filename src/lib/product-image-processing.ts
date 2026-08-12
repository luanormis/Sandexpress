import crypto from 'crypto';

export const PRODUCT_IMAGE_MAX_DIMENSION = 1600;
export const PRODUCT_IMAGE_WEBP_QUALITY = 82;

export function normalizeImageSearch(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 100);
}

export function sanitizeImageLabel(value: unknown, fallback = 'Imagem do cardapio') {
  const clean = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || fallback).slice(0, 120);
}

export function buildSharedImagePath(category: string) {
  const categorySlug = normalizeImageSearch(category).replace(/\s+/g, '-') || 'geral';
  return `general/${categorySlug}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;
}

export async function convertProductImageToWebp(input: Buffer) {
  const { default: sharp } = await import('sharp');
  return sharp(input, { failOn: 'warning', limitInputPixels: 40_000_000 })
    .rotate()
    .resize({
      width: PRODUCT_IMAGE_MAX_DIMENSION,
      height: PRODUCT_IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: PRODUCT_IMAGE_WEBP_QUALITY, effort: 4 })
    .toBuffer();
}
