import { NextRequest, NextResponse } from "next/server";
import { archivePaidOrders } from "@/lib/order-archive";
import { cleanupOtpChallenges } from "@/lib/otp-cleanup";
import { cleanupOrderIdempotencyKeys } from "@/lib/order-idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_BATCHES = 25;
const OTP_RETENTION_MINUTES = 10;

function isAuthorizedCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

function startOfTodaySaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return new Date(`${year}-${month}-${day}T00:00:00-03:00`).toISOString();
}

function readPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const batchSize = readPositiveInt(searchParams.get("batch_size"), DEFAULT_BATCH_SIZE, 1000);
    const maxBatches = readPositiveInt(searchParams.get("max_batches"), DEFAULT_MAX_BATCHES, 50);
    const before = searchParams.get("before") || startOfTodaySaoPaulo();

    await cleanupOtpChallenges(OTP_RETENTION_MINUTES);
    const idempotencyCleanup = await cleanupOrderIdempotencyKeys(30);

    let archivedOrders = 0;
    let deletedOrders = 0;
    const files: string[] = [];
    let batches = 0;

    while (batches < maxBatches) {
      const result = await archivePaidOrders({
        before,
        limit: batchSize,
      });

      archivedOrders += result.archived_orders;
      deletedOrders += result.deleted_orders;
      files.push(...result.files);
      batches += 1;

      if (result.archived_orders < batchSize) break;
    }

    return NextResponse.json({
      ok: true,
      otp_cleanup_retention_minutes: OTP_RETENTION_MINUTES,
      order_idempotency_cleanup: idempotencyCleanup,
      archive_before: before,
      batches,
      archived_orders: archivedOrders,
      deleted_orders: deletedOrders,
      files_written: files.length,
      has_more: batches >= maxBatches && archivedOrders >= batchSize * maxBatches,
    });
  } catch (err) {
    console.error("Daily maintenance error:", err);
    return NextResponse.json({ error: "Erro ao executar manutencao diaria." }, { status: 500 });
  }
}
