"use client";

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export function QrScannerButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('Aponte para o QR Code SandExpress do guarda-sol.');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!videoRef.current || stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (!Detector) {
          setMessage('A câmera foi aberta, mas este navegador não lê QR automaticamente. Use a câmera normal do aparelho.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          if (!videoRef.current || stopped) return;
          const [code] = await detector.detect(videoRef.current).catch(() => []);
          if (!code?.rawValue) return;
          const target = new URL(code.rawValue, window.location.origin);
          const validPath = /^\/u\/[^/]+\/[^/]+\/?$/.test(target.pathname);
          if (target.origin !== window.location.origin || !validPath) {
            setMessage('Este QR não identifica um guarda-sol SandExpress válido.');
            return;
          }
          stopped = true;
          window.location.assign(target.toString());
        }, 500);
      } catch {
        setMessage('Permita o uso da câmera nas configurações do navegador para ler outro QR Code.');
      }
    };
    void start();
    return () => {
      stopped = true;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#FF6B00] bg-white px-4 font-black text-[#9A3E00]">
      <Camera size={20} /> Abrir câmera e ler outro QR
    </button>
    {open && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Leitor de QR Code">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-[#FFF8E8] p-4 text-[#2F241E] shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><strong>Ler QR do guarda-sol</strong><button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white p-2" aria-label="Fechar câmera"><X /></button></div>
        <video ref={videoRef} muted playsInline className="aspect-square w-full rounded-2xl bg-black object-cover" />
        <p className="mt-3 text-sm font-bold leading-5">{message}</p>
      </div>
    </div>}
  </>;
}

