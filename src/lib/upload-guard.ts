const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageUpload(file: File, options: { maxBytes?: number } = {}): string | null {
  const maxBytes = options.maxBytes || MAX_UPLOAD_BYTES;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Formato invalido. Use JPG, PNG ou WEBP.';
  }
  if (file.size <= 0) {
    return 'Arquivo invalido.';
  }
  if (file.size > maxBytes) {
    const maxMb = Math.max(1, Math.round(maxBytes / 1024 / 1024));
    return `Arquivo excede o limite de ${maxMb}MB.`;
  }
  return null;
}
