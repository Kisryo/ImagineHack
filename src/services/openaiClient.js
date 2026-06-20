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
    "concrete inferences drawn from the timeline, memory list, life events and notes — not just",
    "restating the seed fields.",
    "",
    "Reply ONLY with valid minified JSON. No markdown. Schema:",
    "{",
    '  "detailedSummary": string,                  // 5-7 sentence narrative. Lead with personality.',
    '                                              // Weave in lifestyle, family context, motivations',
    '                                              // and how they like to be engaged. No figures.',
    '  "personalityTraits": string[],              // 5-7 short traits, each <= 6 words',
    '  "coreMotivations": string[],                // 3-5 what drives them (legacy, control, status...)',
    '  "inferredInterests": [ {"interest": string, "evidence": string} ], // 5-7 items with cited evidence',
    '  "lifestyleSignals": string[],               // 3-5 observable habits / routines / context',
    '  "communicationStyle": string,               // 1-2 sentences on how they like to be spoken to',
    '  "toneGuidance": string,                     // explicit tone direction for Telegram drafting',
    '  "topicHooks": string[],                     // 4-6 conversation starters tailored to them',
    '  "doList": string[],                         // 3-5 do behaviours',
    '  "avoidList": string[],                      // 3-5 things to avoid',
    '  "giftIdeas": string[],                      // 3-5 personalised gift / care moment ideas',
    '  "telegramMessageSuggestion": string         // <= 350 chars, warm, concise, no advice/figures',
    "}",
    "",
    "Rules: never invent financial advice, product names or numeric figures. Keep evidence quotes",
    "short. Be specific — 'enjoys Saturday golf at Saujana' beats 'likes sport'.",
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
