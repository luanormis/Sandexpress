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
    const search = String(request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const planType = request.nextUrl.searchParams.get("planType") || "free";
    const requestedCategoryKey = category ? categoryKey(category) : null;

    let query = supabaseAdmin.from("product_images").select("*").eq("active", true);
    if (planType === "free") {
      query = query.eq("plan_type", "free");
    }
    const { data, error } = await query.order("category").order("name");

    if (error) {
      console.error("Product gallery query error:", error);
      return NextResponse.json({ error: 'Galeria product_images indisponivel no banco.' }, { status: 500 });
    }

    const categoryImages = requestedCategoryKey
      ? (data || []).filter((image: any) => categoryKey(image.category) === requestedCategoryKey)
      : (data || []);
    const images = search
      ? categoryImages.filter((image: any) => {
          const haystack = [
            image.category,
            image.title,
            image.name,
            image.description,
            ...(Array.isArray(image.tags) ? image.tags : []),
          ].join(" ").toLowerCase();
          return haystack.includes(search);
        })
      : categoryImages;

    return galleryResponse(images);
  } catch (error) {
    console.error("Product gallery fetch error:", error);
    return NextResponse.json({ error: 'Erro ao carregar galeria de produtos.' }, { status: 500 });
  }
}
