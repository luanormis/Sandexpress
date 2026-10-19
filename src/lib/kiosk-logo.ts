export function kioskLogoForCustomer(value?: string | null): string | null {
  const url = String(value || '').trim();
  if (!url) return null;
  const pathname = url.split(/[?#]/, 1)[0].toLowerCase();
  if (/(?:^|\/)(?:sandexpress-logo-fluid|logo-sandexpress|sandexpress-app-icon(?:-\d+)?|icon-\d+)\.(?:png|svg|webp|jpg|jpeg)$/.test(pathname)) {
    return null;
  }
  return url;
}
