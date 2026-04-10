import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const vendorId = formData.get("vendorId") as string;
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!file || !vendorId || !authToken) {
      return NextResponse.json(
        { error: "File, vendorId, and authorization required" },
        { status: 400 }
      );
    }

    // Verificar se o vendor tem plano plus
    const { data: plan, error: planError } = await supabase
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
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("product-images")
      .getPublicUrl(uploadData.path);

    // Atualizar produto com a nova imagem
    const { error: updateError } = await supabase
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
    const { error: counterError } = await supabase
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
