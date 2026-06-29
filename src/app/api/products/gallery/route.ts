import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDefaultProductImages } from "@/lib/default-product-images";

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
    let query = supabaseAdmin.from("product_images").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    // Free users get only free images
    // Plus users can see all images
    if (planType === "free") {
      query = query.eq("plan_type", "free");
    }

    const { data, error } = await query.order("category").order("name");

    if (error) {
      console.error("Product gallery query error:", error);
      return galleryResponse(getDefaultProductImages(category, planType));
    }

    const images: any[] = data?.length ? data : getDefaultProductImages(category, planType);
    return galleryResponse(images);
  } catch (error) {
    console.error("Product gallery fetch error:", error);
    const category = request.nextUrl.searchParams.get("category");
    const planType = request.nextUrl.searchParams.get("planType") || "free";
    return galleryResponse(getDefaultProductImages(category, planType));
  }
}
