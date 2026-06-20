import { useEffect, useMemo, useState } from "react";
import {
  advisors,
  auditLogsSeed,
  clients,
  expensesSeed,
  referralOutcomes,
  tasks as taskSeed,
  cpdModules,
} from "./data.js";
import {
  buildMorningBrief,
  buildMorningBriefActions,
  calculateClientValueScore,
  deriveClientTier,
  detectCareMoments,
  generateClientBrief,
  generateDraftMessage,
  generateNextBestActions,
  generateRelationshipMessage,
  getPriorityClients,
  matchPartners,
  recommendCpd,
  recommendGift,
  scoreComplianceRisk,
  suggestMeetingSlot,
  summarizeAdmin,
  summarizeBusinessImpact,
  summarizeRelationshipAdmin,
} from "./engines.js";
import {
  completeTaskRow,
  createAuditLogRow,
  createConsentRequestRow,
  createExpenseRow,
  createReferralRow,
  createTaskRow,
  getFallbackData,
  sendTelegramMessage,
  signInAdvisorFlow,
  signOutAdvisorFlow,
} from "./services/advisorFlowService.js";
import { generateClientProfile, generateTailoredTelegramMessage } from "./services/openaiClient.js";
import LearningFeature from "./LearningFeature.jsx";

const advisor = advisors.find((person) => person.role === "Advisor");
const admin = advisors.find((person) => person.role === "Admin");

const seededReferrals = referralOutcomes.map((referral) => {
  return {
    ...referral,
    partnerName: "Partner desk",
    value: referral.expectedValue,
  };
});

const advisorRoutes = [
  { path: "/advisor/today", label: "HomePage" },
  { path: "/advisor/clients", label: "Client" },
  { path: "/advisor/client", label: "Client Detail", hidden: true },
  { path: "/advisor/ai-profile", label: "AI Profile", nested: true },
  { path: "/advisor/actions", label: "Action Workspace", nested: true },
  { path: "/advisor/partners", label: "Partners" },
  { path: "/advisor/learning", label: "Learning" },
  { path: "/advisor/claims", label: "Claims", hidden: true },
];

const adminRoutes = [
  { path: "/admin/impact", label: "Impact" },
  { path: "/admin/compliance", label: "Compliance" },
  { path: "/admin/referrals", label: "Referrals" },
  { path: "/admin/audit", label: "Audit" },
];

function normalizePath(pathname, role = "Advisor") {
  const routes = role === "Admin" ? adminRoutes : advisorRoutes;
  const supported = new Set(routes.map((route) => route.path));
  return supported.has(pathname) ? pathname : role === "Admin" ? "/admin/impact" : "/advisor/today";
}

const tierRank = { VIP: 4, Gold: 3, Silver: 2, Bronze: 1, Hold: 0 };

function clientTitle(client) {
  const [title] = (client.name ?? "").split(" ");
  return title || "Client";
}

function getClient(clientId, source = clients) {
  return source.find((client) => client.id === clientId);
}

function isClientLocked(clientId, source = clients) {
  return getClient(clientId, source)?.consentStatus !== "Verified";
}

function formatClientName(clientId, source = clients) {
  const client = getClient(clientId, source);
  if (!client) return "General";
  return isClientLocked(clientId, source) ? "Consent-locked client" : client.name;
}

function displayClientName(client) {
  return client.consentStatus === "Verified" ? client.name : "Consent-locked client";
}

function currency(value) {
  if (value === null || value === undefined) return "Masked";
  return `RM ${Number(value).toLocaleString("en-MY")}`;
}

function buildImpactSummary({ activeAdvisor, auditLogs, businessImpactRows, consentRequests, cpd, referrals, tasks }) {
  const findRow = (pattern) => businessImpactRows.find((row) => pattern.test(row.label));
  const managedPremium = findRow(/managed premium/i)?.displayValue ?? "RM 0";
  const referralPipeline =
    findRow(/referral revenue|weighted referral/i)?.displayValue ??
    findRow(/referral/i)?.displayValue ??
    "RM 0";
  const openConsentRequests = consentRequests.filter((request) => request.status.startsWith("Pending"));
  const blockedRisks = auditLogs.filter((log) => log.risk === "High").length + openConsentRequests.length;
  const openTasks = tasks.filter((task) => task.status !== "Done").length;
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const followUpCompletion = Math.max(0, Math.round(((tasks.length - openTasks) / Math.max(tasks.length, 1)) * 100));
  const cpdReadiness = Math.min(100, Math.round((activeAdvisor.cpdHours / Math.max(activeAdvisor.cpdTarget, 1)) * 100));
  const referralHygiene = Math.min(100, 62 + referrals.length * 7);

  return {
    blockedRisks,
    complianceHealth: overdueTasks > 0 ? `${blockedRisks} guardrails` : "Stable",
    cpdReadiness,
    followUpCompletion,
    managedPremium,
    referralHygiene,
    referralPipeline,
  };
}

function App() {
  const fallbackData = useMemo(() => getFallbackData(), []);
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dataMode, setDataMode] = useState("Local fallback");
  const [activeProfile, setActiveProfile] = useState(fallbackData.profile);
  const [people, setPeople] = useState(fallbackData.advisors);
  const [activeClientId, setActiveClientId] = useState("client-tan");
  const [tasks, setTasks] = useState(fallbackData.tasks);
  const [referrals, setReferrals] = useState(fallbackData.referrals);
  const [expenses, setExpenses] = useState(fallbackData.expenses);
  const [auditLogs, setAuditLogs] = useState(fallbackData.auditLogs);
  const [clientsState, setClientsState] = useState(fallbackData.clients);
  const [consentRequests, setConsentRequests] = useState(fallbackData.consentRequests);
  const [adminReviewItemsState, setAdminReviewItemsState] = useState(fallbackData.adminReviewItems);
  const [businessImpactRowsState, setBusinessImpactRowsState] = useState(fallbackData.businessImpact);
  const [complianceQueueState, setComplianceQueueState] = useState(fallbackData.complianceQueue);
  const [cpdCoursesState, setCpdCoursesState] = useState(fallbackData.cpdCourses);
  const [meetingsState, setMeetingsState] = useState(fallbackData.meetings);
  const [overnightSignalsState, setOvernightSignalsState] = useState(fallbackData.overnightSignals);
  const [partnersState, setPartnersState] = useState(fallbackData.partners);
  const [followUpText, setFollowUpText] = useState("Send legacy planning one-pager");
  const [expenseAmount, setExpenseAmount] = useState("38");
  const [composerMode, setComposerMode] = useState("follow-up");
  const [telegramStatus, setTelegramStatus] = useState({ tone: "idle", text: "" });
  const [telegramDraftBody, setTelegramDraftBody] = useState("");
  const [hasClientContext, setHasClientContext] = useState(false);
  const [draftContext, setDraftContext] = useState(null);
  const [careMomentProgress, setCareMomentProgress] = useState({});
  const [activeMomentId, setActiveMomentId] = useState(null);

  const role = activeProfile.role;
  const activeAdvisor = role === "Advisor" ? activeProfile : people.find((person) => person.role === "Advisor") ?? advisor;
  const activeAdmin = role === "Admin" ? activeProfile : people.find((person) => person.role === "Admin") ?? admin;
  const activeClient = clientsState.find((client) => client.id === activeClientId) ?? clientsState[0] ?? clients[0];
  const activeTasks = tasks.filter((task) => task.clientId === activeClient.id && task.status !== "Done");
  const recentDoneTasks = tasks
    .filter((task) => task.clientId === activeClient.id && task.status === "Done")
    .sort((a, b) => String(b.completedAt ?? b.id).localeCompare(String(a.completedAt ?? a.id)))
    .slice(0, 5);
  const activeExpenses = expenses.filter((expense) => expense.clientId === activeClient.id);
  const activeReferrals = referrals.filter((referral) => referral.clientId === activeClient.id);
  const consentLocked = activeClient.consentStatus !== "Verified";
  const telegramReady = Boolean(activeClient.telegramOptIn && activeClient.telegramChatId && !consentLocked);

  const priorityClients = useMemo(() => getPriorityClients(clientsState, tasks), [clientsState, tasks]);
  const morningBriefActions = useMemo(
    () => buildMorningBriefActions(clientsState, tasks, meetingsState, overnightSignalsState),
    [clientsState, tasks, meetingsState, overnightSignalsState]
  );
  const morningBrief = useMemo(
    () => buildMorningBrief(clientsState, tasks, meetingsState, overnightSignalsState),
    [clientsState, tasks, meetingsState, overnightSignalsState]
  );
  const cpd = useMemo(
    () => recommendCpd(cpdCoursesState, clientsState, activeAdvisor),
    [cpdCoursesState, clientsState, activeAdvisor]
  );
  const partnerMatches = useMemo(() => matchPartners(activeClient, partnersState), [activeClient, partnersState]);
  const complianceRisk = useMemo(
    () => scoreComplianceRisk(activeClient, tasks, complianceQueueState),
    [activeClient, tasks, complianceQueueState]
  );
  const clientBrief = useMemo(
    () => generateClientBrief(activeClient, tasks, overnightSignalsState, referrals),
    [activeClient, tasks, overnightSignalsState, referrals]
  );
  const clientValueScore = useMemo(() => calculateClientValueScore(activeClient), [activeClient]);
  const clientTier = useMemo(() => deriveClientTier(clientValueScore.score), [clientValueScore]);
  const careMoments = useMemo(() => detectCareMoments(activeClient, tasks), [activeClient, tasks]);
  const clientMomentProgress = careMomentProgress[activeClient.id] ?? {};
  const pendingCareMoments = useMemo(
    () => careMoments.filter((moment) => clientMomentProgress[moment.id]?.status !== "done"),
    [careMoments, clientMomentProgress]
  );
  const doneCareMoments = useMemo(
    () =>
      careMoments
        .filter((moment) => clientMomentProgress[moment.id]?.status === "done")
        .map((moment) => ({ ...moment, progress: clientMomentProgress[moment.id] })),
    [careMoments, clientMomentProgress]
  );
  const activeCareMoment = useMemo(() => {
    if (pendingCareMoments.length === 0) return null;
    const selected = pendingCareMoments.find((moment) => moment.id === activeMomentId);
    return selected ?? pendingCareMoments[0];
  }, [pendingCareMoments, activeMomentId]);

  function selectCareMoment(momentId) {
    setActiveMomentId(momentId);
  }

  function markCareMomentDone(momentId, payload = {}) {
    if (!momentId) return;
    setCareMomentProgress((current) => ({
      ...current,
      [activeClient.id]: {
        ...(current[activeClient.id] ?? {}),
        [momentId]: { status: "done", sentAt: new Date().toISOString(), ...payload },
      },
    }));
    setActiveMomentId(null);
  }
  const giftRecommendation = useMemo(
    () => recommendGift(activeClient, clientTier),
    [activeClient, clientTier]
  );
  const meetingRecommendation = useMemo(
    () => suggestMeetingSlot(activeClient, meetingsState, careMoments),
    [activeClient, meetingsState, careMoments]
  );
  const focusMoment = activeCareMoment ?? careMoments[0] ?? null;
  const relationshipDraft = useMemo(
    () =>
      generateRelationshipMessage(activeClient, {
        actionTitle: focusMoment?.action,
        careMoment: focusMoment,
        giftRecommendation,
        meetingRecommendation,
      }),
    [activeClient, focusMoment, giftRecommendation, meetingRecommendation]
  );
  const nextActions = useMemo(
    () => generateNextBestActions(activeClient, tasks, partnersState, complianceQueueState),
    [activeClient, tasks, partnersState, complianceQueueState]
  );
  const generatedDraft = useMemo(
    () => {
      if (draftContext?.clientId === activeClient.id) {
        return generateDraftMessage(activeClient, draftContext.action, "Telegram");
      }
      if (composerMode === "follow-up" && focusMoment) {
        return {
          channel: relationshipDraft.channel,
          subject: relationshipDraft.subject,
          body: relationshipDraft.body,
          disclaimers: relationshipDraft.guardrails,
        };
      }
      const draftAction =
        composerMode === "referral"
          ? partnerMatches[0]?.name ?? "partner referral"
          : composerMode === "compliance"
            ? "consent refresh and audit evidence"
            : focusMoment?.action ?? nextActions[0]?.title ?? "client follow-up";
      const channel = "Telegram";
      return generateDraftMessage(activeClient, draftAction, channel);
    },
    [composerMode, activeClient, focusMoment, relationshipDraft, partnerMatches, nextActions, draftContext]
  );

  useEffect(() => {
    setTelegramDraftBody(generatedDraft.body);
    setTelegramStatus({ tone: "idle", text: "" });
  }, [generatedDraft.body, activeClient.id, focusMoment?.id]);

  const businessImpactRows = useMemo(
    () => summarizeBusinessImpact(businessImpactRowsState, clientsState, referrals),
    [businessImpactRowsState, clientsState, referrals]
  );
  const businessImpact = useMemo(
    () =>
      buildImpactSummary({
        activeAdvisor,
        businessImpactRows,
        tasks,
        referrals,
        auditLogs,
        cpd,
        consentRequests,
      }),
    [activeAdvisor, businessImpactRows, tasks, referrals, auditLogs, cpd, consentRequests]
  );
  const adminMetrics = useMemo(
    () =>
      summarizeAdmin({
        clients: clientsState,
        tasks,
        referrals,
        expenses,
        complianceItems: complianceQueueState,
        reviewItems: adminReviewItemsState,
      }),
    [clientsState, tasks, referrals, expenses, complianceQueueState, adminReviewItemsState]
  );
  const adminRelationship = useMemo(
    () => summarizeRelationshipAdmin(clientsState, tasks),
    [clientsState, tasks]
  );

  useEffect(() => {
    const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname, role));
    window.addEventListener("popstate", handlePopState);
    if (window.location.pathname !== currentPath) {
      window.history.replaceState({}, "", currentPath);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentPath, role]);

  useEffect(() => {
    const normalized = normalizePath(currentPath, role);
    if (normalized !== currentPath) {
      navigate(normalized);
    }
  }, [role]);

  function navigate(path) {
    const nextPath = normalizePath(path, role);
    if (nextPath === currentPath) return;
    window.history.pushState({}, "", nextPath);
    setCurrentPath(nextPath);
  }

  function applyDataBundle(bundle) {
    setActiveProfile(bundle.profile);
    setPeople(bundle.advisors);
    setClientsState(bundle.connected ? bundle.clients : bundle.clients.length > 0 ? bundle.clients : clients);
    setTasks(bundle.connected ? bundle.tasks : bundle.tasks.length > 0 ? bundle.tasks : taskSeed);
    setReferrals(bundle.connected ? bundle.referrals : bundle.referrals.length > 0 ? bundle.referrals : seededReferrals);
    setExpenses(bundle.connected ? bundle.expenses : bundle.expenses.length > 0 ? bundle.expenses : expensesSeed);
    setConsentRequests(bundle.consentRequests);
    setAuditLogs(bundle.connected ? bundle.auditLogs : bundle.auditLogs.length > 0 ? bundle.auditLogs : auditLogsSeed);
    setAdminReviewItemsState(bundle.adminReviewItems);
    setBusinessImpactRowsState(bundle.businessImpact);
    setComplianceQueueState(bundle.complianceQueue);
    setCpdCoursesState(bundle.cpdCourses);
    setMeetingsState(bundle.meetings);
    setOvernightSignalsState(bundle.overnightSignals);
    setPartnersState(bundle.partners);
    setActiveClientId((current) => (bundle.clients.some((client) => client.id === current) ? current : "client-tan"));
    setHasClientContext(false);
    setDraftContext(null);
    setComposerMode("follow-up");
    setDataMode(bundle.connected ? "Supabase connected" : "Local fallback");
    const landingPath = bundle.profile.role === "Admin" ? "/admin/impact" : "/advisor/today";
    window.history.replaceState({}, "", landingPath);
    setCurrentPath(landingPath);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const bundle = await signInAdvisorFlow(loginEmail.trim(), loginPassword);
      applyDataBundle(bundle);
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError(error.message || "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await signOutAdvisorFlow();
    setIsAuthenticated(false);
    applyDataBundle(getFallbackData());
  }

  function queueAudit(action, risk = "Low") {
    const log = {
      id: `audit-${Date.now()}`,
      time: new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      actor: role === "Admin" ? activeAdmin.name : activeAdvisor.name,
      action,
      risk,
    };
    setAuditLogs((current) => [log, ...current]);
    createAuditLogRow(log).catch((error) => {
      console.warn("Supabase audit write failed; local audit retained.", error);
    });
    return log;
  }

  function selectClient(clientId, options = {}) {
    const selected = clientsState.find((client) => client.id === clientId);
    setActiveClientId(clientId);
    setHasClientContext(Boolean(selected));
    if (options.draftAction) {
      setDraftContext({ clientId, action: options.draftAction });
      setComposerMode("follow-up");
    } else if (!options.keepDraft) {
      setDraftContext(null);
    }
    if (!selected) return;
    queueAudit(
      selected.consentStatus === "Verified"
        ? `Viewed ${selected.name} client memory`
        : "Viewed masked profile for consent-locked client",
      selected.consentStatus === "Verified" ? "Low" : "High"
    );
  }

  function runMorningBriefAction(item) {
    if (item.clientId) {
      selectClient(item.clientId, { draftAction: item.draftAction });
    }
    queueAudit(`Opened HomePage brief action: ${item.type}`, item.priority === "High" ? "Medium" : "Low");
    navigate(item.targetPath === "/advisor/client" ? "/advisor/actions" : item.targetPath);
  }

  function blockForConsent(action) {
    queueAudit(`Blocked ${action} for consent-locked client until consent refresh`, "High");
  }

  function requestConsentRefresh(reason = "Advisor requested a consent refresh from the action composer.") {
    const alreadyOpen = consentRequests.some(
      (request) => request.clientId === activeClient.id && request.status.startsWith("Pending")
    );
    if (!alreadyOpen) {
      const request = {
        id: `consent-${Date.now()}`,
        clientId: activeClient.id,
        status: "Pending consent refresh",
        reason,
      };
      setConsentRequests((current) => [
        request,
        ...current,
      ]);
      createConsentRequestRow(request).catch((error) => {
        console.warn("Supabase consent request write failed; local request retained.", error);
      });
    }
    queueAudit("Requested consent refresh for consent-locked client", "High");
  }

  function createFollowUp(title = followUpText.trim(), source = "manual") {
    if (!title) return;
    if (consentLocked) {
      blockForConsent("follow-up creation");
      requestConsentRefresh("Follow-up was blocked because the selected client is consent-locked.");
      return;
    }
    const task = {
      id: `task-${Date.now()}`,
      clientId: activeClient.id,
      title,
      due: "2026-06-21",
      status: "Open",
      severity: source === "copilot" ? "high" : "medium",
    };
    setTasks((current) => [task, ...current]);
    createTaskRow(task).catch((error) => {
      console.warn("Supabase task write failed; local task retained.", error);
    });
    queueAudit(`Created ${source} follow-up for ${activeClient.name}`, source === "copilot" ? "Medium" : "Low");
    setFollowUpText("");
  }

  function logCompletedSend({ clientId, title, severity = "medium" }) {
    if (!title) return;
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-send`,
      clientId: clientId ?? activeClient.id,
      title,
      due: new Date().toISOString().slice(0, 10),
      status: "Done",
      severity,
      completedAt: new Date().toISOString(),
    };
    setTasks((current) => [task, ...current]);
    createTaskRow(task).catch((error) => {
      console.warn("Supabase task write failed; local task retained.", error);
    });
  }

  function completeTask(taskId) {
    const targetTask = tasks.find((task) => task.id === taskId);
    const targetClient = clientsState.find((client) => client.id === targetTask?.clientId);
    const isConsentTask = /consent|pdpa/i.test(targetTask?.title ?? "");
    if (targetClient?.consentStatus !== "Verified" && !isConsentTask) {
      queueAudit("Blocked task update for consent-locked client until consent refresh", "High");
      return;
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status: "Done" } : task))
    );
    completeTaskRow(taskId).catch((error) => {
      console.warn("Supabase task completion failed; local completion retained.", error);
    });
    queueAudit(`Completed advisor follow-up${targetClient ? ` for ${formatClientName(targetClient.id, clientsState)}` : ""}`);
  }

  function createReferral(partner = partnerMatches[0], note = partner?.reason, clientOverride = activeClient) {
    if (!partner) return;
    const targetClient = clientOverride ?? activeClient;
    const targetLocked = targetClient.consentStatus !== "Verified";
    if (targetLocked) {
      blockForConsent("partner referral");
      requestConsentRefresh("Referral recommendation was blocked pending consent verification.");
      return;
    }
    setHasClientContext(true);
    setActiveClientId(targetClient.id);
    const expectedValue = targetClient.annualPremium ? Math.round(targetClient.annualPremium * 0.45) : 0;
    const referral = {
      id: `ref-${Date.now()}`,
      clientId: targetClient.id,
      partnerId: partner.id,
      partnerName: partner.name,
      status: "Submitted",
      note,
      stage: "Advisor submitted",
      value: expectedValue,
      expectedValue,
      probability: 74,
    };
    setReferrals((current) => [referral, ...current]);
    createReferralRow(referral).catch((error) => {
      console.warn("Supabase referral write failed; local referral retained.", error);
    });
    queueAudit(`Created ${partner.name} referral for ${targetClient.name}`, "Medium");
  }

  function createExpense() {
    if (consentLocked) {
      blockForConsent("expense submission");
      return;
    }
    const amount = Number.parseFloat(expenseAmount);
    const normalizedAmount = Math.round(amount * 100) / 100;
    if (!Number.isFinite(amount) || normalizedAmount < 0.01 || normalizedAmount > 10000) {
      queueAudit("Blocked invalid expense input", "Medium");
      return;
    }
    const expense = {
      id: `exp-${Date.now()}`,
      advisorId: activeAdvisor.id,
      clientId: activeClient.id,
      category: "Client follow-up",
      amount: normalizedAmount,
      status: normalizedAmount > 100 ? "Flagged" : "Pending",
      date: "2026-06-20",
    };
    setExpenses((current) => [expense, ...current]);
    createExpenseRow(expense).catch((error) => {
      console.warn("Supabase expense write failed; local expense retained.", error);
    });
    queueAudit(
      `Submitted RM ${normalizedAmount} expense for ${activeClient.name}`,
      normalizedAmount > 100 ? "High" : "Low"
    );
    setExpenseAmount("");
  }

  async function approveComposerDraft() {
    setTelegramStatus({ tone: "idle", text: "" });
    const messageToSend = telegramDraftBody.trim();

    if (!messageToSend) {
      setTelegramStatus({
        tone: "error",
        text: "Telegram message cannot be empty.",
      });
      return;
    }

    if (consentLocked) {
      blockForConsent("Telegram message sending");
      requestConsentRefresh("Telegram message was blocked because the selected client is consent-locked.");
      setTelegramStatus({
        tone: "error",
        text: "Telegram blocked until consent is verified.",
      });
      return;
    }

    if (!telegramReady) {
      queueAudit(`Blocked Telegram send for ${activeClient.name} because chat ID or opt-in is missing`, "Medium");
      setTelegramStatus({
        tone: "error",
        text: "Telegram not ready. Add client chat ID and opt-in in Supabase.",
      });
      return;
    }

    setTelegramStatus({ tone: "sending", text: "Sending Telegram message..." });

    const momentSnapshot = activeCareMoment ? { ...activeCareMoment } : null;
    const clientSnapshot = { id: activeClient.id, name: activeClient.name };
    const subjectSnapshot = generatedDraft.subject;

    function markMomentApproved(channelLabel) {
      const momentLabel = momentSnapshot
        ? `${momentSnapshot.type}: ${momentSnapshot.title}`
        : subjectSnapshot;
      logCompletedSend({
        clientId: clientSnapshot.id,
        title: `${channelLabel} - ${momentLabel}`,
        severity: momentSnapshot?.priority?.toLowerCase() === "high" ? "high" : "medium",
      });
      if (momentSnapshot?.id) {
        markCareMomentDone(momentSnapshot.id, {
          channel: channelLabel,
          subject: subjectSnapshot,
          momentType: momentSnapshot.type,
          momentTitle: momentSnapshot.title,
          clientId: clientSnapshot.id,
        });
      }
    }

    try {
      const result = await sendTelegramMessage({
        clientId: activeClient.id,
        subject: generatedDraft.subject,
        message: messageToSend,
      });

      if (result.localOnly) {
        setTelegramStatus({
          tone: "warn",
          text: `Demo mode: ${result.message} The message is logged to Follow-Up Manager and the care moment is marked done.`,
        });
        queueAudit(`Approved (local only) Telegram draft for ${activeClient.name}: ${generatedDraft.subject}`, "Low");
        markMomentApproved("Local approval");
      } else {
        setTelegramStatus({ tone: "success", text: "Telegram message sent and audited." });
        queueAudit(`Sent Telegram message to ${activeClient.name}: ${generatedDraft.subject}`, "Low");
        markMomentApproved("Telegram");
      }
    } catch (error) {
      const detail = error.message || "Telegram message failed.";
      if (error.edgeFunctionFailure) {
        setTelegramStatus({
          tone: "warn",
          text: `Telegram bot not delivered: ${detail}. Common causes: TELEGRAM_BOT_TOKEN missing on the Supabase Edge Function, client never started the bot, or chat_id mismatch. The message is logged to Follow-Up Manager and the care moment is marked done so the demo can continue.`,
        });
        queueAudit(`Telegram delivery failed for ${activeClient.name}; approved locally - ${detail}`, "Medium");
        markMomentApproved("Local approval (Edge failed)");
        return;
      }
      setTelegramStatus({ tone: "error", text: detail });
      queueAudit(`Telegram message failed for ${activeClient.name}`, "Medium");
      return;
    }

    if (composerMode === "referral") {
      createReferral(partnerMatches[0], messageToSend);
      return;
    }
    if (composerMode === "compliance") {
      requestConsentRefresh(messageToSend);
      return;
    }
    // logCompletedSend (inside markMomentApproved) already records the send as a Done
    // follow-up task. No additional createFollowUp call needed here - it just duplicated.
  }

  return (
    <main className="app-shell">
      <TopBar
        businessImpact={businessImpact}
        dataMode={dataMode}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        user={activeProfile}
      />
      {!isAuthenticated ? (
        <LoginPanel
          email={loginEmail}
          error={loginError}
          isLoggingIn={isLoggingIn}
          onEmailChange={setLoginEmail}
          onLogin={handleLogin}
          onPasswordChange={setLoginPassword}
          password={loginPassword}
        />
      ) : (
      <div className="primary-layout">
        <NavigationShell
          currentPath={currentPath}
          hasClientContext={hasClientContext}
          navigate={navigate}
          role={role}
        />
        <div className="route-surface">
          {role === "Advisor" ? (
            <AdvisorExperience
              activeCareMoment={activeCareMoment}
              activeClient={activeClient}
              activeClientId={activeClientId}
              activeExpenses={activeExpenses}
              activeReferrals={activeReferrals}
              activeTasks={activeTasks}
              recentDoneTasks={recentDoneTasks}
              businessImpact={businessImpact}
              careMoments={careMoments}
              doneCareMoments={doneCareMoments}
              onSelectMoment={selectCareMoment}
              pendingCareMoments={pendingCareMoments}
              clientBrief={clientBrief}
              clientTier={clientTier}
              clientValueScore={clientValueScore}
              clientsState={clientsState}
              complianceRisk={complianceRisk}
              composerMode={composerMode}
              consentLocked={consentLocked}
              cpd={cpd}
              cpdModules={cpdModules}
              activeAdvisor={activeAdvisor}
              createExpense={createExpense}
              createFollowUp={createFollowUp}
              createReferral={createReferral}
              expenseAmount={expenseAmount}
              followUpText={followUpText}
              generatedDraft={generatedDraft}
              giftRecommendation={giftRecommendation}
              meetingRecommendation={meetingRecommendation}
              meetings={meetingsState}
              morningBrief={morningBrief}
              morningBriefActions={morningBriefActions}
              navigate={navigate}
              nextActions={nextActions}
              onApproveDraft={approveComposerDraft}
              partnerMatches={partnerMatches}
              partnersState={partnersState}
              priorityClients={priorityClients}
              referrals={referrals}
              relationshipDraft={relationshipDraft}
              requestConsentRefresh={requestConsentRefresh}
              route={currentPath}
              runMorningBriefAction={runMorningBriefAction}
              selectClient={selectClient}
              setComposerMode={setComposerMode}
              setExpenseAmount={setExpenseAmount}
              setFollowUpText={setFollowUpText}
              setTelegramDraftBody={setTelegramDraftBody}
              telegramDraftBody={telegramDraftBody}
              telegramReady={telegramReady}
              telegramStatus={telegramStatus}
              completeTask={completeTask}
              complianceQueue={complianceQueueState}
              tasks={tasks}
            />
          ) : (
            <AdminExperience
              adminMetrics={adminMetrics}
              adminReviewItems={adminReviewItemsState}
              auditLogs={auditLogs}
              businessImpact={businessImpact}
              businessImpactRows={businessImpactRows}
              clientsState={clientsState}
              complianceQueue={complianceQueueState}
              consentRequests={consentRequests}
              cpd={cpd}
              expenses={expenses}
              referrals={referrals}
              relationshipSummary={adminRelationship}
              route={currentPath}
              tasks={tasks}
            />
          )}
        </div>
      </div>
      )}
    </main>
  );
}

function LoginPanel({
  email,
  error,
  isLoggingIn,
  onEmailChange,
  onLogin,
  onPasswordChange,
  password,
}) {
  return (
    <section className="login-shell">
      <form className="login-panel" onSubmit={onLogin}>
        <div>
          <p className="eyebrow">Secure workspace</p>
          <h2>Sign in to AdvisorFlow AI</h2>
          <p>
            Use your Supabase Auth account. Admin and advisor access is loaded from your linked profile.
          </p>
        </div>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="primary-action" disabled={isLoggingIn} type="submit">
          {isLoggingIn ? "Signing in" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

function TopBar({ businessImpact, dataMode, isAuthenticated, onLogout, user }) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark">AF</div>
        <div>
          <p className="eyebrow">Secure advisory operating platform</p>
          <h1>AdvisorFlow AI</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="score-pill">
          <span>Guardrails</span>
          <strong>{businessImpact.blockedRisks}</strong>
        </div>
        <div className="identity">
          <span>{user.name}</span>
          <small>{user.role} - {dataMode}</small>
        </div>
        {isAuthenticated && (
          <button className="ghost topbar-logout" onClick={onLogout} type="button">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

function NavigationShell({ currentPath, hasClientContext, navigate, role }) {
  const routes = role === "Admin" ? adminRoutes : advisorRoutes;
  const [clientNavOpen, setClientNavOpen] = useState(true);
  const nestedRoutes = routes.filter((route) => route.nested);
  return (
    <aside className="side-nav">
      <div>
        <span>{role}</span>
        {routes
          .filter((route) => role === "Admin" || (!route.hidden && !route.nested))
          .map((route) => {
            if (role !== "Admin" && route.path === "/advisor/clients") {
              return (
                <div className="client-nav-group" key={route.path}>
                  <div className="nav-row">
                    <button
                      className={currentPath === route.path ? "active" : ""}
                      onClick={() => navigate(route.path)}
                      type="button"
                    >
                      {route.label}
                    </button>
                    <button
                      aria-expanded={clientNavOpen}
                      aria-label={clientNavOpen ? "Hide client subpages" : "Show client subpages"}
                      className={`nav-toggle ${clientNavOpen ? "open" : ""}`}
                      onClick={() => setClientNavOpen((current) => !current)}
                      title={clientNavOpen ? "Hide client subpages" : "Show client subpages"}
                      type="button"
                    >
                      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                        <path d="M2 4.5 L6 8.5 L10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  {clientNavOpen &&
                    nestedRoutes.map((nestedRoute) => (
                      <button
                        className={`${currentPath === nestedRoute.path ? "active" : ""} sub-route`}
                        key={nestedRoute.path}
                        onClick={() => navigate(nestedRoute.path)}
                        type="button"
                      >
                        {nestedRoute.label}
                      </button>
                    ))}
                </div>
              );
            }

            return (
              <button
                className={currentPath === route.path ? "active" : ""}
                key={route.path}
                onClick={() => navigate(route.path)}
                type="button"
              >
                {route.label}
              </button>
            );
          })}
      </div>
      <small>{role} workspace</small>
    </aside>
  );
}

function AdvisorExperience(props) {
  const {
    activeAdvisor,
    activeCareMoment,
    activeClient,
    activeClientId,
    activeExpenses,
    activeReferrals,
    activeTasks,
    businessImpact,
    careMoments,
    doneCareMoments,
    onSelectMoment,
    pendingCareMoments,
    recentDoneTasks,
    clientBrief,
    clientTier,
    clientValueScore,
    clientsState,
    complianceQueue,
    complianceRisk,
    composerMode,
    consentLocked,
    cpd,
    cpdModules,
    createExpense,
    createFollowUp,
    createReferral,
    expenseAmount,
    followUpText,
    generatedDraft,
    giftRecommendation,
    meetingRecommendation,
    meetings,
    morningBrief,
    morningBriefActions,
    navigate,
    nextActions,
    onApproveDraft,
    partnerMatches,
    partnersState,
    priorityClients,
    referrals,
    relationshipDraft,
    requestConsentRefresh,
    runMorningBriefAction,
    selectClient,
    setComposerMode,
    setExpenseAmount,
    setFollowUpText,
    setTelegramDraftBody,
    telegramDraftBody,
    telegramReady,
    telegramStatus,
    completeTask,
    tasks,
    route,
  } = props;
  const [clientQuery, setClientQuery] = useState("");
  const [clientSort, setClientSort] = useState("tier");

  useEffect(() => {
    if (route === "/advisor/actions" && composerMode !== "follow-up") {
      setComposerMode("follow-up");
    }
  }, [composerMode, route, setComposerMode]);

  const allCareMoments = useMemo(
    () =>
      clientsState.flatMap((client) =>
        detectCareMoments(client, tasks).map((moment) => ({
          ...moment,
          clientId: client.id,
          clientName: displayClientName(client),
        }))
      ),
    [clientsState, tasks]
  );

  const searchableClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    return [...priorityClients]
      .filter((client) => {
        if (!query) return true;
        return [client.name, clientTitle(client), client.tier, client.nextBestOffer, client.needs?.join(" ")]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (clientSort === "priority") return b.score - a.score;
        if (clientSort === "nextMeeting") return String(a.nextMeeting ?? "").localeCompare(String(b.nextMeeting ?? ""));
        if (clientSort === "opportunity") return (b.opportunityValue ?? 0) - (a.opportunityValue ?? 0);
        if (clientSort === "title") return clientTitle(a).localeCompare(clientTitle(b)) || b.score - a.score;
        return (tierRank[b.tier] ?? 0) - (tierRank[a.tier] ?? 0) || b.score - a.score;
      });
  }, [clientQuery, clientSort, priorityClients]);

  const clientQueue = (
    <section className="panel">
      <PanelHeader title="Client Priority Queue" meta={`${searchableClients.length} visible`} />
      <div className="client-toolbar">
        <input
          aria-label="Search client"
          onChange={(event) => setClientQuery(event.target.value)}
          placeholder="Search client name, title, tier or need"
          value={clientQuery}
        />
        <select aria-label="Sort clients" onChange={(event) => setClientSort(event.target.value)} value={clientSort}>
          <option value="tier">Sort by tier</option>
          <option value="priority">Sort by priority score</option>
          <option value="nextMeeting">Sort by next meeting</option>
          <option value="opportunity">Sort by opportunity value</option>
          <option value="title">Sort by Mr/Ms/Dr/Encik</option>
        </select>
      </div>
      <div className="client-strip">
        {searchableClients.map((client) => {
          const locked = client.consentStatus !== "Verified";
          const tierLabel = locked ? "Hold" : client.tier;
          const tierClass = locked ? "hold" : (client.tier ?? "Silver").toLowerCase();
          return (
            <button
              className={`client-tile tile-tier-${tierClass} ${activeClientId === client.id ? "selected" : ""} ${
                locked ? "locked" : ""
              }`}
              key={client.id}
              onClick={() => {
                selectClient(client.id);
                navigate("/advisor/client");
              }}
              type="button"
            >
              <header className="tile-head">
                <span className="tile-name">{displayClientName(client)}</span>
                <em className={`tier-badge badge-${tierClass}`}>{tierLabel}</em>
              </header>
              {!locked && (
                <div className="tile-score">
                  <span>Value score</span>
                  <strong>{client.valueScore}<i>/100</i></strong>
                </div>
              )}
              <p className="tile-summary">
                {locked
                  ? "Private signals masked / Consent hold"
                  : client.tierDescription}
              </p>
              {!locked && client.prioritySignals?.length > 0 && (
                <ul className="tile-signals">
                  {client.prioritySignals.slice(0, 2).map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );

  if (route === "/advisor/clients") {
    return (
      <div className="page-stack">
        {clientQueue}
        <div className="content-grid three">
          <ClientTierPanel
            activeClient={activeClient}
            clientTier={clientTier}
            clientValueScore={clientValueScore}
          />
          <CareMomentsPanel
            activeClient={activeClient}
            careMoments={careMoments}
            doneCareMoments={doneCareMoments}
            pendingCareMoments={pendingCareMoments}
          />
          <MeetingsPanel clientsState={clientsState} meetings={meetings} />
        </div>
        <div className="content-grid">
          <RelationshipSuggestionsPanel
            activeClient={activeClient}
            giftRecommendation={giftRecommendation}
            meetingRecommendation={meetingRecommendation}
            relationshipDraft={relationshipDraft}
          />
          <CompliancePanel
            activeClient={activeClient}
            complianceRisk={complianceRisk}
            consentLocked={consentLocked}
            requestConsentRefresh={requestConsentRefresh}
          />
        </div>
      </div>
    );
  }

  if (route === "/advisor/client") {
    return (
      <div className="page-stack">
        <SelectedClientBar
          activeClient={activeClient}
          activeTasks={activeTasks}
          clientTier={clientTier}
          consentLocked={consentLocked}
          telegramReady={telegramReady}
        />
        <div className="content-grid">
          <ClientMemory activeClient={activeClient} />
          <ClientTierPanel
            activeClient={activeClient}
            clientTier={clientTier}
            clientValueScore={clientValueScore}
          />
        </div>
        <div className="content-grid">
          <RelationshipSuggestionsPanel
            activeClient={activeClient}
            giftRecommendation={giftRecommendation}
            meetingRecommendation={meetingRecommendation}
            relationshipDraft={relationshipDraft}
          />
          <CopilotPanel
            activeClient={activeClient}
            clientBrief={clientBrief}
            complianceRisk={complianceRisk}
            nextActions={nextActions}
          />
        </div>
      </div>
    );
  }

  if (route === "/advisor/ai-profile") {
    return (
      <div className="page-stack">
        <SelectedClientBar
          activeClient={activeClient}
          activeTasks={activeTasks}
          clientTier={clientTier}
          consentLocked={consentLocked}
          telegramReady={telegramReady}
        />
        <AIProfilePage activeClient={activeClient} consentLocked={consentLocked} />
      </div>
    );
  }

  if (route === "/advisor/actions") {
    return (
      <div className="page-stack">
        <SelectedClientBar
          activeClient={activeClient}
          activeTasks={activeTasks}
          clientTier={clientTier}
          consentLocked={consentLocked}
          telegramReady={telegramReady}
        />
        <TelegramBotConsole
          activeClient={activeClient}
          activeCareMoment={activeCareMoment}
          doneCareMoments={doneCareMoments}
          pendingCareMoments={pendingCareMoments}
          consentLocked={consentLocked}
          generatedDraft={generatedDraft}
          nextActions={nextActions}
          onSelectMoment={onSelectMoment}
          onSend={onApproveDraft}
          setTelegramDraftBody={setTelegramDraftBody}
          telegramDraftBody={telegramDraftBody}
          telegramReady={telegramReady}
          telegramStatus={telegramStatus}
        />
        <div className="content-grid three">
          <FollowUpManager
            activeTasks={activeTasks}
            completeTask={completeTask}
            consentLocked={consentLocked}
            createFollowUp={createFollowUp}
            followUpText={followUpText}
            recentDoneTasks={recentDoneTasks}
            setFollowUpText={setFollowUpText}
          />
          <RelationshipActionPlan careMoments={careMoments} giftRecommendation={giftRecommendation} />
          <CompliancePanel
            activeClient={activeClient}
            complianceRisk={complianceRisk}
            consentLocked={consentLocked}
            requestConsentRefresh={requestConsentRefresh}
          />
        </div>
      </div>
    );
  }

  if (route === "/advisor/partners") {
    return (
      <PartnerHub
        clientsState={clientsState}
        complianceQueue={complianceQueue}
        createReferral={createReferral}
        partnersState={partnersState}
        referrals={referrals}
      />
    );
  }

  if (route === "/advisor/learning") {
    return (
      <LearningFeature 
        activeAdvisor={activeAdvisor} 
        clientsState={clientsState} 
        cpdModules={cpdModules} 
        cpd={cpd} 
        businessImpact={businessImpact} 
      />
    );
  }

  if (route === "/advisor/claims") {
    return (
      <div className="content-grid">
        <ReferralExpensePanel
          activeExpenses={activeExpenses}
          activeReferrals={activeReferrals}
          consentLocked={consentLocked}
          createExpense={createExpense}
          expenseAmount={expenseAmount}
          setExpenseAmount={setExpenseAmount}
        />
        <CompliancePanel
          activeClient={activeClient}
          complianceRisk={complianceRisk}
          consentLocked={consentLocked}
          requestConsentRefresh={requestConsentRefresh}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="command-hero home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Advisor HomePage</p>
          <h2>Start the day with a voice brief, then act on every signal.</h2>
          <p>
            HomePage surfaces today's agenda, urgent client care, and keeps the client cockpit,
            AI profile, and action workspace one click away.
          </p>
        </div>
        <div className="home-hero-stats">
          <ImpactStat label="Managed Premium" value={businessImpact.managedPremium} />
          <ImpactStat label="Pipeline Value" value={businessImpact.referralPipeline} />
          <ImpactStat label="Blocked Risks" value={businessImpact.blockedRisks} />
        </div>
      </section>

      <MorningCommandPanel
        actions={morningBriefActions}
        meetings={meetings}
        onRunAction={runMorningBriefAction}
      />
      <div className="content-grid home-row">
        <MeetingsPanel clientsState={clientsState} meetings={meetings} title="Today Agenda" />
        <WeeklyCareMomentsPanel careMoments={allCareMoments} onSelectClient={selectClient} />
      </div>
      <div className="content-grid home-row home-row-split">
        <RelationshipSuggestionsPanel
          activeClient={activeClient}
          giftRecommendation={giftRecommendation}
          meetingRecommendation={meetingRecommendation}
          relationshipDraft={relationshipDraft}
        />
        <CompliancePanel
          activeClient={activeClient}
          complianceRisk={complianceRisk}
          consentLocked={consentLocked}
          requestConsentRefresh={requestConsentRefresh}
        />
      </div>
    </div>
  );
}

function MorningCommandPanel({ actions, meetings, onRunAction }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const briefingText = useMemo(() => {
    const agendaLines = meetings.slice(0, 3).map((meeting) => `${meeting.time}: ${meeting.topic}`);
    return [
      "Good morning. Here is your AdvisorFlow briefing.",
      ...actions.map((item) => item.label),
      agendaLines.length > 0 ? `Today's agenda includes ${agendaLines.join(". ")}.` : "There are no meetings currently scheduled today.",
      "Open each brief point to continue in the correct workspace.",
    ].join(" ");
  }, [actions, meetings]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function playBriefing() {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(briefingText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  return (
    <section className="panel morning-panel">
      <div className="morning-header">
        <PanelHeader title="Morning Command Brief" meta="Generated 08:00 MYT" />
        <button className="voice-action" onClick={playBriefing} type="button">
          {isSpeaking ? "Stop Voice Briefing" : "Play Voice Briefing"}
        </button>
      </div>
      <div className="brief-grid">
        {actions.map((item) => (
          <button
            className={`brief-card brief-${item.priority.toLowerCase()}`}
            key={item.id}
            onClick={() => onRunAction(item)}
            type="button"
          >
            <span>{item.type}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function WeeklyCareMomentsPanel({ careMoments, onSelectClient }) {
  return (
    <section className="panel care-panel">
      <PanelHeader title="This Week Care Moments" meta={`${careMoments.length} signals`} />
      <div className="stack">
        {careMoments.slice(0, 6).map((moment) => (
          <button
            className={`care-moment priority-${moment.priority.toLowerCase()}`}
            key={`${moment.clientId}-${moment.id}`}
            onClick={() => onSelectClient(moment.clientId)}
            type="button"
          >
            <div>
              <span>{moment.clientName} - {moment.type} - {moment.due}</span>
              <strong>{moment.title}</strong>
              <p>{moment.reason}</p>
            </div>
            <b>{moment.priority}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function SelectedClientBar({ activeClient, activeTasks, clientTier, consentLocked, telegramReady }) {
  return (
    <section className={`selected-client-bar ${consentLocked ? "locked" : ""}`}>
      <div>
        <span>Selected client</span>
        <strong>{displayClientName(activeClient)}</strong>
      </div>
      <div>
        <span>Priority</span>
        <strong>{consentLocked ? "Hold" : clientTier.tier}</strong>
      </div>
      <div>
        <span>Consent</span>
        <strong>{activeClient.consentStatus}</strong>
      </div>
      <div>
        <span>Telegram</span>
        <strong>{telegramReady ? "Ready" : "Setup needed"}</strong>
      </div>
      <div>
        <span>Open actions</span>
        <strong>{activeTasks.length}</strong>
      </div>
    </section>
  );
}

function ClientTierPanel({ activeClient, clientTier, clientValueScore }) {
  const locked = activeClient.consentStatus !== "Verified";

  return (
    <section className="panel tier-panel">
      <PanelHeader title="Relationship Priority" meta={locked ? "Masked" : `${clientTier.tier} tier`} />
      {locked ? (
        <div className="masked-state">
          <strong>Tier hidden</strong>
          <p>Value score inputs are masked until consent is verified.</p>
        </div>
      ) : (
        <>
          <div className={`tier-score tier-${clientTier.tone}`}>
            <div>
              <span>{clientTier.range}</span>
              <strong>{clientTier.tier}</strong>
            </div>
            <b>{clientValueScore.score}/100</b>
          </div>
          <p>{clientTier.description}</p>
          <div className="factor-grid">
            {clientValueScore.factors.map((factor) => (
              <article key={factor.label}>
                <div>
                  <strong>{factor.label}</strong>
                  <span>{factor.value}</span>
                </div>
                <b>{factor.points}/{factor.max}</b>
              </article>
            ))}
          </div>
          <ul className="compact-list">
            {clientValueScore.explanation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CareMomentsPanel({ activeClient, careMoments, pendingCareMoments, doneCareMoments = [] }) {
  const pending = Array.isArray(pendingCareMoments) ? pendingCareMoments : careMoments ?? [];
  const total = pending.length + doneCareMoments.length;
  return (
    <section className="panel care-panel">
      <PanelHeader
        title="Care Moments"
        meta={total > 0
          ? `${pending.length} pending - ${doneCareMoments.length} done`
          : displayClientName(activeClient)}
      />
      <div className="stack">
        {pending.length === 0 && doneCareMoments.length === 0 && (
          <p className="quiet-text">No care moments detected for {displayClientName(activeClient)}.</p>
        )}
        {pending.length === 0 && doneCareMoments.length > 0 && (
          <p className="quiet-text">All care moments handled for {displayClientName(activeClient)}.</p>
        )}
        {pending.map((moment) => (
          <article className={`care-moment priority-${moment.priority.toLowerCase()}`} key={moment.id}>
            <div>
              <span>{moment.type} - {moment.due}</span>
              <strong>{moment.title}</strong>
              <p>{moment.reason}</p>
            </div>
            <b>{moment.priority}</b>
          </article>
        ))}
        {doneCareMoments.length > 0 && (
          <div className="care-done-block">
            <span className="eyebrow">Completed</span>
            {doneCareMoments.map((moment) => (
              <article className="care-moment care-done" key={moment.id}>
                <div>
                  <span>✓ {moment.type}</span>
                  <strong>{moment.title}</strong>
                  <small>
                    {moment.progress?.channel ?? "Telegram"} -{" "}
                    {moment.progress?.sentAt
                      ? new Date(moment.progress.sentAt).toLocaleString()
                      : "sent"}
                  </small>
                </div>
                <b>Done</b>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RelationshipSuggestionsPanel({
  activeClient,
  giftRecommendation,
  meetingRecommendation,
  relationshipDraft,
}) {
  const locked = activeClient.consentStatus !== "Verified";

  const telegramReady = activeClient.telegramOptIn && activeClient.telegramChatId;
  const giftStatus = giftRecommendation.allowed
    ? { tone: "ok", label: giftRecommendation.budget }
    : { tone: "block", label: "Blocked" };
  const telegramStatus = telegramReady
    ? { tone: "ok", label: "Ready" }
    : { tone: "warn", label: "Not ready" };

  return (
    <section className="panel relationship-suggestions">
      <PanelHeader title="Personalized Suggestions" meta={locked ? "Consent-safe" : relationshipDraft.tone} />
      <div className="suggestion-tiles">
        <article className="suggestion-tile">
          <header>
            <span>Gift guardrail</span>
            <b className={`chip chip-${giftStatus.tone}`}>{giftStatus.label}</b>
          </header>
          <strong>{giftRecommendation.recommendation}</strong>
          <p>{giftRecommendation.rationale}</p>
        </article>
        <article className="suggestion-tile">
          <header>
            <span>Best slot</span>
            <b className="chip chip-info">{meetingRecommendation.channel}</b>
          </header>
          <strong>{meetingRecommendation.slot}</strong>
          <p>{meetingRecommendation.reason}</p>
        </article>
        <article className="suggestion-tile">
          <header>
            <span>Telegram bridge</span>
            <b className={`chip chip-${telegramStatus.tone}`}>{telegramStatus.label}</b>
          </header>
          <strong>{activeClient.telegramOptIn ? "Client opted in" : "Opt-in needed"}</strong>
          <p>
            {activeClient.telegramChatId
              ? "Chat ID is saved. Advisor can send after reviewing the draft."
              : "Add telegram_chat_id after the client starts the bot."}
          </p>
        </article>
      </div>
      <div className="draft-box relationship-draft">
        <span>{relationshipDraft.channel}</span>
        <strong>{relationshipDraft.subject}</strong>
        <p>{relationshipDraft.body}</p>
      </div>
      <ul className="compact-list">
        {giftRecommendation.guardrails.slice(0, 3).map((guardrail) => (
          <li key={guardrail}>{guardrail}</li>
        ))}
      </ul>
    </section>
  );
}

function RelationshipActionPlan({ careMoments, giftRecommendation }) {
  return (
    <section className="panel action-plan-panel">
      <PanelHeader title="Relationship Action Plan" meta={`${careMoments.length} care signals`} />
      <div className="timeline action-timeline">
        {careMoments.map((moment, index) => (
          <article key={moment.id}>
            <small>Step {index + 1} - {moment.due}</small>
            <strong>{moment.action}</strong>
          </article>
        ))}
        <article className={giftRecommendation.allowed ? "" : "consent-hold"}>
          <small>Gift policy</small>
          <strong>{giftRecommendation.recommendation} - {giftRecommendation.allowed ? giftRecommendation.budget : "blocked"}</strong>
        </article>
      </div>
    </section>
  );
}

const SENSITIVE_SIGNAL_PATTERNS = [
  /missed premium/i,
  /lapse/i,
  /accident/i,
  /bereave|deceased|passed away|loss of/i,
  /hospital|illness|surgery|diagnos/i,
  /complaint|service risk|service issue|dispute/i,
  /claim denied|claim rejected|fraud/i,
  /consent (review|due|hold)/i,
  /compliance hold|disclosure overdue/i,
  /retrench|laid off|job loss/i,
];

const SENSITIVE_CARE_TYPES = new Set([
  "Service risk",
  "Compliance hold",
  "Bereavement",
  "Claim issue",
]);

function classifyCaseSensitivity({ careMoment, signals = [], lifeEvent, consentVerified }) {
  const reasons = [];

  if (!consentVerified) {
    reasons.push("Consent not verified - caring tone only");
  }

  if (careMoment && SENSITIVE_CARE_TYPES.has(careMoment.type)) {
    reasons.push(`Care moment is sensitive: ${careMoment.type}`);
  }

  signals.forEach((signal) => {
    if (SENSITIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(signal))) {
      reasons.push(`Sensitive signal: ${signal}`);
    }
  });

  if (lifeEvent && SENSITIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(lifeEvent))) {
    reasons.push(`Sensitive life event: ${lifeEvent}`);
  }

  return {
    sensitivity: reasons.length > 0 ? "sensitive" : "neutral",
    sensitiveReasons: reasons,
  };
}

function TelegramBotConsole({
  activeClient,
  activeCareMoment,
  consentLocked,
  doneCareMoments = [],
  generatedDraft,
  nextActions,
  onSelectMoment,
  onSend,
  pendingCareMoments = [],
  setTelegramDraftBody,
  telegramDraftBody,
  telegramReady,
  telegramStatus,
}) {
  const { profile, loading: profileLoading, runAnalysis } = useClientProfile(activeClient);
  const { tailored, loading: tailoringLoading, error: tailoringError, runTailoring } =
    useTailoredMessage(activeClient, activeCareMoment?.id);

  const checks = [
    ["Consent verified", !consentLocked],
    ["Client opted in", Boolean(activeClient.telegramOptIn)],
    ["Chat ID saved", Boolean(activeClient.telegramChatId)],
    ["Advisor approval", true],
  ];
  const checksPassed = checks.filter(([, ok]) => ok).length;

  const todaysCase = useMemo(() => {
    const careMoment = activeCareMoment
      ? {
          type: activeCareMoment.type,
          due: activeCareMoment.due,
          title: activeCareMoment.title,
          action: activeCareMoment.action,
          reason: activeCareMoment.reason,
          priority: activeCareMoment.priority,
        }
      : null;
    const signals = activeClient.prioritySignals?.slice(0, 3) ?? [];
    const lifeEvent = activeClient.lifeEvent ?? null;

    const { sensitivity, sensitiveReasons } = classifyCaseSensitivity({
      careMoment,
      signals,
      lifeEvent,
      consentVerified: !consentLocked,
    });

    const isSensitive = sensitivity === "sensitive";

    return {
      careMoment,
      nextBestAction: isSensitive ? null : nextActions?.[0]?.title ?? null,
      prioritySignals: signals,
      lifeEvent: isSensitive ? null : lifeEvent,
      caseSensitivity: sensitivity,
      sensitiveReasons,
      productHook: isSensitive ? null : activeClient.nextBestOffer ?? null,
    };
  }, [activeClient, activeCareMoment, nextActions, consentLocked]);

  const handleTailor = () => {
    if (!profile) {
      runAnalysis();
      return;
    }
    runTailoring({ profile, context: todaysCase });
  };

  useEffect(() => {
    if (tailored?.body) {
      setTelegramDraftBody(tailored.body);
    }
  }, [tailored?.body, setTelegramDraftBody]);

  useEffect(() => {
    if (
      profile &&
      activeCareMoment?.id &&
      !tailored &&
      !tailoringLoading &&
      !tailoringError &&
      !consentLocked
    ) {
      runTailoring({ profile, context: todaysCase });
    }
  }, [
    profile,
    activeCareMoment?.id,
    tailored,
    tailoringLoading,
    tailoringError,
    consentLocked,
    runTailoring,
    todaysCase,
  ]);

  const draftBody = telegramDraftBody || tailored?.body || generatedDraft.body;
  const draftSubject = tailored?.subject || generatedDraft.subject;
  const tailoringStatus = tailoringLoading
    ? `Tailoring for ${activeCareMoment?.type ?? "this moment"}...`
    : profileLoading
      ? "Loading AI profile..."
      : tailored
        ? `AI-tailored for ${activeCareMoment?.type ?? "this moment"}`
        : profile
          ? "Profile ready - click Tailor"
          : "Generate AI profile first";

  return (
    <section className="panel telegram-console action-console">
      <header className="console-head">
        <div>
          <span className="eyebrow">Auto Recommendation Message</span>
          <h3>Tailored Telegram message for {displayClientName(activeClient)}</h3>
          <p className="console-sub">
            Reads the AI behavioural profile (personality, tone, hooks) and today's case to draft a
            message the advisor approves before sending.
          </p>
        </div>
        <div className="console-status">
          <span className={`pill pill-${telegramReady ? "ok" : "warn"}`}>
            {telegramReady ? "Channel ready" : "Setup needed"}
          </span>
          <span className={`pill pill-${tailored ? "ok" : profile ? "info" : "warn"}`}>
            {tailoringStatus}
          </span>
        </div>
      </header>

      <div className="readiness-row">
        {checks.map(([label, passed]) => (
          <span key={label} className={`readiness-chip ${passed ? "ok" : "warn"}`}>
            <i aria-hidden="true">{passed ? "✓" : "!"}</i>
            {label}
          </span>
        ))}
        <span className="readiness-count">{checksPassed}/{checks.length} checks</span>
      </div>

      {(pendingCareMoments.length > 0 || doneCareMoments.length > 0) && (
        <div className="moment-strip">
          <div className="moment-strip-head">
            <span className="eyebrow">Care moments</span>
            <span className="moment-count">
              {pendingCareMoments.length} pending - {doneCareMoments.length} done
            </span>
          </div>
          <div className="moment-chips">
            {pendingCareMoments.length === 0 ? (
              <span className="moment-empty">All care moments handled - send is paused.</span>
            ) : (
              pendingCareMoments.map((moment) => {
                const isActive = activeCareMoment?.id === moment.id;
                return (
                  <button
                    key={moment.id}
                    type="button"
                    className={`moment-chip priority-${moment.priority.toLowerCase()} ${isActive ? "active" : ""}`}
                    onClick={() => onSelectMoment?.(moment.id)}
                  >
                    <span>{moment.type} - {moment.due}</span>
                    <strong>{moment.title}</strong>
                  </button>
                );
              })
            )}
          </div>
          {doneCareMoments.length > 0 && (
            <details className="moment-done">
              <summary>Show {doneCareMoments.length} completed</summary>
              <ul>
                {doneCareMoments.map((moment) => (
                  <li key={moment.id}>
                    <span>✓ {moment.type} - {moment.title}</span>
                    <small>
                      {moment.progress?.channel ?? "Telegram"} -{" "}
                      {moment.progress?.sentAt
                        ? new Date(moment.progress.sentAt).toLocaleString()
                        : "sent"}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="composer-grid">
        <div className="composer-main">
          <div className="composer-head">
            <div>
              <span className="eyebrow">Draft message</span>
              <strong>{draftSubject}</strong>
            </div>
            <button
              className="secondary-action"
              disabled={tailoringLoading || profileLoading || consentLocked}
              onClick={handleTailor}
              type="button"
            >
              {tailoringLoading
                ? "Tailoring..."
                : profile
                  ? tailored
                    ? "Regenerate with AI"
                    : "Tailor with AI profile"
                  : "Generate AI profile"}
            </button>
          </div>

          {tailoringError && <p className="ai-profile-error">{tailoringError}</p>}

          <label className="telegram-editor">
            <span className="editor-label">Edit before sending</span>
            <textarea
              onChange={(event) => setTelegramDraftBody(event.target.value)}
              rows="9"
              value={draftBody}
            />
          </label>

          {telegramStatus.text && (
            <p className={`delivery-status delivery-${telegramStatus.tone}`}>
              {telegramStatus.text}
            </p>
          )}

          <div className="composer-actions">
            <span className="composer-meta">
              Sends via Telegram bot - logs to audit trail
            </span>
            <button
              className="primary-action"
              disabled={telegramStatus.tone === "sending" || !telegramReady || !activeCareMoment}
              onClick={onSend}
              type="button"
            >
              {telegramStatus.tone === "sending"
                ? "Sending..."
                : !activeCareMoment
                  ? "No pending moments"
                  : "Approve & Send"}
            </button>
          </div>
        </div>

        <aside className="composer-side">
          <div className={`mode-banner mode-${todaysCase.caseSensitivity}`}>
            <span className="eyebrow">Message mode</span>
            <strong>
              {todaysCase.caseSensitivity === "sensitive"
                ? "Caring only - no product plug"
                : "Caring + subtle product hook"}
            </strong>
            {todaysCase.caseSensitivity === "sensitive" ? (
              <ul className="bullet-list">
                {todaysCase.sensitiveReasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : todaysCase.productHook ? (
              <p>Will weave in: <b>{todaysCase.productHook}</b></p>
            ) : (
              <p className="muted">No product hook configured for this client.</p>
            )}
          </div>

          <div className="side-block">
            <span className="eyebrow">Tailored from</span>
            {tailored?.tailoredFrom?.length ? (
              <ul className="bullet-list">
                {tailored.tailoredFrom.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Click <b>Tailor with AI profile</b> to see which personality and tone signals were used.
              </p>
            )}
          </div>

          {profile?.toneGuidance && (
            <div className="side-block">
              <span className="eyebrow">Tone guidance</span>
              <p>{profile.toneGuidance}</p>
            </div>
          )}

          {tailored?.momentTopicHooks?.length ? (
            <div className="side-block">
              <span className="eyebrow">
                Topic hooks for {activeCareMoment?.type ?? "this moment"}
              </span>
              <ul className="hook-list">
                {tailored.momentTopicHooks.slice(0, 4).map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
              {profile?.topicHooks?.length ? (
                <details className="hook-fallback">
                  <summary>Show general profile hooks</summary>
                  <ul className="hook-list">
                    {profile.topicHooks.slice(0, 4).map((hook) => (
                      <li key={hook}>{hook}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : profile?.topicHooks?.length ? (
            <div className="side-block">
              <span className="eyebrow">Topic hooks (general)</span>
              <ul className="hook-list">
                {profile.topicHooks.slice(0, 4).map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
              <p className="muted" style={{ marginTop: 4 }}>
                Click Tailor with AI to get hooks specific to this care moment.
              </p>
            </div>
          ) : null}

          <div className="side-block">
            <span className="eyebrow">Today's case</span>
            {todaysCase.careMoment ? (
              <ul className="bullet-list">
                <li><b>{todaysCase.careMoment.type}:</b> {todaysCase.careMoment.title}</li>
                {todaysCase.careMoment.reason && (
                  <li className="muted">{todaysCase.careMoment.reason}</li>
                )}
                {todaysCase.careMoment.action && (
                  <li>Suggested action: {todaysCase.careMoment.action}</li>
                )}
              </ul>
            ) : (
              <p className="muted">No active care moment selected.</p>
            )}
          </div>

          {(todaysCase.lifeEvent || todaysCase.nextBestAction) && (
            <div className="side-block">
              <span className="eyebrow">Other client context</span>
              <ul className="bullet-list">
                {todaysCase.lifeEvent && (
                  <li className="muted">Life event: {todaysCase.lifeEvent}</li>
                )}
                {todaysCase.nextBestAction && (
                  <li className="muted">Global next-best action: {todaysCase.nextBestAction}</li>
                )}
              </ul>
            </div>
          )}

          {(tailored?.guardrails ?? generatedDraft.disclaimers ?? []).length > 0 && (
            <div className="side-block guardrail-block">
              <span className="eyebrow">Guardrails</span>
              <ul className="bullet-list">
                {(tailored?.guardrails ?? generatedDraft.disclaimers).slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function TelegramBotWorkflow({ activeClient }) {
  return (
    <section className="panel telegram-workflow">
      <PanelHeader title="How The Bot Works" meta="Current MVP" />
      <div className="story-stack">
        {[
          ["1", "Client starts bot", "Client must open the Telegram bot and send /start before messages can be delivered."],
          ["2", "Chat ID stored", "Advisor/admin stores telegram_chat_id and telegram_opt_in on the Supabase client row."],
          ["3", "Advisor approves draft", "AdvisorFlow generates a safe draft, but the advisor must click send."],
          ["4", "Edge Function sends", "Supabase send-telegram function sends the message and records delivery/audit logs."],
        ].map(([step, title, detail]) => (
          <article className="story-step" key={step}>
            <b>{step}</b>
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="mini-section top-gap">
        <article className="list-row">
          <div>
            <strong>Current capability</strong>
            <span>Outbound advisor-approved Telegram messages.</span>
          </div>
          <b>Built</b>
        </article>
        <article className="list-row severity-medium">
          <div>
            <strong>Next chatbot step</strong>
            <span>Inbound Telegram webhook to record client replies and create client signals.</span>
          </div>
          <b>Next</b>
        </article>
        <article className="list-row">
          <div>
            <strong>Supabase field</strong>
            <span>{activeClient.telegramChatId ? "telegram_chat_id is saved." : "telegram_chat_id is missing for this client."}</span>
          </div>
          <b>{activeClient.telegramOptIn ? "Opted in" : "No opt-in"}</b>
        </article>
      </div>
    </section>
  );
}

function CopilotPanel({ activeClient, clientBrief, complianceRisk, nextActions }) {
  const locked = activeClient.consentStatus !== "Verified";

  return (
    <section className="panel copilot-panel">
      <PanelHeader title="Advisor AI Copilot" meta={locked ? "Masked" : `${complianceRisk.level} risk`} />
      {locked ? (
        <div className="masked-state">
          <strong>Copilot paused</strong>
          <p>Private recommendations are blocked until consent is refreshed and logged.</p>
        </div>
      ) : (
        <>
          <div className="copilot-lead">
            <span>{clientBrief.risk} priority brief</span>
            <h3>{clientBrief.title}</h3>
            <p>{clientBrief.summary}</p>
          </div>
          <div className="insight-grid">
            <InsightList title="Advisor Highlights" items={clientBrief.highlights} />
            <InsightList title="Evidence Used" items={clientBrief.evidence} />
          </div>
          <div className="next-actions">
            {nextActions.map((action) => (
              <article key={action.title}>
                <span>{action.owner} - {action.priority}</span>
                <strong>{action.title}</strong>
                <p>{action.reason}</p>
              </article>
            ))}
          </div>
          <div className="data-used">
            {["Client memory", "Open tasks", "Overnight signals", "Partner SLA", "Compliance queue"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ActionComposer({
  composerMode,
  consentLocked,
  generatedDraft,
  onApproveDraft,
  setComposerMode,
  setTelegramDraftBody,
  telegramDraftBody,
  telegramReady,
  telegramStatus,
}) {
  return (
    <section className="panel action-composer">
      <PanelHeader title="Action Composer" meta={telegramReady ? "Telegram ready" : "Telegram setup needed"} />
      <div className="mode-switch">
        {[
          ["follow-up", "Care note"],
          ["referral", "Referral"],
          ["compliance", "Escalation"],
        ].map(([mode, label]) => (
          <button
            className={composerMode === mode ? "active" : ""}
            key={mode}
            onClick={() => setComposerMode(mode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="draft-box">
        <span>{generatedDraft.channel}</span>
        <strong>{generatedDraft.subject}</strong>
        <label className="telegram-editor compact">
          Message to send
          <textarea
            onChange={(event) => setTelegramDraftBody(event.target.value)}
            rows="6"
            value={telegramDraftBody}
          />
        </label>
        <ul>
          {generatedDraft.disclaimers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {telegramStatus.text && (
        <p className={`delivery-status delivery-${telegramStatus.tone}`}>
          {telegramStatus.text}
        </p>
      )}
      <button
        className="primary-action"
        disabled={telegramStatus.tone === "sending"}
        onClick={onApproveDraft}
        type="button"
      >
        {telegramStatus.tone === "sending"
          ? "Sending Telegram"
          : consentLocked && composerMode !== "compliance"
            ? "Log Blocked Action"
            : "Send Telegram And Save"}
      </button>
    </section>
  );
}

function CompliancePanel({ activeClient, complianceRisk, consentLocked, requestConsentRefresh }) {
  const level = complianceRisk.level.toLowerCase();
  return (
    <section className="panel compliance-card">
      <PanelHeader title="Compliance Guardrail" meta={complianceRisk.level} />
      <div className="compliance-summary">
        <div className={`compliance-score compliance-${level}`}>
          <span>Risk score</span>
          <strong>{complianceRisk.score}</strong>
          <small>{complianceRisk.level} severity</small>
        </div>
        <div className="compliance-headline">
          <span>Top guardrail</span>
          <strong>{complianceRisk.reasons[0]}</strong>
          <div className={`risk-meter risk-${level}`}>
            <span style={{ width: `${complianceRisk.score}%` }} />
          </div>
        </div>
      </div>
      <ul className="compact-list compliance-list">
        {complianceRisk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {consentLocked && (
        <button
          className="secondary-action"
          onClick={() => requestConsentRefresh(`Consent refresh requested for ${displayClientName(activeClient)}.`)}
          type="button"
        >
          Request Consent Refresh
        </button>
      )}
    </section>
  );
}

function ClientMemory({ activeClient }) {
  const consentLocked = activeClient.consentStatus !== "Verified";

  return (
    <section className="panel">
      <PanelHeader title="Client Memory" meta={`${activeClient.segment} - ${activeClient.consentStatus}`} />
      <div className="memory-layout">
        <div>
          <h3>{displayClientName(activeClient)}</h3>
          {consentLocked ? (
            <div className="masked-state">
              <strong>Consent review required</strong>
              <p>Private notes, financial values, needs, and timeline are masked until consent is refreshed.</p>
            </div>
          ) : (
            <>
              <p>
                {activeClient.occupation} in {activeClient.location}. Assets {activeClient.assets}; annual
                premium {currency(activeClient.annualPremium)}.
              </p>
              <div className="tag-row">
                {activeClient.needs.map((need) => (
                  <span key={need}>{need}</span>
                ))}
              </div>
              <div className="relationship-profile-grid">
                <article>
                  <span>Personality</span>
                  <strong>{activeClient.personality}</strong>
                </article>
                <article>
                  <span>Channel</span>
                  <strong>{activeClient.preferredChannel}</strong>
                </article>
                <article>
                  <span>Telegram</span>
                  <strong>{activeClient.telegramOptIn && activeClient.telegramChatId ? "Ready" : "Setup needed"}</strong>
                </article>
                <article>
                  <span>Tone</span>
                  <strong>{activeClient.preferredTone}</strong>
                </article>
                <article>
                  <span>Life event</span>
                  <strong>{activeClient.lifeEvent}</strong>
                </article>
              </div>
              <p className="relationship-note">{activeClient.relationshipNotes}</p>
              <div className="tag-row">
                {(activeClient.interests ?? []).map((interest) => (
                  <span key={interest}>{interest}</span>
                ))}
              </div>
              <ul className="memory-list">
                {activeClient.memory.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <AIClientProfile activeClient={activeClient} />
            </>
          )}
        </div>
        <div className="timeline">
          {consentLocked ? (
            <article className="consent-hold">
              <small>Security control</small>
              <strong>Timeline hidden pending PDPA consent refresh.</strong>
            </article>
          ) : (
            activeClient.timeline.map((event) => (
              <article key={`${event.date}-${event.note}`}>
                <small>{event.date} - {event.type}</small>
                <strong>{event.note}</strong>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const aiProfileStore = {
  profiles: new Map(),
  inflight: new Map(),
  listeners: new Set(),
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  notify() {
    this.listeners.forEach((listener) => listener());
  },
  get(clientId) {
    return this.profiles.get(clientId);
  },
  isLoading(clientId) {
    return this.inflight.has(clientId);
  },
  async generate(client) {
    if (!client || this.inflight.has(client.id)) return;
    const promise = generateClientProfile(client)
      .then((result) => {
        this.profiles.set(client.id, { result, error: "" });
      })
      .catch((err) => {
        this.profiles.set(client.id, {
          result: this.profiles.get(client.id)?.result,
          error: err.message || "Failed to generate profile.",
        });
      })
      .finally(() => {
        this.inflight.delete(client.id);
        this.notify();
      });
    this.inflight.set(client.id, promise);
    this.notify();
  },
};

function useClientProfile(activeClient) {
  const [, force] = useState(0);

  useEffect(() => {
    const unsubscribe = aiProfileStore.subscribe(() => force((n) => n + 1));
    return unsubscribe;
  }, []);

  const entry = activeClient ? aiProfileStore.get(activeClient.id) : undefined;
  const loading = activeClient ? aiProfileStore.isLoading(activeClient.id) : false;

  return {
    profile: entry?.result,
    loading,
    error: entry?.error || "",
    runAnalysis: () => aiProfileStore.generate(activeClient),
  };
}

function tailoredCacheKey(clientId, momentId) {
  return `${clientId}::${momentId ?? "default"}`;
}

const tailoredMessageStore = {
  messages: new Map(),
  inflight: new Map(),
  listeners: new Set(),
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  notify() {
    this.listeners.forEach((listener) => listener());
  },
  get(clientId, momentId) {
    return this.messages.get(tailoredCacheKey(clientId, momentId));
  },
  isLoading(clientId, momentId) {
    return this.inflight.has(tailoredCacheKey(clientId, momentId));
  },
  async generate({ client, momentId, profile, context }) {
    if (!client) return;
    const key = tailoredCacheKey(client.id, momentId);
    if (this.inflight.has(key)) return;
    const promise = generateTailoredTelegramMessage({ client, profile, context })
      .then((result) => {
        this.messages.set(key, { result, error: "" });
      })
      .catch((err) => {
        this.messages.set(key, {
          result: this.messages.get(key)?.result,
          error: err.message || "Failed to tailor message.",
        });
      })
      .finally(() => {
        this.inflight.delete(key);
        this.notify();
      });
    this.inflight.set(key, promise);
    this.notify();
  },
};

function useTailoredMessage(activeClient, momentId) {
  const [, force] = useState(0);

  useEffect(() => {
    const unsubscribe = tailoredMessageStore.subscribe(() => force((n) => n + 1));
    return unsubscribe;
  }, []);

  const entry = activeClient ? tailoredMessageStore.get(activeClient.id, momentId) : undefined;
  const loading = activeClient ? tailoredMessageStore.isLoading(activeClient.id, momentId) : false;

  return {
    tailored: entry?.result,
    loading,
    error: entry?.error || "",
    runTailoring: ({ profile, context }) =>
      tailoredMessageStore.generate({ client: activeClient, momentId, profile, context }),
  };
}

function renderListBlock(title, items) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div>
      <h5>{title}</h5>
      <ul>
        {list.map((item) => (
          <li key={typeof item === "string" ? item : item.interest}>
            {typeof item === "string" ? (
              item
            ) : (
              <>
                <strong>{item.interest}</strong>
                {item.evidence ? <span className="ai-evidence"> - {item.evidence}</span> : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function copyText(text) {
  if (text && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function AIClientProfile({ activeClient }) {
  const { profile, loading, error, runAnalysis } = useClientProfile(activeClient);

  return (
    <section className="ai-profile-card">
      <header className="ai-profile-head">
        <div>
          <span className="ai-profile-eyebrow">AI Behavioural Profile</span>
          <strong>Detailed personality and interest read for tailored outreach</strong>
        </div>
        <button className="primary-action" disabled={loading} onClick={runAnalysis} type="button">
          {loading ? "Analyzing..." : profile ? "Regenerate" : "Generate with AI"}
        </button>
      </header>

      {error && <p className="ai-profile-error">{error}</p>}

      {!profile && !loading && !error && (
        <p className="ai-profile-hint">
          Generate a deep profile from this client's notes, timeline, life events and signals.
          Open the AI Profile page in the side nav for the full view.
        </p>
      )}

      {profile && (
        <div className="ai-profile-body">
          <p className="ai-profile-summary">{profile.detailedSummary || profile.summary}</p>

          <div className="ai-profile-grid">
            {renderListBlock("Personality traits", profile.personalityTraits)}
            {renderListBlock("Core motivations", profile.coreMotivations)}
            {renderListBlock("Likely interests", profile.inferredInterests)}
            {renderListBlock("Lifestyle signals", profile.lifestyleSignals)}
          </div>

          {profile.communicationStyle && (
            <div className="ai-profile-style">
              <span>Communication style</span>
              <strong>{profile.communicationStyle}</strong>
            </div>
          )}

          {profile.telegramMessageSuggestion && (
            <div className="ai-telegram-suggestion">
              <div className="ai-telegram-head">
                <span>Telegram tone draft</span>
                <button
                  className="secondary-action"
                  onClick={() => copyText(profile.telegramMessageSuggestion)}
                  type="button"
                >
                  Copy
                </button>
              </div>
              <p>{profile.telegramMessageSuggestion}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AIProfilePage({ activeClient, consentLocked }) {
  const { profile, loading, error, runAnalysis } = useClientProfile(activeClient);

  if (!activeClient) {
    return (
      <section className="panel">
        <PanelHeader title="AI Client Profile" meta="Deep personality and interest read" />
        <p>Select a client from the priority queue above to generate a profile.</p>
      </section>
    );
  }

  if (consentLocked) {
    return (
      <section className="panel">
        <PanelHeader title="AI Client Profile" meta="Blocked by consent" />
        <div className="masked-state">
          <strong>Consent refresh required</strong>
          <p>
            AI summaries are blocked until {displayClientName(activeClient)} refreshes consent. This
            protects private notes, financial values and timeline data.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel ai-profile-page">
      <PanelHeader
        title={`AI Profile - ${displayClientName(activeClient)}`}
        meta={`${activeClient.segment}${activeClient.tier ? ` - ${activeClient.tier} tier` : ""} - ${activeClient.consentStatus}`}
      />

      <div className="ai-profile-toolbar">
        <div className="ai-profile-context">
          <span>
            {activeClient.occupation} - {activeClient.location} - Age {activeClient.age}
          </span>
          <small>
            {activeClient.valueScore ? `Value ${activeClient.valueScore}/100 - ` : ""}
            Engagement urgency {activeClient.engagementUrgency} - Care urgency {activeClient.careUrgency}
          </small>
        </div>
        <button className="primary-action" disabled={loading} onClick={runAnalysis} type="button">
          {loading ? "Analyzing client signals..." : profile ? "Regenerate profile" : "Generate AI profile"}
        </button>
      </div>

      {error && <p className="ai-profile-error">{error}</p>}

      {!profile && !loading && !error && (
        <div className="ai-profile-empty">
          <h4>What this page does</h4>
          <p>
            Reads every signal on this client: personality cues, interests, life events, timeline,
            relationship notes, segment, and priority signals. Then it summarises a behavioural
            profile you can use to tailor a Telegram message that feels personal.
          </p>
          <ul>
            <li>Detailed personality and interest narrative</li>
            <li>Lifestyle signals and core motivations</li>
            <li>Topic hooks and gift ideas grounded in the timeline</li>
            <li>Telegram tone guidance plus a ready-to-edit draft</li>
          </ul>
        </div>
      )}

      {profile && (
        <div className="ai-profile-page-body">
          <article className="ai-profile-summary-card">
            <h4>Behavioural summary</h4>
            <p>{profile.detailedSummary || profile.summary}</p>
          </article>

          <div className="ai-profile-grid wide">
            {renderListBlock("Personality traits", profile.personalityTraits)}
            {renderListBlock("Core motivations", profile.coreMotivations)}
            {renderListBlock("Likely interests", profile.inferredInterests)}
            {renderListBlock("Lifestyle signals", profile.lifestyleSignals)}
            {renderListBlock("Topic hooks", profile.topicHooks)}
            {renderListBlock("Gift ideas", profile.giftIdeas)}
            {renderListBlock("Do", profile.doList)}
            {renderListBlock("Avoid", profile.avoidList)}
          </div>

          {(profile.communicationStyle || profile.toneGuidance) && (
            <div className="ai-profile-style-row">
              {profile.communicationStyle && (
                <div className="ai-profile-style">
                  <span>Communication style</span>
                  <strong>{profile.communicationStyle}</strong>
                </div>
              )}
              {profile.toneGuidance && (
                <div className="ai-profile-style">
                  <span>Tone guidance</span>
                  <strong>{profile.toneGuidance}</strong>
                </div>
              )}
            </div>
          )}

          {profile.telegramMessageSuggestion && (
            <div className="ai-telegram-suggestion large">
              <div className="ai-telegram-head">
                <span>Telegram-ready draft</span>
                <button
                  className="secondary-action"
                  onClick={() => copyText(profile.telegramMessageSuggestion)}
                  type="button"
                >
                  Copy draft
                </button>
              </div>
              <p>{profile.telegramMessageSuggestion}</p>
              <small>Review and adapt before sending. No figures or product names included.</small>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FollowUpManager({
  activeTasks,
  completeTask,
  consentLocked,
  createFollowUp,
  followUpText,
  recentDoneTasks = [],
  setFollowUpText,
}) {
  return (
    <section className="panel">
      <PanelHeader
        title="Follow-Up Manager"
        meta={`${activeTasks.length} active - ${recentDoneTasks.length} recently done`}
      />
      <div className="input-row">
        <input
          aria-label="Follow-up title"
          disabled={consentLocked}
          onChange={(event) => setFollowUpText(event.target.value)}
          placeholder={consentLocked ? "Consent refresh required" : "Add follow-up"}
          value={followUpText}
        />
        <button disabled={consentLocked} onClick={() => createFollowUp()} type="button">
          Add
        </button>
      </div>
      <div className="stack">
        {activeTasks.length === 0 && recentDoneTasks.length === 0 && (
          <p className="quiet-text">No follow-ups yet. Send a care message or add one above.</p>
        )}
        {activeTasks.map((task) => (
          <article className={`list-row severity-${task.severity}`} key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <span>Due {task.due} - {task.status}</span>
            </div>
            <button className="ghost" onClick={() => completeTask(task.id)} type="button">
              Done
            </button>
          </article>
        ))}
        {recentDoneTasks.length > 0 && (
          <div className="followup-done-block">
            <span className="eyebrow">Recently completed</span>
            {recentDoneTasks.map((task) => (
              <article className="list-row followup-done" key={task.id}>
                <div>
                  <strong>✓ {task.title}</strong>
                  <span>
                    {task.completedAt
                      ? `Completed ${new Date(task.completedAt).toLocaleString()}`
                      : `Status: ${task.status}`}
                  </span>
                </div>
                <b>Done</b>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PartnerHub({ clientsState, complianceQueue, createReferral, partnersState, referrals }) {
  const opportunities = useMemo(
    () =>
      clientsState
        .filter((client) => client.consentStatus === "Verified")
        .flatMap((client) =>
          matchPartners(client, partnersState)
            .slice(0, 2)
            .map((partner) => ({
              id: `${client.id}-${partner.id}`,
              client,
              partner,
              reason: partner.reason,
              value: Math.round((client.opportunityValue ?? client.annualPremium ?? 0) * 0.35),
            }))
        )
        .sort((a, b) => b.partner.matchScore - a.partner.matchScore)
        .slice(0, 6),
    [clientsState, partnersState]
  );
  const escalations = complianceQueue.filter((item) => item.status !== "Closed");

  return (
    <div className="page-stack partner-hub">
      <section className="command-hero partner-hero">
        <div>
          <p className="eyebrow">Partner operating hub</p>
          <h2>Centralize partner radar, referral handoff, evidence checks, and escalation control.</h2>
          <p>
            AdvisorFlow keeps partner work in one governed hub while the original client action
            workspace stays available for advisor follow-up.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Opportunities" value={opportunities.length} />
          <ImpactStat label="Partners" value={partnersState.length} />
          <ImpactStat label="Escalations" value={escalations.length} />
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <PanelHeader title="Partner Opportunities" meta="Client-fit matches" />
          <div className="stack">
            {opportunities.map((item) => (
              <article className="partner-card" key={item.id}>
                <div>
                  <strong>{item.client.name}</strong>
                  <span>{item.partner.name}</span>
                  <small>{item.reason} - estimated value {currency(item.value)}</small>
                </div>
                <b>{item.partner.matchScore}%</b>
                <button
                  onClick={() => createReferral(item.partner, item.reason, item.client)}
                  type="button"
                >
                  Refer
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="Partner Directory" meta={`${partnersState.length} desks`} />
          <div className="stack">
            {partnersState.map((partner) => (
              <article className="directory-card" key={partner.id}>
                <div>
                  <strong>{partner.name}</strong>
                  <span>{partner.specialty}</span>
                  <small>{partner.availability} - SLA {partner.sla}</small>
                </div>
                <b>{partner.qualityScore}%</b>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid">
        <section className="panel">
          <PanelHeader title="Referral Pipeline" meta={`${referrals.length} records`} />
          <PipelineList clientsState={clientsState} referrals={referrals} />
        </section>

        <section className="panel">
          <PanelHeader title="Handoff Checklist" meta="Evidence required" />
          <div className="handoff-grid">
            {partnersState.slice(0, 4).map((partner) => (
              <article key={partner.id}>
                <strong>{partner.name}</strong>
                <ul className="compact-list">
                  {partner.evidenceRequired.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelHeader title="Escalations" meta={`${escalations.length} open`} />
        <div className="stack">
          {escalations.map((item) => (
            <article className={`list-row severity-${item.severity.toLowerCase()}`} key={item.id}>
              <div>
                <strong>{formatClientName(item.clientId, clientsState)}</strong>
                <span>{item.issue} - {item.control}</span>
              </div>
              <b>{item.status}</b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PartnerRadar({ activeClient, consentLocked, createReferral, partnerMatches }) {
  return (
    <section className="panel">
      <PanelHeader title="Partner Radar" meta={displayClientName(activeClient)} />
      <div className="stack">
        {consentLocked ? (
          <article className="list-row consent-hold">
            <div>
              <strong>Referral matching paused</strong>
              <span>Refresh consent before partner recommendation or referral creation.</span>
            </div>
            <b>Locked</b>
          </article>
        ) : (
          partnerMatches.slice(0, 3).map((partner) => (
            <article className="partner-card" key={partner.id}>
              <div>
                <strong>{partner.name}</strong>
                <span>{partner.specialty}</span>
                <small>{partner.reason} - SLA {partner.sla}</small>
              </div>
              <b>{partner.matchScore}%</b>
              <button onClick={() => createReferral(partner)} type="button">
                Refer
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function LearningPanel({ activeAdvisor, cpd }) {
  return (
    <section className="panel">
      <PanelHeader title="CPD Readiness" meta={`${activeAdvisor.cpdHours}/${activeAdvisor.cpdTarget} hours`} />
      <div className="stack">
        {cpd.slice(0, 4).map((course) => (
          <article className="list-row" key={course.id}>
            <div>
              <strong>{course.title}</strong>
              <span>{course.reason}</span>
            </div>
            <b>{course.matchScore}%</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function MeetingsPanel({ clientsState, meetings, title = "Calendar Intelligence" }) {
  return (
    <section className="panel">
      <PanelHeader title={title} meta={`${meetings.length} meetings`} />
      <div className="stack">
        {meetings.map((meeting) => (
          <article className="list-row" key={meeting.id}>
            <div>
              <strong>{formatClientName(meeting.clientId, clientsState)}</strong>
              <span>{isClientLocked(meeting.clientId, clientsState) ? "Consent refresh pending" : meeting.topic}</span>
            </div>
            <b>{meeting.time}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReferralExpensePanel({
  activeExpenses,
  activeReferrals,
  consentLocked,
  createExpense,
  expenseAmount,
  setExpenseAmount,
}) {
  return (
    <section className="panel">
      <PanelHeader title="Referrals And Claims" meta="Operational loop" />
      <div className="mini-section">
        {activeReferrals.length === 0 ? (
          <p className="quiet-text">No referral yet for this client.</p>
        ) : (
          activeReferrals.map((referral) => (
            <article className="list-row" key={referral.id}>
              <div>
                <strong>{consentLocked ? "Referral masked" : referral.partnerName}</strong>
                <span>{consentLocked ? "Consent refresh required" : referral.note}</span>
              </div>
              <b>{referral.status}</b>
            </article>
          ))
        )}
      </div>
      <div className="input-row">
        <input
          aria-label="Expense amount"
          disabled={consentLocked}
          inputMode="numeric"
          min="0"
          onChange={(event) => setExpenseAmount(event.target.value)}
          placeholder="RM"
          step="0.01"
          type="number"
          value={expenseAmount}
        />
        <button disabled={consentLocked} onClick={createExpense} type="button">
          Submit
        </button>
      </div>
      <div className="stack">
        {activeExpenses.map((expense) => (
          <article className="list-row" key={expense.id}>
            <div>
              <strong>{consentLocked ? "Amount masked" : currency(expense.amount)}</strong>
              <span>{consentLocked ? `Consent hold - ${expense.date}` : `${expense.category} - ${expense.date}`}</span>
            </div>
            <b className={`status ${expense.status.toLowerCase()}`}>{expense.status}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminExperience({
  adminMetrics,
  adminReviewItems,
  auditLogs,
  businessImpact,
  businessImpactRows,
  clientsState,
  complianceQueue,
  consentRequests,
  cpd,
  expenses,
  referrals,
  relationshipSummary,
  route,
  tasks,
}) {
  const flaggedExpenses = expenses.filter((expense) => ["Flagged", "Masked"].includes(expense.status));
  const highRiskLogs = auditLogs.filter((log) => log.risk === "High");
  const openConsentRequests = consentRequests.filter((request) => request.status.startsWith("Pending"));

  const impactHero = (
      <section className="command-hero admin-hero">
        <div>
          <p className="eyebrow">Organisation-wide capability</p>
          <h2>Admin sees relationship priority, care risk, partner pipeline, and compliance health in one view.</h2>
          <p>
            This read-only view keeps leaders informed while advisors own the relationship actions,
            consent refreshes, and client follow-up workflow.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Blocked Risks" value={businessImpact.blockedRisks} />
          <ImpactStat label="Readiness" value={`${businessImpact.cpdReadiness}%`} />
          <ImpactStat label="Compliance" value={businessImpact.complianceHealth} />
        </div>
      </section>
  );

  const impactDashboard = (
      <section className="panel span-all">
        <PanelHeader title="Business Impact Dashboard" meta="Operational view" />
        <div className="metrics-grid">
          {adminMetrics.map((metric) => (
            <article className={`metric metric-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
        <div className="impact-table">
          {businessImpactRows.slice(0, 5).map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.narrative}</span>
              </div>
              <b>{item.displayValue}</b>
            </article>
          ))}
        </div>
      </section>
  );

  const relationshipPanel = (
      <section className="panel span-all">
        <PanelHeader title="Relationship Intelligence Metrics" meta="Read-only admin view" />
        <div className="tier-distribution">
          {Object.entries(relationshipSummary.tierCounts).map(([tier, count]) => (
            <article key={tier}>
              <span>{tier}</span>
              <strong>{count}</strong>
            </article>
          ))}
        </div>
        <div className="content-grid">
          <div className="stack">
            {relationshipSummary.activeCareMoments.slice(0, 4).map((moment) => (
              <article className={`list-row priority-${moment.priority.toLowerCase()}`} key={`${moment.clientId}-${moment.id}`}>
                <div>
                  <strong>{moment.clientName}</strong>
                  <span>{moment.type} - {moment.title}</span>
                </div>
                <b>{moment.due}</b>
              </article>
            ))}
          </div>
          <div className="stack">
            {relationshipSummary.topTierClients.map((client) => (
              <article className="list-row" key={client.id}>
                <div>
                  <strong>{client.name}</strong>
                  <span>{client.tier} relationship priority</span>
                </div>
                <b>{client.score}/100</b>
              </article>
            ))}
          </div>
        </div>
      </section>
  );

  const referralPanel = (
      <section className="panel">
        <PanelHeader title="Referral Pipeline" meta={`${referrals.length} records`} />
        <PipelineList clientsState={clientsState} referrals={referrals} />
      </section>
  );

  const compliancePanel = (
      <section className="panel">
        <PanelHeader
          title="Compliance Queue"
          meta={`${openConsentRequests.length + flaggedExpenses.length + complianceQueue.length} open items`}
        />
        <div className="stack">
          {consentRequests.map((request) => (
            <article className="list-row consent-hold" key={request.id}>
              <div>
                <strong>{formatClientName(request.clientId, clientsState)}</strong>
                <span>{request.reason}</span>
              </div>
              <b>{request.status}</b>
            </article>
          ))}
          {complianceQueue.map((item) => (
            <article className={`list-row severity-${item.severity.toLowerCase()}`} key={item.id}>
              <div>
                <strong>{formatClientName(item.clientId, clientsState)}</strong>
                <span>{item.issue} - {item.control}</span>
              </div>
              <b>{item.status}</b>
            </article>
          ))}
          {flaggedExpenses.map((expense) => (
            <article className="list-row severity-medium" key={expense.id}>
              <div>
                <strong>{formatClientName(expense.clientId, clientsState)}</strong>
                <span>{isClientLocked(expense.clientId, clientsState) ? "Claim masked" : `${currency(expense.amount)} claim`}</span>
              </div>
              <b>{expense.status}</b>
            </article>
          ))}
        </div>
      </section>
  );

  const reviewPanel = (
      <section className="panel">
        <PanelHeader title="Admin Signal Board" meta={`${adminReviewItems.length} visible items`} />
        <div className="stack">
          {adminReviewItems.map((item) => (
            <article className={`list-row severity-${item.priority.toLowerCase()}`} key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.queue} - {item.owner} - {item.eta}</span>
              </div>
              <b>{item.priority}</b>
            </article>
          ))}
        </div>
      </section>
  );

  const coachingPanel = (
      <section className="panel">
        <PanelHeader title="Advisor Coaching" meta="CPD and task discipline" />
        <ProgressRows
          rows={[
            ["Follow-up completion", businessImpact.followUpCompletion],
            ["CPD readiness", businessImpact.cpdReadiness],
            ["Referral SLA hygiene", businessImpact.referralHygiene],
          ]}
        />
        <div className="stack top-gap">
          {cpd.slice(0, 3).map((course) => (
            <article className="list-row" key={course.id}>
              <div>
                <strong>{course.title}</strong>
                <span>{course.category}</span>
              </div>
              <b>{course.status}</b>
            </article>
          ))}
        </div>
      </section>
  );

  const auditPanel = (
      <section className="panel span-2">
        <PanelHeader title="Audit And Blocked Actions" meta={`${highRiskLogs.length} high-risk logs`} />
        <div className="audit-table">
          {auditLogs.map((log) => (
            <article key={log.id}>
              <span>{log.time}</span>
              <strong>{log.actor}</strong>
              <p>{log.action}</p>
              <b className={`risk-${log.risk.toLowerCase()}`}>{log.risk}</b>
            </article>
          ))}
        </div>
      </section>
  );

  const taskPanel = (
      <section className="panel">
        <PanelHeader title="Task Visibility" meta={`${tasks.length} actions`} />
        <div className="stack">
          {tasks.map((task) => (
            <article className={`list-row severity-${task.severity}`} key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>{formatClientName(task.clientId, clientsState)}</span>
              </div>
              <b>{task.status}</b>
            </article>
          ))}
        </div>
      </section>
  );

  if (route === "/admin/compliance") {
    return (
      <div className="admin-layout">
        {relationshipPanel}
        {compliancePanel}
        {reviewPanel}
        {taskPanel}
      </div>
    );
  }

  if (route === "/admin/referrals") {
    return (
      <div className="admin-layout">
        {relationshipPanel}
        {referralPanel}
        {coachingPanel}
        {reviewPanel}
      </div>
    );
  }

  if (route === "/admin/audit") {
    return (
      <div className="admin-layout">
        {relationshipPanel}
        {auditPanel}
        {compliancePanel}
        {taskPanel}
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {impactHero}
      {impactDashboard}
      {relationshipPanel}
      {referralPanel}
      {compliancePanel}
    </div>
  );
}

function PipelineList({ clientsState, referrals }) {
  if (referrals.length === 0) {
    return <p className="quiet-text">No referrals yet. Create one from Partner Radar.</p>;
  }

  return (
    <div className="stack">
      {referrals.map((referral) => (
        <article className="pipeline-row" key={referral.id}>
          <div>
            <strong>{referral.partnerName}</strong>
            <span>{formatClientName(referral.clientId, clientsState)}</span>
          </div>
          <div className="pipeline-track">
            <span style={{ width: referral.status === "Submitted" ? "42%" : "68%" }} />
          </div>
          <b>{referral.stage ?? referral.status}</b>
        </article>
      ))}
    </div>
  );
}

function ProgressRows({ rows }) {
  return (
    <div className="progress-list">
      {rows.map(([label, value]) => (
        <article key={label}>
          <div>
            <strong>{label}</strong>
            <b>{value}%</b>
          </div>
          <span>
            <i style={{ width: `${value}%` }} />
          </span>
        </article>
      ))}
    </div>
  );
}

function InsightList({ items, title }) {
  return (
    <div className="insight-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ImpactStat({ label, value }) {
  return (
    <article className="impact-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PanelHeader({ title, meta }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

export default App;
