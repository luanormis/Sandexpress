export type PrinterRole = 'food' | 'drinks' | 'cashier';

export interface PrinterProfile {
  id: string;
  name: string;
  connection: 'system' | 'usb' | 'manual' | 'network';
  deviceId?: string;
  host?: string;
  port?: number;
}

export interface PrinterSettings {
  printers: PrinterProfile[];
  routes: Record<PrinterRole, string>;
}

export interface PrintableItem {
  n: string;
  q: number;
  category?: string | null;
  subtotal?: number;
  cancelled?: boolean;
}

export const SYSTEM_PRINTER: PrinterProfile = { id: 'system-dialog', name: 'Impressora do sistema', connection: 'system' };
export const TEST_VIRTUAL_PRINTER: PrinterProfile = { id: 'sandexpress-virtual-test', name: 'SandExpress - Impressora Virtual de Teste', connection: 'manual' };

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printers: [SYSTEM_PRINTER, TEST_VIRTUAL_PRINTER],
  routes: { food: SYSTEM_PRINTER.id, drinks: SYSTEM_PRINTER.id, cashier: SYSTEM_PRINTER.id },
};

const DRINK_CATEGORY_WORDS = ['bebida', 'alcool', 'cerveja', 'drink', 'vinho', 'refrigerante', 'suco', 'agua'];

export function isDrinkCategory(category?: string | null) {
  const normalized = String(category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return DRINK_CATEGORY_WORDS.some(word => normalized.includes(word));
}

export function routeOrderItems(items: PrintableItem[]) {
  const valid = items.filter(item => !item.cancelled && Number.isFinite(item.q) && item.q > 0);
  return {
    food: valid.filter(item => !isDrinkCategory(item.category)),
    drinks: valid.filter(item => isDrinkCategory(item.category)),
    cashier: valid,
  };
}

export function normalizePrinterSettings(value: unknown): PrinterSettings {
  if (!value || typeof value !== 'object') return DEFAULT_PRINTER_SETTINGS;
  const input = value as Partial<PrinterSettings>;
  const seen = new Set<string>();
  const printers = (Array.isArray(input.printers) ? input.printers : [])
    .filter((printer): printer is PrinterProfile => Boolean(printer && typeof printer.id === 'string' && printer.id.trim() && typeof printer.name === 'string' && printer.name.trim() && ['system', 'usb', 'manual', 'network'].includes(printer.connection)))
    .map(printer => ({ ...printer, id: printer.id.trim(), name: printer.name.trim().slice(0, 80) }))
    .filter(printer => !seen.has(printer.id) && Boolean(seen.add(printer.id)));
  if (!printers.some(printer => printer.id === SYSTEM_PRINTER.id)) printers.unshift(SYSTEM_PRINTER);
  if (!printers.some(printer => printer.id === TEST_VIRTUAL_PRINTER.id)) printers.push(TEST_VIRTUAL_PRINTER);
  const ids = new Set(printers.map(printer => printer.id));
  const routes = input.routes || DEFAULT_PRINTER_SETTINGS.routes;
  return {
    printers,
    routes: {
      food: ids.has(routes.food) ? routes.food : SYSTEM_PRINTER.id,
      drinks: ids.has(routes.drinks) ? routes.drinks : SYSTEM_PRINTER.id,
      cashier: ids.has(routes.cashier) ? routes.cashier : SYSTEM_PRINTER.id,
    },
  };
}

export function printerStorageKey(vendorId: string) {
  return `sandexpress:printers:${vendorId}`;
}
