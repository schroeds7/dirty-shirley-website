'use client';

import { useEffect, useState } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  query,
  orderBy,
  startAt,
  endAt,
  limit,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

/* ----------------------------------------------------------
   CONSTANTS
---------------------------------------------------------- */

const AGE_REQUIREMENTS = ['18+', '21+'];

const MUSIC_GENRES = [
  'EDM',
  'Hip-Hop',
  'Rap',
  'Top 40',
  'Pop',
  'Latin',
  'Reggaeton',
  'House',
  'Techno',
  'R&B',
  'Live Bands',
  'Country',
  'Chill',
  'Rock',
  'Alternative',
  'Indie',
];

const TAG_OPTIONS = [
  'Bottle Service',
  'Ladies Free Before X',
  'Free Entry Before X',
  'Ladies Drink Free Before X',
  'Student Night',
  'Live DJ',
  'Rooftop',
  'Dance Floor',
  'VIP Tables',
  'Casual Bar',
  'Outdoor Patio',
  'Late Night',
  'Happy Hour',
  'Cocktail Bar',
  'Dive Bar',
  'Sports Bar',
  'Beachfront',
  'Hotel Bar',
  'Live Performances',
  'Food Available',
  'Private Events',
  'Drink Specials',
];

const EVENT_TYPES = [
  'DJ Night',
  'Live Music',
  'Theme Party',
  'Ladies Night',
  'College Night',
  'Industry Night',
  'Holiday Party',
  'Guest DJ / Headliner',
  'Bottomless',
  'Day Party / Day Club',
  'Pool Party',
  'After Hours',
  'Happy Hour',
  'Sports Viewing Party',
  'Karaoke Night',
  'Silent Disco',
  'Grand Opening / Anniversary',
  'Meet & Greet',
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0=Sun ... 6=Sat

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Generate N weekly occurrences on selected weekdays, INCLUDING the first event as occurrence #1.
// If the start date's weekday is not selected, the first occurrence will be the next selected weekday after start.
function generateWeeklyOccurrences(opts: {
  start: Date;
  end: Date;
  weekdays: number[]; // 0-6
  count: number;
}) {
  const { start, end, weekdays, count } = opts;

  const durationMs = end.getTime() - start.getTime();
  const safeDurationMs =
    durationMs > 0 ? durationMs : durationMs + 24 * 60 * 60 * 1000; // handles overnight

  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
  const results: Array<{ start: Date; end: Date }> = [];
// Host venues: “And more…” flag (means there are additional venues not listed/selected)
const [hostVenuesAndMore, setHostVenuesAndMore] = useState(false);

  let cursorDay = startOfDay(start);

  while (results.length < count) {
    for (const wd of sorted) {
      const delta = (wd - cursorDay.getDay() + 7) % 7;
      const occurrenceDay = addDays(cursorDay, delta);

      const occStart = new Date(occurrenceDay);
      occStart.setHours(start.getHours(), start.getMinutes(), 0, 0);

      if (occStart.getTime() < start.getTime()) continue;

      const occEnd = new Date(occStart.getTime() + safeDurationMs);

      results.push({ start: occStart, end: occEnd });
      if (results.length >= count) break;
    }

    cursorDay = addDays(cursorDay, 7);
  }

  return results;
}

/* ----------------------------------------------------------
   PAGE
---------------------------------------------------------- */

type HostVenue = {
  venueId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
};

export default function NewEventPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueData, setVenueData] = useState<any>(null);
  const [error, setError] = useState('');

  // FORM FIELDS
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');

  const [status, setStatus] = useState<'active' | 'draft' | 'cancelled'>('active');
  const [coverCharge, setCoverCharge] = useState('');
  const [coverChargeMen, setCoverChargeMen] = useState('');
  const [coverChargeWomen, setCoverChargeWomen] = useState('');
  const [ageRequirement, setAgeRequirement] = useState('21+');

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ladiesFreeTime, setLadiesFreeTime] = useState('');
  const [freeEntryTime, setFreeEntryTime] = useState('');
  const [ladiesDrinkFreeTime, setLadiesDrinkFreeTime] = useState('');

  const [dressCode, setDressCode] = useState('');
  const [artistsInput, setArtistsInput] = useState('');
  const [eventType, setEventType] = useState('');

  const [promoted, setPromoted] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
const [uploadingImages, setUploadingImages] = useState(false);
  const [ticketUrl, setTicketUrl] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // "Not at my venue" hosting
const [notAtMyVenue, setNotAtMyVenue] = useState(false);
const [hostVenues, setHostVenues] = useState<HostVenue[]>([]);

// Venue search modal
const [hostVenueModalOpen, setHostVenueModalOpen] = useState(false);
const [venueSearchQuery, setVenueSearchQuery] = useState('');
const [venueSearchResults, setVenueSearchResults] = useState<HostVenue[]>([]);
const [venueSearchLoading, setVenueSearchLoading] = useState(false);
const [venueSearchError, setVenueSearchError] = useState('');

  const [isRecurring, setIsRecurring] = useState(false);

  // Weekly recurrence controls (SMTWTFS)
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]); // 0=Sun ... 6=Sat
  const [occurrencesCount, setOccurrencesCount] = useState<number>(10); // default 10, max 50

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  /* ----------------------------------------------------------
     LOAD ADMIN + VENUE
  ---------------------------------------------------------- */
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

        // Determine active venue (localStorage). If missing:
        // - if multiple venues, force selection
        // - if one venue, auto-select it
        let activeVenueId: string | null =
          typeof window !== 'undefined'
            ? localStorage.getItem('activeVenueId')
            : null;

        if (!activeVenueId || activeVenueId === 'undefined' || activeVenueId === 'null') {
          if (venueIds.length > 1) {
            router.replace('/select-venue');
            return;
          }
          activeVenueId = venueIds[0];
          localStorage.setItem('activeVenueId', activeVenueId);
        }

        // If stored active venue isn't valid for this admin, reset to the first assigned venue
        if (!venueIds.includes(activeVenueId)) {
          activeVenueId = venueIds[0];
          localStorage.setItem('activeVenueId', activeVenueId);
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
      } catch (err: any) {
        console.error(err);
        setError('Failed to load venue.');
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  /* ----------------------------------------------------------
     MULTI SELECT HELPERS
  ---------------------------------------------------------- */
  const toggleGenre = (g: string) =>
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const toggleTag = (t: string) => {
    if (t === 'Ladies Free Before X') {
      if (!selectedTags.includes(t)) {
        setSelectedTags([...selectedTags, t]);
      } else {
        setSelectedTags(selectedTags.filter((x) => x !== t));
        setLadiesFreeTime(''); // reset
      }
      return;
    }

    if (t === 'Free Entry Before X') {
      if (!selectedTags.includes(t)) {
        setSelectedTags([...selectedTags, t]);
      } else {
        setSelectedTags(selectedTags.filter((x) => x !== t));
        setFreeEntryTime(''); // reset
      }
      return;
    }

    if (t === 'Ladies Drink Free Before X') {
      if (!selectedTags.includes(t)) {
        setSelectedTags([...selectedTags, t]);
      } else {
        setSelectedTags(selectedTags.filter((x) => x !== t));
        setLadiesDrinkFreeTime(''); // reset
      }
      return;
    }

    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

/* ----------------------------------------------------------
   HOST VENUE SEARCH (case-insensitive)
---------------------------------------------------------- */

const isVenueSelected = (vId: string) => hostVenues.some((v) => v.venueId === vId);

const toggleHostVenue = (v: HostVenue) => {
  setHostVenues((prev) =>
    prev.some((x) => x.venueId === v.venueId)
      ? prev.filter((x) => x.venueId !== v.venueId)
      : [...prev, v]
  );
};

const runVenueSearch = async (raw: string) => {
  const qText = (raw || '').trim();
  setVenueSearchQuery(raw);

  // Do not show anything unless user searched
  if (!qText) {
    setVenueSearchResults([]);
    setVenueSearchError('');
    return;
  }

  const qLower = qText.toLowerCase();
  setVenueSearchLoading(true);
  setVenueSearchError('');

  try {
    const venuesCol = collection(db, 'venues');

    // Firestore string range queries are case-sensitive.
    // Most venue names are Title Case, so query a few likely casings.
    const titleCase = qText.length ? qText[0].toUpperCase() + qText.slice(1) : qText;
    const upper = qText.toUpperCase();

    // Helper to run a prefix query on `name`
    const runPrefix = async (prefix: string) => {
      const q = query(
        venuesCol,
        orderBy('name'),
        startAt(prefix),
        endAt(prefix + '\uf8ff'),
        limit(25)
      );
      return getDocs(q);
    };

    const [snapA, snapB, snapC] = await Promise.all([
      runPrefix(qText),
      runPrefix(titleCase),
      runPrefix(upper),
    ]);

    const byId = new Map<string, HostVenue>();

    const addSnap = (snap: any) => {
      for (const d of snap.docs) {
        const data: any = d.data();
        const row: HostVenue = {
          venueId: data.venueId || d.id,
          name: data.name || 'Unnamed Venue',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
        };

        // Final true case-insensitive containment filter
        if ((row.name || '').toLowerCase().includes(qLower)) {
          byId.set(row.venueId, row);
        }
      }
    };

    addSnap(snapA);
    addSnap(snapB);
    addSnap(snapC);

    setVenueSearchResults(Array.from(byId.values()).slice(0, 25));
  } catch (err: any) {
    console.error(err);
    setVenueSearchError('Search failed.');
    setVenueSearchResults([]);
  } finally {
    setVenueSearchLoading(false);
  }
};

  /* ----------------------------------------------------------
     SUBMIT LOGIC
  ---------------------------------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId || !venueData) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (!startDateTime || !endDateTime)
        throw new Error('Start & end date required.');

      const start = Timestamp.fromDate(new Date(startDateTime));
      const end = Timestamp.fromDate(new Date(endDateTime));

      const startJs = new Date(startDateTime);
      const endJs = new Date(endDateTime);

      if (Number.isNaN(startJs.getTime()) || Number.isNaN(endJs.getTime())) {
        throw new Error('Invalid start/end date.');
      }

      // Enforce max occurrences (default 10, max 50)
      const safeCount = Math.max(
        1,
        Math.min(50, Math.floor(occurrencesCount || 10))
      );

      if (isRecurring && repeatWeekdays.length === 0) {
        throw new Error('Please select at least one weekday for recurrence.');
      }

      const seriesId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? (crypto as any).randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const uploadSelectedImages = async (opts: { venueId: string; seriesId: string }) => {
  const { venueId, seriesId } = opts;
  if (!imageFiles || imageFiles.length === 0) return [] as string[];

  setUploadingImages(true);
  try {
    const urls: string[] = [];

    for (const file of imageFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `venues/${venueId}/events/${seriesId}/${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}_${safeName}`;

      const objectRef = ref(storage, objectPath);
      await uploadBytes(objectRef, file);
      const url = await getDownloadURL(objectRef);
      urls.push(url);
    }

    return urls;
  } finally {
    setUploadingImages(false);
  }
};

const imgArray = await uploadSelectedImages({ venueId, seriesId });

      let tagsToSave: any[] = [...selectedTags];

      if (selectedTags.includes('Ladies Free Before X')) {
        tagsToSave = tagsToSave.map((t) =>
          t === 'Ladies Free Before X' ? `${t} (${ladiesFreeTime})` : t
        );
      }

      if (selectedTags.includes('Free Entry Before X')) {
        tagsToSave = tagsToSave.map((t) =>
          t === 'Free Entry Before X' ? `${t} (${freeEntryTime})` : t
        );
      }

      if (selectedTags.includes('Ladies Drink Free Before X')) {
        tagsToSave = tagsToSave.map((t) =>
          t === 'Ladies Drink Free Before X'
            ? `${t} (${ladiesDrinkFreeTime})`
            : t
        );
      }

      const baseEventData = {
        name,
        description,

        venueId,
        venueName: venueData.name,
        // Posting account (the admin's active venue)
postedByVenueId: venueId,
postedByVenueName: venueData.name,

// Where the event is actually hosted
notAtMyVenue: !!notAtMyVenue,
hostVenueIds: notAtMyVenue ? hostVenues.map((v) => v.venueId) : [],
hostVenues: notAtMyVenue ? hostVenues : [],
        city: venueData.city,
        state: venueData.state,
        zip: venueData.zip,
        cityNormalized: (venueData.city || '').toLowerCase().trim(),

        status,
        // Legacy string (kept for backward compatibility)
        coverCharge:
          (coverChargeMen.trim() || coverChargeWomen.trim())
            ? `Men: ${coverChargeMen.trim() || '—'} | Women: ${coverChargeWomen.trim() || '—'}`
            : (coverCharge || ''),
        // New split fields
        coverChargeMen: coverChargeMen.trim() || null,
        coverChargeWomen: coverChargeWomen.trim() || null,
        ageRequirement,
        musicGenres: selectedGenres,
        artists: artistsInput
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0),
        tags: tagsToSave,

        dressCode,
        eventType,
        promoted,
        images: imgArray,
        ticketUrl,
        promoCode: promoCode.trim() || null,

        isRecurring: !!isRecurring,
        seriesId: isRecurring ? seriesId : null,
        recurrence: isRecurring
          ? {
              frequency: 'weekly',
              byWeekday: [...new Set(repeatWeekdays)].sort((a, b) => a - b),
              occurrences: safeCount,
              timezone:
                (venueData.timezone as string) ||
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                'America/New_York',
            }
          : null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByAdminUid: auth.currentUser?.uid ?? null,
        createdByAdminEmail: auth.currentUser?.email?.toLowerCase() ?? null,

        hotScore: 0,
        views: 0,
      };

if (notAtMyVenue && hostVenues.length === 0) {
  throw new Error('Please select at least one host venue.');
}

      const eventsCol = collection(db, 'events');

      if (!isRecurring) {
        const newEventRef = doc(eventsCol);
        const eventId = newEventRef.id;

        const eventData = {
          ...baseEventData,
          startDate: start,
          endDate: end,
          eventId,
        };

        await setDoc(newEventRef, eventData);

// Always save under the poster venue
const venueEventRef = doc(db, 'venues', venueId, 'events', eventId);
await setDoc(venueEventRef, eventData);

// If hosted elsewhere, also save under each host venue
if (notAtMyVenue) {
  await Promise.all(
    hostVenues.map((hv) => {
      const hostRef = doc(db, 'venues', hv.venueId, 'events', eventId);
      return setDoc(hostRef, eventData);
    })
  );
}
      } else {
        const occurrences = generateWeeklyOccurrences({
          start: startJs,
          end: endJs,
          weekdays: repeatWeekdays,
          count: safeCount,
        });

        const batch = writeBatch(db);

        for (const occ of occurrences) {
          const newEventRef = doc(eventsCol);
          const eventId = newEventRef.id;

          const eventData = {
            ...baseEventData,
            startDate: Timestamp.fromDate(occ.start),
            endDate: Timestamp.fromDate(occ.end),
            eventId,
          };

          batch.set(newEventRef, eventData);

          // Always save under the poster venue
          const venueEventRef = doc(db, 'venues', venueId, 'events', eventId);
          batch.set(venueEventRef, eventData);

          // If hosted elsewhere, also save under each host venue
          if (notAtMyVenue) {
            for (const hv of hostVenues) {
              const hostRef = doc(db, 'venues', hv.venueId, 'events', eventId);
              batch.set(hostRef, eventData);
            }
          }
        }
        await batch.commit();
      }

      setSuccess(isRecurring ? `Created ${safeCount} events!` : 'Event created!');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create event.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------------------------------------
     UI
  ---------------------------------------------------------- */
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        {error}
      </div>
    );

  if (!venueId || !venueData) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Create Event</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
          >
            ← Back
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-zinc-900 p-6 rounded-xl border border-zinc-800"
        >
          {/* NAME */}
          <div>
            <label className="text-sm">Event Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="text-sm">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* DATE/TIME */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Start</label>
              <input
                type="datetime-local"
                required
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
              />
            </div>
            <div>
              <label className="text-sm">End</label>
              <input
                type="datetime-local"
                required
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
              />
            </div>
          </div>


          {/* STATUS */}
          <div>
            <label className="text-sm">Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'active' | 'draft' | 'cancelled')
              }
              className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* AGE REQUIREMENT */}
          <div>
            <label className="text-sm">Age Requirement</label>
            <select
              value={ageRequirement}
              onChange={(e) => setAgeRequirement(e.target.value)}
              className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
            >
              {AGE_REQUIREMENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

{/* NOT AT MY VENUE */}
<div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
  <label className="flex items-center gap-2 text-sm font-semibold">
    <input
      type="checkbox"
      checked={notAtMyVenue}
      onChange={(e) => {
        const checked = e.target.checked;
        setNotAtMyVenue(checked);
        if (!checked) {
          setHostVenues([]);
          setVenueSearchQuery('');
          setVenueSearchResults([]);
          setVenueSearchError('');

        }
      }}
    />
    Not at my venue
  </label>

  {notAtMyVenue && (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setHostVenueModalOpen(true)}
        className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-sm"
      >
        Select host venue(s)
      </button>

      {hostVenues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hostVenues.map((v) => (
            <div
              key={v.venueId}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs"
            >
              <span className="text-white/80">{v.name}</span>
              <button
                type="button"
                onClick={() => toggleHostVenue(v)}
                className="text-white/50 hover:text-white/80"
                aria-label={`Remove ${v.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>

          {/* MUSIC GENRES */}
          <div>
            <label className="text-sm">Music Genres</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MUSIC_GENRES.map((g) => {
                const active = selectedGenres.includes(g);
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      active
                        ? 'bg-red-600 border-red-600'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAGS */}
          <div>
            <label className="text-sm">Tags</label>

            <div className="flex flex-wrap gap-2 mt-2">
              {TAG_OPTIONS.map((t) => {
                const active = selectedTags.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      active
                        ? 'bg-red-600 border-red-600'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* LADIES FREE BEFORE X TIME SELECTOR */}
            {selectedTags.includes('Ladies Free Before X') && (
              <div className="mt-3">
                <label className="text-sm">
                  Select time for "Ladies Free Before X"
                </label>
                <input
                  type="time"
                  value={ladiesFreeTime}
                  onChange={(e) => setLadiesFreeTime(e.target.value)}
                  className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
                />
              </div>
            )}

            {/* FREE ENTRY BEFORE X TIME SELECTOR */}
            {selectedTags.includes('Free Entry Before X') && (
              <div className="mt-3">
                <label className="text-sm">
                  Select time for "Free Entry Before X"
                </label>
                <input
                  type="time"
                  value={freeEntryTime}
                  onChange={(e) => setFreeEntryTime(e.target.value)}
                  className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
                />
              </div>
            )}

            {/* LADIES DRINK FREE BEFORE X TIME SELECTOR */}
            {selectedTags.includes('Ladies Drink Free Before X') && (
              <div className="mt-3">
                <label className="text-sm">
                  Select time for "Ladies Drink Free Before X"
                </label>
                <input
                  type="time"
                  value={ladiesDrinkFreeTime}
                  onChange={(e) => setLadiesDrinkFreeTime(e.target.value)}
                  className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
                />
              </div>
            )}
          </div>

          {/* EVENT TYPE */}
          <div>
            <label className="text-sm">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full p-2 mt-1 rounded bg-zinc-800 border border-zinc-700"
            >
              <option value="">Select...</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* DRESS CODE */}
          <div>
            <label className="text-sm">Dress Code</label>
            <input
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* TICKET URL */}
          <div>
            <label className="text-sm">Ticket URL</label>
            <input
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://..."
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* PROMO CODE */}
          <div>
            <label className="text-sm">Promo Code (optional)</label>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="e.g., DIRTY10"
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* COVER CHARGE (MEN / WOMEN) */}
          <div>
            <label className="text-sm">Cover Charge (optional)</label>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-white/70">Men</div>
                <input
                  value={coverChargeMen}
                  onChange={(e) => setCoverChargeMen(e.target.value)}
                  placeholder="e.g., $20"
                  className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
                />
              </div>
              <div>
                <div className="text-xs text-white/70">Women</div>
                <input
                  value={coverChargeWomen}
                  onChange={(e) => setCoverChargeWomen(e.target.value)}
                  placeholder="e.g., $10"
                  className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
                />
              </div>
            </div>
          </div>

          {/* PERFORMERS / ARTISTS */}
          <div>
            <label className="text-sm">Performer / Artist Name(s)</label>
            <input
              value={artistsInput}
              onChange={(e) => setArtistsInput(e.target.value)}
              placeholder="e.g., DJ Test, DJ Mike"
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

{/* IMAGES */}
<div>
  <label className="text-sm">Event Images</label>

  <input
    type="file"
    accept="image/*"
    multiple
    onChange={(e) => {
      const files = Array.from(e.target.files ?? []);
      setImageFiles(files);
    }}
    className="w-full mt-2 p-2 rounded bg-zinc-800 border border-zinc-700"
  />

  {imageFiles.length > 0 && (
    <div className="mt-2 text-xs text-white/70 space-y-1">
      <div className="font-semibold">Selected:</div>
      <ul className="list-disc pl-5">
        {imageFiles.map((f) => (
          <li key={f.name + f.size}>{f.name}</li>
        ))}
      </ul>
    </div>
  )}

  <div className="mt-2 text-xs text-white/60">
    Uploads to Firebase Storage when you click “Create Event”.
  </div>
</div>

          {/* RECURRING */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsRecurring(checked);

                  if (checked) {
                    // Default to the start date's weekday (if start datetime is set)
                    if (startDateTime) {
                      const d = new Date(startDateTime);
                      if (!Number.isNaN(d.getTime())) {
                        setRepeatWeekdays([d.getDay()]);
                      }
                    } else {
                      setRepeatWeekdays([]);
                    }
                    setOccurrencesCount(10);
                  } else {
                    setRepeatWeekdays([]);
                    setOccurrencesCount(10);
                  }
                }}
              />
              This event recurs
            </label>

{isRecurring && (
  <div className="mt-3 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
    <div>
      <div className="text-sm font-semibold">Repeats on</div>
      <div className="mt-2 flex gap-2">
        {WEEKDAYS.map((label, idx) => {
          const active = repeatWeekdays.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setRepeatWeekdays((prev) =>
                  prev.includes(idx)
                    ? prev.filter((x) => x !== idx)
                    : [...prev, idx]
                );
              }}
              className={`h-9 w-9 rounded-full border text-sm font-semibold ${
                active
                  ? 'bg-red-600 border-red-600'
                  : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-white/60">
        Select day(s) of the week. The first occurrence will be the start date you entered (if it matches a selected day).
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-semibold">Occurrences</label>
        <input
          type="number"
          min={1}
          max={50}
          value={occurrencesCount}
          onChange={(e) => {
            const n = Number(e.target.value);
            setOccurrencesCount(Number.isFinite(n) ? n : 10);
          }}
          className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
        />
        <div className="mt-1 text-xs text-white/60">
          Default is 10. Max is 50 per create.
        </div>
      </div>

      <div className="flex items-end">
        <div className="text-xs text-white/60">
          Tip: start/end time will be copied for each occurrence.
        </div>
      </div>
    </div>
  </div>
)}

          {/* End of Recurring section */}
          </div>

          {/* SUBMIT */}
<button
  type="submit"
  disabled={submitting || uploadingImages}
  className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
>
  {uploadingImages ? 'Uploading images...' : submitting ? 'Creating...' : 'Create Event'}
</button>

          {success && <p className="text-green-500 mt-2">{success}</p>}
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </form>
      </div>
      {/* HOST VENUE SEARCH MODAL */}
      {hostVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Select host venue(s)</div>
                <div className="mt-1 text-xs text-white/60">
                  Search by venue name. Results only appear after you type.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHostVenueModalOpen(false)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <input
                value={venueSearchQuery}
                onChange={(e) => runVenueSearch(e.target.value)}
                placeholder="Search venues by name..."
                className="w-full mt-1 p-2 rounded bg-zinc-900 border border-zinc-800"
              />
              {venueSearchLoading && (
                <div className="mt-2 text-xs text-white/60">Searching…</div>
              )}
              {venueSearchError && (
                <div className="mt-2 text-xs text-red-400">{venueSearchError}</div>
              )}
            </div>

            <div className="mt-4 max-h-[55vh] overflow-auto">
              {venueSearchQuery.trim().length === 0 ? (
                <div className="text-sm text-white/40">Type to search for venues.</div>
              ) : venueSearchResults.length === 0 && !venueSearchLoading ? (
                <div className="text-sm text-white/40">No matches.</div>
              ) : (
                <div className="space-y-2">
                  {venueSearchResults.map((v) => {
                    const selected = isVenueSelected(v.venueId);
                    const addrLine = [v.address, [v.city, v.state].filter(Boolean).join(', ')]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <button
                        key={v.venueId}
                        type="button"
                        onClick={() => toggleHostVenue(v)}
                        className={`w-full text-left rounded-lg border p-3 transition ${
                          selected
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-white/10 bg-black/20 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white/90">{v.name}</div>
                            <div className="mt-1 text-xs text-white/60">{addrLine}</div>
                          </div>
                          <div className={`text-xs ${selected ? 'text-red-200' : 'text-white/50'}`}>
                            {selected ? 'Selected' : 'Select'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-white/60">
                Selected: <span className="text-white/80">{hostVenues.length}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHostVenues([])}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setHostVenueModalOpen(false)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}