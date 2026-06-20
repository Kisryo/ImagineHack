import { NextResponse } from "next/server";
import { extractNote } from "@/lib/ai";

export async function POST(req: Request) {
  const { raw_note } = (await req.json()) as { raw_note?: string };
  if (!raw_note) return NextResponse.json({ error: "raw_note required" }, { status: 400 });
  const extracted = await extractNote(raw_note);
  return NextResponse.json(extracted);
}
