import Link from "next/link";
import { listClients } from "@/lib/data";

export default async function ClientsPage() {
  const clients = await listClients();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {clients.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`} className="block p-4 hover:bg-compass-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs opacity-60">{c.profile}</div>
              </div>
              <div className="text-xs opacity-60">{c.lastInteraction}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
