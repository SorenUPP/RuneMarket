import { Suspense } from "react";
import ConnectContent from "./ConnectContent";

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <ConnectContent />
    </Suspense>
  );
}