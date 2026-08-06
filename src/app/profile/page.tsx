"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Save } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      setDisplayName(data.user.user_metadata?.display_name ?? "");
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const supabase = createClient();
    const updates: { data?: { display_name: string }; password?: string } = {
      data: { display_name: displayName },
    };
    if (newPassword) updates.password = newPassword;

    const { error } = await supabase.auth.updateUser(updates);
    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setNewPassword("");
    setStatus("Profile updated.");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="px-10 py-10 max-w-lg mx-auto">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-10 py-10 max-w-lg mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5 transition-transform duration-150 ease-out focus-within:scale-[1.015] active:scale-[0.99]">
          <label className="text-sm text-foreground">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            className="w-full border border-border rounded-md px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow duration-200"
          />
        </div>

        <div className="space-y-1.5 transition-transform duration-150 ease-out focus-within:scale-[1.015] active:scale-[0.99]">
          <label className="text-sm text-foreground">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            className="w-full border border-border rounded-md px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow duration-200"
          />
        </div>

        {status && (
          <p className="text-sm text-primary animate-in fade-in slide-in-from-top-1 duration-200">
            {status}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="border-t border-border pt-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#B5453A] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}