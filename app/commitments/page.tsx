import Link from "next/link";
import { listCommitments } from "@/lib/data";

export default async function CommitmentsPage() {
  const items = await listCommitments();
  return (
    <div className="space-y-4 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Commitments inbox</h1>
        <p className="text-sm opacity-70">
          Every promise you made to a client — auto-extracted from your notes. No more dropped balls.
        </p>
      </header>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {items.length === 0 && (
          <div className="p-4 text-sm opacity-60">No open commitments. Capture a note to populate.</div>
        )}
        {items.map((c, i) => (
          <div key={i} className="p-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm">{c.text}</div>
              <div className="text-xs opacity-60 mt-1">
                <Link href={`/clients/${c.clientId}`} className="text-compass-accent">{c.clientName}</Link>
                {" "}· logged {c.date}
              </div>
            </div>
            <button className="text-xs border rounded-full px-3 py-1 whitespace-nowrap">Mark done</button>
          </div>
        ))}
      </div>
    </div>
  );
}
