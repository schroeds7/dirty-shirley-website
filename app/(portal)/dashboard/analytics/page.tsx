'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  onSnapshot,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type VibeKey = 'packed' | 'buzzing' | 'chill' | 'quiet';

type ReviewRow = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: any;
};

type VibeDailyDoc = {
  totalVotes?: number;
  topVibe?: VibeKey | string;
  counts?: Record<string, number>;
  lastUpdatedAt?: any;
  createdAt?: any;
};

type VibeHistoryRow = {
  id: string;
  vibe?: VibeKey | string;
  createdAt?: any;
  timestamp?: any;
  date?: any;
  day?: any;
};

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(' ');
}

function toLocalDateKey(d: Date) {
  // Local date key in YYYY-MM-DD (NOT UTC). This aligns with “tonight” semantics.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildLastNDaysKeysLocal(n: number) {
  const keys: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    keys.push(toLocalDateKey(dt));
  }
  return keys;
}

function formatShortDateKey(dateKey: string) {
  // YYYY-MM-DD -> Mon 3/3
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split('-').map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dow = dt.toLocaleDateString(undefined, { weekday: 'short' });
  return `${dow} ${m}/${d}`;
}

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function readTimestamp(input: any): Date | null {
  if (!input) return null;
  // Firestore Timestamp
  if (input instanceof Timestamp) return input.toDate();
  // Sometimes timestamp-like object
  if (typeof input?.toDate === 'function') {
    try {
      return input.toDate();
    } catch {
      return null;
    }
  }
  // Date
  if (input instanceof Date) return input;
  return null;
}

function VibePill({ vibe }: { vibe?: string }) {
  const v = (vibe || '').toLowerCase();
  const label = vibe ? vibe : '—';
  const tone =
    v === 'packed'
      ? 'border-red-500/40 text-red-200 bg-red-500/10'
      : v === 'buzzing'
        ? 'border-orange-500/40 text-orange-200 bg-orange-500/10'
        : v === 'chill'
          ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10'
          : v === 'quiet'
            ? 'border-blue-500/40 text-blue-200 bg-blue-500/10'
            : 'border-white/10 text-white/80 bg-white/5';

  return (
    <span className={classNames('inline-flex items-center rounded-full border px-2.5 py-1 text-xs', tone)}>
      {label}
    </span>
  );
}

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={classNames('text-sm', i < r ? 'text-yellow-300' : 'text-white/20')}>
          ★
        </span>
      ))}
      <span className="ml-2 text-xs text-white/60">{rating.toFixed(1)}</span>
    </div>
  );
}

function Dropdown({
  title,
  subtitle,
  open,
  setOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4"
      >
        <div className="text-left">
          <div className="text-base font-semibold">{title}</div>
          {subtitle ? <div className="mt-0.5 text-sm text-white/55">{subtitle}</div> : null}
        </div>
        <div className="text-white/70">{open ? '▾' : '▸'}</div>
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string>('');

  // Top cards
  const [goingTonightCount, setGoingTonightCount] = useState<number>(0);
  const [goingLast7Total, setGoingLast7Total] = useState<number>(0);

  const [todayVibeVotes, setTodayVibeVotes] = useState<number>(0);
  const [todayTopVibe, setTodayTopVibe] = useState<string | null>(null);
  const [yesterdayTopVibe, setYesterdayTopVibe] = useState<string | null>(null);

  const [avgRating, setAvgRating] = useState<number>(0);
  const [latestReview, setLatestReview] = useState<ReviewRow | null>(null);

  // Dropdowns
  const [openReviews, setOpenReviews] = useState<boolean>(false);
  const [openVibe, setOpenVibe] = useState<boolean>(false);

  // Reviews details
  const [reviewDist, setReviewDist] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [recentReviews, setRecentReviews] = useState<ReviewRow[]>([]);

  // Vibe details
  const [todayVibeCounts, setTodayVibeCounts] = useState<Record<string, number>>({});
  const [mostRecentVibe, setMostRecentVibe] = useState<{ dateKey: string; topVibe?: string; totalVotes?: number } | null>(
    null
  );
  const [weekdayTopVibes, setWeekdayTopVibes] = useState<
    Array<{ weekday: string; topVibe: string | null; totalVotes: number }>
  >([]);

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateKey(d);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setError(null);
        setLoading(true);

        if (!user?.email) {
          setError('You must be signed in.');
          setLoading(false);
          return;
        }

        const emailLower = user.email.toLowerCase();
        const adminRef = doc(db, 'venueAdmins', emailLower);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          setError('No venue admin record found for this account.');
          setLoading(false);
          return;
        }

        const adminData: any = adminSnap.data();
        const allowed: string[] = Array.isArray(adminData?.venueIds)
          ? adminData.venueIds
          : adminData?.venueId
            ? [adminData.venueId]
            : [];

        if (allowed.length === 0) {
          setError('This admin account is not linked to any venues.');
          setLoading(false);
          return;
        }

        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('activeVenueId') : null;
        const active = stored && allowed.includes(stored) ? stored : allowed.length === 1 ? allowed[0] : null;

        if (!active) {
          // keep it simple: tell user to pick one. (Your app likely has /select-venue)
          setError('No active venue selected. Go back and select a venue.');
          setLoading(false);
          return;
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('activeVenueId', active);
        }

        setVenueId(active);

        const venueSnap = await getDoc(doc(db, 'venues', active));
        setVenueName((venueSnap.exists() ? (venueSnap.data() as any)?.name : '') || '');

        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Failed to load venue context.');
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Live updates for Who's Going (dailyGoing)
  useEffect(() => {
    if (!venueId) return;

    const keys = buildLastNDaysKeysLocal(7);
    const unsubscribers: Array<() => void> = [];

    // Keep a running map of dayKey -> count so we can sum efficiently
    const countsByDay: Record<string, number> = {};

    const recomputeTotals = () => {
      const tonight = countsByDay[todayKey] || 0;
      const last7 = keys.reduce((sum, k) => sum + (countsByDay[k] || 0), 0);
      setGoingTonightCount(tonight);
      setGoingLast7Total(last7);
    };

    // Attach a listener per day key (7 listeners). This works even if the parent day doc doesn't exist.
    for (const k of keys) {
      const usersCol = collection(db, 'venues', venueId, 'dailyGoing', k, 'users');
      const unsub = onSnapshot(
        usersCol,
        (snap) => {
          countsByDay[k] = snap.size;
          recomputeTotals();
        },
        () => {
          // If permission/error, treat as 0 for that day
          countsByDay[k] = 0;
          recomputeTotals();
        }
      );
      unsubscribers.push(unsub);
    }

    // Initialize state quickly even before snapshots return
    recomputeTotals();

    return () => {
      for (const u of unsubscribers) u();
    };
  }, [venueId, todayKey]);

  useEffect(() => {
    const run = async () => {
      if (!venueId) return;

      setError(null);
      setLoading(true);

      try {

        // ------------------------------
        // TODAY'S VIBE (today + yesterday)
        // ------------------------------
        let todayVotes = 0;
        let todayTop: string | null = null;
        let todayCounts: Record<string, number> = {};
        try {
          const vibeSnap = await getDoc(doc(db, 'venues', venueId, 'vibeDaily', todayKey));
          if (vibeSnap.exists()) {
            const data = vibeSnap.data() as any as VibeDailyDoc;
            todayVotes = safeNumber(data?.totalVotes, 0);
            todayTop = (data?.topVibe as any) || null;
            todayCounts = (data?.counts as any) || {};
          }
        } catch {
          // ignore
        }

        let yTop: string | null = null;
        try {
          const ySnap = await getDoc(doc(db, 'venues', venueId, 'vibeDaily', yesterdayKey));
          if (ySnap.exists()) {
            const data = ySnap.data() as any as VibeDailyDoc;
            yTop = (data?.topVibe as any) || null;
          }
        } catch {
          // ignore
        }

        setTodayVibeVotes(todayVotes);
        setTodayTopVibe(todayTop);
        setYesterdayTopVibe(yTop);
        setTodayVibeCounts(todayCounts);

        // ------------------------------
        // REVIEWS (avg rating + latest + dist + recent list)
        // ------------------------------
        // Get all reviews once for avg + distribution.
        let allReviews: ReviewRow[] = [];
        try {
          const reviewsSnap = await getDocs(collection(db, 'venues', venueId, 'reviews'));
          allReviews = reviewsSnap.docs.map((d) => {
            const data: any = d.data();
            return {
              id: d.id,
              rating: safeNumber(data?.rating, 0),
              comment: data?.comment || data?.review || data?.text || '',
              createdAt: data?.createdAt,
            };
          });
        } catch {
          allReviews = [];
        }

        const total = allReviews.length;
        const avg = total === 0 ? 0 : allReviews.reduce((sum, r) => sum + safeNumber(r.rating, 0), 0) / total;
        setAvgRating(avg);

        // Distribution (1-5)
        const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const r of allReviews) {
          const rr = Math.round(safeNumber(r.rating, 0));
          const clamped = Math.max(1, Math.min(5, rr));
          dist[clamped] = (dist[clamped] || 0) + 1;
        }
        setReviewDist(dist);

        // Latest + top 5 recent (prefer createdAt desc)
        let recent: ReviewRow[] = [];
        try {
          const qy = query(
            collection(db, 'venues', venueId, 'reviews'),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const snap = await getDocs(qy);
          recent = snap.docs.map((d) => {
            const data: any = d.data();
            return {
              id: d.id,
              rating: safeNumber(data?.rating, 0),
              comment: data?.comment || data?.review || data?.text || '',
              createdAt: data?.createdAt,
            };
          });
        } catch {
          // fallback: sort in-memory by createdAt when possible
          const sorted = [...allReviews].sort((a, b) => {
            const da = readTimestamp(a.createdAt)?.getTime() ?? 0;
            const dbb = readTimestamp(b.createdAt)?.getTime() ?? 0;
            return dbb - da;
          });
          recent = sorted.slice(0, 5);
        }

        setRecentReviews(recent);
        setLatestReview(recent[0] || null);

        // ------------------------------
        // VIBE DROPDOWN DETAILS
        // - Most recent vibe (from vibeDaily)
        // - Vibe by night (day-of-week top vibe from vibeHistory)
        // ------------------------------
        // Most recent vibeDaily doc
        try {
          const vibeCol = collection(db, 'venues', venueId, 'vibeDaily');
          // Try lastUpdatedAt, fallback to createdAt
          let snap = null as any;
          try {
            snap = await getDocs(query(vibeCol, orderBy('lastUpdatedAt', 'desc'), limit(1)));
          } catch {
            snap = await getDocs(query(vibeCol, orderBy('createdAt', 'desc'), limit(1)));
          }

          if (snap && snap.docs && snap.docs.length > 0) {
            const d = snap.docs[0];
            const data: any = d.data();
            setMostRecentVibe({
              dateKey: d.id,
              topVibe: data?.topVibe || null,
              totalVotes: safeNumber(data?.totalVotes, 0),
            });
          } else {
            setMostRecentVibe(null);
          }
        } catch {
          setMostRecentVibe(null);
        }

        // Vibe by night/day-of-week (aggregate from vibeHistory)
        // We’ll read a bounded recent window to avoid huge reads.
        // If you later add a pre-aggregated doc, we can switch to that.
        try {
          const vibeHistCol = collection(db, 'venues', venueId, 'vibeHistory');

          // Try last 120 days using createdAt filter if present.
          const since = new Date();
          since.setDate(since.getDate() - 120);

          let histSnap = null as any;
          try {
            // createdAt >= since
            histSnap = await getDocs(
              query(vibeHistCol, where('createdAt', '>=', Timestamp.fromDate(since)), limit(500))
            );
          } catch {
            // fallback: no where clause, just take up to 500 (best-effort)
            histSnap = await getDocs(query(vibeHistCol, limit(500)));
          }

          const rows: VibeHistoryRow[] = (histSnap.docs as QueryDocumentSnapshot<DocumentData>[]).map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));

          // weekday -> vibe -> count
          const agg: Record<string, Record<string, number>> = {
            Mon: {},
            Tue: {},
            Wed: {},
            Thu: {},
            Fri: {},
            Sat: {},
            Sun: {},
          };

          for (const r of rows) {
            const vibe = (r.vibe || (r as any).topVibe || '').toString();
            if (!vibe) continue;

            const dt =
              readTimestamp(r.createdAt) ||
              readTimestamp((r as any).lastUpdatedAt) ||
              readTimestamp(r.timestamp) ||
              null;

            if (!dt) continue;

            const wd = dt.toLocaleDateString(undefined, { weekday: 'short' });
            // normalize to Mon/Tue/... in our keys
            const key = wd as keyof typeof agg;
            if (!agg[key]) continue;

            agg[key][vibe] = (agg[key][vibe] || 0) + 1;
          }

          const ordered: Array<{ weekday: string; topVibe: string | null; totalVotes: number }> = [
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat',
            'Sun',
          ].map((weekday) => {
            const bucket = agg[weekday] || {};
            let best: string | null = null;
            let bestCount = 0;
            for (const [v, c] of Object.entries(bucket)) {
              if (c > bestCount) {
                best = v;
                bestCount = c;
              }
            }
            return { weekday, topVibe: best, totalVotes: bestCount };
          });

          setWeekdayTopVibes(ordered);
        } catch {
          setWeekdayTopVibes([]);
        }

        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics.');
        setLoading(false);
      }
    };

    run();
  }, [venueId, todayKey, yesterdayKey]);

  // Derived text
  const avgRatingText = useMemo(() => (avgRating ? avgRating.toFixed(2) : '0.00'), [avgRating]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-white/80">Loading analytics…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>
      </div>
    );
  }

  if (!venueId) {
    return (
      <div className="p-6">
        <div className="text-white/80">No venue selected.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-white/60">Analytics</div>
          <div className="mt-1 text-2xl font-bold">{venueName || 'Your Venue'}</div>
          <div className="mt-1 text-xs text-white/40">Venue ID: {venueId}</div>
        </div>

        <div className="text-xs text-white/50">
          Tonight key: <span className="text-white/70">{todayKey}</span>
        </div>
      </div>

      {/* TOP 3 CARDS */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Who’s going */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/60">Who’s going</div>
                <div className="mt-1 text-xs text-white/40">Tonight + last 7 days</div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/60">
                Live
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[44px] leading-none font-bold tracking-tight">{goingTonightCount}</div>
              <div className="mt-2 text-sm text-white/55">Tonight’s total</div>
            </div>

            <div className="mt-4 h-px w-full bg-white/10" />

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-white/45">Last 7 days</div>
              <div className="text-sm font-semibold text-white/80">{goingLast7Total}</div>
            </div>
          </div>
        </div>

        {/* Today’s vibe */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/60">Today’s Vibe</div>
                <div className="mt-1 text-xs text-white/40">What people are saying</div>
              </div>
              <div className={classNames(
                'rounded-full border px-2.5 py-1 text-[11px]',
                todayVibeVotes > 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-black/30 text-white/60'
              )}>
                {todayVibeVotes > 0 ? 'Active' : 'No votes'}
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <div className="text-[44px] leading-none font-bold tracking-tight">{todayVibeVotes}</div>
                  <div className="text-xs text-white/50">votes</div>
                </div>
                <div className="mt-2 text-sm text-white/55">Logged today</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/45">Top vibe</div>
                <div className="mt-1">
                  <VibePill vibe={todayTopVibe || undefined} />
                </div>
              </div>
            </div>

            <div className="mt-4 h-px w-full bg-white/10" />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-white/45">Yesterday</div>
              <VibePill vibe={yesterdayTopVibe || undefined} />
            </div>
            <div className="mt-3 text-xs text-white/40">
              {todayVibeVotes > 0 ? 'At least one vibe has been logged today.' : 'No vibe votes logged today yet.'}
            </div>
          </div>
        </div>

        {/* Avg rating */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/60">Average Rating</div>
                <div className="mt-1 text-xs text-white/40">Across all reviews</div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/60">
                {recentReviews.length} recent
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-[44px] leading-none font-bold tracking-tight">{avgRatingText}</div>
                <div className="mt-2 text-sm text-white/55">Average score</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/45">Latest</div>
                <div className="mt-1">
                  {latestReview ? <Stars rating={safeNumber(latestReview.rating, 0)} /> : <div className="text-xs text-white/40">—</div>}
                </div>
              </div>
            </div>

            <div className="mt-4 h-px w-full bg-white/10" />
            <div className="mt-3">
              <div className="text-xs text-white/45">Most recent review</div>
              {latestReview ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-sm text-white/80 line-clamp-3">{latestReview.comment || '—'}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-white/40">No reviews yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DROPDOWNS */}
      <div className="space-y-4">
        <Dropdown
          title="Reviews"
          subtitle="Ratings distribution + most recent reviews"
          open={openReviews}
          setOpen={setOpenReviews}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Rating distribution */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Rating distribution</div>
              <div className="mt-3 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewDist[star] || 0;
                  const total = Object.values(reviewDist).reduce((s, n) => s + (n || 0), 0) || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="w-10 text-xs text-white/70">{star}★</div>
                      <div className="flex-1 h-2 rounded bg-white/10 overflow-hidden">
                        <div className="h-2 bg-white/30" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-14 text-right text-xs text-white/60">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most recent */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Most recent review</div>
              {recentReviews[0] ? (
                <div className="mt-3">
                  <Stars rating={safeNumber(recentReviews[0].rating, 0)} />
                  <div className="mt-2 text-sm text-white/80">{recentReviews[0].comment || '—'}</div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/40">No reviews yet.</div>
              )}
            </div>

            {/* Other recent */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Other recent</div>
              <div className="mt-3 space-y-3">
                {recentReviews.slice(1).length === 0 ? (
                  <div className="text-sm text-white/40">—</div>
                ) : (
                  recentReviews.slice(1).map((r) => (
                    <div key={r.id} className="rounded border border-white/10 bg-black/20 p-3">
                      <Stars rating={safeNumber(r.rating, 0)} />
                      <div className="mt-2 text-sm text-white/80">{r.comment || '—'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Dropdown>

        <Dropdown
          title="Vibe"
          subtitle="Vibe breakdown + most recent vibe + vibe by night (day of week)"
          open={openVibe}
          setOpen={setOpenVibe}
        >
          {/* Vibe by night */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">Vibe by night (day of week)</div>
            <div className="mt-2 text-xs text-white/45">
              Based on last ~120 days of vibeHistory docs (bounded to 500 reads).
            </div>

            <div className="mt-3">
              {weekdayTopVibes.length === 0 ? (
                <div className="text-sm text-white/40">No vibeHistory data available.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
                  {weekdayTopVibes.map((r) => (
                    <div key={r.weekday} className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
                      <div className="text-xs text-white/50">{r.weekday}</div>
                      <div className="mt-2 flex justify-center">
                        <VibePill vibe={r.topVibe || undefined} />
                      </div>
                      <div className="mt-1 text-[11px] text-white/50">{r.totalVotes} votes</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Today breakdown */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Vibe breakdown (today)</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(['packed', 'buzzing', 'chill', 'quiet'] as VibeKey[]).map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="text-sm text-white/80">{k}</div>
                    <div className="text-xs text-white/60">{safeNumber(todayVibeCounts?.[k], 0)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most recent vibe */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Most recent vibe update</div>
              {mostRecentVibe ? (
                <div className="mt-3">
                  <div className="text-xs text-white/50">Date</div>
                  <div className="mt-1 text-sm text-white/80">{mostRecentVibe.dateKey}</div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-white/70">Top vibe</div>
                    <VibePill vibe={mostRecentVibe.topVibe || undefined} />
                  </div>

                  <div className="mt-2 text-xs text-white/50">Votes: {safeNumber(mostRecentVibe.totalVotes, 0)}</div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/40">No vibe history yet.</div>
              )}
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  );
}