import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/vendors?status=active
 * Lista todos os vendors (para admin).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json([
        { id: 'v1', name: 'Quiosque do Sol', owner_name: 'João Silva', owner_phone: '11999999999', owner_email: 'joao@email.com', city: 'Santos', state: 'SP', cnpj: '12.345.678/0001-90', cpf: '123.456.789-00', subscription_status: 'active', plan_type: 'monthly', trial_ends_at: '2025-01-15T00:00:00Z', is_active: true, max_umbrellas: 50, created_at: '2025-01-01T00:00:00Z' },
        { id: 'v2', name: 'Barraca Tropical', owner_name: 'Maria Souza', owner_phone: '21888888888', owner_email: 'maria@email.com', city: 'Rio de Janeiro', state: 'RJ', cnpj: null, cpf: '987.654.321-00', subscription_status: 'trial', plan_type: 'trial', trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), is_active: true, max_umbrellas: 5, created_at: '2025-06-01T00:00:00Z' },
        { id: 'v3', name: 'Mar Azul Beach', owner_name: 'Carlos Mendes', owner_phone: '13777777777', owner_email: null, city: 'Guarujá', state: 'SP', cnpj: '98.765.432/0001-10', cpf: null, subscription_status: 'overdue', plan_type: 'monthly', trial_ends_at: null, is_active: true, max_umbrellas: 50, created_at: '2025-03-15T00:00:00Z' },
        { id: 'v4', name: 'Quiosque Pé na Areia', owner_name: 'Ana Lima', owner_phone: '71666666666', owner_email: 'ana@email.com', city: 'Salvador', state: 'BA', cnpj: null, cpf: '111.222.333-44', subscription_status: 'blocked', plan_type: null, trial_ends_at: null, is_active: false, max_umbrellas: 5, created_at: '2025-02-10T00:00:00Z' },
      ]);
    }

    let query = supabaseAdmin.from('vendors').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('subscription_status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Vendors GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
