// Data layer. When Supabase env vars are set we delegate to lib/db.ts;
// otherwise we serve seeded in-memory data so the demo always runs.

import { extractNote, answerOverNotes } from "./ai";
import { usingSupabase } from "./supabase";
import * as db from "./db";

export type Client = {
  id: string;
  name: string;
  profile: string;
  lastInteraction: string;
};

export type Interaction = {
  id: string;
  clientId: string;
  date: string;
  channel: string;
  summary: string;
  relational: string[];
  sensitivities: string[];
  commitments: string[];
  topics?: string[];
};

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  trigger: string;
  cpdHours: number;
  completed?: boolean;
};

const clients: Client[] = [
  {
    id: "wong-family",
    name: "Wong Family",
    profile: "Multi-generational household · KL · advisory since 2019",
    lastInteraction: "2 days ago"
  },
  {
    id: "tan-li-hua",
    name: "Tan Li Hua",
    profile: "SME owner · Penang · cautious, tax-focused",
    lastInteraction: "1 week ago"
  },
  {
    id: "rajesh-menon",
    name: "Rajesh Menon",
    profile: "Pre-retiree · KL · estate planning in progress",
    lastInteraction: "3 weeks ago"
  }
];

const interactions: Interaction[] = [
  {
    id: "i1",
    clientId: "wong-family",
    date: "2026-06-18",
    channel: "Coffee meeting",
    summary: "Discussed daughter's education insurance. Engaged warmly; pulled back when estate planning came up.",
    relational: ["Lights up on family/insurance topics", "Shuts down on estate planning", "Prefers afternoon meetings"],
    sensitivities: ["2022 trust recommendation still a sore point — do not re-pitch the same structure"],
    commitments: ["Send education plan options by Friday"],
    topics: ["insurance", "estate planning"]
  },
  {
    id: "i2",
    clientId: "wong-family",
    date: "2026-05-30",
    channel: "WhatsApp",
    summary: "Quick check-in on portfolio. Asked about sustainable funds — first time he raised ESG.",
    relational: ["Texts in short bursts late evening", "Responds best to concrete numbers, not concepts"],
    sensitivities: [],
    commitments: ["Share two ESG fund factsheets"],
    topics: ["ESG", "portfolio"]
  },
  {
    id: "i3",
    clientId: "wong-family",
    date: "2026-04-12",
    channel: "Office",
    summary: "Annual review. Confirmed risk profile unchanged. Mentioned partner accountant Lim — wants tighter tax coordination.",
    relational: ["Defers to wife on lifestyle decisions", "Trusts referrals over cold pitches"],
    sensitivities: [],
    commitments: ["Loop in partner accountant Lim by next quarter"],
    topics: ["tax", "annual review"]
  }
];

const lessons: Lesson[] = [
  {
    id: "l1",
    title: "Estate planning conversations with reluctant clients",
    summary: "Reframe estate planning around protection and family continuity, not death and legal mechanics.",
    trigger: "Wong family · estate-planning resistance detected across 3 notes",
    cpdHours: 1.5
  },
  {
    id: "l2",
    title: "ESG fund basics for SEA portfolios",
    summary: "What ESG actually means in practice for Malaysian advisory clients, with two-paragraph talking points.",
    trigger: "Wong family · first ESG mention",
    cpdHours: 1
  },
  {
    id: "l3",
    title: "Coordinating with external accountants",
    summary: "Clean handoffs with partner accountants without losing client trust or visibility.",
    trigger: "Multi-client signal · partner-accountant mentions",
    cpdHours: 0.5
  }
];

type CpdEntry = { id: string; title: string; hours: number; completedAt: string };
const cpdEntries: CpdEntry[] = [
  { id: "c1", title: "Behavioural finance in client reviews", hours: 2, completedAt: "2026-06-10" },
  { id: "c2", title: "Trust structures refresher", hours: 1.5, completedAt: "2026-05-22" },
  { id: "c3", title: "AML red flags for SME owners", hours: 1, completedAt: "2026-05-05" }
];

type AuditEntry = { id: string; advisor: string; clientId: string; action: string; at: string };
const auditLog: AuditEntry[] = [];

export async function logAudit(clientId: string, action: string) {
  auditLog.push({
    id: `a${Date.now()}`,
    advisor: "aisyah",
    clientId,
    action,
    at: new Date().toISOString()
  });
}

export async function listAudit(): Promise<AuditEntry[]> {
  return auditLog.slice(-50).reverse();
}

export async function listClients(): Promise<Client[]> {
  if (usingSupabase) return db.listClients();
  return clients;
}

export async function getClient(id: string): Promise<Client | undefined> {
  if (usingSupabase) return db.getClient(id);
  return clients.find((c) => c.id === id);
}

export async function listInteractions(clientId: string): Promise<Interaction[]> {
  if (usingSupabase) return db.listInteractions(clientId);
  await logAudit(clientId, "view_client_timeline");
  return interactions
    .filter((i) => i.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveNote(clientId: string, rawNote: string): Promise<void> {
  if (usingSupabase) return db.saveNote(clientId, rawNote);
  const extracted = await extractNote(rawNote);
  interactions.unshift({
    id: `i${Date.now()}`,
    clientId,
    date: new Date().toISOString().slice(0, 10),
    channel: "Note",
    summary: extracted.summary,
    relational: extracted.relational,
    sensitivities: extracted.sensitivities,
    commitments: extracted.commitments,
    topics: extracted.topics
  });
  await logAudit(clientId, "create_interaction");
}

export async function askClient(clientId: string, question: string): Promise<string> {
  if (usingSupabase) return db.askClient(clientId, question);
  const notes = await listInteractions(clientId);
  await logAudit(clientId, `ask:${question.slice(0, 60)}`);
  return answerOverNotes(question, notes);
}

export async function recommendLessons(): Promise<Lesson[]> {
  if (usingSupabase) return db.recommendLessons();
  return lessons;
}

export async function completeLesson(lessonId: string): Promise<void> {
  if (usingSupabase) return db.completeLesson(lessonId);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson || lesson.completed) return;
  lesson.completed = true;
  cpdEntries.unshift({
    id: `c${Date.now()}`,
    title: lesson.title,
    hours: lesson.cpdHours,
    completedAt: new Date().toISOString().slice(0, 10)
  });
}

export async function getCpdSummary() {
  if (usingSupabase) return db.getCpdSummary();
  const hours = cpdEntries.reduce((s, e) => s + e.hours, 0);
  return { hours, target: 30, entries: cpdEntries };
}

const seedInteractions = JSON.parse(JSON.stringify(interactions)) as Interaction[];
const seedCpd = JSON.parse(JSON.stringify(cpdEntries)) as CpdEntry[];

export async function resetDemo() {
  interactions.splice(0, interactions.length, ...JSON.parse(JSON.stringify(seedInteractions)));
  cpdEntries.splice(0, cpdEntries.length, ...JSON.parse(JSON.stringify(seedCpd)));
  lessons.forEach((l) => { delete l.completed; });
  auditLog.length = 0;
}

export type MeetingCoach = {
  safe: string[];     // 🟢 topics that engage this client
  avoid: string[];    // 🔴 sensitivities and sore points
  explore: string[];  // 🟡 open commitments + recently raised topics
};

export async function getMeetingCoach(clientId: string): Promise<MeetingCoach> {
  const notes = usingSupabase
    ? await db.listInteractions(clientId)
    : interactions.filter((i) => i.clientId === clientId);

  // 🟢 Safe: positive relational signals (lights up, engages, warms)
  const safe = Array.from(new Set(
    notes.flatMap((n) => n.relational ?? [])
      .filter((r) => /light|engage|warm|excite|open|positive|comfort|family|love/i.test(r))
  )).slice(0, 5);

  // 🔴 Avoid: every sensitivity + relational signals that flag friction
  const avoid = Array.from(new Set([
    ...notes.flatMap((n) => n.sensitivities ?? []),
    ...notes.flatMap((n) => n.relational ?? [])
      .filter((r) => /shut|avoid|sore|defens|reluctan|past|burned|grievance|never/i.test(r))
  ])).slice(0, 5);

  // 🟡 Explore: open commitments + recent topics that haven't been closed
  const recentTopics = Array.from(new Set(
    notes.slice(0, 3).flatMap((n) => n.topics ?? [])
  ));
  const openCommitments = notes.flatMap((n) => n.commitments ?? []);
  const explore = Array.from(new Set([
    ...openCommitments,
    ...recentTopics.map((t) => `${t} — recently raised`)
  ])).slice(0, 5);

  return { safe, avoid, explore };
}

export async function listCommitments(): Promise<{ clientId: string; clientName: string; text: string; date: string }[]> {
  const out: { clientId: string; clientName: string; text: string; date: string }[] = [];
  for (const c of clients) {
    const notes = interactions.filter((i) => i.clientId === c.id);
    for (const n of notes) {
      for (const t of n.commitments ?? []) {
        out.push({ clientId: c.id, clientName: c.name, text: t, date: n.date });
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function generateHandover(clientId: string) {
  if (usingSupabase) return db.generateHandover(clientId);
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
    pastAdvice: [
      {
        title: "2022 family trust recommendation",
        reasoning: "Suggested to ring-fence education funding for the daughter; client felt rushed — keep it on ice."
      },
      {
        title: "Risk profile (Apr 2026)",
        reasoning: "Reconfirmed moderate. Wife defers, husband decides. Keep allocations stable through year-end."
      }
    ],
    partners: ["Lim & Co (accountant) — preferred partner for tax coordination"]
  };
}
