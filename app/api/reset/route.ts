import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/data";

export async function POST() {
  await resetDemo();
  return NextResponse.json({ ok: true });
}
