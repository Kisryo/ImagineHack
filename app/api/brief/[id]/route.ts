import { NextResponse } from "next/server";
import { askClient } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const answer = await askClient(
    params.id,
    "Brief me on this client in 5 bullet points: who they are, how they think, what to avoid, open commitments, and the right opening line for our next meeting."
  );
  return NextResponse.json({ briefing: answer });
}
