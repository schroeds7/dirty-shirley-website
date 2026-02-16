

"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// NOTE: this repo already uses a root-level /lib folder.
// Relative path from: app/(portal)/dashboard/events/edit/page.tsx -> lib/*
import { auth, db } from "../../../../../lib/firebase";

type FormState = {
  name: string;
  description: string;
  eventType: string;
  ageRequirement: string;
  dressCode: string;
  coverCharge: string;
  ticketUrl: string;
  artistsText: string; // comma-separated
  musicGenresText: string; // comma-separated
  tagsText: string; // comma-separated
  imagesText: string; // newline-separated urls
  startDateLocal: string; // yyyy-mm-ddThh:mm
  endDateLocal: string; // yyyy-mm-ddThh:mm
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateTimeLocalValue(d: Date) {
  // Formats in local time as yyyy-mm-ddThh:mm (works with <input type="datetime-local" />)
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseCsv(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function EditEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = (
    searchParams.get("eventId") ||
    searchParams.get("id") ||
    searchParams.get("event") ||
    ""
  ).trim();

  const [venueId, setVenueId] = useState<string>("");
  const [venueName, setVenueName] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    eventType: "",
    ageRequirement: "",
    dressCode: "",
    coverCharge: "",
    ticketUrl: "",
    artistsText: "",
    musicGenresText: "",
    tagsText: "",
    imagesText: "",
    startDateLocal: "",
    endDateLocal: "",
  });

  // 1) Ensure logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // 2) Load selected venue from localStorage (set by the venue selector page)
  useEffect(() => {
    const keys = [
      // most common
      "selectedVenueId",
      "ds_selectedVenueId",
      "venueId",
      // fallbacks (in case earlier code stored a different key)
      "selectedVenue",
      "ds_selectedVenue",
      "ds_selectedVenueId_v1",
    ];

    const tryExtractVenueId = (raw: string) => {
      const v = raw.trim();
      if (!v) return "";

      // If it's JSON (e.g. {"venueId":"..."} or {"id":"..."}), extract.
      if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("\"") && v.endsWith("\""))) {
        try {
          const parsed = JSON.parse(v);
          if (typeof parsed === "string") return parsed.trim();
          if (parsed && typeof parsed === "object") {
            return (
              (parsed.venueId || parsed.id || parsed.placeId || "")
                ?.toString()
                .trim() || ""
            );
          }
        } catch {
          // ignore
        }
      }

      // Plain string venue id
      return v;
    };

    for (const k of keys) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const extracted = tryExtractVenueId(raw);
      if (extracted) {
        setVenueId(extracted);
        return;
      }
    }

    // If we didn't find anything, don't leave the page in a perpetual loading state.
    setVenueId("");
  }, []);

  // 3) Fetch existing event and prefill form
  useEffect(() => {
    const run = async () => {
      setError("");
      setSuccess("");

      if (!eventId) {
        setLoading(false);
        setError(
          "Missing event id. Open an event and navigate to /dashboard/events/edit?eventId=YOUR_EVENT_ID"
        );
        return;
      }
      if (!venueId) {
        setLoading(false);
        setError(
          "No venue selected. Please go back to Select Venue and choose the venue you want to manage."
        );
        return;
      }

      setLoading(true);
      try {
        // Fetch venue name (nice header, also ensures venueId is valid)
        const venueSnap = await getDoc(doc(db, "venues", venueId));
        if (venueSnap.exists()) {
          const v = venueSnap.data() as any;
          setVenueName(v?.name || v?.venueName || "");
        }

        // Fetch the event scoped to THIS venue.
        const eventRef = doc(db, "venues", venueId, "events", eventId);
        const snap = await getDoc(eventRef);

        if (!snap.exists()) {
          setError(
            "This event could not be found for the currently selected venue. Make sure you selected the correct venue."
          );
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        const startTs: Timestamp | undefined = data?.startDate;
        const endTs: Timestamp | undefined = data?.endDate;

        const startDate = startTs?.toDate ? startTs.toDate() : null;
        const endDate = endTs?.toDate ? endTs.toDate() : null;

        setForm({
          name: data?.name ?? "",
          description: data?.description ?? "",
          eventType: data?.eventType ?? "",
          ageRequirement: data?.ageRequirement ?? "",
          dressCode: data?.dressCode ?? "",
          coverCharge: data?.coverCharge ?? "",
          ticketUrl: data?.ticketUrl ?? "",
          artistsText: Array.isArray(data?.artists) ? data.artists.join(", ") : "",
          musicGenresText: Array.isArray(data?.musicGenres)
            ? data.musicGenres.join(", ")
            : "",
          tagsText: Array.isArray(data?.tags) ? data.tags.join(", ") : "",
          imagesText: Array.isArray(data?.images) ? data.images.join("\n") : "",
          startDateLocal: startDate ? toDateTimeLocalValue(startDate) : "",
          endDateLocal: endDate ? toDateTimeLocalValue(endDate) : "",
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load event.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [eventId, venueId]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!venueId) {
      setError("No venue selected. Please go back and select a venue.");
      return;
    }
    if (!eventId) {
      setError("Missing event id.");
      return;
    }

    if (!form.name.trim()) {
      setError("Event name is required.");
      return;
    }
    if (!form.startDateLocal || !form.endDateLocal) {
      setError("Start and end date/time are required.");
      return;
    }

    const start = new Date(form.startDateLocal);
    const end = new Date(form.endDateLocal);
    if (!(start instanceof Date) || isNaN(start.getTime())) {
      setError("Invalid start date/time.");
      return;
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      setError("Invalid end date/time.");
      return;
    }
    if (end <= start) {
      setError("End date/time must be after start date/time.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim(),
        eventType: form.eventType.trim(),
        ageRequirement: form.ageRequirement.trim(),
        dressCode: form.dressCode.trim(),
        coverCharge: form.coverCharge.trim(),
        ticketUrl: form.ticketUrl.trim(),
        artists: parseCsv(form.artistsText),
        musicGenres: parseCsv(form.musicGenresText),
        tags: parseCsv(form.tagsText),
        images: parseLines(form.imagesText),
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        updatedAt: serverTimestamp(),

        // IMPORTANT: editing a single occurrence only.
        // Do NOT touch recurrence fields here.
      };

      // 1) Update venue-scoped event (the one the portal primarily uses)
      const venueEventRef = doc(db, "venues", venueId, "events", eventId);
      await updateDoc(venueEventRef, payload);

      // 2) Best-effort update global event doc so the app matches.
      // Some older writes store a separate `eventId` field; otherwise the doc id is the same.
      try {
        const globalEventId = eventId;
        const globalRef = doc(db, "events", globalEventId);
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) {
          await updateDoc(globalRef, payload);
        }
      } catch {
        // ignore (portal can still function with venue-scoped updates)
      }

      setSuccess("Saved changes.");
      // Optionally return to dashboard
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Edit event</h1>
          <p className="mt-2 text-white/60">
            Editing this event for {venueName ? (
              <span className="text-white">{venueName}</span>
            ) : (
              <span className="text-white">your selected venue</span>
            )}.
          </p>
          <p className="mt-1 text-white/40 text-sm">
            Recurring settings are not shown here — this page edits only this single event.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            Loading…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="grid gap-5">
              <div>
                <label className="block text-sm text-white/70">Event name</label>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="THIRSTY THURSDAYS"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70">Event type</label>
                <input
                  value={form.eventType}
                  onChange={(e) => handleChange("eventType", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="DJ Night"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-white/70">Start</label>
                  <input
                    type="datetime-local"
                    value={form.startDateLocal}
                    onChange={(e) => handleChange("startDateLocal", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70">End</label>
                  <input
                    type="datetime-local"
                    value={form.endDateLocal}
                    onChange={(e) => handleChange("endDateLocal", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="mt-2 h-28 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="Describe the night, specials, etc."
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-white/70">Age requirement</label>
                  <input
                    value={form.ageRequirement}
                    onChange={(e) => handleChange("ageRequirement", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                    placeholder='21+ (or 18+)'
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70">Dress code</label>
                  <input
                    value={form.dressCode}
                    onChange={(e) => handleChange("dressCode", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                    placeholder="Upscale / Casual"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-white/70">Cover charge</label>
                  <input
                    value={form.coverCharge}
                    onChange={(e) => handleChange("coverCharge", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                    placeholder="$20 / Free before 11"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70">Ticket URL</label>
                  <input
                    value={form.ticketUrl}
                    onChange={(e) => handleChange("ticketUrl", e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70">Artists (comma separated)</label>
                <input
                  value={form.artistsText}
                  onChange={(e) => handleChange("artistsText", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="DJ Test, DJ Another"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70">Music genres (comma separated)</label>
                <input
                  value={form.musicGenresText}
                  onChange={(e) => handleChange("musicGenresText", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="EDM, House, Rap"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70">Tags (comma separated)</label>
                <input
                  value={form.tagsText}
                  onChange={(e) => handleChange("tagsText", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="Bottle Service, Live DJ, Late Night"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70">Images (one URL per line)</label>
                <textarea
                  value={form.imagesText}
                  onChange={(e) => handleChange("imagesText", e.target.value)}
                  className="mt-2 h-24 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-white/20"
                  placeholder="https://...\nhttps://..."
                />
                <p className="mt-2 text-xs text-white/40">
                  If you leave this empty, the app will use the venue’s default imagery.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-5 py-2 font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>

              {success ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-200">
                  {success}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}