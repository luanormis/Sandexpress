"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { ProductImageManager } from "@/components/vendor/ProductImageManager";
import { Product, VendorPlan } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Edit2, Trash2, Plus, X } from "lucide-react";

interface ProductCreationModalProps {
  vendorId: string;
  tenantId: string;
  isPlusUser: boolean;
  onClose: () => void;
  onProductCreated: () => void;
}

function ProductCreationModal({
  vendorId,
  tenantId,
  isPlusUser,
  onClose,
  onProductCreated,
}: ProductCreationModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    promotional_price: "",
    image_url: "",
    active: true,
  });
  const [selectedImage, setSelectedImage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.price) return;

    setSaving(true);
    try {
      const productData = {
        tenant_id: tenantId,
        vendor_id: vendorId,
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        price: parseFloat(formData.price),
        promotional_price: formData.promotional_price ? parseFloat(formData.promotional_price) : null,
        image_url: selectedImage || null,
        is_default_image: !selectedImage,
        image_plan_type: selectedImage ? "free" : "free",
        active: formData.active,
        is_combo: false,
        sort_order: 99,
      };

      const { error } = await (supabase as any)
        .from("products")
        .insert(productData);

      if (error) throw error;

      onProductCreated();
    } catch (err) {
      console.error("Erro ao criar produto:", err);
      alert("Erro ao criar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelected = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setFormData(prev => ({ ...prev, image_url: imageUrl }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Novo Produto</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome e Categoria */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Produto *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                placeholder="Ex: X-Burger"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              >
                <option value="">Selecione uma categoria</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Petiscos">Petiscos</option>
                <option value="Pratos Principais">Pratos Principais</option>
                <option value="Sobremesas">Sobremesas</option>
                <option value="Combos">Combos</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
              rows={3}
              placeholder="Descrição opcional do produto"
            />
          </div>

          {/* Preços */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço Promocional (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.promotional_price}
                onChange={(e) => setFormData(prev => ({ ...prev, promotional_price: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Imagem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Imagem do Produto
            </label>
            <ProductImageManager
              product={{
                id: "temp",
                tenant_id: tenantId,
                vendor_id: vendorId,
                category: formData.category,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price) || 0,
                promotional_price: formData.promotional_price ? parseFloat(formData.promotional_price) : undefined,
                image_url: selectedImage,
                is_default_image: !selectedImage,
                image_plan_type: "free",
                active: true,
                is_combo: false,
                sort_order: 99,
                blocked_by_stock: false,
                stock_quantity: null,
                created_at: undefined,
                updated_at: undefined,
              }}
              onImageSelected={handleImageSelected}
              isPlusUser={isPlusUser}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name || !formData.category || !formData.price}
              className="bg-[#FF6B00] hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              {saving ? "Criando..." : "Criar Produto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorProductsPage() {
  const { vendorId, isAuthenticated } = useVendorAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [plan, setPlan] = useState<VendorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !vendorId) return;
    fetchProducts();
    fetchVendorPlan();
  }, [vendorId, isAuthenticated]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
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
      await (supabase as any)
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
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FF6B00] hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
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
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-[#FF6B00] hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Criar Primeiro Produto
            </button>
          </div>
        )}

        {/* Product Creation Modal */}
        {showCreateModal && vendorId && (
          <ProductCreationModal
            vendorId={vendorId as string}
            tenantId={products[0]?.tenant_id || ""}
            isPlusUser={plan?.plan_type === "plus" || false}
            onClose={() => setShowCreateModal(false)}
            onProductCreated={() => {
              setShowCreateModal(false);
              fetchProducts();
            }}
          />
        )}
      </div>
    </div>
  );
}
