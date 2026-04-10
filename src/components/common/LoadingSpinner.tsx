"use client";

import { LoaderCircle } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ text = "Carregando...", fullScreen = false }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
        <div className="flex flexx-col items-center gap-3">
          <LoaderCircle className="w-8 h-8 animate-spin text-[#FF6B00]" />
          <p className="text-gray-600 font-medium">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <LoaderCircle className="w-6 h-6 animate-spin text-[#FF6B00]" />
      <p className="text-gray-600 text-sm font-medium">{text}</p>
    </div>
  );
}
