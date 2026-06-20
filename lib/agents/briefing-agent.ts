// Morning Briefing Agent — runs autonomously over today's calendar and
// produces a per-meeting briefing using the Compass memory graph as tools.

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { tools } from "./tools";
import { todaysMeetings } from "@/lib/calendar";
import { getMeetingCoach, listCommitments } from "@/lib/data";

export type MeetingBriefing = {
  clientId: string;
  clientName: string;
  time: string;
  safe: string[];
  avoid: string[];
  explore: string[];
  openingLine: string;
  alerts: string[];
};

export type AgentRun = {
  startedAt: string;
  finishedAt: string;
  steps: number;
  toolCalls: { name: string; args: unknown }[];
  briefings: MeetingBriefing[];
  rationale: string;
};

const SYSTEM = `You are Compass's Morning Briefing Agent.

Your job: every weekday morning, prepare a per-meeting briefing for the advisor.

Process you MUST follow:
1. Call getTodaysMeetings to discover today's meetings.
2. For EACH meeting, call getMeetingCoach(clientId) to get safe/avoid/explore signals.
3. For EACH meeting, call askAboutClient with the question
   "What is the right opening line for our meeting today, given everything you know about this person?"
   to draft an opening line grounded in their notes.
4. Optionally call listOpenCommitments to flag overdue items.
5. Once you have data for ALL meetings, STOP calling tools and return your final
   JSON in this exact shape:

{
  "briefings": [
    {
      "clientId": "...",
      "clientName": "...",
      "time": "HH:MM",
      "safe": ["..."],
      "avoid": ["..."],
      "explore": ["..."],
      "openingLine": "...",
      "alerts": ["..."]
    }
  ],
  "rationale": "1-2 sentences on what you noticed across today's roster."
}

Rules:
- Output ONLY the JSON object as your final answer. No prose, no markdown fences.
- Keep each list to at most 3 items.
- "alerts" should flag overdue commitments or churn signals; empty array if none.
- Be concrete. No platitudes. No hedging.`;

export async function runBriefingAgent(): Promise<AgentRun> {
  const startedAt = new Date().toISOString();
  const toolCalls: { name: string; args: unknown }[] = [];

  if (!process.env.ANTHROPIC_API_KEY) return heuristicRun(startedAt);


  const result = await generateText({
    model: anthropic("claude-opus-4-7"),
    system: SYSTEM,
    prompt: "Prepare today's briefings.",
    tools,
    maxSteps: 12,
    onStepFinish: ({ toolCalls: calls }) => {
      for (const c of calls ?? []) toolCalls.push({ name: c.toolName, args: c.args });
    }
  });

  const finishedAt = new Date().toISOString();
  const text = (result.text ?? "").replace(/^```json\s*|\s*```$/g, "").trim();

  let parsed: { briefings: MeetingBriefing[]; rationale: string };
  try { parsed = JSON.parse(text); }
  catch { parsed = { briefings: [], rationale: text || "Agent returned unparseable output." }; }

  return {
    startedAt,
    finishedAt,
    steps: result.steps?.length ?? 0,
    toolCalls,
    briefings: parsed.briefings ?? [],
    rationale: parsed.rationale ?? ""
  };
}

async function heuristicRun(startedAt: string): Promise<AgentRun> {
  const meetings = await todaysMeetings();
  const commitments = await listCommitments();
  const toolCalls: { name: string; args: unknown }[] = [
    { name: "getTodaysMeetings", args: {} }
  ];

  const briefings: MeetingBriefing[] = [];
  for (const m of meetings) {
    toolCalls.push({ name: "getMeetingCoach", args: { clientId: m.clientId } });
    const coach = await getMeetingCoach(m.clientId);
    const open = commitments.filter((c) => c.clientId === m.clientId).map((c) => c.text);
    briefings.push({
      clientId: m.clientId,
      clientName: m.clientName,
      time: m.time,
      safe: coach.safe.slice(0, 3),
      avoid: coach.avoid.slice(0, 3),
      explore: coach.explore.slice(0, 3),
      openingLine: openingLineFor(m.clientName, coach.safe[0]),
      alerts: open.length > 0 ? [`Open commitment: ${open[0]}`] : []
    });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    steps: 1 + meetings.length,
    toolCalls,
    briefings,
    rationale: `Prepared ${briefings.length} briefings. ${briefings.filter((b) => b.alerts.length > 0).length} have open commitments to follow up.`
  };
}

function openingLineFor(name: string, safeTopic?: string) {
  const first = name.split(" ")[0];
  if (safeTopic) return `Open with ${first.toLowerCase()}'s ${safeTopic.toLowerCase()} — that's their warm zone.`;
  return `Open warmly with ${first} — keep it personal before pivoting to business.`;
}
