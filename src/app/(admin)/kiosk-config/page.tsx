"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Save } from "lucide-react";

export default function KioskConfigPage() {
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF6B00");
  const [secondaryColor, setSecondaryColor] = useState("#394E59");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const vendorId = sessionStorage.getItem("vendor_id");
      if (!vendorId) {
        setMessage("Erro: Quiosque não identificado.");
        return;
      }

      let logoUrl = logoPreview;

      if (logoFile) {
        const fileName = `logos/${vendorId}/${Date.now()}-${logoFile.name}`;
        const { data, error } = await supabase.storage
          .from("kiosk-uploads")
          .upload(fileName, logoFile);

        if (error) throw error;
        logoUrl = supabase.storage
          .from("kiosk-uploads")
          .getPublicUrl(data.path).data.publicUrl;
      }

      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          name,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
        })
        .eq("id", vendorId);

      if (updateError) throw updateError;

      setMessage("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Save config error:", err);
      setMessage("Erro ao salvar configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-6">Configuração do Quiosque</h1>

        <div
          className="mb-6 p-6 rounded-lg text-white"
          style={{
            backgroundColor: primaryColor,
          }}
        >
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="w-24 h-24 rounded"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold">{name || "Seu Quiosque"}</h2>
              <p>Cor secundária:</p>
              <span
                className="inline-block w-6 h-6 rounded ml-2"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nome do Quiosque
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Ex: Quiosque Praia Central"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Cor Primária
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Cor Secundária
            </label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full"
            />
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="mt-2 max-h-32"
              />
            )}
          </div>

          {message && (
            <p
              className={`p-3 rounded ${
                message.includes("sucesso")
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {message}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full bg-[#FF6B00] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#E56000] disabled:opacity-50"
          >
            <Save size={20} />
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
