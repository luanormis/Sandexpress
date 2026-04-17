"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Product, ProductImage } from "@/types";
import { Image as ImageIcon, Upload } from "lucide-react";

interface ProductImageManagerProps {
  product: Product;
  onImageSelected: (imageUrl: string) => void;
  isPlusUser: boolean;
}

export function ProductImageManager({
  product,
  onImageSelected,
  isPlusUser,
}: ProductImageManagerProps) {
  const [defaultImages, setDefaultImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(product.image_url || "");

  useEffect(() => {
    fetchDefaultImages();
  }, [product.category]);

  const fetchDefaultImages = async () => {
    try {
      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .eq("category", product.category)
        .eq("plan_type", "free");

      if (error) throw error;
      setDefaultImages(data as ProductImage[]);
    } catch (err) {
      console.error("Erro ao carregar imagens padrão:", err);
    }
  };

  const handleSelectDefault = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  const handleUploadCustom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPlusUser) {
      alert("Upload de imagens personalizadas está disponível apenas no plano Plus");
      return;
    }

    setLoading(true);

    try {
      const fileName = `products/${product.vendor_id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      setSelectedImage(publicUrl.publicUrl);
      onImageSelected(publicUrl.publicUrl);
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
      alert("Erro ao fazer upload da imagem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Imagem do Produto</h3>

      {selectedImage && (
        <div className="mb-4">
          <img
            src={selectedImage}
            alt={product.name}
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Imagens Padrão */}
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">Imagens Padrão (Grátis)</p>
        <div className="grid grid-cols-3 gap-2">
          {defaultImages.map((img) => (
            <button
              key={img.id}
              onClick={() => handleSelectDefault(img.image_url)}
              className={`relative h-24 rounded-lg overflow-hidden border-2 transition-all ${
                selectedImage === img.image_url
                  ? "border-[#FF6B00]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <img
                src={img.image_url}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              {selectedImage === img.image_url && (
                <div className="absolute inset-0 bg-[#FF6B00]/20 flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Customizado */}
      {isPlusUser && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Imagem Personalizada (Plano Plus)
          </p>
          <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#FF6B00] transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadCustom}
              disabled={loading}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center">
              <Upload size={20} className="text-gray-400 mb-1" />
              <span className="text-sm text-gray-600">
                {loading ? "Enviando..." : "Clique para enviar"}
              </span>
            </div>
          </label>
        </div>
      )}

      {!isPlusUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            💡 Atualize para o Plano Plus para enviar imagens personalizadas
          </p>
        </div>
      )}
    </div>
  );
}
