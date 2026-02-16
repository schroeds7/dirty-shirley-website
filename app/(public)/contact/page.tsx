import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight">Get in touch</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/75">
            Whether you have feedback, want to partner, or are a venue looking to get set up,
            we’d love to hear from you.
          </p>
        </header>

        {/* Contact options */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* General contact */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">General inquiries</h2>
            <p className="mt-3 text-white/70 leading-relaxed">
              Questions, ideas, or feedback about Dirty Shirley? Email is the fastest way to reach us.
              If you’re a venue, please include your venue name.
            </p>

            <div className="mt-6">
              <a
                href="mailto:contact@dirtyshirley.app?subject=Dirty%20Shirley%20Inquiry"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Email contact@dirtyshirley.app
              </a>
            </div>

            <p className="mt-4 text-xs text-white/50">
              Prefer to copy the address?
              <span className="ml-2 select-all rounded-md border border-white/10 bg-white/5 px-2 py-1">
                contact@dirtyshirley.app
              </span>
            </p>
          </div>

          {/* Venue portal */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">For venues</h2>
            <p className="mt-3 text-white/70 leading-relaxed">
              Claim your listing, publish events, and manage your venue’s presence through
              the Dirty Shirley Venue Portal.
            </p>

            <ul className="mt-4 space-y-2 text-white/70">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
                <span>Update venue details and photos</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
                <span>Create and promote events</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
                <span>Reach guests deciding where to go tonight</span>
              </li>
            </ul>

            <div className="mt-6">
              <Link
                href="/select-venue"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Open Venue Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-10 max-w-2xl text-sm text-white/50">
          Dirty Shirley is still evolving. If you’re a promoter, DJ, or brand interested in
          collaborating, don’t hesitate to reach out.
        </p>
      </section>
    </main>
  );
}