export const CREAM = '#fff8e8';
export const INK = '#241b16';
export const ORANGE = '#ff9a3c';

export function validBackground(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : CREAM;
}

export function contrastText(background: string): string {
  const hex = validBackground(background).slice(1);
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // Black or white always provides at least 4.5:1 contrast for a solid color.
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
