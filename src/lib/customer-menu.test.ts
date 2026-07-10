import {
  CUSTOMER_MENU_CATEGORIES,
  filterCustomerMenuProducts,
  getCustomerMenuThumbnail,
} from './customer-menu';

const products = [
  { name: 'Cerveja Amstel 350', category: 'Alcoolicos' },
  { name: 'Pastel de carne', category: 'Comidas' },
  { name: 'Batata frita', category: 'Petiscos' },
  { name: 'Agua com gas', category: 'Nao Alcoolicos' },
  { name: 'Caipirinha de pinga', category: 'Drinks', subcategory: 'Frutas', option_values: ['Limao', 'Abacaxi'] },
];

describe('customer menu helpers', () => {
  it('uses the requested category chips', () => {
    expect(CUSTOMER_MENU_CATEGORIES).toEqual(['Bebidas', 'Drinks', 'Doses', 'Porções', 'Pastéis', 'Cervejas']);
  });

  it('maps current product labels into the customer-facing filters', () => {
    expect(filterCustomerMenuProducts(products, 'Cervejas')).toEqual([products[0]]);
    expect(filterCustomerMenuProducts(products, 'Pastéis')).toEqual([products[1]]);
    expect(filterCustomerMenuProducts(products, 'Porções')).toEqual([products[2]]);
    expect(filterCustomerMenuProducts(products, 'Bebidas')).toEqual([products[3]]);
    expect(filterCustomerMenuProducts(products, 'Drinks')).toEqual([products[4]]);
  });

  it('compresses Unsplash thumbnails for row images', () => {
    const thumb = getCustomerMenuThumbnail('https://images.unsplash.com/photo-1?w=900&q=90');
    expect(thumb).toContain('w=128');
    expect(thumb).toContain('q=72');
  });
});
