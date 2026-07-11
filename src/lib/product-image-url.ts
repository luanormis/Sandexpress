const CATALOG_PUBLIC_MARKER = "/storage/v1/object/public/catalogo-global/";

export function catalogImageProxyUrl(image: { id?: string | null; storage_path?: string | null; image_url?: string | null }) {
  if (image.id && image.storage_path) {
    return `/api/products/gallery-image?id=${encodeURIComponent(image.id)}`;
  }
  return normalizeRenderableProductImageUrl(image.image_url);
}

export function normalizeRenderableProductImageUrl(url?: string | null) {
  if (!url) return url || "";
  const markerIndex = url.indexOf(CATALOG_PUBLIC_MARKER);
  if (markerIndex >= 0) {
    const path = url.slice(markerIndex + CATALOG_PUBLIC_MARKER.length);
    if (path) return `/api/products/gallery-image?path=${encodeURIComponent(path)}`;
  }
  return url;
}
