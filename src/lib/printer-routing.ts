export type PrinterRoute = 'food' | 'beverage' | 'cashier';

export type KioskPrinter = {
  id: string;
  name: string;
  route: PrinterRoute;
  active: boolean;
};

export type PrintableOrderItem = { q: number; n: string; category?: string | null; subtotal?: number };

export function isBeverageCategory(category: string | null | undefined) {
  const value = String(category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /(bebida|cerveja|drink|dose|alcool|refrigerante|suco|agua|energetico|vinho)/.test(value);
}

export function routeOrderItems(items: PrintableOrderItem[]) {
  return {
    food: items.filter(item => !isBeverageCategory(item.category)),
    beverage: items.filter(item => isBeverageCategory(item.category)),
    cashier: [...items],
  };
}

export function normalizePrinters(value: unknown): KioskPrinter[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<KioskPrinter>;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim().slice(0, 80);
    const route = item.route;
    if (!id || !name || !['food', 'beverage', 'cashier'].includes(String(route))) return [];
    return [{ id, name, route: route as PrinterRoute, active: item.active !== false }];
  });
}
