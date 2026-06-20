// LLM extraction + retrieval. Uses Anthropic if ANTHROPIC_API_KEY is set,
// otherwise falls back to a deterministic stub so the demo always runs.

import Anthropic from "@anthropic-ai/sdk";

export type Extracted = {
  summary: string;
  commitments: string[];
  sensitivities: string[];
  relational: string[];
  topics: string[];
  partner_mentions: string[];
};

const EXTRACT_SYSTEM = `You are Compass, an extractor for advisory firm client notes.
Return STRICT JSON with these keys and nothing else:
  summary (string, <= 240 chars, neutral past tense),
  commitments (string[]),
  sensitivities (string[] — things to avoid or be careful of),
  relational (string[] — BEHAVIOURAL signals a CRM never holds: tone, triggers, preferences, trust state, communication style. THIS IS THE MOST IMPORTANT FIELD.),
  topics (string[] — concise topical tags for gap detection, e.g. "estate planning", "ESG"),
  partner_mentions (string[] — names of external partners like accountants/lawyers).
Never include identity data (IC numbers, account numbers). Output JSON only.`;

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MODEL = "claude-opus-4-7";

export async function extractNote(rawNote: string): Promise<Extracted> {
  if (!client) return heuristicExtract(rawNote);

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: rawNote }]
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  try {
    const json = text.replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(json) as Extracted;
    return {
      summary: parsed.summary ?? rawNote.slice(0, 240),
      commitments: parsed.commitments ?? [],
      sensitivities: parsed.sensitivities ?? [],
      relational: parsed.relational ?? [],
      topics: parsed.topics ?? [],
      partner_mentions: parsed.partner_mentions ?? []
    };
  } catch {
    return heuristicExtract(rawNote);
  }
}

export async function answerOverNotes(
  question: string,
  notes: { date: string; summary: string; relational?: string[] }[]
): Promise<string> {
  if (!client || notes.length === 0) {
    return notes.length
      ? `Based on ${notes.length} notes: ${notes[0].summary}`
      : "No notes available for this client yet.";
  }
  const context = notes
    .map((n, i) => `[Note ${i + 1} · ${n.date}] ${n.summary}${n.relational?.length ? ` · relational: ${n.relational.join("; ")}` : ""}`)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      "You are Compass. Answer the advisor's question using ONLY the provided notes. Cite which note number supports each claim. If the notes don't cover it, say so plainly.",
    messages: [{ role: "user", content: `Notes:\n${context}\n\nQuestion: ${question}` }]
  });

  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function embed(text: string): Promise<number[]> {
  if (!openai) return new Array(1536).fill(0);
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return res.data[0].embedding;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function heuristicExtract(raw: string): Extracted {
  const lower = raw.toLowerCase();
  const relational: string[] = [];
  const sensitivities: string[] = [];
  const topics: string[] = [];

  if (/lit up|engaged|warm|excited/.test(lower)) relational.push("Engages warmly on family/protection topics");
  if (/shut down|defensive|reluctant|pulled back/.test(lower)) relational.push("Pulls back when pushed too hard");
  if (/afternoon|after lunch/.test(lower)) relational.push("Prefers afternoon meetings");
  if (/whatsapp|text/.test(lower)) relational.push("Texts in short bursts");
  if (/sore|burnt|burned|past|2022|previous/.test(lower)) sensitivities.push("Carries a past grievance — handle with care");
  if (/estate/.test(lower)) topics.push("estate planning");
  if (/insurance/.test(lower)) topics.push("insurance");
  if (/esg|sustainable/.test(lower)) topics.push("ESG");
  if (/tax|accountant/.test(lower)) topics.push("tax");

  return {
    summary: raw.slice(0, 240),
    commitments: [],
    sensitivities,
    relational,
    topics,
    partner_mentions: /lim|accountant/.test(lower) ? ["Lim & Co (accountant)"] : []
  };
}
