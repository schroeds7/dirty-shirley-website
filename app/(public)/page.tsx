import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen text-white">
      {/* Hero */}
      <section
        className="relative w-full overflow-hidden"
        style={{
          backgroundImage: "url('/hero-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "right center",
        }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/0" />


        <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Dirty Shirley
            </div>

            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Find the best spots tonight.
              <span className="block text-white/70">Vote with friends. Go with confidence.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70">
              Dirty Shirley is a nightlife discovery app that helps you quickly find venues and events,
              see what’s trending, and coordinate plans with your group—without the chaos.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* Download links can be updated when live */}
              <Link
                href="/about#download"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Download the App
              </Link>

              <Link
                href="/select-venue"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Venue Portal
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/55">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                Map + filters
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                Live events
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                Trending tonight
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                Vote with friends
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>
    </main>
  );
}
