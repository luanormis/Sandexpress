import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";


export const metadata: Metadata = {
  title: "SandExpress | Peça direto do seu guarda-sol",
  description: "Peça direto do seu guarda-sol pelo QR Code, sem filas e sem esperar atendimento para fazer o pedido.",
  manifest: "/manifest.json",
  icons: {
    icon: "/sandexpress-logo-fluid.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6b00",
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
        {children}
      </body>
    </html>
  );
}
