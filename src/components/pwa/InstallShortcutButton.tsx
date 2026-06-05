"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallShortcutButtonProps = {
  context: "vendor" | "customer";
  className?: string;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallShortcutButton({ context, className }: InstallShortcutButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const copy = useMemo(() => {
    if (context === "vendor") {
      return {
        title: "Instalar atalho do quiosque",
        button: "Instalar atalho",
        help: "No iPhone, toque em Compartilhar e escolha Adicionar a Tela de Inicio. No Android, use Instalar ou Adicionar a tela inicial.",
      };
    }
    return {
      title: "Instalar atalho deste guarda-sol",
      button: "Instalar atalho",
      help: "No iPhone, toque em Compartilhar e escolha Adicionar a Tela de Inicio. No Android, use Instalar ou Adicionar a tela inicial para voltar a este cardapio.",
    };
  }, [context]);

  useEffect(() => {
    const standaloneCheck = window.setTimeout(() => setInstalled(isStandalone()), 0);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(standaloneCheck);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowHelp(false);
    }
    setInstallPrompt(null);
  }

  if (installed) return null;

  return (
    <div className={cn("rounded-xl border border-[#e2bfb0] bg-white/90 p-3 text-left shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={install}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-4 py-3 text-sm font-black text-white active:scale-95"
          aria-label={copy.title}
        >
          <Download size={18} />
          {copy.button}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          className="rounded-lg border border-[#e2bfb0] p-3 text-[#82533f]"
          aria-label="Como instalar"
        >
          {showHelp ? <X size={18} /> : <Info size={18} />}
        </button>
      </div>
      {showHelp && (
        <p className="mt-3 text-xs font-semibold leading-relaxed text-[#82533f]">
          {copy.help}
        </p>
      )}
    </div>
  );
}
