"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Vendor } from "@/types";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { kioskLogoForCustomer } from "@/lib/kiosk-logo";

interface CustomerKioskViewProps {
  vendorId: string;
  umbrellaNumber: number;
}

export function CustomerKioskView({ vendorId, umbrellaNumber }: CustomerKioskViewProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const { data, error } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .single();

        if (error) throw error;
        setVendor(data as Vendor);
      } catch (err) {
        console.error("Erro ao carregar vendor:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId]);

  if (loading) return <LoadingSpinner fullScreen text="Carregando quiosque..." />;

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Quiosque não encontrado</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: vendor.primary_color }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header com logo e nome */}
        <div className="text-white mb-8 text-center">
          {kioskLogoForCustomer(vendor.logo_url) ? (
            <img
              src={kioskLogoForCustomer(vendor.logo_url) || undefined}
              alt={vendor.name}
              className="w-24 h-24 mx-auto mb-4 rounded-lg shadow-lg"
            />
          ) : (
            <div aria-hidden="true" className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/80 text-4xl font-black text-[#3D1A0A]">
              {vendor.name.slice(0, 1).toLocaleUpperCase()}
            </div>
          )}
          <h1 className="text-4xl font-bold">{vendor.name}</h1>
          <p className="text-lg opacity-90 mt-2">Mesa/Guarda-sol #{umbrellaNumber}</p>
        </div>

        {/* Seção de menu */}
        <div
          className="rounded-lg shadow-lg p-6 text-center"
          style={{ backgroundColor: vendor.secondary_color || "#394E59" }}
        >
          <p className="text-white text-xl font-semibold mb-4">
            Faça seu pedido escaneando o QR code
          </p>
          <p className="text-gray-200 mb-6">
            Ou acesse o menu através do aplicativo
          </p>

          <button
            className="px-8 py-3 rounded-lg font-bold text-lg transition-all hover:opacity-90"
            style={{
              backgroundColor: vendor.primary_color,
              color: "white",
            }}
          >
            Abrir Menu
          </button>
        </div>

      </div>
    </div>
  );
}
