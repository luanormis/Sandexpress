export type PrinterRoute = 'food' | 'beverage' | 'cashier';

export type KioskPrinter = {
  id: string;
  name: string;
  route: PrinterRoute;
  routes?: PrinterRoute[];
  active: boolean;
  connection?: 'browser' | 'network';
  host?: string;
  port?: number;
};

export type PrintableOrderItem = { q: number; n: string; category?: string | null; subtotal?: number };

export function getPrinterRoutes(printer: Pick<KioskPrinter, 'route' | 'routes'>): PrinterRoute[] {
  const routes = Array.isArray(printer.routes) ? printer.routes : [printer.route];
  return [...new Set(routes.filter(route => ['food', 'beverage', 'cashier'].includes(route)))];
}

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
    const host = typeof item.host === 'string' ? item.host.trim() : undefined;
    const port = Number(item.port || 9100);
    const connection = item.connection === 'network' && host ? 'network' as const : 'browser' as const;
    const routes = [...new Set((Array.isArray(item.routes) ? item.routes : [route]).filter(value => ['food', 'beverage', 'cashier'].includes(String(value))))] as PrinterRoute[];
    return [{ id, name, route: routes[0] || route as PrinterRoute, routes: routes.length ? routes : [route as PrinterRoute], active: item.active !== false, connection, host, port: connection === 'network' && Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined }];
  });
}

export function buildPrintJobs(printers: KioskPrinter[], items: PrintableOrderItem[]) {
  const routed = routeOrderItems(items);
  return printers.flatMap(printer => getPrinterRoutes(printer)
    .filter(route => routed[route].length > 0)
    .map(route => ({ printer, route, items: routed[route] })));
}

