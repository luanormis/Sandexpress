import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { parseBrazilianMoneyInput } from '@/lib/brazilian-money';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

type EventRow = { id: string; event_type: string; metadata: Record<string, unknown> | null; created_at: string };
const EVENT_TYPES = ['financial_supplier', 'financial_entry', 'financial_settlement'];

async function loadFinancial(vendorId: string) {
  const { data, error } = await supabaseAdmin.from('analytics_events').select('id, event_type, metadata, created_at').eq('vendor_id', vendorId).in('event_type', EVENT_TYPES).order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data || []) as EventRow[];
  const suppliers = rows.filter(row => row.event_type === 'financial_supplier').map(row => ({ id: row.id, name: String(row.metadata?.name || ''), document: String(row.metadata?.document || ''), phone: String(row.metadata?.phone || ''), email: String(row.metadata?.email || '') }));
  const settlements = rows.filter(row => row.event_type === 'financial_settlement');
  const settled = new Map<string, number>();
  settlements.forEach(row => { const amount = Number(row.metadata?.amount || 0); ['payable_id', 'receivable_id'].forEach(key => { const id = String(row.metadata?.[key] || ''); settled.set(id, (settled.get(id) || 0) + amount); }); });
  const entries = rows.filter(row => row.event_type === 'financial_entry').map(row => { const amount = Number(row.metadata?.amount || 0); const settledAmount = Math.min(amount, settled.get(row.id) || 0); return { id: row.id, type: row.metadata?.type === 'receivable' ? 'receivable' : 'payable', supplier_id: String(row.metadata?.supplier_id || ''), description: String(row.metadata?.description || ''), due_date: String(row.metadata?.due_date || ''), amount, settled_amount: settledAmount, open_amount: Math.max(0, amount - settledAmount), status: amount - settledAmount <= 0.009 ? 'settled' : settledAmount > 0 ? 'partial' : 'open', created_at: row.created_at }; });
  return { suppliers, entries, settlements: settlements.map(row => ({ id: row.id, ...row.metadata, created_at: row.created_at })) };
}

async function context(req: NextRequest, vendorId: string) {
  if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) return null;
  const { data } = await supabaseAdmin.from('vendors').select('tenant_id').eq('id', vendorId).single();
  return data?.tenant_id ? { tenantId: data.tenant_id } : null;
}

export async function GET(req: NextRequest) {
  try { const vendorId = req.nextUrl.searchParams.get('vendor_id') || ''; if (!await context(req, vendorId)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 }); return NextResponse.json(await loadFinancial(vendorId)); }
  catch (error) { console.error('Financial accounts GET error:', error); return NextResponse.json({ error: 'Erro ao carregar o financeiro.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})); const vendorId = String(body.vendor_id || ''); const ctx = await context(req, vendorId);
    if (!ctx) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    if (body.action === 'supplier') {
      const name = String(body.name || '').trim().slice(0, 120); if (name.length < 2) return NextResponse.json({ error: 'Informe o nome do fornecedor.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: ctx.tenantId, vendor_id: vendorId, event_type: 'financial_supplier', metadata: { name, document: String(body.document || '').trim().slice(0, 30), phone: String(body.phone || '').trim().slice(0, 30), email: String(body.email || '').trim().slice(0, 120) } } as any); if (error) throw error;
    } else if (body.action === 'entry') {
      const state = await loadFinancial(vendorId); const supplierId = String(body.supplier_id || ''); const type = body.type === 'receivable' ? 'receivable' : body.type === 'payable' ? 'payable' : ''; const amount = parseBrazilianMoneyInput(String(body.amount || '')); const description = String(body.description || '').trim().slice(0, 160); const dueDate = String(body.due_date || '');
      if (!state.suppliers.some(item => item.id === supplierId) || !type || !amount || description.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return NextResponse.json({ error: 'Preencha fornecedor, tipo, descrição, vencimento e valor.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: ctx.tenantId, vendor_id: vendorId, event_type: 'financial_entry', metadata: { supplier_id: supplierId, type, amount, description, due_date: dueDate } } as any); if (error) throw error;
    } else if (body.action === 'settle') {
      const state = await loadFinancial(vendorId); const payable = state.entries.find(item => item.id === body.payable_id && item.type === 'payable'); const receivable = state.entries.find(item => item.id === body.receivable_id && item.type === 'receivable'); const requested = parseBrazilianMoneyInput(String(body.amount || ''));
      if (!payable || !receivable || payable.supplier_id !== receivable.supplier_id || !requested || requested > Math.min(payable.open_amount, receivable.open_amount) + 0.009) return NextResponse.json({ error: 'Selecione contas abertas do mesmo fornecedor e um valor dentro dos saldos.' }, { status: 400 });
      const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: ctx.tenantId, vendor_id: vendorId, event_type: 'financial_settlement', metadata: { supplier_id: payable.supplier_id, payable_id: payable.id, receivable_id: receivable.id, amount: requested, note: String(body.note || '').trim().slice(0, 200) } } as any); if (error) throw error;
    } else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    return NextResponse.json(await loadFinancial(vendorId), { status: 201 });
  } catch (error) { console.error('Financial accounts POST error:', error); return NextResponse.json({ error: 'Erro ao salvar o financeiro.' }, { status: 500 }); }
}

