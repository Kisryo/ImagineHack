import Link from "next/link";

const slides: { kicker: string; title: string; body: React.ReactNode }[] = [
  {
    kicker: "01 · The problem",
    title: "When an advisor leaves, the relationship leaves with them.",
    body: (
      <p>
        The CRM transfers fine. What never transfers is the <strong>relational knowledge</strong> —
        how the client thinks, what lights them up, what to never bring up again.
        The successor inherits the file and starts cold on the person. The client feels the reset.
      </p>
    )
  },
  {
    kicker: "02 · Why now",
    title: "Built for giants, not the rest.",
    body: (
      <p>
        The tools that come close target enterprise wealth firms. Small/mid-size advisory firms
        in Southeast Asia are left with spreadsheets and memory — and a regulator that mandates CPD hours
        they have no good way to log.
      </p>
    )
  },
  {
    kicker: "03 · The product",
    title: "Compass turns scattered client knowledge into secure organisational memory.",
    body: (
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Client memory</strong> — captures every interaction as firm-owned data, with the behavioural signals a CRM never holds.</li>
        <li><strong>Learning loop</strong> — detects knowledge gaps from your real work, serves a micro-lesson, auto-logs CPD.</li>
        <li><strong>Handover pack</strong> — one click regenerates the relationship for any successor.</li>
      </ul>
    )
  },
  {
    kicker: "04 · The wedge",
    title: "We capture what a CRM never could: the relational layer.",
    body: (
      <p>
        Tone, triggers, preferences, trust state, communication style.
        Deliberately <strong>not</strong> regulated identity data — that's the differentiator and a privacy-aware design choice.
      </p>
    )
  },
  {
    kicker: "05 · Live demo",
    title: "Watch one note hit every gap.",
    body: (
      <ol className="list-decimal pl-6 space-y-1 text-base">
        <li>Log a note (voice).</li>
        <li>AI extracts relational signals → client timeline.</li>
        <li>Learning loop serves a matched lesson → CPD auto-logs.</li>
        <li>Generate handover pack → export PDF.</li>
        <li>Admin sees firm-wide compliance + continuity risk.</li>
      </ol>
    )
  },
  {
    kicker: "06 · Why this wins",
    title: "One platform. One memory graph. One affordable price.",
    body: (
      <p>
        Advisors keep their clients. Firms stop losing relationships when staff turn over.
        Partners get a compliance-grade view. Built mobile-first for the SEA reality.
      </p>
    )
  }
];

export default function PitchPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div className="text-sm opacity-60">Compass · pitch deck</div>
        <Link href="/" className="text-sm text-compass-accent">← back to app</Link>
      </div>
      <div className="space-y-6">
        {slides.map((s, i) => (
          <section
            key={i}
            className="bg-white rounded-2xl shadow-sm p-10 print-card break-inside-avoid"
            style={{ pageBreakAfter: "always" }}
          >
            <div className="text-xs uppercase tracking-[0.2em] opacity-50">{s.kicker}</div>
            <h2 className="text-3xl font-semibold mt-2 leading-tight">{s.title}</h2>
            <div className="text-sm opacity-80 mt-4 leading-relaxed max-w-2xl">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
