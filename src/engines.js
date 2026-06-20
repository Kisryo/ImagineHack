const today = new Date("2026-06-20T08:00:00+08:00");

const riskWeights = {
  Low: 10,
  Medium: 24,
  High: 42,
  Critical: 60,
};

const severityWeights = {
  low: 8,
  medium: 16,
  high: 28,
};

function formatRinggit(value) {
  return `RM ${Math.round(value).toLocaleString("en-MY")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeRisk(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getClientTasks(client, tasks) {
  return tasks.filter((task) => task.clientId === client.id && task.status !== "Done");
}

function localDateString(date = today) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function daysBetween(dateString, referenceDate = today) {
  const target = new Date(`${dateString}T00:00:00+08:00`);
  const reference = new Date(`${localDateString(referenceDate)}T00:00:00+08:00`);
  return Math.round((target - reference) / 86400000);
}

function daysUntilMonthDay(dateString, referenceDate = today) {
  if (!dateString) return null;
  const [, month, day] = dateString.split("-");
  if (!month || !day) return null;
  const referenceYear = referenceDate.getFullYear();
  const reference = new Date(`${localDateString(referenceDate)}T00:00:00+08:00`);
  let next = new Date(`${referenceYear}-${month}-${day}T00:00:00+08:00`);
  if (next < reference) {
    next = new Date(`${referenceYear + 1}-${month}-${day}T00:00:00+08:00`);
  }
  return Math.round((next - reference) / 86400000);
}

function priorityWeight(priority) {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

export function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  return Math.max(0, Math.round((today - date) / 86400000));
}

export function calculateClientValueScore(client) {
  if (!client || client.consentStatus !== "Verified") {
    return {
      score: 0,
      factors: [],
      explanation: ["Consent is not verified, so value scoring stays masked."],
    };
  }

  const policyValue = numberOrZero(client.policyValue ?? client.annualPremium);
  const opportunityValue = numberOrZero(client.opportunityValue);
  const referralPotential = numberOrZero(client.referralPotential);
  const engagementUrgency = numberOrZero(client.engagementUrgency);
  const careUrgency = numberOrZero(client.careUrgency);
  const relationshipImportance = numberOrZero(client.relationshipImportance);

  const factors = [
    {
      label: "Policy value",
      value: formatRinggit(policyValue),
      points: clamp((policyValue / 5000) * 1.2, 0, 24),
      max: 24,
    },
    {
      label: "Opportunity value",
      value: formatRinggit(opportunityValue),
      points: clamp(opportunityValue / 20000, 0, 22),
      max: 22,
    },
    {
      label: "Referral potential",
      value: `${referralPotential}/100`,
      points: clamp((referralPotential / 100) * 14, 0, 14),
      max: 14,
    },
    {
      label: "Engagement urgency",
      value: `${engagementUrgency}/100`,
      points: clamp((engagementUrgency / 100) * 14, 0, 14),
      max: 14,
    },
    {
      label: "Care urgency",
      value: `${careUrgency}/100`,
      points: clamp((careUrgency / 100) * 12, 0, 12),
      max: 12,
    },
    {
      label: "Relationship importance",
      value: `${relationshipImportance}/100`,
      points: clamp((relationshipImportance / 100) * 14, 0, 14),
      max: 14,
    },
  ];

  const score = Math.round(factors.reduce((sum, factor) => sum + factor.points, 0));
  const strongest = [...factors].sort((a, b) => b.points / b.max - a.points / a.max)[0];

  return {
    score: clamp(score, 0, 100),
    factors: factors.map((factor) => ({ ...factor, points: Math.round(factor.points) })),
    explanation: [
      `${strongest.label} is the strongest tier driver at ${strongest.value}.`,
      `The score blends book value, opportunity, referral potential, urgency and relationship importance.`,
    ],
  };
}

export function deriveClientTier(scoreOrClient) {
  const score = typeof scoreOrClient === "number" ? scoreOrClient : calculateClientValueScore(scoreOrClient).score;
  if (score >= 85) {
    return {
      tier: "VIP",
      score,
      range: "85-100",
      description: "Highest value and care priority; proactive relationship planning required.",
      tone: "platinum",
    };
  }
  if (score >= 70) {
    return {
      tier: "Gold",
      score,
      range: "70-84",
      description: "High priority relationship with strong growth or referral potential.",
      tone: "gold",
    };
  }
  if (score >= 50) {
    return {
      tier: "Silver",
      score,
      range: "50-69",
      description: "Steady client value; keep timely, relevant care rhythms.",
      tone: "silver",
    };
  }
  return {
    tier: "Bronze",
    score,
    range: "0-49",
    description: "Maintain service quality while monitoring new priority signals.",
    tone: "bronze",
  };
}

export function detectCareMoments(client, tasks = [], referenceDate = today) {
  if (!client) return [];

  if (client.consentStatus !== "Verified") {
    return [
      {
        id: `${client.id}-consent-care`,
        type: "Consent",
        title: "Consent refresh needed before personal care",
        due: "Today",
        priority: "High",
        reason: "Private relationship details and recommendations are masked.",
        action: "Send a consent refresh note without private planning details.",
      },
    ];
  }

  const moments = [];
  const birthdayDays = daysUntilMonthDay(client.birthday, referenceDate);
  const preferredChannel = client.preferredChannel ?? "WhatsApp";
  const preferredTone = client.preferredTone ?? "Warm";

  if (birthdayDays === 0) {
    moments.push({
      id: `${client.id}-birthday-today`,
      type: "Birthday",
      title: "Birthday care moment today",
      due: "Today",
      priority: "High",
      reason: `${client.name} prefers a ${preferredTone.toLowerCase()} tone on ${preferredChannel}.`,
      action: "Send a personal birthday note before any product discussion.",
    });
  } else if (birthdayDays !== null && birthdayDays <= 7) {
    moments.push({
      id: `${client.id}-birthday-upcoming`,
      type: "Birthday",
      title: `Birthday care moment in ${birthdayDays} day(s)`,
      due: `${birthdayDays} day(s)`,
      priority: "Medium",
      reason: "Upcoming birthday is inside the one-week relationship window.",
      action: "Schedule a short greeting and record the touchpoint.",
    });
  }

  if (client.lifeEvent) {
    moments.push({
      id: `${client.id}-life-event`,
      type: "Life event",
      title: client.lifeEvent,
      due: "This week",
      priority: client.careUrgency >= 80 ? "High" : "Medium",
      reason: "Life-event context should shape the next conversation and message tone.",
      action: "Acknowledge the event and offer a concise planning check-in.",
    });
  }

  const overdueTasks = getClientTasks(client, tasks).filter((task) => task.status === "Overdue" || daysBetween(task.due, referenceDate) < 0);
  overdueTasks.slice(0, 2).forEach((task) => {
    moments.push({
      id: `${task.id}-care-overdue`,
      type: "Overdue care",
      title: task.title,
      due: task.due,
      priority: "High",
      reason: "An overdue advisor task can damage trust if it is not handled quickly.",
      action: "Complete the task or send a service-first update.",
    });
  });

  const nextMeeting = client.nextMeeting ? new Date(client.nextMeeting) : null;
  if (nextMeeting && localDateString(nextMeeting) === localDateString(referenceDate)) {
    moments.push({
      id: `${client.id}-meeting-today`,
      type: "Meeting prep",
      title: "Relationship-aware meeting prep",
      due: "Today",
      priority: "Medium",
      reason: "A meeting is already scheduled today.",
      action: "Prepare a one-page agenda using the preferred tone and interests.",
    });
  }

  if (daysSince(client.lastContact) >= 14) {
    moments.push({
      id: `${client.id}-stale-contact`,
      type: "Care rhythm",
      title: "Relationship touchpoint overdue",
      due: "Today",
      priority: "Medium",
      reason: `${daysSince(client.lastContact)} day(s) since last contact.`,
      action: `Send a ${preferredTone.toLowerCase()} ${preferredChannel} check-in.`,
    });
  }

  if (client.prioritySignals.some((signal) => /missed premium|policy review overdue/i.test(signal))) {
    moments.push({
      id: `${client.id}-service-sensitive`,
      type: "Service risk",
      title: "Service-sensitive follow-up",
      due: "Today",
      priority: "High",
      reason: "Policy service or lapse-sensitive signal detected.",
      action: "Lead with service help and include required disclosure wording.",
    });
  }

  return moments.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)).slice(0, 5);
}

export function recommendGift(client, tierInfo = deriveClientTier(client)) {
  if (!client || client.consentStatus !== "Verified") {
    return {
      allowed: false,
      recommendation: "Gift recommendation blocked",
      budget: "RM 0",
      rationale: "Consent is not verified.",
      guardrails: ["Do not use private interests or relationship notes until consent is verified."],
    };
  }

  const tier = tierInfo.tier ?? "Bronze";
  const budgetByTier = { VIP: 100, Gold: 50 };
  const budget = budgetByTier[tier] ?? 0;
  const interests = client.interests ?? [];
  const isServiceSensitive = client.prioritySignals.some((signal) => /missed premium|lapse/i.test(signal));
  const isGiftTier = tier === "VIP" || tier === "Gold";

  let recommendation = "Handwritten thank-you note";
  if (interests.some((interest) => /golf/i.test(interest)) && interests.some((interest) => /coffee/i.test(interest))) {
    recommendation = "Premium coffee bean set with a modest golf ball sleeve";
  } else if (interests.some((interest) => /coffee/i.test(interest))) {
    recommendation = "Premium coffee bean set";
  } else if (interests.some((interest) => /family|education/i.test(interest))) {
    recommendation = "Family photo book voucher capped at modest value";
  } else if (interests.some((interest) => /wellness|medical/i.test(interest))) {
    recommendation = "Wellness care pack";
  }

  return {
    allowed: isGiftTier && !isServiceSensitive,
    recommendation: isServiceSensitive
      ? "No gift until service issue is resolved"
      : isGiftTier
        ? recommendation
        : "Care note only; no gift for this tier",
    budget: formatRinggit(budget),
    rationale: isServiceSensitive
      ? "A lapse or missed-premium signal makes a gift inappropriate until the service matter is handled."
      : isGiftTier
        ? `${tier} tier permits a modest, relationship-led gesture based on recorded interests.`
        : `${tier} tier should receive thoughtful service follow-up without a gift gesture.`,
    guardrails: [
      "No cash, cash equivalent, or luxury item.",
      "Never make the gift conditional on buying, renewing, or referring.",
      "Gift suggestions are limited to VIP and Gold clients.",
      "Record estimated value and reason in the client timeline.",
      "Keep the message relationship-led, not sales-led.",
    ],
  };
}

export function suggestMeetingSlot(client, meetings = [], careMoments = []) {
  if (!client || client.consentStatus !== "Verified") {
    return {
      slot: "Blocked",
      channel: "Consent refresh",
      reason: "Consent must be refreshed before scheduling a private planning discussion.",
      preparation: ["Send a consent refresh note only."],
    };
  }

  const scheduled = meetings.find((meeting) => meeting.clientId === client.id);
  const highCare = careMoments.some((moment) => moment.priority === "High");
  const channel = client.preferredChannel ?? scheduled?.channel ?? "WhatsApp";

  if (scheduled) {
    return {
      slot: scheduled.time,
      channel: scheduled.channel,
      reason: `Use the existing ${scheduled.topic.toLowerCase()} appointment.`,
      preparation: [
        `Open with ${client.lifeEvent ? client.lifeEvent.toLowerCase() : "the latest relationship note"}.`,
        `Keep tone ${client.preferredTone?.toLowerCase() ?? "warm"} and channel ${channel}.`,
      ],
    };
  }

  if (/call|phone/i.test(channel)) {
    return {
      slot: highCare ? "Tomorrow 08:30" : "This week 08:45",
      channel: "Phone",
      reason: "Phone is the preferred channel and morning contact is likely to feel timely.",
      preparation: ["Prepare a two-minute service agenda.", "Leave a concise voicemail if unanswered."],
    };
  }

  if (/email/i.test(channel)) {
    return {
      slot: highCare ? "Today 20:15" : "This week 20:15",
      channel: "Email",
      reason: "Email is preferred, so an evening summary respects the client's pattern.",
      preparation: ["Use a clear subject line.", "Keep attachments to one page."],
    };
  }

  return {
    slot: highCare ? "Today 16:30" : "Tomorrow 11:00",
    channel,
    reason: `${channel} is the preferred channel for quick relationship care.`,
    preparation: ["Send one clear question.", "Offer two follow-up windows."],
  };
}

export function generateRelationshipMessage(client, { actionTitle, careMoment, giftRecommendation, meetingRecommendation } = {}) {
  const channel = client?.preferredChannel ?? "WhatsApp";

  if (!client || client.consentStatus !== "Verified") {
    return {
      channel,
      tone: "Consent-safe",
      subject: "Consent refresh required",
      body: "Hi, I would like to refresh your consent preferences before we review any private planning details.",
      guardrails: ["No private interests, life events, or recommendations are used until consent is verified."],
    };
  }

  const tone = client.preferredTone ?? "Warm";
  const opener = channel === "Email" ? `Dear ${client.name},` : `Hi ${client.name},`;
  const interestText = (client.interests ?? []).filter((interest) => /golf|coffee/i.test(interest)).join(" and ");
  const momentText = careMoment?.type === "Birthday"
    ? `Happy birthday. I hope you get a calm moment${interestText ? ` for ${interestText}` : ""}.`
    : client.lifeEvent
      ? `I remembered your update: ${client.lifeEvent.toLowerCase()}.`
      : "I wanted to check in while this is still timely.";
  const actionText = actionTitle ?? careMoment?.action ?? "set up a short planning check-in";
  const meetingText = meetingRecommendation
    ? `A good next step is ${meetingRecommendation.channel} at ${meetingRecommendation.slot}.`
    : "I can work around your preferred timing.";
  const giftText = giftRecommendation?.allowed
    ? `Separately, I noted a modest relationship gesture: ${giftRecommendation.recommendation.toLowerCase()}.`
    : "";

  return {
    channel,
    tone,
    subject: `${client.name}: ${careMoment?.type ?? "relationship"} follow-up`,
    body: [opener, momentText, `I suggest we ${actionText.toLowerCase()}. ${meetingText}`, giftText]
      .filter(Boolean)
      .join("\n\n"),
    guardrails: [
      "For relationship care only; no product recommendation is included.",
      "Final advice still needs suitability, affordability and consent checks.",
    ],
  };
}

export function scoreClient(client, tasks) {
  const openTasks = getClientTasks(client, tasks);
  const overdueWeight = openTasks.filter((task) => task.status === "Overdue").length * 28;
  const taskSeverityWeight = openTasks.reduce((sum, task) => sum + (severityWeights[task.severity] ?? 10), 0);
  const signalWeight = client.prioritySignals.length * 12;
  const contactWeight = Math.min(daysSince(client.lastContact) * 2, 28);
  const premiumWeight = Math.min(client.annualPremium / 4000, 25);
  const gapWeight = Math.min((client.estimatedCoverageGap ?? 0) / 100000, 18);
  const propensityWeight = Math.min((client.propensity ?? 0) / 8, 12);
  const consentPenalty = client.consentStatus === "Review due" ? 16 : 0;
  const valueWeight = Math.min(calculateClientValueScore(client).score / 5, 20);

  return Math.round(
    overdueWeight +
      taskSeverityWeight +
      signalWeight +
      contactWeight +
      premiumWeight +
      gapWeight +
      propensityWeight +
      consentPenalty +
      valueWeight
  );
}

export function getPriorityClients(clients, tasks) {
  return [...clients]
    .map((client) => {
      const valueScore = calculateClientValueScore(client);
      const tier = deriveClientTier(valueScore.score);
      return {
        ...client,
        score: scoreClient(client, tasks),
        valueScore: valueScore.score,
        tier: tier.tier,
        tierRange: tier.range,
        tierDescription: tier.description,
        scoreExplanation: valueScore.explanation,
        openTasks: getClientTasks(client, tasks).length,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildMorningBrief(clients, tasks, meetings, signals = []) {
  const verifiedClients = clients.filter((client) => client.consentStatus === "Verified");
  const lockedCount = clients.length - verifiedClients.length;
  const priority = getPriorityClients(verifiedClients, tasks)[0];
  const overdue = tasks.filter((task) => task.status === "Overdue");
  const meetingsToday = meetings.filter((meeting) => !meeting.time.toLowerCase().includes("tomorrow"));
  const highSignals = signals.filter((signal) => signal.confidence >= 90);
  const priorityLine = priority
    ? `${priority.name} is the highest verified priority because of ${priority.prioritySignals[0].toLowerCase()} and ${priority.openTasks} active action item(s).`
    : "No verified client records are available yet; start with consent refreshes before generating private recommendations.";

  return [
    priorityLine,
    `${meetingsToday.length} client meetings are scheduled today; prepare concise summaries before each appointment.`,
    `${overdue.length} overdue follow-up(s) need attention before new recommendations are issued.`,
    highSignals.length > 0
      ? `${highSignals.length} high-confidence overnight signal(s) can be converted into compliant next-best actions.`
      : "No high-confidence overnight signals require immediate escalation.",
    `Security reminder: ${lockedCount} consent-gated record(s) stay masked until status is verified.`,
  ];
}

export function generateClientBrief(client, tasks = [], signals = [], referrals = []) {
  if (!client) {
    return {
      title: "No client selected",
      summary: "Select a client to generate a deterministic advisory brief.",
      highlights: [],
      risk: "Low",
      evidence: [],
    };
  }

  if (client.consentStatus !== "Verified") {
    return {
      title: "Consent refresh required",
      summary: "Private notes, needs, financial values and recommendations remain masked until consent is verified.",
      highlights: ["Refresh PDPA consent", "Log consent evidence", "Re-run client brief after verification"],
      risk: "High",
      evidence: ["Consent status is not verified.", "Private timeline evidence is intentionally masked."],
    };
  }

  const activeTasks = getClientTasks(client, tasks);
  const clientSignals = signals.filter((signal) => signal.clientId === client.id);
  const clientReferrals = referrals.filter((referral) => referral.clientId === client.id);
  const valueScore = calculateClientValueScore(client);
  const tier = deriveClientTier(valueScore.score);
  const topSignal = clientSignals[0]?.signal ?? client.prioritySignals[0];
  const taskSummary =
    activeTasks.length > 0
      ? `${activeTasks.length} open task(s), including ${activeTasks[0].title.toLowerCase()}.`
      : "No open operational tasks.";
  const referralSummary =
    clientReferrals.length > 0
      ? `${clientReferrals.length} referral opportunity/opportunities in motion.`
      : "No active referral yet.";

  return {
    title: `${client.name} - ${client.segment}`,
    summary: `${client.occupation} in ${client.location}; ${topSignal.toLowerCase()} makes ${client.nextBestOffer.toLowerCase()} timely.`,
    highlights: [
      `${tier.tier} tier (${valueScore.score}/100): ${tier.description}`,
      `Annual premium ${formatRinggit(client.annualPremium)} with estimated coverage gap ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
      taskSummary,
      referralSummary,
      `Preferred engagement: ${client.preferredChannel ?? "WhatsApp"} in a ${client.preferredTone?.toLowerCase() ?? "warm"} tone.`,
    ],
    risk: normalizeRisk(scoreClient(client, tasks)),
    evidence: client.timeline.slice(0, 4).map((event) => `${event.date}: ${event.type} - ${event.note}`),
  };
}

export function generateNextBestActions(client, tasks = [], partners = [], complianceItems = []) {
  if (!client) return [];

  const actions = [];
  const complianceRisk = scoreComplianceRisk(client, tasks, complianceItems);
  const careMoments = detectCareMoments(client, tasks);

  if (client.consentStatus !== "Verified") {
    return [
      {
        id: `${client.id}-consent`,
        title: "Refresh consent before advice",
        priority: "High",
        owner: "Advisor",
        reason: "PDPA consent is not verified, so private workflows must stay masked.",
        blocked: false,
      },
    ];
  }

  careMoments.slice(0, 2).forEach((moment) => {
    actions.push({
      id: `${moment.id}-action`,
      title: moment.action,
      priority: moment.priority,
      owner: "Advisor",
      reason: `${moment.title}: ${moment.reason}`,
      blocked: false,
    });
  });

  const overdueTask = getClientTasks(client, tasks).find((task) => task.status === "Overdue");
  if (overdueTask) {
    actions.push({
      id: `${client.id}-overdue`,
      title: overdueTask.title,
      priority: "High",
      owner: "Advisor",
      reason: "Overdue service tasks increase lapse, complaint and retention risk.",
      blocked: false,
    });
  }

  actions.push({
    id: `${client.id}-brief`,
    title: `Prepare ${client.nextBestOffer}`,
    priority: client.propensity >= 85 ? "High" : "Medium",
    owner: "Advisor",
    reason: `Client propensity is ${client.propensity ?? 0}% and signals include ${client.prioritySignals.join(", ")}.`,
    blocked: complianceRisk.level === "High" && complianceRisk.score >= 85,
  });

  const partnerMatch = matchPartners(client, partners)[0];
  if (partnerMatch) {
    actions.push({
      id: `${client.id}-partner`,
      title: `Route to ${partnerMatch.name}`,
      priority: partnerMatch.matchScore >= 90 ? "High" : "Medium",
      owner: "Advisor",
      reason: `${partnerMatch.reason}; SLA ${partnerMatch.sla}.`,
      blocked: false,
    });
  }

  if (complianceRisk.score >= 40) {
    actions.push({
      id: `${client.id}-compliance`,
      title: "Attach suitability and disclosure evidence",
      priority: complianceRisk.level,
      owner: "Advisor",
      reason: complianceRisk.reasons.join(" "),
      blocked: false,
    });
  }

  return actions.sort((a, b) => riskWeights[b.priority] - riskWeights[a.priority]);
}

export function generateDraftMessage(client, action, channel = "WhatsApp") {
  if (!client || client.consentStatus !== "Verified") {
    return {
      channel,
      subject: "Consent refresh required",
      body: "Hi, I would like to refresh your consent preferences before we review any private planning details.",
      disclaimers: ["No recommendation is included until consent is verified."],
    };
  }

  const isPremiumRisk = client.prioritySignals.some((signal) => /missed premium|lapse/i.test(signal));
  const preferredChannel = channel ?? client.preferredChannel ?? "WhatsApp";
  const opener = preferredChannel === "Email" ? `Dear ${client.name},` : `Hi ${client.name},`;
  const actionTitle = typeof action === "string" ? action : action?.title ?? client.nextBestOffer;
  const careMoment = detectCareMoments(client, [])[0];
  const relationshipLine = careMoment
    ? `${careMoment.title}: ${careMoment.action.toLowerCase()}.`
    : client.lifeEvent
      ? `I remembered your update: ${client.lifeEvent.toLowerCase()}.`
      : `I kept this ${client.preferredTone?.toLowerCase() ?? "warm"} and concise, as preferred.`;
  const body = [
    opener,
    relationshipLine,
    `I prepared a short review for ${actionTitle.toLowerCase()} based on your recent updates.`,
    `The main items are ${client.prioritySignals.slice(0, 2).join(" and ").toLowerCase()}, with an estimated planning gap of ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
    "Would you like me to walk through the options and assumptions in our next meeting?",
  ];

  return {
    channel: preferredChannel,
    subject: `${client.name}: ${actionTitle}`,
    body: body.join("\n\n"),
    disclaimers: [
      "For discussion only; final advice depends on updated suitability and affordability checks.",
      isPremiumRisk ? "Includes lapse-prevention language because a payment issue was detected." : "No guaranteed outcome language included.",
    ],
  };
}

export function scoreComplianceRisk(client, tasks = [], complianceItems = []) {
  if (!client) return { score: 0, level: "Low", reasons: ["No client selected."] };

  const reasons = [];
  let score = 0;

  if (client.consentStatus !== "Verified") {
    score += 55;
    reasons.push("Consent is not verified.");
  }

  const clientTasks = getClientTasks(client, tasks);
  const overdue = clientTasks.filter((task) => task.status === "Overdue");
  if (overdue.length > 0) {
    score += overdue.length * 14;
    reasons.push(`${overdue.length} overdue task(s) need action.`);
  }

  const complianceMatches = complianceItems.filter((item) => item.clientId === client.id);
  complianceMatches.forEach((item) => {
    score += riskWeights[item.severity] ?? 12;
    reasons.push(item.issue);
  });

  if (client.prioritySignals.some((signal) => /missed premium|policy review overdue/i.test(signal))) {
    score += 12;
    reasons.push("Service or disclosure-sensitive signal detected.");
  }

  const cappedScore = Math.min(100, score);
  return {
    score: cappedScore,
    level: normalizeRisk(cappedScore),
    reasons: reasons.length > 0 ? reasons : ["No material compliance flags detected."],
  };
}

export function recommendCpd(courses, clients, advisor) {
  const activeNeeds = new Set(clients.flatMap((client) => client.needs));
  return courses
    .map((course) => {
      const matches = course.fitTags.filter((tag) => activeNeeds.has(tag));
      const complianceBoost = advisor.cpdHours < advisor.cpdTarget && course.status === "Required" ? 2 : 0;
      const gapBoost = Math.max(0, advisor.cpdTarget - advisor.cpdHours) > 8 ? 1 : 0;
      return {
        ...course,
        matchScore: Math.min(100, 62 + matches.length * 13 + complianceBoost * 10 + gapBoost * 5),
        reason:
          matches.length > 0
            ? `Matches current book themes: ${matches.join(", ")}`
            : "Supports compliance hygiene across advisory workflows",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function matchPartners(client, partners) {
  if (!client || client.consentStatus !== "Verified") return [];

  return partners
    .map((partner) => {
      const matches = partner.tags.filter((tag) => client.needs.includes(tag));
      const slaBoost = /hour/i.test(partner.sla) ? 4 : 0;
      return {
        ...partner,
        matchScore: Math.min(100, partner.qualityScore - 10 + matches.length * 9 + slaBoost),
        reason: matches.length > 0 ? `Relevant for ${matches.join(", ")}` : "General advisory support",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function summarizeBusinessImpact(impactItems = [], clients = [], referrals = []) {
  const premium = clients.reduce((sum, client) => sum + (client.annualPremium || 0), 0);
  const coverageGap = clients.reduce((sum, client) => sum + (client.estimatedCoverageGap || 0), 0);
  const referralPipeline = referrals.reduce(
    (sum, referral) => sum + (referral.expectedValue || 0) * ((referral.probability ?? 100) / 100),
    0
  );

  const generated = [
    {
      id: "impact-generated-premium",
      label: "Managed premium in active book",
      value: premium,
      unit: "RM",
      narrative: "Visible premium base protected by priority scoring and follow-up controls.",
    },
    {
      id: "impact-generated-gap",
      label: "Coverage gap surfaced",
      value: coverageGap,
      unit: "RM",
      narrative: "Estimated needs gap available for compliant, evidence-led advice.",
    },
    {
      id: "impact-generated-referrals",
      label: "Weighted referral pipeline",
      value: Math.round(referralPipeline),
      unit: "RM",
      narrative: "Referral opportunities weighted by current stage probability.",
    },
  ];

  return [...impactItems, ...generated].map((item) => ({
    ...item,
    displayValue: item.unit === "RM" ? formatRinggit(item.value) : `${item.value} ${item.unit}`,
  }));
}

export function summarizeRelationshipAdmin(clients = [], tasks = []) {
  const tierCounts = { VIP: 0, Gold: 0, Silver: 0, Bronze: 0 };
  const scoredClients = clients
    .filter((client) => client.consentStatus === "Verified")
    .map((client) => {
      const valueScore = calculateClientValueScore(client);
      const tier = deriveClientTier(valueScore.score);
      tierCounts[tier.tier] += 1;
      return {
        id: client.id,
        name: client.name,
        tier: tier.tier,
        score: valueScore.score,
      };
    });
  const careMoments = clients.flatMap((client) =>
    detectCareMoments(client, tasks).map((moment) => ({
      ...moment,
      clientId: client.id,
      clientName: client.consentStatus === "Verified" ? client.name : "Consent-locked client",
    }))
  );
  const gifts = clients.map((client) => recommendGift(client, deriveClientTier(calculateClientValueScore(client).score)));

  return {
    tierCounts,
    careMomentsToday: careMoments.filter((moment) => moment.due === "Today").length,
    overdueCare: careMoments.filter((moment) => /overdue|service/i.test(moment.type)).length,
    giftGuardrailSummary: {
      allowed: gifts.filter((gift) => gift.allowed).length,
      blocked: gifts.filter((gift) => !gift.allowed).length,
    },
    topTierClients: scoredClients.sort((a, b) => b.score - a.score).slice(0, 5),
    activeCareMoments: careMoments.slice(0, 8),
  };
}

export function summarizeAdmin({ clients, tasks, referrals, expenses, complianceItems = [], reviewItems = [] }) {
  const totalPremium = clients.reduce((sum, client) => sum + client.annualPremium, 0);
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const pendingExpenses = expenses.filter((expense) => expense.status === "Pending").length;
  const flaggedExpenses = expenses.filter((expense) => expense.status === "Flagged").length;
  const highCompliance = complianceItems.filter((item) => item.severity === "High").length;
  const highReviews = reviewItems.filter((item) => item.priority === "High").length;
  const relationship = summarizeRelationshipAdmin(clients, tasks);

  return [
    { label: "Managed premium", value: `RM ${Math.round(totalPremium / 1000)}k`, tone: "blue" },
    { label: "VIP clients", value: relationship.tierCounts.VIP, tone: "blue" },
    { label: "Care moments today", value: relationship.careMomentsToday, tone: relationship.careMomentsToday > 0 ? "red" : "green" },
    { label: "Overdue care", value: relationship.overdueCare + overdueTasks, tone: relationship.overdueCare + overdueTasks > 0 ? "red" : "green" },
    { label: "Open referrals", value: referrals.filter((referral) => referral.status !== "Closed").length, tone: "blue" },
    { label: "Gift guardrails", value: `${relationship.giftGuardrailSummary.allowed}/${relationship.giftGuardrailSummary.blocked}`, tone: relationship.giftGuardrailSummary.blocked > 0 ? "red" : "green" },
    {
      label: "Review queue",
      value: highCompliance + highReviews + pendingExpenses + flaggedExpenses,
      tone: highCompliance + highReviews > 0 ? "red" : "green",
    },
  ];
}
