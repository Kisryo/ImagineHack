import Link from "next/link";
import { getClient, listInteractions } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  if (!client) notFound();
  const interactions = await listInteractions(params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="text-sm opacity-70">{client.profile}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${client.id}/handover`} className="bg-compass-ink text-white text-sm px-3 py-2 rounded-lg">
            Generate handover pack
          </Link>
          <Link href={`/notes/new?client=${client.id}`} className="border border-compass-ink text-compass-ink text-sm px-3 py-2 rounded-lg">
            + New note
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-xl p-4 shadow-sm">
        <div className="text-sm font-semibold mb-2">Ask anything about {client.name.split(" ")[0]}</div>
        <form action={`/clients/${client.id}/ask`} method="GET" className="flex gap-2">
          <input
            name="q"
            placeholder="e.g. What's their stance on estate planning?"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button className="bg-compass-accent text-white px-4 py-2 rounded-lg text-sm">Ask</button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60 mb-2">Interaction timeline</h2>
        <div className="space-y-3">
          {interactions.map((i) => (
            <div key={i.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between text-xs opacity-60">
                <span>{i.date}</span>
                <span>{i.channel}</span>
              </div>
              <div className="mt-2 text-sm">{i.summary}</div>
              {i.relational?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {i.relational.map((r, k) => (
                    <span key={k} className="text-xs bg-compass-soft border rounded-full px-2 py-0.5">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
