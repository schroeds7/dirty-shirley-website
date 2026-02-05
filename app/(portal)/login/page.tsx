'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function LoginEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanedEmail = email.trim().toLowerCase();

      // Lookup Firestore doc: venueAdmins/<email>
      const adminRef = doc(db, 'venueAdmins', cleanedEmail);
      const adminSnap = await getDoc(adminRef);

      if (!adminSnap.exists()) {
        setError('This email is not registered as a venue admin.');
        setLoading(false);
        return;
      }

      const data = adminSnap.data();

      if (!data.passwordCreated) {
        // First-time admin → go to create password page
        router.push(`/login/create-password?email=${cleanedEmail}`);
      } else {
        // Returning admin → go to normal password login
        router.push(`/login/password?email=${cleanedEmail}`);
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-3xl font-bold text-center mb-6">Venue Admin Login</h1>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="text-white text-sm">Enter your email</label>
            <input
              type="email"
              className="w-full mt-1 p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
              placeholder="admin@venue.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}