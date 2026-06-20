import { listAudit } from "@/lib/data";

export default async function AuditPage() {
  const entries = await listAudit();
  return (
    <div className="space-y-4 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Audit trail</h1>
        <p className="text-sm opacity-70">
          Every client-record access is logged. Required for Gap 4 (SME-grade security).
        </p>
      </header>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {entries.length === 0 && (
          <div className="p-4 text-sm opacity-60">No activity yet — open a client to populate.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="p-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-mono text-xs opacity-60">{e.advisor}</span>
              <span className="mx-2 opacity-40">·</span>
              <span>{e.action}</span>
            </div>
            <div className="text-xs opacity-60">{e.at.replace("T", " ").slice(0, 19)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
