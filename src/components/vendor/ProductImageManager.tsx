"use client";

import { useEffect, useMemo, useState } from "react";
import { Product, ProductImage } from "@/types";
import { Search, Upload } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  void isPlusUser;

  const visibleImages = useMemo(() => {
    const query = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (!query) return defaultImages;
    return defaultImages.filter(image => `${image.name} ${image.title} ${image.category}`
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query));
  }, [defaultImages, search]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDefaultImages() {
      try {
        const response = await fetch('/api/products/gallery?planType=free');
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Erro ao carregar imagens padrao.");
        if (!cancelled) setDefaultImages((data?.data?.images || []) as ProductImage[]);
      } catch (err) {
        console.error("Erro ao carregar imagens padrao:", err);
        if (!cancelled) setDefaultImages([]);
      }
    }

    fetchDefaultImages();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectDefault = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  const handleUploadCustom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vendor_id", product.vendor_id);
      formData.append("category", product.category);
      formData.append("title", product.name || file.name.replace(/\.[^.]+$/, ""));
      const response = await fetch('/api/products/upload', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'Erro ao enviar imagem.');
      setSelectedImage(data.url);
      onImageSelected(data.url);
      if (data.image) setDefaultImages(prev => [data.image, ...prev.filter(image => image.id !== data.image.id)]);
      setMessage("Imagem convertida e adicionada a galeria geral.");
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
      setMessage(err instanceof Error ? err.message : "Erro ao fazer upload da imagem.");
    } finally {
      setLoading(false);
      e.target.value = "";
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

      <div>
        <label htmlFor="shared-image-search" className="text-sm font-medium text-gray-600 mb-2 block">Galeria geral</label>
        <div className="relative mb-3">
          <Search aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="shared-image-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar imagem" className="w-full rounded-lg border-2 border-gray-200 py-2 pl-10 pr-3" />
        </div>
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
          {visibleImages.map((img) => (
            <button
              key={img.id}
              type="button"
              aria-pressed={selectedImage === img.image_url}
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
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              {selectedImage === img.image_url && (
                <div className="absolute inset-0 bg-[#FF6B00]/20 flex items-center justify-center">
                  <span className="text-white font-bold">OK</span>
                </div>
              )}
            </button>
          ))}
        </div>
        {visibleImages.length === 0 && <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Nenhuma imagem encontrada.</p>}
      </div>

      <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Enviar para a galeria geral</p>
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
          {message && <p role="status" className="mt-2 rounded-lg bg-orange-50 p-3 text-sm font-bold text-orange-800">{message}</p>}
      </div>
    </div>
  );
}

