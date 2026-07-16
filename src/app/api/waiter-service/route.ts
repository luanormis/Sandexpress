import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { featureDisabledResponse, vendorFeatureEnabled } from '@/lib/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

const CALL_MARKERS = ['[WAITER_CALL]', '[CLEANING_REQUEST]', '[UMBRELLA_TRANSFER]'];
const ASSIGNMENT_PATTERN = /\[WAITER_ASSIGNED:([0-9a-f-]{36})\]/i;

function activeCallMarker(notes: string) { return CALL_MARKERS.find(marker => notes.includes(marker)) || null; }

export async function PATCH(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const orderId = String(body.order_id || '');
    const action = String(body.action || 'claim');
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(orderId) || !canAccessVendor(session, vendorId) || !session?.user_id) {
      return NextResponse.json({ error: 'Garcom nao autenticado.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(vendorId, 'waiter_service')) return NextResponse.json(featureDisabledResponse('waiter_service'), { status: 403 });

    const { data: staff } = await supabaseAdmin.from('vendor_users').select('id, name, active').eq('id', session.user_id).eq('vendor_id', vendorId).single();
    if (!staff?.active) return NextResponse.json({ error: 'Usuario da equipe inativo.' }, { status: 403 });
    const { data: order, error: orderError } = await supabaseAdmin.from('orders')
      .select('id, tenant_id, vendor_id, customer_id, umbrella_id, notes, updated_at')
      .eq('id', orderId).eq('vendor_id', vendorId).single();
    if (orderError || !order) return NextResponse.json({ error: 'Comanda nao encontrada.' }, { status: 404 });
    const notes = String(order.notes || '');
    const callMarker = activeCallMarker(notes);
    if (!callMarker) return NextResponse.json({ error: 'Este chamado ja foi concluido.' }, { status: 409 });
    const assignedUserId = notes.match(ASSIGNMENT_PATTERN)?.[1] || null;

    if (action === 'claim') {
      if (assignedUserId && assignedUserId !== session.user_id) {
        const { data: assigned } = await supabaseAdmin.from('vendor_users').select('name').eq('id', assignedUserId).maybeSingle();
        return NextResponse.json({ error: `Chamado ja assumido por ${assigned?.name || 'outro garcom'}.`, assigned_user_id: assignedUserId }, { status: 409 });
      }
      if (assignedUserId === session.user_id) return NextResponse.json({ claimed: true, assigned_user_id: session.user_id, waiter_name: staff.name, duplicate: true });
      const assignmentLine = `[WAITER_ASSIGNED:${session.user_id}] Assumido por ${staff.name}`;
      const now = new Date();
      const { data: updated, error } = await supabaseAdmin.from('orders').update({ notes: `${notes}\n${assignmentLine}`.trim(), updated_at: now.toISOString() })
        .eq('id', orderId).eq('vendor_id', vendorId).eq('updated_at', order.updated_at).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) return NextResponse.json({ error: 'Outro garcom atualizou este chamado. Atualize a fila.' }, { status: 409 });
      const { data: createdCall } = await supabaseAdmin.from('analytics_events').select('created_at').eq('vendor_id', vendorId).eq('event_type', 'waiter_call_created').contains('metadata', { order_id: orderId, call_marker: callMarker }).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const callStartedAt = createdCall?.created_at || order.updated_at || now.toISOString();
      const responseSeconds = Math.max(0, Math.round((now.getTime() - new Date(callStartedAt).getTime()) / 1000));
      await supabaseAdmin.from('analytics_events').insert({ tenant_id: order.tenant_id, vendor_id: vendorId, customer_id: order.customer_id, umbrella_id: order.umbrella_id, event_type: 'waiter_call_claimed', metadata: { order_id: orderId, user_id: session.user_id, waiter_name: staff.name, call_marker: callMarker, response_seconds: responseSeconds }, payload: {} } as any);
      return NextResponse.json({ claimed: true, assigned_user_id: session.user_id, waiter_name: staff.name, response_seconds: responseSeconds });
    }

    if (action === 'resolve') {
      if (assignedUserId && assignedUserId !== session.user_id) return NextResponse.json({ error: 'Somente o garcom que assumiu pode concluir.' }, { status: 409 });
      const cleanedNotes = notes.split('\n').filter(line => !CALL_MARKERS.some(marker => line.includes(marker)) && !ASSIGNMENT_PATTERN.test(line)).join('\n').trim();
      const now = new Date();
      const { data: updated, error } = await supabaseAdmin.from('orders').update({ notes: cleanedNotes || null, updated_at: now.toISOString() })
        .eq('id', orderId).eq('vendor_id', vendorId).eq('updated_at', order.updated_at).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) return NextResponse.json({ error: 'Chamado atualizado por outro usuario.' }, { status: 409 });
      const { data: claim } = await supabaseAdmin.from('analytics_events').select('created_at, metadata').eq('vendor_id', vendorId).eq('event_type', 'waiter_call_claimed').contains('metadata', { order_id: orderId }).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const serviceSeconds = claim?.created_at ? Math.max(0, Math.round((now.getTime() - new Date(claim.created_at).getTime()) / 1000)) : 0;
      await supabaseAdmin.from('analytics_events').insert({ tenant_id: order.tenant_id, vendor_id: vendorId, customer_id: order.customer_id, umbrella_id: order.umbrella_id, event_type: 'waiter_call_resolved', metadata: { order_id: orderId, user_id: session.user_id, waiter_name: staff.name, call_marker: callMarker, service_seconds: serviceSeconds, response_seconds: Number((claim as any)?.metadata?.response_seconds || 0) }, payload: {} } as any);
      return NextResponse.json({ resolved: true, service_seconds: serviceSeconds });
    }
    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 });
  } catch (err) {
    console.error('Waiter service error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar atendimento.' }, { status: 500 });
  }
}
