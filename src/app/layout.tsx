import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PlatformThemeRuntime } from "@/components/PlatformThemeRuntime";
import "./globals.css";
import "./readable-app.css";


export const metadata: Metadata = {
  title: "SandExpress | Peça direto do seu guarda-sol",
  description: "Peça direto do seu guarda-sol pelo QR Code, sem filas e sem esperar atendimento para fazer o pedido.",
  manifest: "/manifest.json",
  icons: {
    icon: "/sandexpress-app-icon-512.png",
    apple: "/sandexpress-app-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3d1a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ServiceWorkerRegister />
        <PlatformThemeRuntime />
        {children}
      </body>
    </html>
  );
}
