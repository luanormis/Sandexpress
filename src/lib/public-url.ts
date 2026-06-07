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
