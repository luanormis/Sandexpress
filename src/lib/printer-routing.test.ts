import { buildPrintJobs, isBeverageCategory, normalizePrinters, routeOrderItems } from './printer-routing';

describe('printer routing', () => {
  it('recognizes beverage categories without depending on accents', () => {
    expect(isBeverageCategory('Bebidas não alcoólicas')).toBe(true);
    expect(isBeverageCategory('Porções e petiscos')).toBe(false);
  });

  it('keeps the cashier copy consolidated', () => {
    const items = [{ q: 1, n: 'Água', category: 'Bebidas' }, { q: 2, n: 'Pastel', category: 'Alimentos' }];
    const routed = routeOrderItems(items);
    expect(routed.beverage).toEqual([items[0]]);
    expect(routed.food).toEqual([items[1]]);
    expect(routed.cashier).toEqual(items);
  });

  it('rejects malformed persisted configuration', () => {
    expect(normalizePrinters([{ id: '1', name: 'Cozinha', route: 'food' }, { name: '', route: 'cashier' }])).toHaveLength(1);
  });

  it('allows one printer to receive every destination', () => {
    const printers = normalizePrinters([{ id: '1', name: 'Termica geral', route: 'food', routes: ['food', 'beverage', 'cashier'] }]);
    const jobs = buildPrintJobs(printers, [{ q: 1, n: 'Agua', category: 'Bebidas' }, { q: 1, n: 'Porcao', category: 'Porcoes' }]);
    expect(jobs.map(job => job.route)).toEqual(['food', 'beverage', 'cashier']);
    expect(jobs[2].items).toHaveLength(2);
  });

  it('keeps supported Windows USB printer profiles', () => {
    const printers = normalizePrinters([
      { id: 'usb-1', name: 'Bar', route: 'beverage', connection: 'windows', printerName: 'EPSON TM-T20', portName: 'USB003', model: 'EPSON TM-T20', profile: 'epson-tm-t20' },
      { id: 'usb-2', name: 'Cozinha', route: 'food', connection: 'windows', printerName: 'ELGIN i8', model: 'ELGIN i8', profile: 'elgin-i8' },
    ]);
    expect(printers.map(item => item.connection)).toEqual(['windows', 'windows']);
    expect(printers.map(item => item.profile)).toEqual(['epson-tm-t20', 'elgin-i8']);
    expect(printers[0].portName).toBe('USB003');
  });
});

