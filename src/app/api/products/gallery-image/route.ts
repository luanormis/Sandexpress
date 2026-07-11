import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CATALOG_BUCKET = "catalogo-global";

function safeStoragePath(value: string) {
  const decoded = decodeURIComponent(value || "").trim();
  if (!decoded || decoded.includes("..") || decoded.startsWith("/") || decoded.includes("\\")) {
    return "";
  }
  return decoded;
}

export async function GET(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get("id") || "").trim();
    let storagePath = safeStoragePath(String(req.nextUrl.searchParams.get("path") || ""));

    if (id && !storagePath) {
      const { data, error } = await (supabaseAdmin.from("product_images") as any)
        .select("storage_path")
        .eq("id", id)
        .single();
      if (error || !data?.storage_path) {
        return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
      }
      storagePath = safeStoragePath(data.storage_path);
    }

    if (!storagePath) {
      return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(CATALOG_BUCKET)
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type || "image/webp",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("Gallery image proxy error:", err);
    return NextResponse.json({ error: "Erro ao carregar imagem." }, { status: 500 });
  }
}
