const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageUpload(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Formato inválido. Use JPG, PNG ou WEBP.';
  }
  if (file.size <= 0) {
    return 'Arquivo inválido.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Arquivo excede o limite de 5MB.';
  }
  return null;
}
