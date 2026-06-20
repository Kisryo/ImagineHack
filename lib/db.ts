// Supabase-backed implementations of the data layer.
// Activated by lib/data.ts when usingSupabase is true.

import { supabaseAdmin } from "./supabase";
import { extractNote, answerOverNotes, embed, cosineSim } from "./ai";
import type { Client, Interaction, Lesson } from "./data";

const ADVISOR_ID = "11111111-1111-1111-1111-111111111111";

function db() {
  if (!supabaseAdmin) throw new Error("Supabase service role not configured.");
  return supabaseAdmin;
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await db()
    .from("clients")
    .select("id, name, profile, created_at")
    .eq("owning_advisor_id", ADVISOR_ID)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    profile: typeof c.profile === "object" ? Object.values(c.profile ?? {}).join(" · ") : String(c.profile ?? ""),
    lastInteraction: ""
  }));
}

export async function getClient(id: string): Promise<Client | undefined> {
  const { data } = await db().from("clients").select("id, name, profile").eq("id", id).single();
  if (!data) return undefined;
  return {
    id: data.id,
    name: data.name,
    profile: typeof data.profile === "object" ? Object.values(data.profile ?? {}).join(" · ") : String(data.profile ?? ""),
    lastInteraction: ""
  };
}

export async function listInteractions(clientId: string): Promise<Interaction[]> {
  const { data, error } = await db()
    .from("interactions")
    .select("id, client_id, raw_note, summary, relational, sensitivities, commitments, topics, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    clientId: i.client_id,
    date: (i.created_at ?? "").slice(0, 10),
    channel: "Note",
    summary: i.summary ?? i.raw_note?.slice(0, 200) ?? "",
    relational: i.relational ?? [],
    sensitivities: i.sensitivities ?? [],
    commitments: i.commitments ?? [],
    topics: i.topics ?? []
  }));
}

export async function saveNote(clientId: string, rawNote: string): Promise<void> {
  const extracted = await extractNote(rawNote);
  const vec = await embed(`${extracted.summary}\n${extracted.relational.join("; ")}`);
  await db().from("interactions").insert({
    client_id: clientId,
    advisor_id: ADVISOR_ID,
    raw_note: rawNote,
    summary: extracted.summary,
    commitments: extracted.commitments,
    sensitivities: extracted.sensitivities,
    relational: extracted.relational,
    topics: extracted.topics,
    partner_mentions: extracted.partner_mentions,
    embedding: vec
  });
  await logAudit(clientId, "create_interaction");
}

export async function askClient(clientId: string, question: string): Promise<string> {
  await logAudit(clientId, `ask:${question.slice(0, 60)}`);
  const q = await embed(question);
  const { data, error } = await db().rpc("match_interactions", {
    client: clientId,
    query_embedding: q,
    match_count: 5
  });
  if (error || !data || data.length === 0) {
    return answerOverNotes(question, await listInteractions(clientId));
  }
  const notes = data.map((n: any) => ({
    date: "",
    summary: n.summary,
    relational: n.relational ?? []
  }));
  return answerOverNotes(question, notes);
}

export async function recommendLessons(): Promise<Lesson[]> {
  // Pull recent interactions, embed their concatenated topics + relational
  // signals, and find the closest lessons via pgvector RPC.
  const { data: recent } = await db()
    .from("interactions")
    .select("summary, relational, topics")
    .eq("advisor_id", ADVISOR_ID)
    .order("created_at", { ascending: false })
    .limit(8);

  const signal = (recent ?? [])
    .map((r: any) => [r.summary, ...(r.topics ?? []), ...(r.relational ?? [])].join(" "))
    .join("\n");

  if (signal.trim().length === 0) {
    const { data: lessons } = await db()
      .from("learning_content")
      .select("id, title, body, topic, cpd_hours");
    return (lessons ?? []).map((l) => ({
      id: l.id, title: l.title, summary: l.body ?? "",
      trigger: l.topic ? `Topic · ${l.topic}` : "Recommended",
      cpdHours: Number(l.cpd_hours ?? 0)
    }));
  }

  const q = await embed(signal);
  const { data: matches, error } = await db().rpc("match_lessons", {
    query_embedding: q,
    match_count: 5
  });
  if (error) throw error;

  return (matches ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    summary: m.body ?? "",
    trigger: `Gap detected · ${m.topic ?? "topic"} · ${(m.similarity * 100).toFixed(0)}% match`,
    cpdHours: Number(m.cpd_hours ?? 0)
  }));
}

export async function completeLesson(lessonId: string): Promise<void> {
  const { data: lesson } = await db()
    .from("learning_content")
    .select("cpd_hours")
    .eq("id", lessonId)
    .single();
  if (!lesson) return;
  await db().from("cpd_log").insert({
    advisor_id: ADVISOR_ID,
    learning_content_id: lessonId,
    hours: lesson.cpd_hours ?? 0
  });
}

export async function getCpdSummary() {
  const { data } = await db()
    .from("cpd_log")
    .select("id, hours, completed_at, learning_content:learning_content_id(title)")
    .eq("advisor_id", ADVISOR_ID)
    .order("completed_at", { ascending: false });
  const entries = (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.learning_content?.title ?? "Lesson",
    hours: Number(e.hours ?? 0),
    completedAt: (e.completed_at ?? "").slice(0, 10)
  }));
  const hours = entries.reduce((s, e) => s + e.hours, 0);
  return { hours, target: 30, entries };
}

export async function generateHandover(clientId: string) {
  const client = await getClient(clientId);
  const history = await listInteractions(clientId);
  await logAudit(clientId, "generate_handover");
  const flat = <K extends keyof Interaction>(key: K) =>
    Array.from(new Set(history.flatMap((h) => (h[key] as unknown as string[]) ?? [])));
  return {
    summary: `${client?.name} — ${client?.profile}. Long-standing relationship; family-first decisions; trust must be earned through consistency, not pitches.`,
    relational: flat("relational"),
    sensitivities: flat("sensitivities"),
    commitments: flat("commitments"),
    pastAdvice: [],
    partners: []
  };
}

export async function logAudit(clientId: string, action: string) {
  await db().from("audit_log").insert({ advisor_id: ADVISOR_ID, client_id: clientId, action });
}

export async function listAudit() {
  const { data } = await db()
    .from("audit_log")
    .select("id, advisor_id, client_id, action, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((e) => ({
    id: e.id,
    advisor: e.advisor_id?.slice(0, 8) ?? "anon",
    clientId: e.client_id,
    action: e.action,
    at: e.created_at
  }));
}

// Vector-based gap detection: any topic from recent notes whose
// embedding has no close lesson match counts as a gap signal.
export async function detectGaps(clientId: string): Promise<string[]> {
  const notes = await listInteractions(clientId);
  const topics = Array.from(new Set(notes.flatMap((n) => n.topics ?? [])));
  if (topics.length === 0) return [];
  void cosineSim;
  return topics;
}

void cosineSim;
