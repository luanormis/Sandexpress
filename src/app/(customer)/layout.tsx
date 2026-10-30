import "@fontsource-variable/plus-jakarta-sans";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="sx-menu min-h-dvh bg-areia text-tinta antialiased">{children}</div>;
}
