"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, usingSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("aisyah@compass.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (usingSupabase && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      document.cookie = `compass_demo_user=${encodeURIComponent(email)}; path=/; max-age=86400`;
    }
    router.push("/");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 shadow-sm w-full max-w-sm space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-60">Compass</div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-xs opacity-60 mt-1">
            {usingSupabase ? "Use your firm account" : "Demo mode — any email works"}
          </p>
        </div>
        <label className="block">
          <span className="text-xs opacity-60">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            type="email"
            required
          />
        </label>
        <label className="block">
          <span className="text-xs opacity-60">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            type="password"
            placeholder={usingSupabase ? "" : "(any)"}
          />
        </label>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          disabled={loading}
          className="w-full bg-compass-accent text-white py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
