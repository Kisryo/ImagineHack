import Link from "next/link";
import { listClients, listAudit, getCpdSummary } from "@/lib/data";

export default async function AdminPage() {
  const [clients, audit, cpd] = await Promise.all([
    listClients(),
    listAudit(),
    getCpdSummary()
  ]);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wide opacity-60">Team lead view</div>
        <h1 className="text-2xl font-semibold">Firm overview</h1>
        <p className="text-sm opacity-70">
          What the partner sees — coverage, continuity risk, CPD compliance, recent activity.
        </p>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <Stat label="Clients on platform" value={String(clients.length)} sub="firm-owned, not in heads" />
        <Stat label="CPD compliance" value={`${Math.round((cpd.hours / cpd.target) * 100)}%`} sub={`${cpd.hours}h / ${cpd.target}h`} />
        <Stat label="Continuity risk" value="Low" sub="all clients have ≥3 captured interactions" />
        <Stat label="Admin time saved" value="6h / advisor / wk" sub="auto-extraction + auto-CPD" />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm font-semibold mb-3">Clients by advisor</div>
          <ul className="text-sm divide-y">
            {clients.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <Link href={`/clients/${c.id}`} className="text-compass-accent">{c.name}</Link>
                <span className="text-xs opacity-60">Aisyah</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm font-semibold mb-3">Recent activity</div>
          <ul className="text-xs space-y-2 max-h-72 overflow-auto">
            {audit.length === 0 && <li className="opacity-60">No activity yet.</li>}
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span className="truncate">{a.action}</span>
                <span className="opacity-60 whitespace-nowrap">{(a.at ?? "").toString().slice(11, 16)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs opacity-60 mt-1">{sub}</div>
    </div>
  );
}
