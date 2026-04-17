"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { VendorPlan } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Star, Check } from "lucide-react";

export default function VendorPlanPage() {
  const { vendorId, isAuthenticated } = useVendorAuth();
  const [plan, setPlan] = useState<VendorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !vendorId) return;
    fetchVendorPlan();
  }, [vendorId, isAuthenticated]);

  const fetchVendorPlan = async () => {    if (!vendorId) return;
        try {
      const { data, error } = await (supabase as any)
        .from("vendor_plans")
        .select("*")
        .eq("vendor_id", vendorId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setPlan(data as VendorPlan);
      } else {
        // Criar plano padrão (free)
        const { data: newPlan, error: insertError } = await (supabase as any)
          .from("vendor_plans")
          .insert({
            vendor_id: vendorId,
            plan_type: "free",
            can_upload_images: false,
            max_custom_images: 0,
            custom_images_used: 0,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setPlan(newPlan as VendorPlan);
      }
    } catch (err) {
      console.error("Erro ao buscar plano:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToPlusTier = async () => {
    if (!vendorId) return;
    
    setUpgrading(true);
    try {
      const { error } = await (supabase as any)
        .from("vendor_plans")
        .update({
          plan_type: "plus",
          can_upload_images: true,
          max_custom_images: 100,
        })
        .eq("vendor_id", vendorId);

      if (error) throw error;

      await fetchVendorPlan();
      alert("✅ Plano atualizado para Plus com sucesso!");
    } catch (err) {
      console.error("Erro ao fazer upgrade:", err);
      alert("Erro ao fazer upgrade do plano");
    } finally {
      setUpgrading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Faça login para gerenciar seu plano</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando plano..." />;
  }

  const isPlusMember = plan?.plan_type === "plus";
  const customImagesUsed = plan?.custom_images_used || 0;
  const maxCustomImages = plan?.max_custom_images || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Plano</h1>
          <p className="text-gray-600">
            Escolha o plano certo para seu negócio
          </p>
        </div>

        {/* Cards de Planos */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Plano Free */}
          <div
            className={`rounded-lg border-2 p-6 transition-all ${
              !isPlusMember
                ? "border-[#FF6B00] bg-white shadow-lg"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Plano Free</h2>
              <p className="text-gray-600 mt-1">Perfeito para começar</p>
            </div>

            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900">
                R$ <span className="text-4xl">0</span>
              </div>
              <p className="text-gray-600 text-sm">por mês</p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3">
                <Check size={20} className="text-green-600" />
                <span className="text-gray-700">Galeria de imagens padrão</span>
              </li>
              <li className="flex items-center gap-3">
                <Check size={20} className="text-gray-300" />
                <span className="text-gray-500">Upload de imagens personalizadas</span>
              </li>
              <li className="flex items-center gap-3">
                <Check size={20} className="text-gray-300" />
                <span className="text-gray-500">Até 100 imagens personalizadas</span>
              </li>
            </ul>

            {!isPlusMember && (
              <button
                disabled
                className="w-full bg-gray-400 text-white py-2 rounded-lg font-semibold cursor-default"
              >
                Plano Atual
              </button>
            )}
          </div>

          {/* Plano Plus */}
          <div
            className={`rounded-lg border-2 p-6 transition-all relative ${
              isPlusMember
                ? "border-[#FF6B00] bg-white shadow-lg"
                : "border-[#FF6B00] bg-white"
            }`}
          >
            <div className="absolute top-4 right-4 bg-[#FF6B00] text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-semibold">
              <Star size={14} />
              Popular
            </div>

            <div className="mb-4 mt-4">
              <h2 className="text-2xl font-bold text-gray-900">Plano Plus</h2>
              <p className="text-gray-600 mt-1">Imagens personalizadas</p>
            </div>

            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900">
                R$ <span className="text-4xl">29</span>
              </div>
              <p className="text-gray-600 text-sm">por mês</p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3">
                <Check size={20} className="text-green-600" />
                <span className="text-gray-700">Galeria de imagens padrão</span>
              </li>
              <li className="flex items-center gap-3">
                <Check size={20} className="text-green-600" />
                <span className="text-gray-700">Upload de imagens personalizadas</span>
              </li>
              <li className="flex items-center gap-3">
                <Check size={20} className="text-green-600" />
                <span className="text-gray-700">Até 100 imagens personalizadas</span>
              </li>
            </ul>

            {isPlusMember ? (
              <button
                disabled
                className="w-full bg-[#FF6B00] text-white py-2 rounded-lg font-semibold cursor-default"
              >
                Plano Atual
              </button>
            ) : (
              <button
                onClick={handleUpgradeToPlusTier}
                disabled={upgrading}
                className="w-full bg-[#FF6B00] hover:bg-orange-700 text-white py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {upgrading ? "Atualizando..." : "Fazer Upgrade Agora"}
              </button>
            )}
          </div>
        </div>

        {/* Status Atual */}
        {isPlusMember && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Status de Imagens Personalizadas
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Imagens Personalizadas Usadas</span>
                  <span className="font-semibold text-gray-900">
                    {customImagesUsed} / {maxCustomImages}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#FF6B00] h-2 rounded-full transition-all"
                    style={{
                      width: `${(customImagesUsed / maxCustomImages) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Você tem {maxCustomImages - customImagesUsed} imagens personalizadas
                disponíveis para upload.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
