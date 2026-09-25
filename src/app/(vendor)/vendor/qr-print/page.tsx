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

const ITEMS_PER_PAGE = 10;

export default function QrPrintPage() {
  const [data, setData] = useState<BatchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryVendorId = new URLSearchParams(window.location.search).get("vendor_id");
    const vendorId = queryVendorId || sessionStorage.getItem("vendor_id") || localStorage.getItem("vendor_id");
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
    <main className="qr-print-root min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="no-print sticky top-3 z-10 mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#3D1A0A] p-4 text-white shadow-xl">
        <div>
          <p className="font-black">{data.count} QR Codes prontos</p>
          <p className="text-sm text-orange-100">Pimaco A4250 / A4350 · 99 × 55,8 mm · 10 por folha A4. Imprima em tamanho real (100%), sem cabeçalhos e rodapés.</p>
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
          <div className="qr-grid">
            {items.map(item => (
              <article key={item.id} className="qr-card">
                <strong className="qr-callout">Faça seu pedido aqui</strong>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.qr_image_url} alt={`QR Code do guarda-sol ${item.number}`} className="qr-image" />
                <div className="min-w-0 text-center">
                  <strong className="block text-[9pt] leading-none">Guarda-sol {item.number}</strong>
                  <span className="mt-[1mm] block truncate text-[6pt] font-bold text-[#70402c]">{data.vendor.name}</span>
                  {!item.active && <span className="mt-[1mm] inline-block rounded bg-gray-200 px-1 text-[5pt] font-black uppercase">Inativo</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <style jsx global>{`
        .qr-page { box-sizing: border-box; width: 210mm; height: 297mm; padding: 9mm 4.7mm; overflow: hidden; break-after: page; }
        .qr-page:last-child { break-after: auto; }
        .qr-grid { display: grid; grid-template-columns: repeat(2, 99mm); grid-template-rows: repeat(5, 55.8mm); column-gap: 2.6mm; row-gap: 0; }
        .qr-card { box-sizing: border-box; min-width: 0; width: 99mm; height: 55.8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; break-inside: avoid; color: #000; background: white; overflow: hidden; }
        .qr-callout { font: bold 12pt/1.2 Arial, sans-serif; margin-bottom: 1mm; }
        .qr-image { width: 34mm; height: 34mm; object-fit: contain; background: white; }
        @media screen { .qr-card { outline: 1px dashed #bba58a; outline-offset: -1px; } }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { width: 210mm; margin: 0 !important; padding: 0 !important; background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          html body .readable-app.readable-app .qr-print-root { background: white !important; padding: 0 !important; }
          .qr-page, .qr-card { background: white !important; box-shadow: none !important; border: 0 !important; }
        }
        @media screen and (max-width: 850px) {
          .qr-page { transform-origin: top left; }
        }
      `}</style>
    </main>
  );
}
