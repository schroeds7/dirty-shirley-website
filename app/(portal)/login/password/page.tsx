"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

function PasswordInner() {
  const params = useSearchParams();
  const router = useRouter();

  const email = params.get("email");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-lg">
        Missing email parameter.
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Incorrect password. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl w-full max-w-md shadow-xl">
        <h1 className="text-white text-3xl font-bold text-center mb-6">
          Enter Your Password
        </h1>

        <p className="text-zinc-400 text-center mb-4">
          Logging in as: <br />
          <span className="text-white font-semibold">{email}</span>
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-white text-sm">Password</label>
            <input
              type="password"
              className="w-full mt-1 p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading…
        </div>
      }
    >
      <PasswordInner />
    </Suspense>
  );
}