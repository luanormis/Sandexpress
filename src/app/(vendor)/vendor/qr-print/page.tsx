"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";

type QrItem = {
  id: string;
  number: number;
  label: string;
  active: boolean;
  target_url: string;
  qr_image_url: string;
};

type BatchResponse = {
  vendor: { id: string; name: string };
  generated_at: string;
  count: number;
  items: QrItem[];
  error?: string;
};

const ITEMS_PER_PAGE = 30;

export default function QrPrintPage() {
  const [data, setData] = useState<BatchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryVendorId = new URLSearchParams(window.location.search).get("vendor_id");
    const vendorId = queryVendorId || sessionStorage.getItem("vendor_id");
    if (!vendorId) {
      const timer = window.setTimeout(() => setError("Quiosque nao identificado. Volte ao painel e tente novamente."), 0);
      return () => window.clearTimeout(timer);
    }

    fetch(`/api/qr/batch?vendor_id=${encodeURIComponent(vendorId)}`, { credentials: "include" })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Nao foi possivel gerar os QR Codes.");
        setData(payload);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Erro ao carregar QR Codes."));
  }, []);

  const pages = useMemo(() => {
    const items = data?.items || [];
    return Array.from({ length: Math.ceil(items.length / ITEMS_PER_PAGE) }, (_, index) =>
      items.slice(index * ITEMS_PER_PAGE, (index + 1) * ITEMS_PER_PAGE)
    );
  }, [data]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><p className="font-bold text-red-700">{error}</p><a href="/vendor/dashboard" className="mt-5 inline-block rounded-xl bg-orange-600 px-5 py-3 font-bold text-white">Voltar ao painel</a></div></main>;
  }

  if (!data) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-100"><p className="font-bold text-gray-700">Montando folhas A4...</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="no-print sticky top-3 z-10 mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#3D1A0A] p-4 text-white shadow-xl">
        <div>
          <p className="font-black">{data.count} QR Codes prontos</p>
          <p className="text-sm text-orange-100">30 por folha A4. No destino, escolha imprimir ou salvar como PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/vendor/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4 font-bold"><ArrowLeft size={18}/> Voltar</a>
          <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF6B00] px-4 font-black text-white"><Printer size={18}/><Download size={16}/> Baixar / imprimir A4</button>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center font-bold text-gray-700">Cadastre guarda-sois antes de gerar a folha.</div>
      ) : pages.map((items, pageIndex) => (
        <section className="qr-page mx-auto mb-6 bg-white text-[#251006] shadow-xl print:mb-0 print:shadow-none" key={pageIndex}>
          <header className="sheet-header flex items-center justify-between border-b-2 border-[#FF6B00]">
            <div className="flex items-center gap-[2mm]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sandexpress-logo.svg" alt="SandExpress" className="brand-mark" />
              <div><strong className="block text-[12pt] leading-none">SandExpress</strong><span className="text-[7pt] font-bold uppercase tracking-wide text-[#8b3d16]">{data.vendor.name}</span></div>
            </div>
            <div className="text-right text-[7pt] font-bold text-[#70402c]">QR Codes dos guarda-sois<br/>Folha {pageIndex + 1} de {pages.length}</div>
          </header>

          <div className="qr-grid">
            {items.map(item => (
              <article key={item.id} className="qr-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.qr_image_url} alt={`QR Code do guarda-sol ${item.number}`} className="qr-image" />
                <div className="min-w-0 text-center">
                  <strong className="block text-[9pt] leading-none">Guarda-sol {item.number}</strong>
                  <span className="mt-[1mm] block truncate text-[6pt] font-bold text-[#70402c]">Aponte a camera e faca seu pedido</span>
                  {!item.active && <span className="mt-[1mm] inline-block rounded bg-gray-200 px-1 text-[5pt] font-black uppercase">Inativo</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <style jsx global>{`
        .qr-page { box-sizing: border-box; width: 210mm; height: 297mm; padding: 7mm 8mm 6mm; overflow: hidden; page-break-after: always; }
        .qr-page:last-child { page-break-after: auto; }
        .sheet-header { height: 14mm; padding-bottom: 2mm; }
        .brand-mark { width: 10mm; height: 10mm; }
        .qr-grid { display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(6, 1fr); gap: 1.5mm; height: 267mm; padding-top: 2mm; }
        .qr-card { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; border: .35mm solid #e8b28e; border-radius: 2mm; padding: 1mm; break-inside: avoid; }
        .qr-image { width: 30mm; height: 30mm; object-fit: contain; image-rendering: auto; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { width: 210mm; margin: 0 !important; padding: 0 !important; background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        @media screen and (max-width: 850px) {
          .qr-page { transform-origin: top left; }
        }
      `}</style>
    </main>
  );
}
