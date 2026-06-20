import { supabase } from "./supabaseClient.js";

export async function loadAdvisorTodayData() {
  if (!supabase) {
    return {
      actionSuggestions: [],
      error: "Supabase env vars are not configured.",
      priorityQueue: [],
    };
  }

  const [priorityResult, suggestionsResult] = await Promise.all([
    supabase
      .from("client_priority_queue")
      .select("*")
      .order("priority_score", { ascending: false }),
    supabase
      .from("daily_action_suggestions")
      .select("*")
      .order("priority_score", { ascending: false })
      .order("event_date", { ascending: true }),
  ]);

  const error = priorityResult.error || suggestionsResult.error;

  return {
    actionSuggestions: suggestionsResult.data ?? [],
    error: error?.message ?? null,
    priorityQueue: priorityResult.data ?? [],
  };
}
