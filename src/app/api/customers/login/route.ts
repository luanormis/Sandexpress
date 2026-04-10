import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/customers/login
 * Login/cadastro do cliente.
 * Se o cliente já existe (mesmo phone + vendor_id), incrementa visitas.
 * Se não, cria novo registro.
 */
export async function POST(req: NextRequest) {
  try {
    const { name, phone, vendor_id } = await req.json();

    if (!name || !phone || !vendor_id) {
      return NextResponse.json({ error: 'name, phone e vendor_id são obrigatórios.' }, { status: 400 });
    }

    // Modo demo
    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';

    if (isDemo) {
      return NextResponse.json({
        id: 'demo-customer-' + Date.now(),
        name,
        phone,
        vendor_id,
        visit_count: 1,
        total_spent: 0,
      });
    }

    // Verificar se cliente já existe neste quiosque
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('vendor_id', vendor_id)
      .eq('phone', phone)
      .single();

    if (existing) {
      // Atualizar nome e incrementar visitas
      const { data: updated, error } = await supabaseAdmin
        .from('customers')
        .update({
          name,
          visit_count: existing.visit_count + 1,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(updated);
    }

    // Criar novo cliente
    const { data: newCustomer, error } = await supabaseAdmin
      .from('customers')
      .insert({ name, phone, vendor_id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(newCustomer, { status: 201 });
  } catch (err) {
    console.error('Customer login error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
