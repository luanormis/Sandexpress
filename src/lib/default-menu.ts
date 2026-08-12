export type DefaultMenuProduct = {
  category: string;
  name: string;
  description: string;
  price: number;
  sort_order: number;
  stock_quantity: number;
};

export const DEFAULT_MENU_PRODUCTS: DefaultMenuProduct[] = [
  { category: 'Petiscos e Porcoes', name: 'Porcao de Peixe Frito', description: 'Porcao para compartilhar.', price: 75, sort_order: 10, stock_quantity: 20 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Camarao Frito', description: 'Camarao frito crocante.', price: 90, sort_order: 11, stock_quantity: 20 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Batata Frita', description: 'Batata frita sequinha.', price: 35, sort_order: 12, stock_quantity: 40 },
  { category: 'Petiscos e Porcoes', name: 'Porcao de Mandioca Frita', description: 'Mandioca frita crocante.', price: 38, sort_order: 13, stock_quantity: 30 },
  { category: 'Pasteis', name: 'Pastel de Camarao', description: 'Unidade.', price: 14, sort_order: 20, stock_quantity: 60 },
  { category: 'Pasteis', name: 'Pastel de Carne', description: 'Unidade.', price: 12, sort_order: 21, stock_quantity: 60 },
  { category: 'Pasteis', name: 'Pastel de Queijo', description: 'Unidade.', price: 12, sort_order: 22, stock_quantity: 60 },
  { category: 'Pasteis', name: 'Pastel de Palmito', description: 'Unidade.', price: 12, sort_order: 23, stock_quantity: 40 },
  { category: 'Pasteis', name: 'Pastel de Frango com Catupiry', description: 'Unidade.', price: 13, sort_order: 24, stock_quantity: 50 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Caipirinha de Limao (Cachaca)', description: 'Preparada na hora.', price: 22, sort_order: 30, stock_quantity: 40 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Caipiroska de Frutas (Vodka)', description: 'Escolha a fruta disponivel.', price: 26, sort_order: 31, stock_quantity: 40 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Coco', description: 'Copo individual.', price: 20, sort_order: 32, stock_quantity: 40 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Maracuja', description: 'Copo individual.', price: 20, sort_order: 33, stock_quantity: 40 },
  { category: 'Drinks, Caipirinhas e Batidas', name: 'Batida de Morango', description: 'Copo individual.', price: 20, sort_order: 34, stock_quantity: 40 },
  { category: 'Cervejas em Lata', name: 'Cerveja Amstel / Skol / Brahma (Lata 350ml)', description: 'Lata 350ml.', price: 10, sort_order: 40, stock_quantity: 120 },
  { category: 'Cervejas em Lata', name: 'Cerveja Heineken / Corona / Stella Artois (Lata 350ml)', description: 'Lata 350ml.', price: 12, sort_order: 41, stock_quantity: 90 },
  { category: 'Cervejas em Lata', name: 'Cerveja Budweiser / Eisenbahn (Lata 350ml)', description: 'Lata 350ml.', price: 11, sort_order: 42, stock_quantity: 90 },
  { category: 'Cervejas em Lata', name: 'Cervejas Latao (Marcas Tradicionais - 473ml)', description: 'Lata 473ml.', price: 13, sort_order: 43, stock_quantity: 80 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Suco Natural de Frutas (Laranja, Abacaxi ou Limao)', description: 'Copo individual.', price: 12, sort_order: 50, stock_quantity: 60 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Refrigerante Lata (Coca-Cola / Coca-Cola Zero)', description: 'Lata 350ml.', price: 7, sort_order: 51, stock_quantity: 80 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Refrigerante Lata (Guarana Antarctica / Sprite / Fanta Laranja)', description: 'Lata 350ml.', price: 7, sort_order: 52, stock_quantity: 80 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Agua Mineral sem Gas', description: 'Garrafa individual.', price: 5, sort_order: 53, stock_quantity: 120 },
  { category: 'Bebidas Nao Alcoolicas', name: 'Agua Mineral com Gas', description: 'Garrafa individual.', price: 6, sort_order: 54, stock_quantity: 80 },
];
