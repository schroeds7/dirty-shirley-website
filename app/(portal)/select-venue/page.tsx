"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type VenueOption = {
  id: string;
  name?: string;
};

export default function SelectVenuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          router.replace("/");
          return;
        }

        const email = user.email?.toLowerCase() || "";
        if (!email) {
          setError("No email found for this account.");
          setLoading(false);
          return;
        }

        const adminRef = doc(db, "venueAdmins", email);
        const snap = await getDoc(adminRef);

        if (!snap.exists()) {
          setError("Admin record not found.");
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        const ids: string[] =
          Array.isArray(data.venueIds) && data.venueIds.length > 0
            ? data.venueIds
            : data.venueId
            ? [data.venueId]
            : [];

        if (ids.length === 0) {
          setError("No venues assigned to this account.");
          setLoading(false);
          return;
        }

        // If only one venue, auto-select and go straight to dashboard
        if (ids.length === 1) {
          const vId = ids[0];
          localStorage.setItem("activeVenueId", vId);
          localStorage.setItem("ds_selectedVenueId", vId);
          localStorage.setItem("selectedVenueId", vId);
          localStorage.setItem("venueId", vId);
          router.replace("/dashboard");
          return;
        }

        // Fetch venue docs so we can show names + photos in the picker
        const options: VenueOption[] = await Promise.all(
          ids.map(async (id) => {
            try {
              const vSnap = await getDoc(doc(db, "venues", id));
              const vData: any = vSnap.exists() ? vSnap.data() : null;

              return {
                id,
                name: vData?.name || vData?.venueName || undefined,
              };
            } catch {
              return { id };
            }
          })
        );

        setVenueOptions(options);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.");
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleSelect = (venueId: string) => {
    localStorage.setItem("activeVenueId", venueId);
    localStorage.setItem("ds_selectedVenueId", venueId);
    localStorage.setItem("selectedVenueId", venueId);
    localStorage.setItem("venueId", venueId);
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Loading venues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Venue access issue</div>
          <div className="mt-2 text-sm text-white/70">{error}</div>
          <button
            onClick={() => router.replace("/")}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold">Select a venue</h1>
        <p className="mt-2 text-sm text-white/70">
          Choose which venue you want to manage right now.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {venueOptions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              className="text-left rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition"
            >
              <div>
                <div className="truncate text-sm font-semibold">
                  {v.name || "Venue"}
                </div>
                <div className="mt-1 truncate text-xs text-white/60">
                  {v.id}
                </div>
              </div>

              <div className="mt-4 inline-flex items-center text-xs text-white/70">
                Manage this venue →
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}