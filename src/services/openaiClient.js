const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function buildPrompt(client) {
  const payload = {
    name: client.name,
    segment: client.segment,
    tier: client.tier,
    tierDescription: client.tierDescription,
    age: client.age,
    occupation: client.occupation,
    location: client.location,
    assets: client.assets,
    annualPremium: client.annualPremium,
    policyValue: client.policyValue,
    opportunityValue: client.opportunityValue,
    referralPotential: client.referralPotential,
    engagementUrgency: client.engagementUrgency,
    careUrgency: client.careUrgency,
    relationshipImportance: client.relationshipImportance,
    valueScore: client.valueScore,
    prioritySignals: client.prioritySignals,
    needs: client.needs,
    personality: client.personality,
    interests: client.interests,
    preferredChannel: client.preferredChannel,
    preferredTone: client.preferredTone,
    birthday: client.birthday,
    lifeEvent: client.lifeEvent,
    relationshipNotes: client.relationshipNotes,
    memory: client.memory,
    timeline: client.timeline,
    consentStatus: client.consentStatus,
  };

  const system = [
    "You are a senior financial-advisor relationship coach. Read every detail in the client record",
    "and produce a rich behavioural profile so the advisor can tailor Telegram outreach, gifts and",
    "conversation hooks. The advisor needs depth: focus heavily on PERSONALITY and INTERESTS, with",
    "concrete inferences drawn from the timeline, memory list, life events and notes, not just",
    "restating the seed fields.",
    "",
    "Reply ONLY with valid minified JSON. No markdown. Schema:",
    "{",
    '  "detailedSummary": string,',
    '  "personalityTraits": string[],',
    '  "coreMotivations": string[],',
    '  "inferredInterests": [ {"interest": string, "evidence": string} ],',
    '  "lifestyleSignals": string[],',
    '  "communicationStyle": string,',
    '  "toneGuidance": string,',
    '  "topicHooks": string[],',
    '  "doList": string[],',
    '  "avoidList": string[],',
    '  "giftIdeas": string[],',
    '  "telegramMessageSuggestion": string',
    "}",
    "",
    "Rules: never invent financial advice, product names or numeric figures. Keep evidence quotes",
    "short. Be specific, warm, and consent-safe.",
  ].join(" \n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `Client record:\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

function buildTailoredMessagePrompt({ client, profile, context }) {
  const compactProfile = {
    detailedSummary: profile?.detailedSummary,
    personalityTraits: profile?.personalityTraits,
    coreMotivations: profile?.coreMotivations,
    inferredInterests: profile?.inferredInterests,
    communicationStyle: profile?.communicationStyle,
    toneGuidance: profile?.toneGuidance,
    topicHooks: profile?.topicHooks,
    doList: profile?.doList,
    avoidList: profile?.avoidList,
  };

  const clientSeed = {
    name: client.name,
    preferredTone: client.preferredTone,
    preferredChannel: client.preferredChannel,
    lifeEvent: client.lifeEvent,
    prioritySignals: client.prioritySignals,
    consentStatus: client.consentStatus,
  };

  const sensitive = context?.caseSensitivity === "sensitive";
  const productToPlug = !sensitive ? context?.productHook : null;

  const modeBlock = sensitive
    ? [
        "MODE: SENSITIVE CASE (caring only).",
        "- Today's case is sensitive (e.g. missed premium, lapse, accident, bereavement, illness,",
        "  hospitalization, service complaint, or compliance hold). DO NOT plug or mention any",
        "  product, plan, review, upgrade, or sales line.",
        "- Write a short, human, empathetic check-in. Acknowledge the situation gently. Offer to",
        "  help if and when the client is ready.",
        "- No call-to-action that asks for a meeting to discuss products. A simple 'I'm here if",
        "  you need anything' is enough.",
      ].join(" \n")
    : [
        "MODE: NEUTRAL/POSITIVE CASE (caring + subtle product hook allowed).",
        productToPlug
          ? `- After the personal/caring opening, weave in ONE subtle, optional suggestion based on this product hook: "${productToPlug}". Phrase it as an invitation, not a pitch (e.g. "when you have a moment, I'd love to walk you through ...").`
          : "- After the personal/caring opening, you may offer a light next-step suggestion based on today's case. Keep it as an invitation, not a pitch.",
        "- Lead with the warm, personal acknowledgement first. The product line should feel like",
        "  a natural P.S., not the headline.",
        "- Never use guaranteed-return language, never invent product names beyond the hook above.",
      ].join(" \n");

  const careMomentSummary = context?.careMoment
    ? `${context.careMoment.type} - ${context.careMoment.title}${context.careMoment.reason ? ` (${context.careMoment.reason})` : ""}`
    : "general relationship check-in";

  const system = [
    "You are a senior financial advisor writing a Telegram message that the advisor will review",
    "before sending. Take the AI behavioural profile (personality, tone, hooks, do/avoid) AND",
    "today's case context, and write ONE tailored message that feels personal, warm and",
    "consent-safe.",
    "",
    `PRIMARY SUBJECT OF THIS MESSAGE: ${careMomentSummary}`,
    "The body MUST be written specifically about this care moment. Do not drift into unrelated",
    "topic hooks just because they appear in the profile.",
    "",
    modeBlock,
    "",
    "Reply ONLY with valid minified JSON. Schema:",
    '{ "subject": string, "body": string, "tailoredFrom": string[], "guardrails": string[], "momentTopicHooks": string[], "mode": "sensitive" | "neutral" }',
    "",
    "Common rules:",
    "- The body must be ABOUT the primary subject above. It is the reason for this message.",
    "- Use a topic hook from the profile ONLY if it directly relates to the primary subject.",
    "  If no hook fits, do NOT force one in - keep the message focused on the moment itself.",
    "- For generic care moments (e.g. 'Relationship touchpoint overdue', 'Care rhythm'), focus",
    "  on the relationship gap itself: acknowledge the time since last contact, express genuine",
    "  interest in how the client is doing, suggest a casual check-in. Don't latch onto an",
    "  unrelated life event.",
    "- Match the tone guidance and personality. No invented figures, no guaranteed-outcome",
    "  language. Respect the avoidList. Stay inside doList.",
    "- 'tailoredFrom' = 2-4 short bullets naming which profile signals shaped the message",
    '  (e.g. "Tone guidance: warm and concise", "Care moment: Relationship touchpoint overdue",',
    '  "Mode: sensitive, no product mention"). The PRIMARY SUBJECT must appear in this list.',
    "- 'momentTopicHooks' = 3-4 short conversational hooks (under 10 words each) that are",
    "  SPECIFIC TO THIS CARE MOMENT and would make a follow-up call/message feel natural.",
    "  Examples for 'Relationship touchpoint overdue': 'Ask how the family has been',",
    "  'Confirm preferred contact day/time', 'Offer a low-pressure 15-min coffee catch-up'.",
    "  These should NOT just repeat the profile's static topic hooks - derive them from the",
    "  moment's intent.",
    "- 'mode' must echo the MODE you followed above so the UI can verify.",
    "- Keep body under ~120 words. Use line breaks between paragraphs.",
  ].join(" \n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        `Client seed:\n${JSON.stringify(clientSeed, null, 2)}`,
        `AI behavioural profile:\n${JSON.stringify(compactProfile, null, 2)}`,
        `Today's case:\n${JSON.stringify(context, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export async function generateTailoredTelegramMessage({ client, profile, context }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY. Add it to .env.local and restart the dev server.");
  }
  if (!profile) {
    throw new Error("Generate the AI behavioural profile first so the message can be tailored.");
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: buildTailoredMessagePrompt({ client, profile, context }),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }
}

export async function generateClientProfile(client) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY. Add it to .env.local and restart the dev server.");
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: buildPrompt(client),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }
}
