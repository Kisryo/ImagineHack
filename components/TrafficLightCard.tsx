import { getMeetingCoach } from "@/lib/data";

export async function TrafficLightCard({ clientId, dense = false }: { clientId: string; dense?: boolean }) {
  const coach = await getMeetingCoach(clientId);

  return (
    <div className={`bg-white rounded-xl shadow-sm ${dense ? "p-4" : "p-5"} print-card`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Meeting coach</div>
        <div className="text-[10px] uppercase tracking-wider opacity-50">what to say · what to avoid</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Column tone="safe" title="🟢 Safe today" items={coach.safe} empty="No engaged topics captured yet." />
        <Column tone="avoid" title="🔴 Avoid today" items={coach.avoid} empty="No sensitivities flagged." />
        <Column tone="explore" title="🟡 Explore" items={coach.explore} empty="No open threads." />
      </div>
    </div>
  );
}

function Column({
  tone, title, items, empty
}: { tone: "safe" | "avoid" | "explore"; title: string; items: string[]; empty: string }) {
  const bg = tone === "safe" ? "bg-green-50 border-green-200"
           : tone === "avoid" ? "bg-red-50 border-red-200"
           : "bg-amber-50 border-amber-200";
  return (
    <div className={`rounded-lg border ${bg} p-3`}>
      <div className="text-xs font-semibold mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs opacity-60">{empty}</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-xs leading-snug">• {it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
