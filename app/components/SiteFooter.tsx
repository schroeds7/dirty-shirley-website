import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-white/55 md:flex-row md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} Dirty Shirley</div>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-white" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-white" href="/terms">
            Terms
          </Link>
          <Link className="hover:text-white" href="/contact">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}