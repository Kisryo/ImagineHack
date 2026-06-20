import { getClient, generateHandover } from "@/lib/data";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";

export default async function HandoverPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  if (!client) notFound();
  const pack = await generateHandover(params.id);

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl p-6 shadow-sm space-y-6 print-card">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-60">Handover pack</div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm opacity-70">Generated for the inheriting advisor — reads like a relationship briefing, not a data dump.</p>
        </div>
        <PrintButton />
      </header>

      <Section title="Who they are">
        <p className="text-sm">{pack.summary}</p>
      </Section>

      <Section title="How to work with them">
        <ul className="text-sm space-y-1 list-disc pl-5">
          {pack.relational.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </Section>

      <Section title="Sensitivities — what to avoid">
        <ul className="text-sm space-y-1 list-disc pl-5">
          {pack.sensitivities.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </Section>

      <Section title="Past advice & reasoning">
        <ul className="text-sm space-y-2">
          {pack.pastAdvice.map((p, i) => (
            <li key={i}>
              <div className="font-medium">{p.title}</div>
              <div className="opacity-70">{p.reasoning}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Open commitments">
        <ul className="text-sm space-y-1 list-disc pl-5">
          {pack.commitments.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </Section>

      <Section title="Partner contacts">
        <ul className="text-sm space-y-1 list-disc pl-5">
          {pack.partners.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide opacity-60 mb-1">{title}</h2>
      {children}
    </section>
  );
}
