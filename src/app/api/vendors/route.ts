import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

/**
 * GET /api/vendors?status=active
 * Lista todos os vendors (para admin).
 */
export async function GET(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

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
