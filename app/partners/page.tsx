const partners = [
  { id: "p1", name: "Lim & Co",        specialty: "Tax & accounting", contact: "lim@lim.co" },
  { id: "p2", name: "Aman Estate Law", specialty: "Wills & trusts",   contact: "intake@aman-law.my" },
  { id: "p3", name: "Saga Mortgage",   specialty: "Home financing",   contact: "hello@saga.my" }
];

type Stage = "introduced" | "engaged" | "closed";
const referrals: { id: string; client: string; partner: string; stage: Stage; updated: string }[] = [
  { id: "r1", client: "Wong Family",  partner: "Lim & Co",        stage: "engaged",    updated: "2026-06-12" },
  { id: "r2", client: "Tan Li Hua",   partner: "Aman Estate Law", stage: "introduced", updated: "2026-06-05" },
  { id: "r3", client: "Rajesh Menon", partner: "Aman Estate Law", stage: "closed",     updated: "2026-05-18" }
];

const stageStyle: Record<Stage, string> = {
  introduced: "bg-blue-100 text-blue-800",
  engaged:    "bg-amber-100 text-amber-800",
  closed:     "bg-green-100 text-green-800"
};

export default function PartnersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Partner ecosystem</h1>
        <p className="text-sm opacity-70">Surface the right partner at the right moment, and track every referral.</p>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-wide opacity-60 mb-2">Directory</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {partners.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs opacity-60">{p.specialty}</div>
              </div>
              <div className="text-xs opacity-60">{p.contact}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide opacity-60 mb-2">Referrals</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {referrals.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-medium">{r.client}</span>
                <span className="opacity-50"> → </span>
                <span>{r.partner}</span>
                <div className="text-xs opacity-60 mt-1">Updated {r.updated}</div>
              </div>
              <span className={`text-xs rounded-full px-3 py-1 ${stageStyle[r.stage]}`}>{r.stage}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
