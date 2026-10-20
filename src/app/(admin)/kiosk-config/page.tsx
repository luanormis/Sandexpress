"use client";

import { useState } from "react";
import { Save } from "lucide-react";

export default function KioskConfigPage() {
  const [name, setName] = useState("");
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
        const formData = new FormData();
        formData.append("file", logoFile);
        const logoResponse = await fetch(`/api/vendors/${vendorId}/theme/logo`, {
          method: "POST",
          body: formData,
        });
        const logoData = await logoResponse.json().catch(() => ({}));
        if (!logoResponse.ok) throw new Error(logoData.error || "Erro ao subir logo.");
        logoUrl = logoData.logo_url || logoUrl;
      }

      const response = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logo_url: logoUrl,
        }),
      });

      if (!response.ok) throw new Error("Failed to update vendor");

      setMessage("Configurações salvas com sucesso!");
    } catch (err) {
      console.error("Save config error:", err);
      setMessage("Erro ao salvar configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-ops-shell min-h-screen p-6">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#7a2b00] bg-[#451704]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-8">
        <h1 className="text-3xl font-bold mb-6">Configuração do Quiosque</h1>

        <div className="mb-6 rounded-2xl border border-[#e8d8bb] bg-[#fff8e8] p-6 text-[#241b16] shadow-inner">
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-24 w-24 rounded-2xl border border-white/25 bg-white/90 object-contain p-2"
              />
            )}
            <div>
              <h2 className="text-2xl font-black">{name || "Seu Quiosque"}</h2>
              <p className="text-sm text-[#65574b]">Identidade visual padrão do SandExpress</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">
              Nome do Quiosque
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#d5b797] bg-white px-4 py-3 font-bold text-[#241b16] outline-none placeholder:text-[#8b7a6c] focus:border-[#ff9a3c] focus:ring-2 focus:ring-[#ff9a3c]/25"
              placeholder="Ex: Quiosque Praia Central"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full rounded-xl border border-dashed border-[#d5b797] bg-white px-4 py-3 text-sm font-bold text-[#241b16] file:mr-4 file:rounded-lg file:border-0 file:bg-[#ff9a3c] file:px-4 file:py-2 file:font-black file:text-[#241b16]"
            />
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="mt-3 max-h-32 rounded-2xl border border-[#7a2b00] bg-white/95 object-contain p-2"
              />
            )}
          </div>

          {message && (
            <p
              className={`rounded-xl border p-3 font-bold ${
                message.includes("sucesso")
                  ? "border-green-500/30 bg-green-500/15 text-green-100"
                  : "border-red-500/30 bg-red-500/15 text-red-100"
              }`}
            >
              {message}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9a3c] py-3 font-black text-[#241b16] shadow-[0_14px_30px_rgba(255,154,60,0.28)] transition hover:brightness-105 disabled:opacity-50"
          >
            <Save size={20} />
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
