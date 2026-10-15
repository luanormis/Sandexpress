import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession, canAccessVendor } from '@/lib/auth-session';
import { verifyVendorPassword } from '@/lib/vendor-password';

/** Zera os contadores operacionais do quiosque sem apagar pedidos dos relatórios. */
export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const body = await req.json();
    const vendorId = String(body.vendor_id || session.vendor_id || '');
    const password = String(body.password || '');
    if (!vendorId || !password || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Quiosque e senha são obrigatórios.' }, { status: 400 });
    }
    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors').select('id, tenant_id, password_hash').eq('id', vendorId).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor?.password_hash || !(await verifyVendorPassword(password, vendor.password_hash))) {
      return NextResponse.json({ error: 'Senha do proprietário inválida.' }, { status: 403 });
    }

    // Os pedidos continuam intactos: o relatório principal segue conseguindo
    // consultar todo o histórico, mesmo após a limpeza operacional.
    const [customers, products] = await Promise.all([
      supabaseAdmin.from('customers').update({ visit_count: 0, total_spent: 0 }).eq('vendor_id', vendorId),
      supabaseAdmin.from('products').update({ physical_stock_quantity: 0, beach_stock_quantity: 0, stock_quantity: 0, blocked_by_stock: true }).eq('vendor_id', vendorId).eq('stock_tracking_enabled', true),
    ]);
    if (customers.error) throw customers.error;
    if (products.error) throw products.error;

    // Compatível com instalações que já possuem a tabela de auditoria; em bases
    // antigas a limpeza ainda é segura e os pedidos preservam o relatório.
    await supabaseAdmin.from('vendor_counter_resets').insert({
      vendor_id: vendorId,
      tenant_id: vendor.tenant_id,
      reset_by: session.role,
      reset_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, message: 'Contadores e estoque operacional zerados. O histórico permanece nos relatórios do admin.' });
  } catch (error) {
    console.error('Vendor reset counters error:', error);
    return NextResponse.json({ error: 'Não foi possível zerar os contadores.' }, { status: 500 });
  }
}
