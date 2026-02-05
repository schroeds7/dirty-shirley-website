'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function CreatePasswordPage() {
  const params = useSearchParams();
  const router = useRouter();

  const email = params.get('email'); // read ?email=value
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-lg">
        Missing email parameter.
      </div>
    );
  }

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Update Firestore admin record
      const adminRef = doc(db, 'venueAdmins', email);
      await updateDoc(adminRef, {
        uid,
        passwordCreated: true,
      });

      router.push('/dashboard'); // login complete → dashboard
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-3xl font-bold text-center mb-6">
          Create Your Password
        </h1>

        <p className="text-zinc-400 text-center mb-4">
          Setting up your admin account for: <br />
          <span className="text-white font-semibold">{email}</span>
        </p>

        <form onSubmit={handleCreatePassword} className="space-y-4">
          <div>
            <label className="text-white text-sm">Choose a password</label>
            <input
              type="password"
              className="w-full mt-1 p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
              placeholder="Enter a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {loading ? 'Creating...' : 'Create Password'}
          </button>
        </form>
      </div>
    </div>
  );
}