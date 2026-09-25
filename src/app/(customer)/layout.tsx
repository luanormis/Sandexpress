import type { ReactNode } from "react";
export default function ReadableLayout({ children }: { children: ReactNode }) {
  return <div className="readable-app">{children}</div>;
}
