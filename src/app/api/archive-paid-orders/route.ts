import { NextRequest, NextResponse } from "next/server";
import { archivePaidOrders } from "@/lib/order-archive";
import { canAccessVendor, getRequestSession } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const vendorId = body.vendor_id ? String(body.vendor_id) : undefined;
    if (vendorId && !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: "Nao autorizado para este vendor." }, { status: 403 });
    }
    if (!vendorId && session.role !== "admin") {
      return NextResponse.json({ error: "Apenas admin pode arquivar todos os quiosques." }, { status: 403 });
    }

    const result = await archivePaidOrders({
      vendorId,
      before: body.before ? String(body.before) : undefined,
      limit: body.limit ? Number(body.limit) : undefined,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.archived_orders} pedidos pagos arquivados no Storage e removidos do banco operacional.`,
    });
  } catch (err) {
    console.error("Archive paid orders error:", err);
    return NextResponse.json({ error: "Erro ao arquivar pedidos pagos." }, { status: 500 });
  }
}

