import type { ReactNode } from "react";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-black text-white">{children}</main>;
}
