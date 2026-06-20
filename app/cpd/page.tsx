import { getCpdSummary } from "@/lib/data";

export default async function CpdPage() {
  const cpd = await getCpdSummary();
  const pct = Math.min(100, Math.round((cpd.hours / cpd.target) * 100));
  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold">CPD dashboard</h1>
        <p className="text-sm opacity-70">Auto-logged from lessons you complete in Compass.</p>
      </header>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-60">Hours this year</div>
            <div className="text-3xl font-semibold">{cpd.hours} / {cpd.target}</div>
          </div>
          <div className="text-sm opacity-60">{pct}% complete</div>
        </div>
        <div className="h-2 bg-compass-soft rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-compass-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {cpd.entries.map((e) => (
          <div key={e.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-xs opacity-60">{e.completedAt}</div>
            </div>
            <div className="text-xs opacity-70">{e.hours}h</div>
          </div>
        ))}
      </div>
    </div>
  );
}
