

'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { useRouter, useSearchParams } from 'next/navigation';

// NOTE: This import path should match your existing portal setup.
// If your firebase client exports live elsewhere, update this import.
import { auth, db } from '@/lib/firebase';

function normalizePhotoList(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

export default function EditPhotosPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [venueId, setVenueId] = useState<string>('');
  const [venueName, setVenueName] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  const [photos, setPhotos] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string>('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  const storage = useMemo(() => getStorage(auth.app), []);

  const activePhotos = photos;

  const resolveVenueId = () => {
    // Prefer query param so we can deep-link.
    const fromQuery = params?.get('venueId') || '';
    if (fromQuery) return fromQuery;

    // Fallbacks to common localStorage keys used in portals.
    try {
      const keys = ['activeVenueId', 'selectedVenueId', 'venueId', 'portalVenueId'];
      for (const k of keys) {
        const v = window.localStorage.getItem(k);
        if (v && v.trim()) return v.trim();
      }
    } catch {
      // ignore
    }

    return '';
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      const vid = resolveVenueId();
      if (!vid) {
        setLoadError('No venue selected. Go back to the dashboard and pick a venue first.');
        setLoading(false);
        return;
      }

      setVenueId(vid);

      try {
        setLoading(true);
        setLoadError('');

        const snap = await getDoc(doc(db, 'venues', vid));
        if (!snap.exists()) {
          setLoadError('Venue not found.');
          setLoading(false);
          return;
        }

        const data: any = snap.data();
        setVenueName((data?.name || data?.title || '').toString());
        setPhotos(normalizePhotoList(data?.firebasePhotos));
      } catch (e) {
        console.error(e);
        setLoadError('Failed to load venue photos. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError('');
    setSaveSuccess('');
    setIsUploading(true);

    try {
      const maxPhotos = 12;
      const existingCount = activePhotos.length;
      const filesToUpload = Array.from(files).slice(0, Math.max(0, maxPhotos - existingCount));

      const uploaded: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_');
        const stamp = Date.now();
        const path = `venues/${venueId}/${stamp}_${i + 1}_${safeName}`;

        const r = storageRef(storage, path);
        await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' } as any);
        const url = await getDownloadURL(r);
        uploaded.push(url);
      }

      if (uploaded.length > 0) {
        setPhotos((prev) => [...prev, ...uploaded]);
        setIsEditing(true);
      }

      if (Array.from(files).length > filesToUpload.length) {
        setUploadError('Some files were not uploaded because the photo limit was reached.');
      }
    } catch (e) {
      console.error(e);
      setUploadError('Upload failed. Check your permissions and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (url: string) => {
    setUploadError('');
    setSaveSuccess('');

    setPhotos((prev) => prev.filter((p) => p !== url));
    setIsEditing(true);

    // Best-effort delete (won't block UI)
    try {
      const r = storageRef(storage, url);
      await deleteObject(r);
    } catch (e) {
      console.warn('Could not delete photo from storage:', e);
    }
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= activePhotos.length) return;
    setSaveSuccess('');

    setPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

    setIsEditing(true);
  };

  const save = async () => {
    if (!venueId) return;

    setSaveError('');
    setSaveSuccess('');
    setIsSaving(true);

    try {
      await updateDoc(doc(db, 'venues', venueId), {
        firebasePhotos: activePhotos,
      });
      setIsEditing(false);
      setSaveSuccess('Saved successfully.');
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const backToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50">Dashboard</div>
          <h1 className="mt-1 text-2xl font-semibold text-white">Edit Photos</h1>
          <div className="mt-1 text-sm text-white/60">
            {venueName ? (
              <span>
                Venue: <span className="text-white/80">{venueName}</span>
              </span>
            ) : (
              <span className="text-white/60">Manage your venue’s photo gallery.</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={backToDashboard}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Back
          </button>

          <button
            type="button"
            onClick={save}
            disabled={isSaving || !isEditing}
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        {loading ? (
          <div className="text-sm text-white/70">Loading…</div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Upload Photos</div>
                <div className="mt-1 text-xs text-white/60">
                  Upload images directly (no URLs). Order matters — the first photo is your cover.
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">
                {isUploading ? 'Uploading…' : '+ Upload'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploading}
                  onChange={(e) => uploadPhotos(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {uploadError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {uploadError}
              </div>
            )}

            {saveError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {saveSuccess}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {activePhotos.length === 0 ? (
                <div className="col-span-2 sm:col-span-3 md:col-span-4 text-sm text-white/60">
                  No photos yet. Upload 6–10 high-quality photos for best performance.
                </div>
              ) : (
                activePhotos.map((url, i) => (
                  <div key={url} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <img src={url} alt="Venue" className="h-32 w-full object-cover" />

                    {i === 0 && (
                      <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-white">
                        Cover
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-black/60 p-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i - 1)}
                          disabled={i === 0}
                          className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-40"
                          title="Move left"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i + 1)}
                          disabled={i === activePhotos.length - 1}
                          className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-40"
                          title="Move right"
                        >
                          ↓
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Notes: If a delete fails due to permissions, the photo will still be removed from your venue profile after you click Save.
            </div>
          </>
        )}
      </div>
    </div>
  );
}