import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-white">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/DSlogo.png"
            alt="Dirty Shirley"
            width={36}
            height={36}
            className="rounded-lg opacity-95"
            priority
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">Dirty Shirley</div>
            <div className="text-xs text-white/60">Nightlife, simplified</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/about"
            className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            Contact
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Venue Portal
          </Link>
        </nav>
      </div>
    </header>
  );
}