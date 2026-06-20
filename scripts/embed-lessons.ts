/**
 * One-off: backfill embeddings on learning_content + interactions.
 * Run with: npx tsx scripts/embed-lessons.ts
 */
import "dotenv/config";
import { embed } from "../lib/ai";
import { supabaseAdmin } from "../lib/supabase";

async function main() {
  if (!supabaseAdmin) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY first.");

  const { data: lessons } = await supabaseAdmin
    .from("learning_content")
    .select("id, title, topic, body")
    .is("embedding", null);

  for (const l of lessons ?? []) {
    const v = await embed(`${l.title}\n${l.topic ?? ""}\n${l.body ?? ""}`);
    await supabaseAdmin.from("learning_content").update({ embedding: v }).eq("id", l.id);
    console.log("embedded lesson", l.title);
  }

  const { data: notes } = await supabaseAdmin
    .from("interactions")
    .select("id, summary, relational, topics")
    .is("embedding", null);

  for (const n of notes ?? []) {
    const text = [n.summary, ...(n.topics ?? []), ...(n.relational ?? [])].join(" ");
    const v = await embed(text);
    await supabaseAdmin.from("interactions").update({ embedding: v }).eq("id", n.id);
    console.log("embedded interaction", n.id);
  }

  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
