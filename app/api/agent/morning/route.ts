import { NextResponse } from "next/server";
import { runBriefingAgent } from "@/lib/agents/briefing-agent";

export const maxDuration = 60;

export async function GET() {
  const run = await runBriefingAgent();
  return NextResponse.json(run);
}

export async function POST() {
  const run = await runBriefingAgent();
  return NextResponse.json(run);
}
