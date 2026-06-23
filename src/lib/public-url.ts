import type { NextRequest } from 'next/server';

export function getConfiguredPublicAppUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (explicitUrl) return explicitUrl.replace(/\/$/, '');

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionUrl) return `https://${productionUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  return null;
}

export function getPublicAppUrl(req?: NextRequest) {
  const configuredUrl = getConfiguredPublicAppUrl();
  if (configuredUrl) return configuredUrl;

  const deploymentUrl = process.env.VERCEL_URL;
  if (deploymentUrl) return `https://${deploymentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  const origin = req?.headers.get('origin') || (req ? new URL(req.url).origin : 'http://localhost:3000');
  return origin.replace(/\/$/, '');
}

type UmbrellaQrTargetOptions = {
  vendorName?: string | null;
  umbrellaNumber?: string | number | null;
};

export function slugifyPathSegment(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'item';
}

export function extractUmbrellaIdFromRouteSegment(segment: string) {
  const value = decodeURIComponent(segment || '').trim();
  const uuidMatch = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (uuidMatch) return uuidMatch[0];
  return value;
}

export function buildUmbrellaQrTargetUrl(
  baseUrl: string,
  vendorId: string,
  umbrellaId: string,
  options: UmbrellaQrTargetOptions = {}
) {
  return `${baseUrl.replace(/\/$/, '')}${buildUmbrellaQrTargetPath(vendorId, umbrellaId, options)}`;
}

export function buildUmbrellaQrTargetPath(
  vendorId: string,
  umbrellaId: string,
  options: UmbrellaQrTargetOptions = {}
) {
  const kioskSegment = options.vendorName ? slugifyPathSegment(options.vendorName) : vendorId;
  const umbrellaSegment = options.umbrellaNumber
    ? `guarda-sol-${slugifyPathSegment(String(options.umbrellaNumber))}-${umbrellaId}`
    : umbrellaId;

  return `/u/${encodeURIComponent(kioskSegment)}/${encodeURIComponent(umbrellaSegment)}`;
}
