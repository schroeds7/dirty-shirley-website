'use client';

import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
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
        router.replace('/');
        return;
      }

      try {
        // Pull the admin record from `venueAdmins/{email}` (doc id = email)
        const email = user.email?.toLowerCase() || '';
        if (!email) {
          setError('No email found for this account.');
          setLoading(false);
          return;
        }

        const adminRef = doc(db, 'venueAdmins', email);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
          setError('Admin record not found.');
          setLoading(false);
          return;
        }

        const adminData: any = adminSnap.data();

        // Support both new (`venueIds`) and legacy (`venueId`) shapes
        const venueIds: string[] =
          Array.isArray(adminData.venueIds) && adminData.venueIds.length > 0
            ? adminData.venueIds
            : adminData.venueId
            ? [adminData.venueId]
            : [];

        if (venueIds.length === 0) {
          setError('No venues assigned to this admin account.');
          setLoading(false);
          return;
        }

        // Determine active venue (localStorage). Robust against stale/invalid values.
        let activeVenueId: string | null =
          typeof window !== 'undefined' ? localStorage.getItem('activeVenueId') : null;

        // Normalize bad/stale localStorage values
        if (!activeVenueId || activeVenueId === 'undefined' || activeVenueId === 'null') {
          activeVenueId = null;
        }

        // If missing, choose the right path:
        // - multiple venues => force selection
        // - single venue => auto-select
        if (!activeVenueId) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activeVenueId');
          }

          if (venueIds.length > 1) {
            router.replace('/select-venue');
            return;
          }

          activeVenueId = venueIds[0];
          if (typeof window !== 'undefined') {
            localStorage.setItem('activeVenueId', activeVenueId);
          }
        }

        // If stored active venue isn't valid for this admin, reset.
        // If the admin has multiple venues, force re-selection (prevents loading the wrong venue).
        if (!venueIds.includes(activeVenueId)) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activeVenueId');
          }

          if (venueIds.length > 1) {
            router.replace('/select-venue');
            return;
          }

          activeVenueId = venueIds[0];
          if (typeof window !== 'undefined') {
            localStorage.setItem('activeVenueId', activeVenueId);
          }
        }

        setVenueId(activeVenueId);

        // Fetch venue document
        const venueRef = doc(db, 'venues', activeVenueId);
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
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('activeVenueId');
      }
      await auth.signOut();
    } finally {
      router.replace('/');
    }
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
          {/* NEW BUTTON — Switch Venue */}
          <button
            onClick={() => router.push('/select-venue')}
            className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded border border-zinc-600"
          >
            Switch Venue
          </button>
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

  const router = useRouter();

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
    description: '',
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
      // Coerce to string so React inputs + .trim() never crash when Firestore stores numbers
      minAge: String(venueData?.minAge ?? ''),
      description: venueData?.description || '',
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
        description: form.description.trim(),
        type: form.type.trim(),
        genre: form.genre.trim(),
        tags: form.tags.trim(),
      };
      // Normalize minAge:
      // - If blank, don't overwrite existing value
      // - If numeric, store as number (preferred)
      // - Otherwise store as trimmed string
      const minAgeRaw = String((form as any).minAge ?? '').trim();
      if (minAgeRaw !== '') {
        const n = Number(minAgeRaw);
        patch.minAge = Number.isFinite(n) ? n : minAgeRaw;
      }

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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold">Photos</h2>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/edit/photos?venueId=${encodeURIComponent(venueId)}`)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Edit Photos
              </button>
            </div>

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
                className="h-[480px] w-full object-cover"
              />
            ) : (
              <div className="h-[480px] w-full flex items-center justify-center text-zinc-400">
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
              <div className="text-zinc-400">Description</div>
              {!isEditing ? (
                venueData?.description ? (
                  <div className="text-white whitespace-pre-wrap">{venueData.description}</div>
                ) : (
                  <div className="text-white">—</div>
                )
              ) : (
                <textarea
                  value={form.description}
                  onChange={(e) => onChange('description', e.target.value)}
                  className="mt-1 min-h-[120px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                  placeholder="Short venue description (vibe, music, crowd, etc.)"
                />
              )}
            </div>

            <div>
              <div className="text-zinc-400">Type</div>
              {!isEditing ? (
                <div className="text-white">{type}</div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="text-xs text-white/60 leading-relaxed">
                    Select up to 3 of the options below. Separate them by comma and space (ex: Bar, Nightclub). Nightclub, Bar, Lounge, Live Music Venue, Rooftop, Pool Party, Dayclub, Speakeasy, Cocktail Bar, Sports Bar, Tiki Bar, Irish Pub
                  </div>
                  <textarea
                    value={form.type}
                    onChange={(e) => onChange('type', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="Bar, Nightclub"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="text-zinc-400">Genre</div>
              {!isEditing ? (
                <div className="text-white">{genre}</div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="text-xs text-white/60 leading-relaxed">
                    Select up to 5 of the options below. Separate them by comma and space (ex: EDM, House). EDM, Hip-Hop, Rap, Top 40, Pop, Latin, Reggaeton, House, Techno, R&B, Live Bands, Country, Chill, Rock, Alternative, Indie
                  </div>
                  <textarea
                    value={form.genre}
                    onChange={(e) => onChange('genre', e.target.value)}
                    className="mt-1 min-h-[70px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="EDM, House"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="text-zinc-400">Tags</div>
              {!isEditing ? (
                <div className="text-white">{tags}</div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="text-xs text-white/60 leading-relaxed">
                    Select as many that apply. Separate them by comma and space (ex: Bottle Service, Live DJ).
                    Bottle Service, Ladies Free Before X, Student Nights, Live DJ, Rooftop, Dance Floor, 21+ Only, 18+ Entry, VIP Tables, Casual Bar, Outdoor Patio, Late Night, Happy Hour, Cocktail Bar, Dive Bar, Sports Bar, Beachfront, Hotel Bar, Live Performances, Food Available, Private Events,
                  </div>
                  <textarea
                    value={form.tags}
                    onChange={(e) => onChange('tags', e.target.value)}
                    className="mt-1 min-h-[90px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    placeholder="Bottle Service, Live DJ"
                  />
                </div>
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
  type EventDoc = {
    id: string;
    startDate?: Timestamp;
    endDate?: Timestamp;
    [key: string]: any;
  };
  const router = useRouter();
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDeleteEvent = async (event: EventDoc) => {
    const name = event?.name || 'this event';
    const ok = window.confirm(`Delete ${name}? This cannot be undone.`);
    if (!ok) return;

    try {
      // Venue doc id is the subcollection doc id (`event.id`)
      const venueEventRef = doc(db, 'venues', venueId, 'events', event.id);

      // Global doc id is typically stored in `event.eventId`.
      // Fallback to the same id if needed.
      const globalEventId = (event as any).eventId || event.id;
      const globalEventRef = doc(db, 'events', globalEventId);

      const batch = writeBatch(db);
      batch.delete(venueEventRef);
      batch.delete(globalEventRef);
      await batch.commit();

      // Update UI immediately
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete event. Please try again.');
    }
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const colRef = collection(db, 'venues', venueId, 'events');
        const snap = await getDocs(colRef);

        const items: EventDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const now = new Date();

        const upcoming = items.filter((e) => (e.startDate ? e.startDate.toDate() >= now : false));
        const past = items.filter((e) => (e.startDate ? e.startDate.toDate() < now : false));

        upcoming.sort((a, b) => {
          const at = a.startDate ? a.startDate.toDate().getTime() : 0;
          const bt = b.startDate ? b.startDate.toDate().getTime() : 0;
          return at - bt;
        });

        past.sort((a, b) => {
          const at = a.startDate ? a.startDate.toDate().getTime() : 0;
          const bt = b.startDate ? b.startDate.toDate().getTime() : 0;
          return bt - at;
        });

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
        {events.map((event: EventDoc) => {
          const start = event.startDate ? event.startDate.toDate() : undefined;
          const end = event.endDate ? event.endDate.toDate() : undefined;
          const isPast = start && start < new Date();

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
              key={event.id}
              className={`snap-start shrink-0 w-[320px] rounded-xl border overflow-hidden relative ${
                isPast
                  ? 'border-zinc-800 bg-zinc-950/40 opacity-70'
                  : 'border-zinc-800 bg-zinc-950/60'
              }`}
            >
              {/* Actions (Edit / Delete) */}
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/dashboard/events/edit?eventId=${encodeURIComponent(event.id)}&venueId=${encodeURIComponent(venueId)}`
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-black/75"
                  aria-label="Edit event"
                  title="Edit"
                >
                  {/* Pencil icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteEvent(event)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-500/30 bg-black/60 text-red-200 hover:bg-black/75"
                  aria-label="Delete event"
                  title="Delete"
                >
                  {/* Trash icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
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