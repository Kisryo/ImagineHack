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
