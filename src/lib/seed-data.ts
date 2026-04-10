/**
 * ============================================================================
 * SUPABASE SEED DATA GENERATOR - SandExpress
 * ============================================================================
 * Script para popular o banco de dados com dados de teste programaticamente.
 * Este arquivo é um helper para criar 500 quiosques com seus dados relacionados.
 * 
 * USO:
 * 1. Importe as funções deste arquivo
 * 2. Chame `seedAllData()` no seu script de setup
 * 
 * NOTA: Execute isso uma única vez, preferencialmente via SQL direto em
 * supabase-schema.sql o arquivo seed-data.sql para melhor performance!
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SERVICE_ROLE_KEY são obrigatórios');
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Produtos base para cardápio de cada quiosque
 */
const PRODUCTS_TEMPLATE = [
  // Bebidas
  { category: 'Bebidas', name: 'Água', description: 'Água mineral 500ml', price: 3.00 },
  { category: 'Bebidas', name: 'Refrigerante', description: 'Refrigerante 350ml', price: 5.00 },
  { category: 'Bebidas', name: 'Suco Natural', description: 'Suco de laranja fresco', price: 8.00 },
  { category: 'Bebidas', name: 'Chopp Gelado', description: 'Chopp artesanal 1L', price: 25.00 },
  { category: 'Bebidas', name: 'Água de Coco', description: 'Água de coco gelada', price: 6.00 },

  // Comidas
  { category: 'Comidas', name: 'Pastel', description: 'Pastel de carne frito', price: 8.00 },
  { category: 'Comidas', name: 'Coxinha', description: 'Coxinha de frango quentinha', price: 6.00 },
  { category: 'Comidas', name: 'Cachorro Quente', description: 'Cachorro quente especial', price: 12.00 },
  { category: 'Comidas', name: 'Acarajé', description: 'Acarajé baiano tradicional', price: 10.00 },
  { category: 'Comidas', name: 'Moqueca', description: 'Moqueca de camarão', price: 35.00 },

  // Combos
  { category: 'Combos', name: 'Combo Praia', description: 'Chopp + Pastel + Água', price: 35.00, is_combo: true },
  { category: 'Combos', name: 'Combo Festa', description: 'Chopp + 2x Coxinha + Suco', price: 42.00, is_combo: true },
  { category: 'Combos', name: 'Combo Família', description: 'Chopp 2L + 3x Pastel + Água Coco', price: 65.00, is_combo: true },

  // Lanches
  { category: 'Lanches', name: 'Queijo Quente', description: 'Queijo grelhado na chapa', price: 7.00 },
  { category: 'Lanches', name: 'Biscoito Polvilho', description: 'Biscoito polvilho caseiro', price: 5.00 },
];

/**
 * Criar um novo quiosque com todos os seus dados relacionados
 */
async function createVendorWithData(vendorNumber: number) {
  try {
    // 1. Criar vendor
    const vendorName = `Teste ${vendorNumber}`;
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .insert({
        name: vendorName,
        owner_name: `Proprietário Teste ${vendorNumber}`,
        owner_phone: `11999999${String(vendorNumber % 100).padStart(3, '0')}`,
        owner_email: `teste${vendorNumber}@sandexpress.com`,
        city: 'Praia do Teste',
        state: 'SP',
        subscription_status: 'active',
        plan_type: 'monthly',
        max_umbrellas: 50,
        is_active: true,
      })
      .select()
      .single();

    if (vendorError || !vendor) {
      console.error(`❌ Erro ao criar vendor ${vendorNumber}:`, vendorError);
      return null;
    }

    console.log(`✅ Vendor criado: ${vendorName}`);

    // 2. Criar 50 guarda-sóis
    const umbrellas = Array.from({ length: 50 }, (_, i) => ({
      vendor_id: vendor.id,
      number: i + 1,
      label: `Guarda-sol ${i + 1}`,
      location_hint: `Posição ${i + 1}`,
      active: true,
    }));

    const { error: umbrellaError } = await supabase
      .from('umbrellas')
      .insert(umbrellas);

    if (umbrellaError) {
      console.error(`❌ Erro ao criar guarda-sóis para ${vendorName}:`, umbrellaError);
    } else {
      console.log(`   ↳ 50 guarda-sóis criados`);
    }

    // 3. Criar produtos (cardápio)
    const products = PRODUCTS_TEMPLATE.map((p, index) => ({
      vendor_id: vendor.id,
      category: p.category,
      name: p.name,
      description: p.description,
      price: p.price,
      active: true,
      is_combo: p.is_combo ? true : false,
      sort_order: index + 1,
    }));

    const { error: productError } = await supabase
      .from('products')
      .insert(products);

    if (productError) {
      console.error(`❌ Erro ao criar cardápio para ${vendorName}:`, productError);
    } else {
      console.log(`   ↳ ${products.length} produtos criados`);
    }

    return vendor;
  } catch (error) {
    console.error(`❌ Erro ao criar vendor ${vendorNumber}:`, error);
    return null;
  }
}

/**
 * Seed de todos os dados (500 quiosques)
 * ⚠️ AVISO: Esta função é lenta! Use o arquivo seed-data.sql em vez disso.
 */
export async function seedAllData(totalVendors: number = 500) {
  console.log(`\n🚀 Iniciando seed com ${totalVendors} quiosques...`);
  console.log(`⏱️  Tempo estimado: ${Math.ceil(totalVendors * 0.5)} segundos\n`);

  const startTime = Date.now();
  let successCount = 0;

  for (let i = 1; i <= totalVendors; i++) {
    const vendor = await createVendorWithData(i);
    if (vendor) successCount++;

    // Progress
    if (i % 50 === 0) {
      console.log(`   [${i}/${totalVendors}] - ${Math.round((i / totalVendors) * 100)}%`);
    }

    // Pequeno delay para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n✨ Seed concluído!`);
  console.log(`   ✅ ${successCount} quiosques criados`);
  console.log(`   ✅ ${successCount * 50} guarda-sóis criados`);
  console.log(`   ✅ ${successCount * PRODUCTS_TEMPLATE.length} produtos criados`);
  console.log(`   ⏱️  Tempo total: ${duration.toFixed(2)}s\n`);
}

/**
 * Verificar quantos quiosques já existem
 */
export async function checkExistingData() {
  try {
    const { count: vendorCount } = await supabase
      .from('vendors')
      .select('id', { count: 'exact' });

    const { count: umbrellaCount } = await supabase
      .from('umbrellas')
      .select('id', { count: 'exact' });

    const { count: productCount } = await supabase
      .from('products')
      .select('id', { count: 'exact' });

    console.log(`📊 Status do banco de dados:`);
    console.log(`   • Quiosques: ${vendorCount}`);
    console.log(`   • Guarda-sóis: ${umbrellaCount}`);
    console.log(`   • Produtos: ${productCount}\n`);

    return { vendorCount, umbrellaCount, productCount };
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error);
    return null;
  }
}

/**
 * Limpar todos os dados (CUIDADO! Isso deleta tudo!)
 */
export async function clearAllData() {
  console.log('⚠️  ATENÇÃO: Isso vai deletar TODOS os dados do banco!');
  console.log('   Continuando em 3 segundos... (Ctrl+C para cancelar)\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // A ordem importa devido às foreign keys!
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('umbrellas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('vendors').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ Todos os dados foram deletados!\n');
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
  }
}

/**
 * Script principal para uso direto
 */
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args[0] === 'check') {
      await checkExistingData();
    } else if (args[0] === 'seed') {
      const count = parseInt(args[1] || '500', 10);
      await seedAllData(count);
    } else if (args[0] === 'clear') {
      await clearAllData();
    } else {
      console.log(`
📝 SandExpress Seed Data Generator

Uso:
  npm run seed-data check              # Ver quantos quiosques já existem
  npm run seed-data seed [COUNT]       # Criar COUNT quiosques (default: 500)
  npm run seed-data clear              # Deletar todos os dados (CUIDADO!)

Exemplos:
  npm run seed-data seed 100            # Criar 100 quiosques
  npm run seed-data seed 500            # Criar 500 quiosques
      `);
    }

    process.exit(0);
  })();
}
