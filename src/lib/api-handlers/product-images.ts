import { supabase } from "@/lib/supabase";
import { ProductImage } from "@/types";

export async function getProductImagesByCategory(
  category: string,
  planType?: "free" | "plus"
) {
  try {
    let query = supabase.from("product_images").select("*").eq("category", category);

    if (planType) {
      query = query.eq("plan_type", planType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as ProductImage[];
  } catch (err) {
    console.error("Erro ao buscar imagens de produto:", err);
    return [];
  }
}

export async function getProductImageGallery(
  category?: string,
  isPlusMember: boolean = false
) {
  try {
    let query = supabase.from("product_images").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    // Free users see only free images
    // Plus users see all images (free + plus)
    if (!isPlusMember) {
      query = query.eq("plan_type", "free");
    }

    const { data, error } = await query.order("category").order("title");

    if (error) throw error;
    return data as ProductImage[];
  } catch (err) {
    console.error("Erro ao buscar galeria de imagens:", err);
    return [];
  }
}

export async function uploadProductImage(
  file: File,
  vendorId: string,
  productId: string
): Promise<string | null> {
  try {
    const fileName = `products/${vendorId}/${productId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  } catch (err) {
    console.error("Erro ao fazer upload de imagem:", err);
    return null;
  }
}

export async function updateProductImage(
  productId: string,
  imageUrl: string,
  isDefaultImage: boolean = false,
  imagePlanType: "free" | "plus" = "free"
) {
  try {
    const { error } = await supabase
      .from("products")
      .update({
        image_url: imageUrl,
        is_default_image: isDefaultImage,
        image_plan_type: imagePlanType,
      })
      .eq("id", productId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao atualizar imagem do produto:", err);
    return false;
  }
}
