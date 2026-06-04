import { NextRequest, NextResponse } from "next/server";
import { canAccessVendor, getRequestSession } from "@/lib/auth-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const vendorId = formData.get("vendorId") as string;
    const session = getRequestSession(request);

    if (!file || !vendorId) {
      return NextResponse.json(
        { error: "File and vendorId are required" },
        { status: 400 }
      );
    }

    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
    }

    // Verificar se o vendor tem plano plus
    const { data: plan, error: planError } = await supabaseAdmin
      .from("vendor_plans")
      .select("*")
      .eq("vendor_id", vendorId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found for vendor" },
        { status: 404 }
      );
    }

    if (plan.plan_type !== "plus") {
      return NextResponse.json(
        { error: "Plus plan required for custom images" },
        { status: 403 }
      );
    }

    if (plan.custom_images_used >= plan.max_custom_images) {
      return NextResponse.json(
        {
          error: `Custom image limit reached (${plan.max_custom_images})`,
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
        { error: "Failed to upload image" },
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
        { error: "Failed to update product" },
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
      console.error("Failed to update custom images counter:", counterError);
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
