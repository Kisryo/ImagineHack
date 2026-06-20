"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoResetButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch("/api/reset", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={reset}
      disabled={busy}
      className="no-print text-xs border border-white/30 text-white/80 hover:text-white px-2 py-1 rounded-md"
      title="Reset to seeded demo state"
    >
      {busy ? "resetting…" : "↺ reset demo"}
    </button>
  );
}
