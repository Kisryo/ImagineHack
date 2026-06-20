import Link from "next/link";
import { askClient, getClient } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function AskPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  const client = await getClient(params.id);
  if (!client) notFound();
  const q = searchParams.q?.trim();
  const answer = q ? await askClient(params.id, q) : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-sm">
        <Link href={`/clients/${client.id}`} className="text-compass-accent">← {client.name}</Link>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ask anything about this client..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button className="bg-compass-accent text-white px-4 py-2 rounded-lg text-sm">Ask</button>
        </form>
      </div>
      {q && (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <div className="text-xs uppercase tracking-wide opacity-60">Q</div>
          <div className="text-sm font-medium">{q}</div>
          <div className="text-xs uppercase tracking-wide opacity-60 pt-2">Answer</div>
          <div className="text-sm whitespace-pre-wrap">{answer}</div>
        </div>
      )}
    </div>
  );
}
