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

function normalizeRisk(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getClientName(client) {
  return client?.consentStatus === "Verified" ? client.name : "Consent-locked client";
}

function getClientTasks(client, tasks) {
  return tasks.filter((task) => task.clientId === client.id && task.status !== "Done");
}

export function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  return Math.max(0, Math.round((today - date) / 86400000));
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

  return Math.round(
    overdueWeight +
      taskSeverityWeight +
      signalWeight +
      contactWeight +
      premiumWeight +
      gapWeight +
      propensityWeight +
      consentPenalty
  );
}

export function getPriorityClients(clients, tasks) {
  return [...clients]
    .map((client) => ({
      ...client,
      score: scoreClient(client, tasks),
      openTasks: getClientTasks(client, tasks).length,
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildMorningBrief(clients, tasks, meetings, signals = []) {
  const verifiedClients = clients.filter((client) => client.consentStatus === "Verified");
  const lockedCount = clients.length - verifiedClients.length;
  const priority = getPriorityClients(verifiedClients, tasks)[0];
  const overdue = tasks.filter((task) => task.status === "Overdue");
  const meetingsToday = meetings.filter((meeting) => !meeting.time.toLowerCase().includes("tomorrow"));
  const highSignals = signals.filter((signal) => signal.confidence >= 90);

  return [
    `${priority.name} is the highest verified priority because of ${priority.prioritySignals[0].toLowerCase()} and ${priority.openTasks} active action item(s).`,
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
      evidence: client.timeline.map((event) => `${event.date}: ${event.note}`),
    };
  }

  const activeTasks = getClientTasks(client, tasks);
  const clientSignals = signals.filter((signal) => signal.clientId === client.id);
  const clientReferrals = referrals.filter((referral) => referral.clientId === client.id);
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
      `Annual premium ${formatRinggit(client.annualPremium)} with estimated coverage gap ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
      taskSummary,
      referralSummary,
      `Preferred engagement: ${client.memory[0]}`,
    ],
    risk: normalizeRisk(scoreClient(client, tasks)),
    evidence: client.timeline.slice(0, 4).map((event) => `${event.date}: ${event.type} - ${event.note}`),
  };
}

export function generateNextBestActions(client, tasks = [], partners = [], complianceItems = []) {
  if (!client) return [];

  const actions = [];
  const complianceRisk = scoreComplianceRisk(client, tasks, complianceItems);

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
      owner: "Admin",
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
  const opener = channel === "Email" ? `Dear ${client.name},` : `Hi ${client.name},`;
  const actionTitle = typeof action === "string" ? action : action?.title ?? client.nextBestOffer;
  const body = [
    opener,
    `I prepared a short review for ${actionTitle.toLowerCase()} based on your recent updates.`,
    `The main items are ${client.prioritySignals.slice(0, 2).join(" and ").toLowerCase()}, with an estimated planning gap of ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
    "Would you like me to walk through the options and assumptions in our next meeting?",
  ];

  return {
    channel,
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
      label: "Managed premium in demo book",
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

export function buildDemoStory({
  clients = [],
  tasks = [],
  meetings = [],
  signals = [],
  partners = [],
  complianceItems = [],
  impactItems = [],
  referrals = [],
} = {}) {
  const priority = getPriorityClients(
    clients.filter((client) => client.consentStatus === "Verified"),
    tasks
  )[0];
  const clientBrief = generateClientBrief(priority, tasks, signals, referrals);
  const actions = generateNextBestActions(priority, tasks, partners, complianceItems).slice(0, 3);
  const complianceHotspot = clients
    .map((client) => ({ client, risk: scoreComplianceRisk(client, tasks, complianceItems) }))
    .sort((a, b) => b.risk.score - a.risk.score)[0];
  const impact = summarizeBusinessImpact(impactItems, clients, referrals).slice(0, 4);

  return [
    {
      title: "Start with the AI morning brief",
      detail: `${meetings.length} scheduled meeting(s), ${signals.length} overnight signal(s), and ${getClientName(priority)} surfaced as the top verified client.`,
    },
    {
      title: "Open the client cockpit",
      detail: `${clientBrief.title}: ${clientBrief.summary}`,
    },
    {
      title: "Show next-best actions",
      detail: actions.map((action) => `${action.priority}: ${action.title}`).join(" | "),
    },
    {
      title: "Prove compliance guardrails",
      detail: `${getClientName(complianceHotspot.client)} scores ${complianceHotspot.risk.score}/100 because ${complianceHotspot.risk.reasons[0]}`,
    },
    {
      title: "Close on business impact",
      detail: impact.map((item) => `${item.label}: ${item.displayValue}`).join(" | "),
    },
  ];
}

export function summarizeAdmin({ clients, tasks, referrals, expenses, complianceItems = [], reviewItems = [] }) {
  const totalPremium = clients.reduce((sum, client) => sum + client.annualPremium, 0);
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const pendingExpenses = expenses.filter((expense) => expense.status === "Pending").length;
  const flaggedExpenses = expenses.filter((expense) => expense.status === "Flagged").length;
  const highCompliance = complianceItems.filter((item) => item.severity === "High").length;
  const highReviews = reviewItems.filter((item) => item.priority === "High").length;

  return [
    { label: "Managed premium", value: `RM ${Math.round(totalPremium / 1000)}k`, tone: "blue" },
    { label: "Priority clients", value: clients.filter((client) => client.prioritySignals.length > 1).length, tone: "green" },
    { label: "Overdue tasks", value: overdueTasks, tone: overdueTasks > 0 ? "red" : "green" },
    { label: "Open referrals", value: referrals.filter((referral) => referral.status !== "Closed").length, tone: "blue" },
    { label: "Pending expenses", value: pendingExpenses + flaggedExpenses, tone: flaggedExpenses > 0 ? "red" : "green" },
    {
      label: "Review queue",
      value: highCompliance + highReviews,
      tone: highCompliance + highReviews > 0 ? "red" : "green",
    },
  ];
}
