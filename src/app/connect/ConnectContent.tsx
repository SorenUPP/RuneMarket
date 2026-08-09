"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type Status =
  | "checking"
  | "needs-login"
  | "ready"
  | "approving"
  | "approved"
  | "error";

export default function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setErrorMessage(
        "No connection code was provided. Go back to RuneLite and click Connect again."
      );
      return;
    }

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setStatus("needs-login");
        return;
      }

      setStatus("ready");
    });
  }, [code]);

  async function handleApprove() {
    if (!code) return;

    setStatus("approving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data?.error ?? "Something went wrong approving this connection."
        );
        setStatus("error");
        return;
      }

      setStatus("approved");
    } catch {
      setErrorMessage(
        "Couldn't reach RuneMarket. Check your connection and try again."
      );
      setStatus("error");
    }
  }

  function goToLogin() {
    // Preserve the code across the login round-trip so the user never has
    // to re-click a link or re-copy anything.
    const next = code
      ? `/connect?code=${encodeURIComponent(code)}`
      : "/connect";

    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
        {status === "checking" && (
          <div className="space-y-2">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checking your session…
            </p>
          </div>
        )}

        {status === "needs-login" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="font-display text-xl text-foreground">
                Log in to connect RuneLite
              </h1>
              <p className="text-sm text-muted-foreground">
                You'll be brought right back here afterwards.
              </p>
            </div>

            <button
              onClick={goToLogin}
              className="w-full rounded-md bg-foreground py-2 text-sm font-medium text-background transition-transform active:scale-[0.98]"
            >
              Log in
            </button>
          </div>
        )}

        {status === "ready" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="font-display text-xl text-foreground">
                Connect RuneLite
              </h1>
              <p className="text-sm text-muted-foreground">
                Approve this to let the RuneMarket Sync plugin log your flips
                automatically. No token to copy, just confirm it's you.
              </p>
            </div>

            <button
              onClick={handleApprove}
              className="w-full rounded-md bg-foreground py-2 text-sm font-medium text-background transition-transform active:scale-[0.98]"
            >
              Approve RuneLite
            </button>
          </div>
        )}

        {status === "approving" && (
          <div className="space-y-2">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Approving…</p>
          </div>
        )}

        {status === "approved" && (
          <div className="space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <h1 className="font-display text-xl text-foreground">
              Connected
            </h1>
            <p className="text-sm text-muted-foreground">
              RuneLite will pick this up automatically within a few seconds.
              You can close this tab.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="font-display text-xl text-foreground">
              Couldn't connect
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorMessage ??
                "Something went wrong. Go back to RuneLite and click Connect again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}