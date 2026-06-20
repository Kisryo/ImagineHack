// Tools the Compass agents can call. Thin wrappers over lib/data.ts so the
// agent has a clean, typed interface to the firm's memory graph.

import { tool } from "ai";
import { z } from "zod";
import {
  askClient,
  getClient,
  getMeetingCoach,
  listCommitments,
  listInteractions
} from "@/lib/data";
import { todaysMeetings } from "@/lib/calendar";

export const tools = {
  getTodaysMeetings: tool({
    description: "Get the advisor's meetings for today, including clientId, time, channel and topic.",
    parameters: z.object({}),
    execute: async () => todaysMeetings()
  }),

  getClient: tool({
    description: "Get a single client's profile by clientId.",
    parameters: z.object({ clientId: z.string() }),
    execute: async ({ clientId }) => (await getClient(clientId)) ?? null
  }),

  listClientNotes: tool({
    description: "List all interaction notes for a client (most recent first).",
    parameters: z.object({ clientId: z.string() }),
    execute: async ({ clientId }) => listInteractions(clientId)
  }),

  getMeetingCoach: tool({
    description: "Get the traffic-light coach (safe / avoid / explore) for a specific client.",
    parameters: z.object({ clientId: z.string() }),
    execute: async ({ clientId }) => getMeetingCoach(clientId)
  }),

  askAboutClient: tool({
    description: "Run a RAG-grounded question over a client's notes and return an answer with citations.",
    parameters: z.object({ clientId: z.string(), question: z.string() }),
    execute: async ({ clientId, question }) => ({ answer: await askClient(clientId, question) })
  }),

  listOpenCommitments: tool({
    description: "Return every open commitment the advisor has made to clients.",
    parameters: z.object({}),
    execute: async () => listCommitments()
  })
};

export type AgentTools = typeof tools;
