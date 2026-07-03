import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { categoryKey } from "@/lib/default-product-images";

function galleryResponse(images: any[]) {
  const groupedByCategory = images.reduce(
    (acc: Record<string, any[]>, image: any) => {
      if (!acc[image.category]) {
        acc[image.category] = [];
      }
      acc[image.category].push(image);
      return acc;
    },
    {}
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        images,
        byCategory: groupedByCategory,
        total: images.length,
      },
    },
    { status: 200 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get("category");
    const planType = request.nextUrl.searchParams.get("planType") || "free";
    const requestedCategoryKey = category ? categoryKey(category) : null;
    let query = supabaseAdmin.from("product_images").select("*");

    // Free users get only free images
    // Plus users can see all images
    if (planType === "free") {
      query = query.eq("plan_type", "free");
    }

    const { data, error } = await query.order("category").order("name");

    if (error) {
      console.error("Product gallery query error:", error);
      return NextResponse.json({ error: 'Galeria product_images indisponivel no banco.' }, { status: 500 });
    }

    const images = requestedCategoryKey
      ? (data || []).filter((image: any) => categoryKey(image.category) === requestedCategoryKey)
      : (data || []);

    return galleryResponse(images);
  } catch (error) {
    console.error("Product gallery fetch error:", error);
    return NextResponse.json({ error: 'Erro ao carregar galeria de produtos.' }, { status: 500 });
  }
}
