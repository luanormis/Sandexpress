const MAX_INPUT_DIGITS = 15;

export function formatBrazilianMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Currency mask with fixed cents: typing 1250 produces 12,50.
 * It deliberately keeps the currency symbol outside the editable value.
 */
export function maskBrazilianMoneyInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, MAX_INPUT_DIGITS);
  if (!digits) return "";
  return formatBrazilianMoneyInput(Number(digits) / 100);
}

export function parseBrazilianMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}
