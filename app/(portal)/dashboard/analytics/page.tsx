'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type CollectionKey = 'dailyGoing' | 'reviews' | 'vibeDaily' | 'vibeHistory';

type PreviewDoc = {
  id: string;
  data: any;
};

function formatDocIdMaybeDate(id: string) {
  // If id looks like YYYY-MM-DD, return as-is (already human-readable)
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return id;
  return id;
}

function safeString(v: any) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

type DailyGoingDay = {
  dateKey: string;
  count: number;
};

type VibeDailyDay = {
  dateKey: string;
  totalVotes: number;
  topVibe?: string;
  counts: Record<string, number>;
  lastUpdatedAt?: any;
};

type VibeDailySummary = {
  totalDays: number;
  todayVotes: number;
  last7DaysVotes: number;
  topVibeLast7?: string;
  todayTopVibe?: string;
  todayCounts: Record<string, number>;
  last7Counts: Record<string, number>;
  latest?: {
    id: string;
    totalVotes?: number;
    topVibe?: string;
    date?: string;
    lastUpdatedAt?: any;
    counts?: Record<string, number>;
  };
};

type ReviewsSummary = {
  total: number;
  avgRating: number; // 0-5
  last30Days: number;
  dist: Record<number, number>; // 1..5
  topVibes: { vibe: string; count: number }[];
  latest?: {
    id: string;
    rating?: number;
    vibe?: string;
    comment?: string;
    visitDateKey?: string;
    createdAt?: any;
  };
};

function toDateMaybe(ts: any): Date | null {
  if (!ts) return null;
  // Firestore Timestamp
  if (typeof ts?.toDate === 'function') return ts.toDate();
  // Serialized string or ISO
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  // JS Date
  if (ts instanceof Date) return ts;
  return null;
}

function daysBetween(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.floor((end - start) / ms);
}

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [counts, setCounts] = useState<Record<CollectionKey, number>>({
    dailyGoing: 0,
    reviews: 0,
    vibeDaily: 0,
    vibeHistory: 0,
  });

  const [recent, setRecent] = useState<Record<CollectionKey, PreviewDoc[]>>({
    dailyGoing: [],
    reviews: [],
    vibeDaily: [],
    vibeHistory: [],
  });

  const [expanded, setExpanded] = useState<Record<CollectionKey, boolean>>({
    dailyGoing: false,
    reviews: false,
    vibeDaily: false,
    vibeHistory: false,
  });

  const [dailyGoingDays, setDailyGoingDays] = useState<DailyGoingDay[]>([]);
  const [dailyGoingTodayCount, setDailyGoingTodayCount] = useState<number>(0);
  const [dailyGoing7DayTotal, setDailyGoing7DayTotal] = useState<number>(0);

  const [vibeDailyDays, setVibeDailyDays] = useState<VibeDailyDay[]>([]);
  const [vibeDailySummary, setVibeDailySummary] = useState<VibeDailySummary>({
    totalDays: 0,
    todayVotes: 0,
    last7DaysVotes: 0,
    todayCounts: {},
    last7Counts: {},
  });

  const [reviewsSummary, setReviewsSummary] = useState<ReviewsSummary>({
    total: 0,
    avgRating: 0,
    last30Days: 0,
    dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    topVibes: [],
  });

  // ---------- AUTH + VENUE LOAD ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }

      try {
        // Pull the admin user record from `venueAdmins/{emailLower}`
        const emailLower = (user.email || '').toLowerCase().trim();
        if (!emailLower) {
          setError('Missing email on auth user.');
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'venueAdmins', emailLower);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setError('User record not found.');
          setLoading(false);
          return;
        }

        const userData: any = userSnap.data();

        // Support both new (`venueIds`) and legacy (`venueId`) shapes
        const venueIds: string[] =
          Array.isArray(userData.venueIds) && userData.venueIds.length > 0
            ? userData.venueIds
            : userData.venueId
            ? [userData.venueId]
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

        if (!activeVenueId) {
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

        const venueSnap = await getDoc(doc(db, 'venues', activeVenueId));
        if (venueSnap.exists()) {
          setVenueName((venueSnap.data() as any)?.name || '');
        }
      } catch (e) {
        console.error(e);
        setError('Failed to load admin / venue data.');
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  // ---------- ANALYTICS LOAD ----------
  useEffect(() => {
    if (!venueId) return;

    const load = async () => {
      try {
        const keys: CollectionKey[] = [
          'dailyGoing',
          'reviews',
          'vibeDaily',
          'vibeHistory',
        ];

        const nextCounts: any = {};
        const nextRecent: any = {};

        for (const key of keys) {
          const colRef = collection(db, 'venues', venueId, key);

          if (key === 'dailyGoing') {
            // Schema:
            // venues/{venueId}/dailyGoing/{YYYY-MM-DD}/users/{uid}
            // We treat doc IDs as date keys.

            const allDaysSnap = await getDocs(colRef);
            nextCounts[key] = allDaysSnap.size;

            const dayIds = allDaysSnap.docs
              .map((d) => d.id)
              .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id))
              .sort((a, b) => (a < b ? 1 : -1));

            // Recent day docs (preview)
            nextRecent[key] = dayIds.slice(0, 8).map((id) => ({ id, data: {} }));

            // Compute last 14 days with counts (best-effort; keep this bounded to avoid heavy reads)
            const last14 = dayIds.slice(0, 14);
            const dayRows = await Promise.all(
              last14.map(async (dateKey) => {
                try {
                  const usersCol = collection(db, 'venues', venueId, 'dailyGoing', dateKey, 'users');
                  const usersSnap = await getDocs(usersCol);
                  return { dateKey, count: usersSnap.size } as DailyGoingDay;
                } catch {
                  return { dateKey, count: 0 } as DailyGoingDay;
                }
              })
            );

            const todayKey = new Date().toISOString().slice(0, 10);
            const todayRow = dayRows.find((r) => r.dateKey === todayKey);

            // 7-day total (including today if present)
            const last7Keys = dayIds.slice(0, 7);
            const last7Total = dayRows
              .filter((r) => last7Keys.includes(r.dateKey))
              .reduce((sum, r) => sum + (r.count || 0), 0);

            setDailyGoingDays(dayRows);
            setDailyGoingTodayCount(todayRow?.count || 0);
            setDailyGoing7DayTotal(last7Total);

            continue;
          }

          if (key === 'vibeDaily') {
            // Schema:
            // venues/{venueId}/vibeDaily/{YYYY-MM-DD}
            // Fields: counts (map), date (string), lastUpdatedAt (timestamp), topVibe (string), totalVotes (number)

            const allDaysSnap = await getDocs(colRef);
            nextCounts[key] = allDaysSnap.size;

            // Prefer ordering by lastUpdatedAt; fallback to doc id (YYYY-MM-DD)
            let previewDocs: PreviewDoc[] = [];
            try {
              const qy = query(colRef, orderBy('lastUpdatedAt' as any, 'desc'), limit(50));
              const snap = await getDocs(qy);
              previewDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
            } catch {
              previewDocs = allDaysSnap.docs
                .map((d) => ({ id: d.id, data: d.data() }))
                .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
                .sort((a, b) => (a.id < b.id ? 1 : -1))
                .slice(0, 50);
            }

            nextRecent[key] = previewDocs.slice(0, 8);

            const normalizeCounts = (raw: any): Record<string, number> => {
              const out: Record<string, number> = {};
              if (!raw || typeof raw !== 'object') return out;
              for (const [k, v] of Object.entries(raw)) {
                const n = Number(v);
                out[String(k)] = isNaN(n) ? 0 : n;
              }
              return out;
            };

            const todayKey = new Date().toISOString().slice(0, 10);

            // Build a bounded list (last 14 by date key)
            const dayDocs = previewDocs
              .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.id))
              .sort((a, b) => (a.id < b.id ? 1 : -1))
              .slice(0, 14);

            const days: VibeDailyDay[] = dayDocs.map((d) => {
              const data = d.data as any;
              return {
                dateKey: d.id,
                totalVotes: Number(data?.totalVotes || 0) || 0,
                topVibe: (data?.topVibe || '').toString() || undefined,
                counts: normalizeCounts(data?.counts),
                lastUpdatedAt: data?.lastUpdatedAt,
              };
            });

            const last7 = days.slice(0, 7);
            const last7DaysVotes = last7.reduce((sum, d) => sum + (d.totalVotes || 0), 0);

            const mergeCounts = (rows: VibeDailyDay[]) => {
              const agg: Record<string, number> = {};
              for (const r of rows) {
                for (const [k, v] of Object.entries(r.counts || {})) {
                  agg[k] = (agg[k] || 0) + (Number(v) || 0);
                }
              }
              return agg;
            };

            const last7Counts = mergeCounts(last7);
            const todayRow = days.find((d) => d.dateKey === todayKey);
            const todayCounts = todayRow?.counts || {};

            const topKeyFromCounts = (c: Record<string, number>): string | undefined => {
              const entries = Object.entries(c);
              if (entries.length === 0) return undefined;
              entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
              return entries[0]?.[0] || undefined;
            };

            const latest = previewDocs[0]
              ? {
                  id: previewDocs[0].id,
                  totalVotes: Number((previewDocs[0].data as any)?.totalVotes || 0) || 0,
                  topVibe: (previewDocs[0].data as any)?.topVibe,
                  date: (previewDocs[0].data as any)?.date,
                  lastUpdatedAt: (previewDocs[0].data as any)?.lastUpdatedAt,
                  counts: normalizeCounts((previewDocs[0].data as any)?.counts),
                }
              : undefined;

            setVibeDailyDays(days);
            setVibeDailySummary({
              totalDays: allDaysSnap.size,
              todayVotes: todayRow?.totalVotes || 0,
              last7DaysVotes,
              todayTopVibe: todayRow?.topVibe || topKeyFromCounts(todayCounts),
              topVibeLast7: topKeyFromCounts(last7Counts),
              todayCounts,
              last7Counts,
              latest,
            });

            continue;
          }

          if (key === 'reviews') {
            // Schema:
            // venues/{venueId}/reviews/{uid}_{YYYY-MM-DD}
            // Fields: rating (number), comment (string), vibe (string), createdAt (timestamp), visitDateKey (YYYY-MM-DD)

            const allSnap = await getDocs(colRef);
            nextCounts[key] = allSnap.size;

            // Recent docs by createdAt (fallback to id desc)
            let previewDocs: PreviewDoc[] = [];
            try {
              const qy = query(colRef, orderBy('createdAt' as any, 'desc'), limit(50));
              const snap = await getDocs(qy);
              previewDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
            } catch {
              previewDocs = allSnap.docs
                .map((d) => ({ id: d.id, data: d.data() }))
                .sort((a, b) => (a.id < b.id ? 1 : -1))
                .slice(0, 50);
            }

            nextRecent[key] = previewDocs.slice(0, 8);

            // Compute summary
            const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let ratingSum = 0;
            let ratingCount = 0;
            const vibeCounts: Record<string, number> = {};

            const now = new Date();
            let last30 = 0;

            for (const d of allSnap.docs) {
              const data = d.data() as any;
              const r = Number(data?.rating);
              if (!isNaN(r) && r >= 1 && r <= 5) {
                dist[r] = (dist[r] || 0) + 1;
                ratingSum += r;
                ratingCount += 1;
              }

              const vibe = (data?.vibe || '').toString().trim();
              if (vibe) {
                vibeCounts[vibe] = (vibeCounts[vibe] || 0) + 1;
              }

              const created = toDateMaybe(data?.createdAt);
              if (created) {
                const diff = daysBetween(created, now);
                if (diff >= 0 && diff <= 30) last30 += 1;
              } else {
                // Fallback to visitDateKey if present
                const k = (data?.visitDateKey || '').toString();
                if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
                  const dt = new Date(`${k}T00:00:00`);
                  const diff = daysBetween(dt, now);
                  if (diff >= 0 && diff <= 30) last30 += 1;
                }
              }
            }

            const topVibes = Object.entries(vibeCounts)
              .map(([vibe, count]) => ({ vibe, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 4);

            const latest = previewDocs[0]
              ? {
                  id: previewDocs[0].id,
                  rating: (previewDocs[0].data as any)?.rating,
                  vibe: (previewDocs[0].data as any)?.vibe,
                  comment: (previewDocs[0].data as any)?.comment,
                  visitDateKey: (previewDocs[0].data as any)?.visitDateKey,
                  createdAt: (previewDocs[0].data as any)?.createdAt,
                }
              : undefined;

            setReviewsSummary({
              total: allSnap.size,
              avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
              last30Days: last30,
              dist,
              topVibes,
              latest,
            });

            continue;
          }

          // Count docs (simple now; can optimize later once we know schemas)
          const allSnap = await getDocs(colRef);
          nextCounts[key] = allSnap.size;

          // Recent preview (defensive): try likely timestamp fields, fallback to id sorting.
          let previewDocs: PreviewDoc[] = [];

          const tryOrders = ['createdAt', 'updatedAt', 'timestamp', 'date', 'day'];
          let ordered = false;

          for (const field of tryOrders) {
            try {
              const qy = query(colRef, orderBy(field as any, 'desc'), limit(8));
              const snap = await getDocs(qy);
              previewDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
              ordered = true;
              break;
            } catch {
              // Ignore and try next field
            }
          }

          if (!ordered) {
            previewDocs = allSnap.docs
              .map((d) => ({ id: d.id, data: d.data() }))
              .sort((a, b) => (a.id < b.id ? 1 : -1))
              .slice(0, 8);
          }

          nextRecent[key] = previewDocs;
        }

        setCounts(nextCounts);
        setRecent(nextRecent);
      } catch (e) {
        console.error(e);
        setError('Failed to load analytics.');
      }
    };

    load();
  }, [venueId]);

  const headerTitle = useMemo(() => {
    if (venueName) return `${venueName} — Analytics`;
    return 'Analytics';
  }, [venueName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col gap-4 items-center justify-center p-6">
        <p className="text-red-200">{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded border border-zinc-600"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{headerTitle}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            High-level insights for your venue. We’ll refine these once we lock the data formats.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-zinc-800 hover:bg-zinc-700 text-sm px-4 py-2 rounded border border-zinc-600"
          >
            Back
          </button>
        </div>
      </div>

      {/* VIBE DAILY OVERVIEW */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-400">Vibe Daily</div>
            <div className="mt-1 text-lg font-semibold">How the crowd feels (by day)</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-zinc-400">Today</div>
              <div className="text-xl font-bold">{vibeDailySummary.todayVotes}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-zinc-400">Last 7 Days</div>
              <div className="text-xl font-bold">{vibeDailySummary.last7DaysVotes}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Today's breakdown */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Today’s Breakdown</div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Top vibe: {vibeDailySummary.todayTopVibe || '—'}
            </div>

            <div className="mt-3 space-y-2">
              {Object.keys(vibeDailySummary.todayCounts || {}).length === 0 ? (
                <div className="text-sm text-zinc-400">No votes yet today.</div>
              ) : (
                ['packed', 'buzzing', 'chill', 'quiet'].map((k) => (
                  <VibeCountRow
                    key={k}
                    label={k}
                    count={vibeDailySummary.todayCounts?.[k] || 0}
                  />
                ))
              )}
            </div>
          </div>

          {/* Last 7 aggregate */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Last 7 Days (Aggregate)</div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Top vibe: {vibeDailySummary.topVibeLast7 || '—'}
            </div>

            <div className="mt-3 space-y-2">
              {Object.keys(vibeDailySummary.last7Counts || {}).length === 0 ? (
                <div className="text-sm text-zinc-400">No vibe data yet.</div>
              ) : (
                ['packed', 'buzzing', 'chill', 'quiet'].map((k) => (
                  <VibeCountRow
                    key={k}
                    label={k}
                    count={vibeDailySummary.last7Counts?.[k] || 0}
                  />
                ))
              )}
            </div>
          </div>

          {/* Recent days */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Recent Days</div>
            <div className="mt-3 space-y-2">
              {vibeDailyDays.length === 0 ? (
                <div className="text-sm text-zinc-400">No vibeDaily records yet.</div>
              ) : (
                vibeDailyDays.slice(0, 7).map((d) => (
                  <div key={d.dateKey} className="flex items-center justify-between">
                    <div className="text-sm text-white/90">{d.dateKey}</div>
                    <div className="text-xs text-zinc-400">
                      {d.totalVotes} {d.topVibe ? `• ${d.topVibe}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>

            {vibeDailySummary.latest ? (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-[11px] text-zinc-500">Latest update</div>
                <div className="mt-1 text-sm text-white/90 break-all">{vibeDailySummary.latest.id}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Votes: {vibeDailySummary.latest.totalVotes ?? 0}
                  {vibeDailySummary.latest.topVibe ? ` • Top: ${vibeDailySummary.latest.topVibe}` : ''}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* REVIEWS OVERVIEW */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-400">Reviews</div>
            <div className="mt-1 text-lg font-semibold">What people are saying</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-zinc-400">Avg Rating</div>
              <div className="text-xl font-bold">{reviewsSummary.avgRating.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[11px] text-zinc-400">Last 30 Days</div>
              <div className="text-xl font-bold">{reviewsSummary.last30Days}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Distribution */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Rating Distribution</div>
            <div className="mt-3 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar
                  key={star}
                  star={star}
                  count={reviewsSummary.dist[star] || 0}
                  total={Math.max(1, reviewsSummary.total)}
                />
              ))}
            </div>
          </div>

          {/* Top vibes */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Top Vibes</div>
            <div className="mt-3 space-y-2">
              {reviewsSummary.topVibes.length === 0 ? (
                <div className="text-sm text-zinc-400">No vibe data yet.</div>
              ) : (
                reviewsSummary.topVibes.map((v) => (
                  <div key={v.vibe} className="flex items-center justify-between">
                    <div className="text-sm text-white/90">{v.vibe}</div>
                    <div className="text-xs text-zinc-400">{v.count}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Latest */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Latest Review</div>
            {reviewsSummary.latest ? (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {typeof reviewsSummary.latest.rating === 'number'
                      ? `${reviewsSummary.latest.rating}/5`
                      : '—'}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {reviewsSummary.latest.visitDateKey || formatDocIdMaybeDate(reviewsSummary.latest.id)}
                  </div>
                </div>

                {reviewsSummary.latest.vibe ? (
                  <div className="mt-2 text-xs text-white/80">Vibe: {reviewsSummary.latest.vibe}</div>
                ) : null}

                {reviewsSummary.latest.comment ? (
                  <div className="mt-2 text-sm text-white/80 line-clamp-4">{reviewsSummary.latest.comment}</div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-400">No comment provided.</div>
                )}
              </div>
            ) : (
              <div className="mt-3 text-sm text-zinc-400">No reviews yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Daily Going"
          subtitle="people going (by day)"
          count={counts.dailyGoing}
          latestId={recent.dailyGoing?.[0]?.id}
          onOpen={() => setExpanded((p) => ({ ...p, dailyGoing: true }))}
        />
        <SummaryCard
          title="Reviews"
          subtitle="review records"
          count={counts.reviews}
          latestId={recent.reviews?.[0]?.id}
          onOpen={() => setExpanded((p) => ({ ...p, reviews: true }))}
        />
        <SummaryCard
          title="Vibe Daily"
          subtitle="today’s vibe votes"
          count={counts.vibeDaily}
          latestId={recent.vibeDaily?.[0]?.id}
          onOpen={() => setExpanded((p) => ({ ...p, vibeDaily: true }))}
        />
        <SummaryCard
          title="Vibe History"
          subtitle="historical vibe data"
          count={counts.vibeHistory}
          latestId={recent.vibeHistory?.[0]?.id}
          onOpen={() => setExpanded((p) => ({ ...p, vibeHistory: true }))}
        />
      </div>

      {/* DETAIL PANELS */}
      <div className="space-y-4">
        <CollectionPanel
          title="Daily Going"
          collectionKey="dailyGoing"
          expanded={expanded.dailyGoing}
          onToggle={() => setExpanded((p) => ({ ...p, dailyGoing: !p.dailyGoing }))}
          docs={recent.dailyGoing}
        />
        <CollectionPanel
          title="Reviews"
          collectionKey="reviews"
          expanded={expanded.reviews}
          onToggle={() => setExpanded((p) => ({ ...p, reviews: !p.reviews }))}
          docs={recent.reviews}
        />
        <CollectionPanel
          title="Vibe Daily"
          collectionKey="vibeDaily"
          expanded={expanded.vibeDaily}
          onToggle={() => setExpanded((p) => ({ ...p, vibeDaily: !p.vibeDaily }))}
          docs={recent.vibeDaily}
        />
        <CollectionPanel
          title="Vibe History"
          collectionKey="vibeHistory"
          expanded={expanded.vibeHistory}
          onToggle={() => setExpanded((p) => ({ ...p, vibeHistory: !p.vibeHistory }))}
          docs={recent.vibeHistory}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  count,
  latestId,
  onOpen,
}: {
  title: string;
  subtitle: string;
  count: number;
  latestId?: string;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">{subtitle}</div>
          <div className="mt-1 text-lg font-semibold">{title}</div>
        </div>

        <button
          onClick={onOpen}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
        >
          View
        </button>
      </div>

      <div className="mt-4">
        <div className="text-3xl font-bold">{count}</div>
        <div className="mt-1 text-xs text-zinc-400">
          Latest: {latestId ? formatDocIdMaybeDate(latestId) : '—'}
        </div>
      </div>
    </div>
  );
}

function CollectionPanel({
  title,
  collectionKey,
  expanded,
  onToggle,
  docs,
}: {
  title: string;
  collectionKey: string;
  expanded: boolean;
  onToggle: () => void;
  docs: PreviewDoc[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5"
      >
        <div className="text-left">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-xs text-zinc-400">venues/{'{venueId}'}/{collectionKey}</div>
        </div>

        <div className="text-sm text-zinc-400">{expanded ? 'Hide' : 'Show'}</div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="mt-3 text-sm text-zinc-400">Recent docs (preview)</div>

          {docs && docs.length > 0 ? (
            <div className="mt-3 space-y-3">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-white/10 bg-black/30 p-4"
                >
                  <div className="text-xs text-zinc-400">Doc ID</div>
                  <div className="text-sm text-white break-all">{d.id}</div>

                  <div className="mt-3 text-xs text-zinc-400">Fields</div>
                  <div className="mt-1 grid gap-2 md:grid-cols-2">
                    {Object.keys(d.data || {})
                      .slice(0, 8)
                      .map((k) => (
                        <div key={k} className="text-xs">
                          <span className="text-zinc-400">{k}:</span>{' '}
                          <span className="text-white/80 break-all">
                            {safeString((d.data as any)[k])}
                          </span>
                        </div>
                      ))}
                  </div>

                  {Object.keys(d.data || {}).length > 8 && (
                    <div className="mt-2 text-[11px] text-zinc-500">
                      Showing first 8 fields.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-zinc-400">No docs found.</div>
          )}
        </div>
      )}
    </div>
  );
}

function RatingBar({
  star,
  count,
  total,
}: {
  star: number;
  count: number;
  total: number;
}) {
  const pct = Math.round((count / Math.max(1, total)) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-[48px] text-xs text-zinc-400">{star}★</div>
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-2 rounded-full bg-white/60"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-[44px] text-right text-xs text-white/80">{count}</div>
    </div>
  );
}
function VibeCountRow({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-white/90 capitalize">{label}</div>
      <div className="text-xs text-zinc-400">{count}</div>
    </div>
  );
}