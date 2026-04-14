import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get("category");
    const planType = request.nextUrl.searchParams.get("planType") || "free";

    let query = supabase.from("product_images").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    // Free users get only free images
    // Plus users can see all images
    if (planType === "free") {
      query = query.eq("plan_type", "free");
    }

    const { data, error } = await query.order("category").order("title");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch product images" },
        { status: 500 }
      );
    }

    // Group by category
    const groupedByCategory = data.reduce(
      (acc: Record<string, typeof data>, image) => {
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
          images: data,
          byCategory: groupedByCategory,
          total: data.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Product gallery fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
