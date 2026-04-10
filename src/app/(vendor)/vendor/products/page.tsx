"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { ProductImageManager } from "@/components/vendor/ProductImageManager";
import { Product, VendorPlan } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Edit2, Trash2, Plus } from "lucide-react";

export default function VendorProductsPage() {
  const { vendorId, isAuthenticated } = useVendorAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [plan, setPlan] = useState<VendorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !vendorId) return;
    fetchProducts();
    fetchVendorPlan();
  }, [vendorId, isAuthenticated]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("category")
        .order("sort_order");

      if (error) throw error;
      setProducts(data as Product[]);
    } catch (err) {
      console.error("Erro ao buscar produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorPlan = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_plans")
        .select("*")
        .eq("vendor_id", vendorId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data) setPlan(data as VendorPlan);
    } catch (err) {
      console.error("Erro ao buscar plano:", err);
    }
  };

  const handleImageSelected = async (productId: string, imageUrl: string) => {
    try {
      await supabase
        .from("products")
        .update({
          image_url: imageUrl,
          is_default_image: false,
          image_plan_type: "free",
        })
        .eq("id", productId);

      setEditingProductId(null);
      await fetchProducts();
    } catch (err) {
      console.error("Erro ao atualizar imagem:", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Faça login para gerenciar seus produtos</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando produtos..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Produtos</h1>
            <p className="text-gray-600">
              {products.length} produto{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="bg-[#FF6B00] hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors">
            <Plus size={20} />
            Novo Produto
          </button>
        </div>

        {/* Info do Plano */}
        {plan && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">Plano Atual</h3>
                <p className="text-gray-600">
                  {plan.plan_type === "plus" ? "Plano Plus" : "Plano Free"}
                </p>
              </div>
              {plan.plan_type === "plus" && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Imagens Personalizadas</p>
                  <p className="font-semibold text-gray-900">
                    {plan.custom_images_used} / {plan.max_custom_images}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid de Produtos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Imagem do Produto */}
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}

              {/* Conteúdo */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {product.category}
                </p>

                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-lg font-bold text-[#FF6B00]">
                      R$ {product.price.toFixed(2)}
                    </p>
                    {product.promotional_price && (
                      <p className="text-sm text-gray-500 line-through">
                        R$ {product.promotional_price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  {product.active && (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                      Ativo
                    </span>
                  )}
                </div>

                {/* Status da Imagem */}
                {product.is_default_image && (
                  <p className="text-xs text-blue-600 mb-3">
                    📷 Usando imagem padrão
                  </p>
                )}
                {product.image_plan_type === "plus" && !product.is_default_image && (
                  <p className="text-xs text-purple-600 mb-3">
                    ⭐ Imagem personalizada (Plus)
                  </p>
                )}

                {/* Botões */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingProductId(product.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit2 size={16} />
                    Editar Imagem
                  </button>
                  <button className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Product Image Manager Modal */}
              {editingProductId === product.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <ProductImageManager
                    product={product}
                    onImageSelected={(imageUrl) =>
                      handleImageSelected(product.id, imageUrl)
                    }
                    isPlusUser={plan?.plan_type === "plus" || false}
                  />
                  <button
                    onClick={() => setEditingProductId(null)}
                    className="mt-3 w-full text-gray-600 hover:text-gray-900 py-2 font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Nenhum produto cadastrado</p>
            <button className="bg-[#FF6B00] hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
              Criar Primeiro Produto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
