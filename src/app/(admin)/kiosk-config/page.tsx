"use client";

import { useState } from "react";
import { Save } from "lucide-react";

export default function KioskConfigPage() {
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF6B00");
  const [secondaryColor, setSecondaryColor] = useState("#394E59");
  const [buttonColor, setButtonColor] = useState("#FF6B00");
  const [buttonTextColor, setButtonTextColor] = useState("#FFFFFF");
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
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          button_color: buttonColor,
          button_text_color: buttonTextColor,
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

        <div
          className="mb-6 rounded-2xl border border-white/15 p-6 text-white shadow-inner"
          style={{
            backgroundColor: primaryColor,
          }}
        >
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
              <p>Cor secundária:</p>
              <span
                className="ml-2 inline-block h-7 w-7 rounded-lg border border-white/30"
                style={{ backgroundColor: secondaryColor }}
              />
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
              className="w-full rounded-xl border border-[#7a2b00] bg-[#201411] px-4 py-3 font-bold text-[#fff8f6] outline-none placeholder:text-[#b78f7d] focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/25"
              placeholder="Ex: Quiosque Praia Central"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">
              Cor Primária
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-11 w-16 rounded-xl border border-[#7a2b00] bg-[#201411] p-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">
              Cor Secundária
            </label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-11 w-16 rounded-xl border border-[#7a2b00] bg-[#201411] p-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">
              Cor do Botao
            </label>
            <input
              type="color"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              className="h-11 w-16 rounded-xl border border-[#7a2b00] bg-[#201411] p-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">
              Texto do Botao
            </label>
            <input
              type="color"
              value={buttonTextColor}
              onChange={(e) => setButtonTextColor(e.target.value)}
              className="h-11 w-16 rounded-xl border border-[#7a2b00] bg-[#201411] p-1"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#ffcfb1]">Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full rounded-xl border border-dashed border-[#7a2b00] bg-[#201411] px-4 py-3 text-sm font-bold text-[#fff8f6] file:mr-4 file:rounded-lg file:border-0 file:bg-[#ff6b00] file:px-4 file:py-2 file:font-black file:text-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-black shadow-[0_14px_30px_rgba(255,107,0,0.28)] transition hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            <Save size={20} />
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
