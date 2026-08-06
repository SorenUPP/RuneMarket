"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try logging in instead.");
        return;
      }
      setInfo("Check your email to confirm your account before logging in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-20 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-foreground">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login"
            ? "Log in to track your favourites and portfolio."
            : "Sign up to save favourites and set price alerts."}
        </p>
      </div>

      <div className="relative grid grid-cols-2 bg-secondary rounded-lg p-1 text-sm">
        <span
          className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-300 ease-in-out ${
            mode === "signup" ? "translate-x-[calc(100%+8px)]" : "translate-x-0"
          }`}
        />
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`relative z-10 py-1.5 rounded-md transition-colors ${
            mode === "login" ? "text-foreground font-medium" : "text-muted-foreground"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`relative z-10 py-1.5 rounded-md transition-colors ${
            mode === "signup" ? "text-foreground font-medium" : "text-muted-foreground"
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative transition-transform duration-150 ease-out focus-within:scale-[1.015] active:scale-[0.99]">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded-md pl-10 pr-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow duration-200"
            required
          />
        </div>

        <div className="relative transition-transform duration-150 ease-out focus-within:scale-[1.015] active:scale-[0.99]">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded-md pl-10 pr-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow duration-200"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-[#B5453A] animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-[#4B7A52] animate-in fade-in slide-in-from-top-1 duration-200">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {loading ? "..." : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
    </div>
  );
}