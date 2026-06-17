import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { purgeCustomerDatabase } from '@/lib/admin-data-erasure';
import { getAdminPassword } from '@/lib/runtime-config';

function verifyAdminPassword(password: unknown) {
  const provided = Buffer.from(String(password || ''));
  const expected = Buffer.from(getAdminPassword());
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (!verifyAdminPassword(body.admin_password)) {
      return NextResponse.json({ error: 'Senha do admin invalida.' }, { status: 401 });
    }
    if (body.confirmation !== 'APAGAR CLIENTES') {
      return NextResponse.json({ error: 'Digite APAGAR CLIENTES para confirmar.' }, { status: 400 });
    }

    const result = await purgeCustomerDatabase(body.vendor_id ? String(body.vendor_id) : undefined);
    return NextResponse.json({
      ok: true,
      ...result,
      scope: body.vendor_id ? 'vendor' : 'platform',
    });
  } catch (err) {
    console.error('Customer data erasure error:', err);
    return NextResponse.json({ error: 'Erro ao apagar dados de clientes.' }, { status: 500 });
  }
}
