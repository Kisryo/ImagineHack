import Link from "next/link";
import { todaysMeetings } from "@/lib/calendar";
import { listClients, listCommitments, getCpdSummary } from "@/lib/data";

export default async function HomePage() {
  const [meetings, clients, commitments, cpd] = await Promise.all([
    todaysMeetings(),
    listClients(),
    listCommitments(),
    getCpdSummary()
  ]);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold">Good morning, Aisyah.</h1>
        <p className="text-sm opacity-70 mt-1">
          Transfer the relationship, not just the records.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Card title="Clients" value={String(clients.length)} href="/clients" sub="all firm-owned, not in heads" />
        <Card title="CPD hours" value={`${cpd.hours} / ${cpd.target}`} href="/cpd" sub="auto-logged from your notes" />
        <Card title="Open commitments" value={String(commitments.length)} href="/commitments" sub="nothing dropped" />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Panel title="Quick actions">
          <ul className="space-y-2 text-sm">
            <li><Link className="text-compass-accent" href="/notes/new">+ Log a client interaction</Link></li>
            <li><Link className="text-compass-accent" href="/clients">Brief me on a client</Link></li>
            <li><Link className="text-compass-accent" href="/learning">Today's recommended lesson</Link></li>
          </ul>
        </Panel>
        <Panel title="Today's briefings">
          <ul className="space-y-3 text-sm">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{m.time} · {m.clientName}</div>
                  <div className="text-xs opacity-60">{m.channel} · {m.topic}</div>
                </div>
                <Link
                  href={`/clients/${m.clientId}/brief`}
                  className="text-xs bg-compass-ink text-white px-2 py-1 rounded-md whitespace-nowrap"
                >
                  Brief me
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function Card({ title, value, sub, href }: { title: string; value: string; sub: string; href: string }) {
  return (
    <Link href={href} className="block bg-white rounded-xl p-4 shadow-sm hover:shadow transition">
      <div className="text-xs uppercase tracking-wide opacity-60">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs opacity-60 mt-1">{sub}</div>
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}
