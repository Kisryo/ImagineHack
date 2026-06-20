import { listClients, saveNote } from "@/lib/data";
import { redirect } from "next/navigation";
import { VoiceNoteInput } from "@/components/VoiceNoteInput";

export default async function NewNotePage({
  searchParams
}: { searchParams: { client?: string } }) {
  const clients = await listClients();

  async function submit(formData: FormData) {
    "use server";
    const clientId = String(formData.get("client_id"));
    const raw = String(formData.get("raw_note"));
    await saveNote(clientId, raw);
    redirect(`/clients/${clientId}`);
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl p-6 shadow-sm space-y-4">
      <h1 className="text-xl font-semibold">Log an interaction</h1>
      <p className="text-sm opacity-70">
        Compass will extract the summary, commitments, sensitivities and the relational signals a CRM never holds.
      </p>
      <form action={submit} className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wide opacity-60">Client</label>
          <select
            name="client_id"
            defaultValue={searchParams.client ?? clients[0]?.id}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide opacity-60">Raw note</label>
          <div className="mt-1">
            <VoiceNoteInput name="raw_note" />
          </div>
        </div>
        <button className="bg-compass-accent text-white px-4 py-2 rounded-lg text-sm">
          Save & extract
        </button>
      </form>
    </div>
  );
}
