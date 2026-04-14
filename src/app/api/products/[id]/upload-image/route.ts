import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canAccessVendor, getRequestSession } from "@/lib/auth-session";
import { validateImageUpload } from "@/lib/upload-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getRequestSession(request);
    if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id: productId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const vendorId = formData.get("vendorId") as string;

    if (!file || !vendorId) {
      return NextResponse.json(
        { error: "file e vendorId são obrigatórios." },
        { status: 400 }
      );
    }
    const validationError = validateImageUpload(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: "Não autorizado para este vendor." }, { status: 403 });
    }

    // Verificar se o vendor tem plano plus
    const { data: plan, error: planError } = await supabaseAdmin
      .from("vendor_plans")
      .select("*")
      .eq("vendor_id", vendorId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plano não encontrado para o vendor." },
        { status: 404 }
      );
    }

    if (plan.plan_type !== "plus") {
      return NextResponse.json(
        { error: "Plano Plus obrigatório para imagens personalizadas." },
        { status: 403 }
      );
    }

    if (plan.custom_images_used >= plan.max_custom_images) {
      return NextResponse.json(
        {
          error: `Limite de imagens personalizadas atingido (${plan.max_custom_images}).`,
        },
        { status: 403 }
      );
    }

    // Upload da imagem para o storage
    const fileName = `products/${vendorId}/${productId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json(
        { error: "Falha no upload da imagem." },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrl } = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(uploadData.path);

    // Atualizar produto com a nova imagem
    const { error: updateError } = await supabaseAdmin
      .from("products")
      .update({
        image_url: publicUrl.publicUrl,
        is_default_image: false,
        image_plan_type: "plus",
      })
      .eq("id", productId)
      .eq("vendor_id", vendorId);

    if (updateError) {
      return NextResponse.json(
        { error: "Falha ao atualizar produto." },
        { status: 500 }
      );
    }

    // Incrementar contador de imagens usadas
    const { error: counterError } = await supabaseAdmin
      .from("vendor_plans")
      .update({
        custom_images_used: plan.custom_images_used + 1,
      })
      .eq("vendor_id", vendorId);

    if (counterError) {
      console.error("Falha ao atualizar contador de imagens personalizadas:", counterError);
    }

    return NextResponse.json(
      {
        success: true,
        imageUrl: publicUrl.publicUrl,
        remainingUploads: plan.max_custom_images - plan.custom_images_used - 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Product image upload error:", error);
    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 }
    );
  }
}
