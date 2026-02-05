'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  setDoc,
  serverTimestamp,
  Timestamp,
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

/* ----------------------------------------------------------
   PAGE
---------------------------------------------------------- */

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
  const [imageUrls, setImageUrls] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const [isRecurring, setIsRecurring] = useState(false);
  const [extraDates, setExtraDates] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  /* ----------------------------------------------------------
     LOAD ADMIN + VENUE
  ---------------------------------------------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/login');

      try {
        const email = user.email?.toLowerCase() || '';
        const adminRef = doc(db, 'venueAdmins', email);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
          setError('Admin record not found.');
          setLoading(false);
          return;
        }

        const admin = adminSnap.data();
        const vId = admin.venueId;

        setVenueId(vId);

        const venueRef = doc(db, 'venues', vId);
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

      const imgArray = imageUrls
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

      const recurrence = isRecurring
        ? extraDates
            .filter((d) => d)
            .map((d) => Timestamp.fromDate(new Date(d)))
        : [];

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

      const eventData = {
        name,
        description,
        startDate: start,
        endDate: end,
        venueId,
        venueName: venueData.name,
        city: venueData.city,
        state: venueData.state,
        zip: venueData.zip,
        cityNormalized: (venueData.city || '').toLowerCase().trim(),

        status,
        coverCharge,
        ageRequirement,
        musicGenres: selectedGenres,
        artists: artistsInput.split(',').map(a => a.trim()).filter(a => a.length > 0),
        tags: tagsToSave,

        dressCode,
        eventType,
        promoted,
        images: imgArray,
        ticketUrl,

        isRecurring,
        recurrenceDates: recurrence,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByAdminUid: auth.currentUser?.uid ?? null,

        hotScore: 0,
        views: 0,
      };

      const eventsCol = collection(db, 'events');
      const newEventRef = doc(eventsCol);
      const eventId = newEventRef.id;

      await setDoc(newEventRef, { ...eventData, eventId });

      const venueEventRef = doc(db, 'venues', venueId, 'events', eventId);
      await setDoc(venueEventRef, { ...eventData, eventId });

      setSuccess('Event created!');
      setSubmitting(false);

      setTimeout(() => router.push('/dashboard'), 900);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create event.');
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
            <label className="text-sm">Image URLs (one per line)</label>
            <textarea
              rows={3}
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-zinc-800 border border-zinc-700"
            />
          </div>

          {/* RECURRING */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              This event recurs
            </label>

            {isRecurring && (
              <div className="space-y-2 mt-2">
                {extraDates.map((d, idx) => (
                  <input
                    key={idx}
                    type="datetime-local"
                    value={d}
                    onChange={(e) => {
                      const updated = [...extraDates];
                      updated[idx] = e.target.value;
                      setExtraDates(updated);
                    }}
                    className="w-full p-2 rounded bg-zinc-800 border border-zinc-700"
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setExtraDates([...extraDates, ''])}
                  className="px-3 py-1 rounded border border-zinc-600 hover:bg-zinc-800 text-sm"
                >
                  + Add another date
                </button>
              </div>
            )}
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold"
          >
            {submitting ? 'Creating...' : 'Create Event'}
          </button>

          {success && <p className="text-green-500 mt-2">{success}</p>}
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </form>
      </div>
    </div>
  );
}