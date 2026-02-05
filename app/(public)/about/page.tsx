

export default function AboutPage() {
  const featureCards = [
    {
      title: "Find the right spot fast",
      description:
        "Browse venues and events by city, vibe, and what’s actually happening tonight — not outdated lists.",
    },
    {
      title: "See real-time momentum",
      description:
        "Know what’s trending right now with live ‘Going’ signals and activity that updates as people decide.",
    },
    {
      title: "Make group decisions easier",
      description:
        "Skip the endless group chat debates. Share options, compare, and lock in a plan in minutes.",
    },
    {
      title: "Explore events with context",
      description:
        "Artists, music, dress code, and the vibe — all in one place so you’re never guessing at the door.",
    },
    {
      title: "Save, share, and come back",
      description:
        "Bookmark favorites, share venues with friends, and keep your go-to spots organized.",
    },
    {
      title: "A portal built for venues",
      description:
        "Manage listings, promote events, and reach the exact audience deciding where to go tonight.",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">About Dirty Shirley</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/75">
            Dirty Shirley was built to make nightlife simpler — less guessing, less scrolling, and
            fewer messy group chats.
          </p>
        </header>

        {/* Why we built it */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Why we created it</h2>
            <p className="mt-3 text-white/70 leading-relaxed">
              We kept seeing the same problem: planning a night out takes too long. You bounce
              between Instagram stories, maps, random review sites, and a group chat that never
              agrees — and by the time you decide, you’ve lost momentum.
            </p>
            <p className="mt-4 text-white/70 leading-relaxed">
              Dirty Shirley combines discovery, coordination, and real-time signals into one place
              so you can confidently pick the right venue or event — and actually get out the door.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Our Mission</h2>
            <p className="mt-3 text-white/70 leading-relaxed">
              To remove friction from nightlife planning by combining discovery, coordination, and
              real-time insight into one simple platform.
            </p>
          </div>
        </div>

        {/* What the app does */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">What the app does</h2>
          <p className="mt-3 text-white/70 leading-relaxed max-w-3xl">
            The goal is simple: help you find the right place for the right night, with enough
            context to decide quickly — and signals that show what’s actually popular.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10"
              >
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-white/70 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* For venues */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">For venues</h2>
          <p className="mt-3 text-white/70 leading-relaxed">
            Dirty Shirley isn’t just a consumer app — it’s also a venue toolkit. The venue portal is
            designed to make updates easy and promotion measurable: publish events, manage your
            listing, and understand what’s resonating with guests.
          </p>
          <ul className="mt-4 space-y-2 text-white/70">
            <li className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
              <span>Update venue details and photos in minutes</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
              <span>Post events with rich context (artists, vibe, cover, and more)</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/50" />
              <span>Reach guests who are deciding where to go right now</span>
            </li>
          </ul>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-sm text-white/50">
          Dirty Shirley is evolving quickly. If you’re a venue owner, promoter, or DJ and want to be
          part of the launch, reach out via the Contact page.
        </p>
      </section>
    </main>
  );
}