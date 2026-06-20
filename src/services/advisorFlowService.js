import { allowLocalFallback, isSupabaseConfigured, localFallbackPassword, supabase } from "../supabaseClient.js";
import {
  advisors,
  adminReviewItems,
  auditLogsSeed,
  businessImpact,
  clients,
  complianceQueue,
  cpdCourses,
  expensesSeed,
  meetings,
  overnightSignals,
  partners,
  referralOutcomes,
  tasks as taskSeed,
} from "../data.js";

const seededReferrals = referralOutcomes.map((referral) => {
  const partner = partners.find((item) => item.id === referral.partnerId);
  return {
    ...referral,
    partnerName: partner?.name ?? "Partner desk",
    value: referral.expectedValue,
  };
});

const seedConsentRequests = [
  {
    id: "consent-1",
    clientId: "client-lee",
    status: "Pending consent refresh",
    reason: "Advisor attempted to open a masked profile before PDPA refresh.",
  },
];

const localFallbackProfiles = [
  { email: "alex.lim@advisorflow.local", profileId: "adv-alex" },
  { email: "nadia.wong@advisorflow.local", profileId: "admin-nadia" },
  { email: "maya.singh@advisorflow.local", profileId: "adv-maya" },
];

export function getFallbackData(activeProfileId = "adv-alex") {
  return {
    connected: false,
    profile: advisors.find((person) => person.id === activeProfileId) ?? advisors[0],
    advisors,
    adminReviewItems,
    auditLogs: auditLogsSeed,
    businessImpact,
    clients,
    complianceQueue,
    consentRequests: seedConsentRequests,
    cpdCourses,
    expenses: expensesSeed,
    meetings,
    overnightSignals,
    partners,
    referrals: seededReferrals,
    tasks: taskSeed,
  };
}

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data ?? [];
}

function mapProfile(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name,
    role: row.role,
    region: row.region,
    licenseStatus: row.license_status,
    cpdHours: row.cpd_hours,
    cpdTarget: row.cpd_target,
    riskProfile: row.risk_profile,
    focusSegments: row.focus_segments ?? [],
    languages: row.languages ?? [],
    bookPremium: row.book_premium,
    retentionRate: row.retention_rate,
    referralsWon: row.referrals_won,
  };
}

function mapClient(row) {
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    age: row.age,
    occupation: row.occupation,
    location: row.location,
    advisorId: row.advisor_id,
    prioritySignals: row.priority_signals ?? [],
    needs: row.needs ?? [],
    assets: row.assets,
    annualPremium: row.annual_premium,
    lastContact: row.last_contact,
    nextMeeting: row.next_meeting,
    consentStatus: row.consent_status,
    household: row.household,
    propensity: row.propensity,
    estimatedCoverageGap: row.estimated_coverage_gap,
    nextBestOffer: row.next_best_offer,
    policyValue: row.policy_value,
    opportunityValue: row.opportunity_value,
    referralPotential: row.referral_potential,
    engagementUrgency: row.engagement_urgency,
    careUrgency: row.care_urgency,
    relationshipImportance: row.relationship_importance,
    personality: row.personality,
    interests: row.interests ?? [],
    preferredChannel: row.preferred_channel,
    preferredTone: row.preferred_tone,
    birthday: row.birthday,
    lifeEvent: row.life_event,
    relationshipNotes: row.relationship_notes,
    memory: row.memory ?? [],
    timeline: row.timeline ?? [],
  };
}

function mapTask(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    due: row.due_date,
    status: row.status,
    severity: row.severity,
  };
}

function mapReferral(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    status: row.status,
    note: row.note,
    stage: row.stage,
    value: row.expected_value,
    expectedValue: row.expected_value,
    probability: row.probability,
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    advisorId: row.advisor_id,
    clientId: row.client_id,
    category: row.category,
    amount: row.amount,
    status: row.status,
    date: row.expense_date,
  };
}

function mapConsent(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    status: row.status,
    reason: row.reason,
  };
}

function mapAudit(row) {
  return {
    id: row.id,
    time: row.logged_at
      ? new Date(row.logged_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
      : row.time_label,
    actor: row.actor,
    action: row.action,
    risk: row.risk,
  };
}

function mapPartner(row) {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    tags: row.tags ?? [],
    sla: row.sla,
    qualityScore: row.quality_score,
    availability: row.availability,
    evidenceRequired: row.evidence_required ?? [],
    commercialModel: row.commercial_model,
  };
}

function mapCpdCourse(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    hours: row.hours,
    fitTags: row.fit_tags ?? [],
    status: row.status,
    format: row.format,
    outcome: row.outcome,
  };
}

function mapCompliance(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    owner: row.owner,
    issue: row.issue,
    severity: row.severity,
    status: row.status,
    due: row.due_date,
    control: row.control,
  };
}

function mapMeeting(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    time: row.time_label,
    topic: row.topic,
    channel: row.channel,
  };
}

function mapSignal(row) {
  return {
    id: row.id,
    source: row.source,
    clientId: row.client_id,
    signal: row.signal,
    confidence: row.confidence,
    action: row.action,
  };
}

function mapImpact(row) {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    unit: row.unit,
    narrative: row.narrative,
  };
}

function mapAdminReview(row) {
  return {
    id: row.id,
    title: row.title,
    owner: row.owner,
    clientId: row.client_id,
    queue: row.queue,
    priority: row.priority,
    eta: row.eta,
  };
}

export async function signInAdvisorFlow(email, password) {
  if (!isSupabaseConfigured) {
    if (!allowLocalFallback) {
      throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
    }
    const fallbackProfile = localFallbackProfiles.find((login) => login.email.toLowerCase() === email.toLowerCase());
    if (!fallbackProfile || !localFallbackPassword || password !== localFallbackPassword) {
      throw new Error("Local fallback login is disabled or the fallback credentials are incorrect.");
    }
    return getFallbackData(fallbackProfile.profileId);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user?.id) throw new Error("Supabase did not return an authenticated user.");
  return loadAdvisorFlowData(data.user);
}

export async function signOutAdvisorFlow() {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}

export async function loadAdvisorFlowData(user) {
  if (!isSupabaseConfigured) return getFallbackData();

  const profileResult = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) {
    throw new Error("No AdvisorFlow profile is linked to this Supabase Auth user.");
  }

  const activeProfile = mapProfile(profileResult.data);

  const [
    profileRows,
    clientRows,
    taskRows,
    referralRows,
    expenseRows,
    consentRows,
    auditRows,
    partnerRows,
    cpdRows,
    complianceRows,
    meetingRows,
    signalRows,
    impactRows,
    reviewRows,
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("role", { ascending: false }),
    supabase.rpc("get_scoped_clients"),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").order("created_at", { ascending: false }),
    supabase.from("consent_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("*").order("logged_at", { ascending: false }),
    supabase.from("partners").select("*").order("name", { ascending: true }),
    supabase.from("cpd_courses").select("*").order("title", { ascending: true }),
    supabase.from("compliance_items").select("*").order("due_date", { ascending: true }),
    supabase.from("meetings").select("*").order("sort_order", { ascending: true }),
    supabase.from("overnight_signals").select("*").order("confidence", { ascending: false }),
    supabase.from("business_impact_items").select("*").order("sort_order", { ascending: true }),
    supabase.from("admin_review_items").select("*").order("sort_order", { ascending: true }),
  ]);

  return {
    connected: true,
    profile: activeProfile,
    advisors: throwIfError(profileRows).map(mapProfile),
    clients: throwIfError(clientRows).map(mapClient),
    tasks: throwIfError(taskRows).map(mapTask),
    referrals: throwIfError(referralRows).map(mapReferral),
    expenses: throwIfError(expenseRows).map(mapExpense),
    consentRequests: throwIfError(consentRows).map(mapConsent),
    auditLogs: throwIfError(auditRows).map(mapAudit),
    partners: throwIfError(partnerRows).map(mapPartner),
    cpdCourses: throwIfError(cpdRows).map(mapCpdCourse),
    complianceQueue: throwIfError(complianceRows).map(mapCompliance),
    meetings: throwIfError(meetingRows).map(mapMeeting),
    overnightSignals: throwIfError(signalRows).map(mapSignal),
    businessImpact: throwIfError(impactRows).map(mapImpact),
    adminReviewItems: throwIfError(reviewRows).map(mapAdminReview),
  };
}

export async function createTaskRow(task) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      id: task.id,
      client_id: task.clientId,
      title: task.title,
      due_date: task.due,
      status: task.status,
      severity: task.severity,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function completeTaskRow(taskId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "Done" })
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function createReferralRow(referral) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("referrals")
    .insert({
      id: referral.id,
      client_id: referral.clientId,
      partner_id: referral.partnerId,
      partner_name: referral.partnerName,
      status: referral.status,
      note: referral.note,
      stage: referral.stage,
      expected_value: referral.expectedValue,
      probability: referral.probability,
    })
    .select()
    .single();
  if (error) throw error;
  return mapReferral(data);
}

export async function createExpenseRow(expense) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      id: expense.id,
      advisor_id: expense.advisorId,
      client_id: expense.clientId,
      category: expense.category,
      amount: expense.amount,
      status: expense.status,
      expense_date: expense.date,
    })
    .select()
    .single();
  if (error) throw error;
  return mapExpense(data);
}

export async function createConsentRequestRow(request) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("consent_requests")
    .insert({
      id: request.id,
      client_id: request.clientId,
      status: request.status,
      reason: request.reason,
    })
    .select()
    .single();
  if (error) throw error;
  return mapConsent(data);
}

export async function createAuditLogRow(log) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      id: log.id,
      actor: log.actor,
      action: log.action,
      risk: log.risk,
      time_label: log.time,
    })
    .select()
    .single();
  if (error) throw error;
  return mapAudit(data);
}
