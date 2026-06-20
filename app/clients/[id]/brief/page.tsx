import Link from "next/link";
import { askClient, getClient } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function BriefPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  if (!client) notFound();
  const briefing = await askClient(
    params.id,
    "Brief me on this client in 5 bullet points: who they are, how they think, what to avoid today, open commitments, and the right opening line for our meeting."
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="text-sm">
        <Link href="/" className="text-compass-accent">← Today's briefings</Link>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-3">
        <div className="text-xs uppercase tracking-wide opacity-60">Pre-meeting briefing</div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="text-sm opacity-70">{client.profile}</p>
        <div className="border-t pt-4 text-sm whitespace-pre-wrap leading-relaxed">{briefing}</div>
      </div>
      <div className="flex gap-2">
        <Link href={`/clients/${client.id}`} className="border text-sm px-3 py-2 rounded-lg">Open client</Link>
        <Link href={`/notes/new?client=${client.id}`} className="bg-compass-accent text-white text-sm px-3 py-2 rounded-lg">
          + Log post-meeting note
        </Link>
      </div>
    </div>
  );
}
