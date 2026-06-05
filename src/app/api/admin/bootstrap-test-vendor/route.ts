import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { ensureTestVendor } from '@/lib/vendor-bootstrap';

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const result = await ensureTestVendor();
    return NextResponse.json({
      success: true,
      ...result,
      message: 'Usuario teste001 recriado com cardapio padrao e 50 guarda-sois.',
    });
  } catch (err) {
    console.error('Bootstrap test vendor error:', err);
    return NextResponse.json({
      error: 'Nao foi possivel criar o usuario teste. Confirme que o banco foi criado com infra/sql-iniciar-novo-projeto.sql.',
    }, { status: 500 });
  }
}
