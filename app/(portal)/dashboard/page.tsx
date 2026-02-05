'use client';

import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [venueData, setVenueData] = useState<any>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ---------- AUTH + VENUE LOAD ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }

      try {
        const email = user.email?.toLowerCase() || '';

        // Fetch admin record
        const adminRef = doc(db, 'venueAdmins', email);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
          setError('Admin record not found.');
          setLoading(false);
          return;
        }

        const admin = adminSnap.data();
        const vId = admin.venueId as string;
        setVenueId(vId);

        // Fetch venue document
        const venueRef = doc(db, 'venues', vId);
        const venueSnap = await getDoc(venueRef);

        if (!venueSnap.exists()) {
          setError('Venue not found.');
          setLoading(false);
          return;
        }

        setVenueData(venueSnap.data());
      } catch (err) {
        console.error(err);
        setError('Failed to load venue data.');
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading venue data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col gap-4 items-center justify-center p-6">
        <p>{error}</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
    );
  }

  if (!venueData || !venueId) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">{venueData.name}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Admin dashboard for your venue
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* NEW BUTTON — Analytics */}
          <button
            onClick={() => router.push('/dashboard/analytics')}
            className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded border border-zinc-600"
          >
            Analytics
          </button>

          {/* NEW BUTTON — Add Event */}
          <button
            onClick={() => router.push('/dashboard/events/new')}
            className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded border border-zinc-600"
          >
            + Add Event
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {/* OVERVIEW: Photos (left) + Venue details (right) */}
      <VenueOverview
        venueId={venueId}
        venueData={venueData}
        onVenueUpdated={(patch) => setVenueData((prev: any) => ({ ...(prev || {}), ...(patch || {}) }))}
      />

      {/* HOURS */}
      <HoursCard
        venueId={venueId}
        hours={Array.isArray(venueData.hours) ? venueData.hours : []}
        onHoursUpdated={(nextHours) =>
          setVenueData((prev: any) => ({ ...(prev || {}), hours: nextHours }))
        }
      />

      {/* EVENTS LIST */}
      <EventsList venueId={venueId} />
    </div>
  );
}

/* ---------------- VENUE OVERVIEW ---------------- */

function VenueOverview({
  venueId,
  venueData,
  onVenueUpdated,
}: {
  venueId: string;
  venueData: any;
  onVenueUpdated: (patch: any) => void;
}) {
  const photos: string[] = useMemo(() => {
    const list = Array.isArray(venueData?.firebasePhotos) ? venueData.firebasePhotos : [];
    return list.filter(Boolean);
  }, [venueData]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // If photos change, keep the index in bounds.
    if (idx >= photos.length) setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[idx] : null;

  const next = () => {
    if (!hasPhotos) return;
    setIdx((prev) => (prev + 1) % photos.length);
  };

  const prev = () => {
    if (!hasPhotos) return;
    setIdx((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');

  const [form, setForm] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    website: '',
    instagramUrl: '',
    type: '',
    genre: '',
    tags: '',
    minAge: '',
  });

  // Keep form in sync with venue data when not editing
  useEffect(() => {
    if (isEditing) return;
    setForm({
      address: venueData?.address || '',
      city: venueData?.city || '',
      state: venueData?.state || '',
      zip: venueData?.zip || '',
      phone: venueData?.phone || '',
      website: venueData?.website || '',
      instagramUrl: venueData?.instagramUrl || '',
      type: venueData?.type || '',
      genre: venueData?.genre || '',
      tags: venueData?.tags || '',
      minAge: venueData?.minAge || '',
    });
  }, [venueData, isEditing]);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startEdit = () => {
    setSaveError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setSaveError('');
    setIsEditing(false);
    // form will reset from venueData via effect
  };

  const saveEdits = async () => {
    try {
      setIsSaving(true);
      setSaveError('');

      const patch: any = {
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        instagramUrl: form.instagramUrl.trim(),
        type: form.type.trim(),
        genre: form.genre.trim(),
        tags: form.tags.trim(),
        minAge: form.minAge.trim(),
      };

      // Persist to Firestore
      await updateDoc(doc(db, 'venues', venueId), patch);

      // Update parent state for immediate UI refresh
      onVenueUpdated(patch);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addressLine = venueData?.address || '—';
  const cityLine = `${venueData?.city || ''}${venueData?.city ? ', ' : ''}${venueData?.state || ''}${venueData?.zip ? ` ${venueData.zip}` : ''}`.trim() || '—';
  const phone = venueData?.phone || '—';
  const website = venueData?.website || '';
  const instagram = (isEditing ? form.instagramUrl : (venueData?.instagramUrl || venueData?.instagram || ''));
  const type = venueData?.type || '—';
  const genre = venueData?.genre || '—';
  const tags = venueData?.tags || '—';
  const minAge = venueData?.minAge ?? '—';
  const rating = venueData?.rating ?? '—';
  const totalRatings = venueData?.totalRatings ?? '—';

  return (
    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Photos carousel */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Photos</h2>
            {hasPhotos && (
              <div className="text-xs text-zinc-400">
                {idx + 1} of {photos.length}
              </div>
            )}
          </div>

          <div className="mt-4 relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={`Venue photo ${idx + 1}`}
                className="h-[320px] w-full object-cover"
              />
            ) : (
              <div className="h-[320px] w-full flex items-center justify-center text-zinc-400">
                No photos uploaded yet.
              </div>
            )}

            {/* Arrows */}
            {hasPhotos && photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-sm hover:bg-black/75"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-sm hover:bg-black/75"
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Thumbnail row (simple, optional but helpful) */}
          {hasPhotos && photos.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`shrink-0 overflow-hidden rounded-lg border ${
                    i === idx ? 'border-white/25' : 'border-white/10'
                  }`}
                  aria-label={`View photo ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${i + 1}`}
                    className="h-16 w-24 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Venue details */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Venue Details</h2>

            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdits}
                  disabled={isSaving}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3 text-sm">
            {saveError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {saveError}
              </div>
            )}
            <div>
              <div className="text-zinc-400">Address</div>
              {!isEditing ? (
                <div className="text-white">{addressLine}</div>
              ) : (
                <input
                  value={form.address}
                  onChange={(e) => onChange('address', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Street address"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">City</div>
              {!isEditing ? (
                <div className="text-white">{cityLine || '—'}</div>
              ) : (
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    value={form.city}
                    onChange={(e) => onChange('city', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="City"
                  />
                  <input
                    value={form.state}
                    onChange={(e) => onChange('state', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="State"
                  />
                  <input
                    value={form.zip}
                    onChange={(e) => onChange('zip', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="Zip"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="text-zinc-400">Phone</div>
              {!isEditing ? (
                <div className="text-white">{phone}</div>
              ) : (
                <input
                  value={form.phone}
                  onChange={(e) => onChange('phone', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="(555) 555-5555"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Website</div>
              {!isEditing ? (
                website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 break-all"
                  >
                    {website}
                  </a>
                ) : (
                  <div className="text-white">—</div>
                )
              ) : (
                <input
                  value={form.website}
                  onChange={(e) => onChange('website', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="https://example.com"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Instagram</div>
              {!isEditing ? (
                instagram ? (
                  <a
                    href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-pink-400 hover:text-pink-300 break-all"
                  >
                    {instagram}
                  </a>
                ) : (
                  <div className="text-white">—</div>
                )
              ) : (
                <input
                  value={form.instagramUrl}
                  onChange={(e) => onChange('instagramUrl', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="https://instagram.com/yourhandle or @yourhandle"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Type</div>
              {!isEditing ? (
                <div className="text-white">{type}</div>
              ) : (
                <input
                  value={form.type}
                  onChange={(e) => onChange('type', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Nightclub"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Genre</div>
              {!isEditing ? (
                <div className="text-white">{genre}</div>
              ) : (
                <input
                  value={form.genre}
                  onChange={(e) => onChange('genre', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Hip-Hop, EDM, Top 40"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Tags</div>
              {!isEditing ? (
                <div className="text-white">{tags}</div>
              ) : (
                <textarea
                  value={form.tags}
                  onChange={(e) => onChange('tags', e.target.value)}
                  className="mt-1 min-h-[90px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Bottle Service, Live DJ, Dance Floor, ..."
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Min Age</div>
              {!isEditing ? (
                <div className="text-white">{minAge}</div>
              ) : (
                <input
                  value={form.minAge}
                  onChange={(e) => onChange('minAge', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="21"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Rating</div>
              <div className="text-white">
                {rating} ({totalRatings} reviews)
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">
              Tip: Keep photos fresh and post events consistently — it improves discovery and converts better.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- HOURS CARD ---------------- */

function HoursCard({
  venueId,
  hours,
  onHoursUpdated,
}: {
  venueId: string;
  hours: string[];
  onHoursUpdated: (hours: string[]) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [draft, setDraft] = useState<string>('');

  // Keep draft in sync with Firestore hours when not editing
  useEffect(() => {
    if (isEditing) return;
    setDraft((hours || []).join('\n'));
  }, [hours, isEditing]);

  const startEdit = () => {
    setSaveError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setSaveError('');
    setIsEditing(false);
  };

  const save = async () => {
    try {
      setIsSaving(true);
      setSaveError('');

      const nextHours = draft
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      await updateDoc(doc(db, 'venues', venueId), { hours: nextHours });

      onHoursUpdated(nextHours);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save hours. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Hours</h2>

        {!isEditing ? (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {saveError && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveError}
          </div>
        )}

        {!isEditing ? (
          hours && hours.length > 0 ? (
            <div className="space-y-1 text-sm">
              {hours.map((line, idx) => (
                <div key={idx} className="text-white">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-400">No hours set.</div>
          )
        ) : (
          <div>
            <p className="text-xs text-white/60">
              One line per day (e.g., “Thursday: 10:00 PM – 4:00 AM”). Blank lines will be removed.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-2 min-h-[180px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              placeholder="Monday: Closed\nTuesday: 10:00 PM – 2:00 AM\n..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- EVENTS LIST ---------------- */

function EventsList({ venueId }: { venueId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const colRef = collection(db, 'venues', venueId, 'events');
        const snap = await getDocs(colRef);

        const items = snap.docs.map((d) => d.data());

        const now = new Date();

        const upcoming = items.filter((e) => e.startDate?.toDate() >= now);
        const past = items.filter((e) => e.startDate?.toDate() < now);

        upcoming.sort(
          (a, b) =>
            a.startDate.toDate().getTime() -
            b.startDate.toDate().getTime()
        );

        past.sort(
          (a, b) =>
            b.startDate.toDate().getTime() -
            a.startDate.toDate().getTime()
        );

        setEvents([...upcoming, ...past]);
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    };

    loadEvents();
  }, [venueId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        Loading events...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        No events created yet.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold">Your Events</h2>
        <div className="text-xs text-zinc-400">Swipe to browse</div>
      </div>

      <div className="mt-4 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {events.map((event) => {
          const start = event.startDate?.toDate();
          const end = event.endDate?.toDate();
          const isPast = start < new Date();

          // Your schema: `images: string[]` (fallbacks included)
          const imageUrl =
            (Array.isArray(event.images) && event.images.length > 0 ? event.images[0] : '') ||
            event.imageUrl ||
            event.photoUrl ||
            event.flyerUrl ||
            event.coverImageUrl ||
            '';

          const artistsText = Array.isArray(event.artists) && event.artists.length > 0
            ? event.artists.join(', ')
            : '';

          const musicGenresText = Array.isArray(event.musicGenres) && event.musicGenres.length > 0
            ? event.musicGenres.join(' • ')
            : '';

          const tagsArray: string[] = Array.isArray(event.tags) ? event.tags : [];

          return (
            <div
              key={event.eventId}
              className={`snap-start shrink-0 w-[320px] rounded-xl border overflow-hidden ${
                isPast
                  ? 'border-zinc-800 bg-zinc-950/40 opacity-70'
                  : 'border-zinc-800 bg-zinc-950/60'
              }`}
            >
              {/* Image */}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={event.name || 'Event'}
                  className="h-[170px] w-full object-cover"
                />
              ) : (
                <div className="h-[170px] w-full bg-black/40 flex items-center justify-center text-zinc-500 text-sm">
                  No image
                </div>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-snug truncate">
                      {event.name || 'Untitled Event'}
                    </p>

                    {(event.eventType || artistsText) && (
                      <p className="mt-1 text-xs text-zinc-400 truncate">
                        {event.eventType ? event.eventType : ''}
                        {event.eventType && artistsText ? ' • ' : ''}
                        {artistsText}
                      </p>
                    )}
                  </div>

                  {isPast ? (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                      Past
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
                      Upcoming
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  {start?.toLocaleString()} {end ? `– ${end.toLocaleString()}` : ''}
                </p>

                {musicGenresText && (
                  <p className="mt-2 text-xs text-zinc-300">
                    {musicGenresText}
                  </p>
                )}

                {event.description ? (
                  <p className="mt-2 text-sm text-zinc-200 line-clamp-3">
                    {event.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No description</p>
                )}

                {/* Core chips */}
                {(event.ageRequirement || event.dressCode || (event.coverCharge && event.coverCharge !== 'unknown' && event.coverCharge !== '')) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.ageRequirement && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        {event.ageRequirement}
                      </span>
                    )}
                    {event.dressCode && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        Dress: {event.dressCode}
                      </span>
                    )}
                    {event.coverCharge && event.coverCharge !== 'unknown' && event.coverCharge !== '' && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        Cover: {event.coverCharge}
                      </span>
                    )}
                  </div>
                )}

                {/* Music genre chips (first 3) */}
                {Array.isArray(event.musicGenres) && event.musicGenres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.musicGenres.slice(0, 3).map((g: string) => (
                      <span
                        key={g}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag chips (first 4) */}
                {tagsArray.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsArray.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tickets */}
                {event.ticketUrl && (
                  <div className="mt-4">
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
                    >
                      Tickets
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}