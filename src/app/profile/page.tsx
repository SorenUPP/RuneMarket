"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  User, 
  Mail, 
  Lock, 
  Camera, 
  LogOut, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  Bell,
  Palette,
  Loader2
} from "lucide-react";
import { AlertsPanel } from "@/components/AlertsPanel";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // User details
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Settings toggles
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [compactView, setCompactView] = useState(false);

  // Alerts feedback
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");
        
        const metadata = user.user_metadata || {};
        setUsername(metadata.username || metadata.full_name || user.email?.split("@")[0] || "");
        setAvatarUrl(metadata.avatar_url || null);
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router, supabase]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { username }
      });

      if (error) throw error;
      setMessage({ type: "success", text: "Profile details updated successfully." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !userId) return;

  setUploadingPhoto(true);
  setMessage(null);

  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `avatars/${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      if (uploadError.message.includes("not found")) {
        throw new Error("Storage bucket 'avatars' does not exist in Supabase.");
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    });

    if (updateError) throw updateError;

    setAvatarUrl(publicUrl);
    setMessage({ type: "success", text: "Profile photo updated successfully." });
  } catch (err: any) {
    setMessage({ type: "error", text: err.message || "Failed to upload photo." });
  } finally {
    setUploadingPhoto(false);
  }
};

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setChangingPassword(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Password changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-amber-700">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-stone-800 md:px-12">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-amber-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">User Profile</h1>
            <p className="text-sm text-stone-500">Manage account details, avatar photo, and site preferences.</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>

        {/* Feedback Banner */}
        {message && (
          <div
            className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${
              message.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Parallel 2x2 Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          
          {/* Card 1: Avatar */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-stone-50/80 p-6 shadow-sm">
            <div>
              <div className="mb-6 flex items-center justify-between border-b border-amber-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-amber-700" />
                  <h2 className="text-lg font-semibold text-stone-900">Avatar & Identity</h2>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800 border border-amber-300/60">
                  Public Profile
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-amber-400 bg-amber-50 shadow-inner">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-amber-100 text-amber-700">
                        <User className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  <label
                    htmlFor="avatar-input"
                    className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-amber-600 text-white shadow transition hover:bg-amber-700"
                    title="Upload Photo"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="w-full text-center sm:text-left space-y-1">
                  <p className="text-xl font-semibold text-stone-900">{username || "User"}</p>
                  <p className="text-xs text-stone-500">{email}</p>
                  <p className="text-xs text-amber-800 pt-2 font-medium">Click camera badge to change photo.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Display Name */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-stone-50/80 p-6 shadow-sm">
            <form onSubmit={handleProfileUpdate} className="flex h-full flex-col justify-between space-y-4">
              <div>
                <div className="mb-4 flex items-center gap-2 border-b border-amber-200/60 pb-3">
                  <User className="h-5 w-5 text-amber-700" />
                  <h2 className="text-lg font-semibold text-stone-900">General Info</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600">Display Name</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600">Email Address</label>
                    <div className="relative mt-1">
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100/80 px-3 py-2 text-sm text-stone-500"
                      />
                      <Mail className="absolute right-3 top-2.5 h-4 w-4 text-stone-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Details
                </button>
              </div>
            </form>
          </div>

          {/* Card 3: Password */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-stone-50/80 p-6 shadow-sm">
            <form onSubmit={handlePasswordChange} className="flex h-full flex-col justify-between space-y-4">
              <div>
                <div className="mb-4 flex items-center gap-2 border-b border-amber-200/60 pb-3">
                  <Lock className="h-5 w-5 text-amber-700" />
                  <h2 className="text-lg font-semibold text-stone-900">Security</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600">New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100/80 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-200 disabled:opacity-50"
                >
                  {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>

          {/* Card 4: Preferences */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-stone-50/80 p-6 shadow-sm">
            <div>
              <div className="mb-4 flex items-center gap-2 border-b border-amber-200/60 pb-3">
                <Settings className="h-5 w-5 text-amber-700" />
                <h2 className="text-lg font-semibold text-stone-900">Preferences</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Email Notifications</p>
                      <p className="text-xs text-stone-500">Receive market updates & summaries.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-amber-200/50 pt-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Price Alerts</p>
                      <p className="text-xs text-stone-500">Notify on item price changes.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={priceAlerts}
                    onChange={(e) => setPriceAlerts(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-amber-200/50 pt-3">
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Compact Interface</p>
                      <p className="text-xs text-stone-500">Reduce layout padding across dashboard.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={compactView}
                    onChange={(e) => setCompactView(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Alerts */}
          <AlertsPanel />

        </div>

      </div>
    </div>
  );
}