import { useEffect, useMemo, useState } from "react";
import {
  advisors,
  auditLogsSeed,
  clients,
  expensesSeed,
  referralOutcomes,
  tasks as taskSeed,
} from "./data.js";
import {
  buildMorningBrief,
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
  ["/advisor/today", "Today"],
  ["/advisor/client", "Client Cockpit"],
  ["/advisor/actions", "Action Workspace"],
  ["/advisor/learning", "Learning"],
];

const adminRoutes = [
  ["/admin/impact", "Impact"],
  ["/admin/compliance", "Compliance"],
  ["/admin/referrals", "Referrals"],
  ["/admin/audit", "Audit"],
];

function normalizePath(pathname, role = "Advisor") {
  const routes = role === "Admin" ? adminRoutes : advisorRoutes;
  const supported = new Set(routes.map(([path]) => path));
  return supported.has(pathname) ? pathname : role === "Admin" ? "/admin/impact" : "/advisor/today";
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

  const role = activeProfile.role;
  const activeAdvisor = role === "Advisor" ? activeProfile : people.find((person) => person.role === "Advisor") ?? advisor;
  const activeAdmin = role === "Admin" ? activeProfile : people.find((person) => person.role === "Admin") ?? admin;
  const activeClient = clientsState.find((client) => client.id === activeClientId) ?? clientsState[0] ?? clients[0];
  const activeTasks = tasks.filter((task) => task.clientId === activeClient.id && task.status !== "Done");
  const activeExpenses = expenses.filter((expense) => expense.clientId === activeClient.id);
  const activeReferrals = referrals.filter((referral) => referral.clientId === activeClient.id);
  const consentLocked = activeClient.consentStatus !== "Verified";
  const telegramReady = Boolean(activeClient.telegramOptIn && activeClient.telegramChatId && !consentLocked);

  const priorityClients = useMemo(() => getPriorityClients(clientsState, tasks), [clientsState, tasks]);
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
  const giftRecommendation = useMemo(
    () => recommendGift(activeClient, clientTier),
    [activeClient, clientTier]
  );
  const meetingRecommendation = useMemo(
    () => suggestMeetingSlot(activeClient, meetingsState, careMoments),
    [activeClient, meetingsState, careMoments]
  );
  const relationshipDraft = useMemo(
    () =>
      generateRelationshipMessage(activeClient, {
        actionTitle: careMoments[0]?.action,
        careMoment: careMoments[0],
        giftRecommendation,
        meetingRecommendation,
      }),
    [activeClient, careMoments, giftRecommendation, meetingRecommendation]
  );
  const nextActions = useMemo(
    () => generateNextBestActions(activeClient, tasks, partnersState, complianceQueueState),
    [activeClient, tasks, partnersState, complianceQueueState]
  );
  const generatedDraft = useMemo(
    () => {
      if (composerMode === "follow-up" && careMoments.length > 0) {
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
            : nextActions[0]?.title ?? "client follow-up";
      const channel = "Telegram";
      return generateDraftMessage(activeClient, draftAction, channel);
    },
    [composerMode, activeClient, careMoments, relationshipDraft, partnerMatches, nextActions]
  );

  useEffect(() => {
    setTelegramDraftBody(generatedDraft.body);
    setTelegramStatus({ tone: "idle", text: "" });
  }, [generatedDraft.body, activeClient.id]);

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

  function selectClient(clientId) {
    const selected = clientsState.find((client) => client.id === clientId);
    setActiveClientId(clientId);
    if (!selected) return;
    queueAudit(
      selected.consentStatus === "Verified"
        ? `Viewed ${selected.name} client memory`
        : "Viewed masked profile for consent-locked client",
      selected.consentStatus === "Verified" ? "Low" : "High"
    );
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

  function createReferral(partner = partnerMatches[0], note = partner?.reason) {
    if (!partner) return;
    if (consentLocked) {
      blockForConsent("partner referral");
      requestConsentRefresh("Referral recommendation was blocked pending consent verification.");
      return;
    }
    const expectedValue = activeClient.annualPremium ? Math.round(activeClient.annualPremium * 0.45) : 0;
    const referral = {
      id: `ref-${Date.now()}`,
      clientId: activeClient.id,
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
    queueAudit(`Created ${partner.name} referral for ${activeClient.name}`, "Medium");
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

    try {
      const result = await sendTelegramMessage({
        clientId: activeClient.id,
        subject: generatedDraft.subject,
        message: messageToSend,
      });

      if (result.localOnly) {
        setTelegramStatus({ tone: "error", text: result.message });
      } else {
        setTelegramStatus({ tone: "success", text: "Telegram message sent and audited." });
        queueAudit(`Sent Telegram message to ${activeClient.name}: ${generatedDraft.subject}`, "Low");
      }
    } catch (error) {
      setTelegramStatus({
        tone: "error",
        text: error.message || "Telegram message failed.",
      });
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
    createFollowUp(nextActions[0]?.title ?? generatedDraft.subject, "copilot");
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
        <NavigationShell currentPath={currentPath} navigate={navigate} role={role} />
        <div className="route-surface">
          {role === "Advisor" ? (
            <AdvisorExperience
              activeClient={activeClient}
              activeClientId={activeClientId}
              activeExpenses={activeExpenses}
              activeReferrals={activeReferrals}
              activeTasks={activeTasks}
              businessImpact={businessImpact}
              careMoments={careMoments}
              clientBrief={clientBrief}
              clientTier={clientTier}
              clientValueScore={clientValueScore}
              clientsState={clientsState}
              complianceRisk={complianceRisk}
              composerMode={composerMode}
              consentLocked={consentLocked}
              cpd={cpd}
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
              navigate={navigate}
              nextActions={nextActions}
              onApproveDraft={approveComposerDraft}
              partnerMatches={partnerMatches}
              priorityClients={priorityClients}
              relationshipDraft={relationshipDraft}
              requestConsentRefresh={requestConsentRefresh}
              route={currentPath}
              selectClient={selectClient}
              setComposerMode={setComposerMode}
              setExpenseAmount={setExpenseAmount}
              setFollowUpText={setFollowUpText}
              setTelegramDraftBody={setTelegramDraftBody}
              telegramDraftBody={telegramDraftBody}
              telegramReady={telegramReady}
              telegramStatus={telegramStatus}
              completeTask={completeTask}
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

function NavigationShell({ currentPath, navigate, role }) {
  const routes = role === "Admin" ? adminRoutes : advisorRoutes;
  return (
    <aside className="side-nav">
      <div>
        <span>{role}</span>
        {routes.map(([path, label]) => (
          <button
            className={currentPath === path ? "active" : ""}
            key={path}
            onClick={() => navigate(path)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <small>{role} workspace</small>
    </aside>
  );
}

function AdvisorExperience(props) {
  const {
    activeAdvisor,
    activeClient,
    activeClientId,
    activeExpenses,
    activeReferrals,
    activeTasks,
    businessImpact,
    careMoments,
    clientBrief,
    clientTier,
    clientValueScore,
    clientsState,
    complianceRisk,
    composerMode,
    consentLocked,
    cpd,
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
    navigate,
    nextActions,
    onApproveDraft,
    partnerMatches,
    priorityClients,
    relationshipDraft,
    requestConsentRefresh,
    selectClient,
    setComposerMode,
    setExpenseAmount,
    setFollowUpText,
    setTelegramDraftBody,
    telegramDraftBody,
    telegramReady,
    telegramStatus,
    completeTask,
    route,
  } = props;

  const clientQueue = (
    <section className="panel">
      <PanelHeader title="Client Priority Queue" meta="Explainable scoring" />
      <div className="client-strip">
        {priorityClients.map((client) => (
          <button
            className={`client-tile ${activeClientId === client.id ? "selected" : ""} ${
              client.consentStatus === "Verified" ? "" : "locked"
            }`}
            key={client.id}
            onClick={() => {
              selectClient(client.id);
              navigate("/advisor/client");
            }}
            type="button"
          >
            <span>{displayClientName(client)}</span>
            <strong>{client.consentStatus === "Verified" ? client.tier : "Hold"}</strong>
            {client.consentStatus === "Verified" && (
              <em>{client.valueScore}/100 value score</em>
            )}
            <small>
              {client.consentStatus === "Verified"
                ? `${client.tierDescription} / ${client.prioritySignals.slice(0, 2).join(" / ")}`
                : "Private signals masked / Consent hold"}
            </small>
          </button>
        ))}
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
          <CareMomentsPanel activeClient={activeClient} careMoments={careMoments} />
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
        <div className="content-grid">
          <TelegramBotConsole
            activeClient={activeClient}
            composerMode={composerMode}
            consentLocked={consentLocked}
            generatedDraft={generatedDraft}
            onSend={onApproveDraft}
            setComposerMode={setComposerMode}
            setTelegramDraftBody={setTelegramDraftBody}
            telegramDraftBody={telegramDraftBody}
            telegramReady={telegramReady}
            telegramStatus={telegramStatus}
          />
          <TelegramBotWorkflow activeClient={activeClient} />
        </div>
        <div className="content-grid three">
          <FollowUpManager
            activeTasks={activeTasks}
            completeTask={completeTask}
            consentLocked={consentLocked}
            createFollowUp={createFollowUp}
            followUpText={followUpText}
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
        <div className="content-grid">
          <PartnerRadar
            activeClient={activeClient}
            consentLocked={consentLocked}
            createReferral={createReferral}
            partnerMatches={partnerMatches}
          />
          <ReferralExpensePanel
            activeExpenses={activeExpenses}
            activeReferrals={activeReferrals}
            consentLocked={consentLocked}
            createExpense={createExpense}
            expenseAmount={expenseAmount}
            setExpenseAmount={setExpenseAmount}
          />
        </div>
      </div>
    );
  }

  if (route === "/advisor/partners") {
    return (
      <div className="content-grid">
        <PartnerRadar
          activeClient={activeClient}
          consentLocked={consentLocked}
          createReferral={createReferral}
          partnerMatches={partnerMatches}
        />
        <section className="panel">
          <PanelHeader title="Referral Pipeline" meta={`${activeReferrals.length} selected client`} />
          <PipelineList clientsState={clientsState} referrals={activeReferrals} />
        </section>
      </div>
    );
  }

  if (route === "/advisor/learning") {
    return (
      <div className="content-grid">
        <LearningPanel activeAdvisor={activeAdvisor} cpd={cpd} />
        <section className="panel">
          <PanelHeader title="Readiness Progress" meta="Advisor development" />
          <ProgressRows
            rows={[
              ["CPD readiness", businessImpact.cpdReadiness],
              ["Referral SLA hygiene", businessImpact.referralHygiene],
              ["Follow-up completion", businessImpact.followUpCompletion],
            ]}
          />
        </section>
      </div>
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
      <section className="command-hero">
        <div>
          <p className="eyebrow">Advisor Today</p>
          <h2>Choose the right client, then move into action.</h2>
          <p>
            Today is the decision page: scan the priority queue, understand the top care moments,
            then open the cockpit or action workspace for the selected client.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Managed Premium" value={businessImpact.managedPremium} />
          <ImpactStat label="Pipeline Value" value={businessImpact.referralPipeline} />
          <ImpactStat label="Blocked Risks" value={businessImpact.blockedRisks} />
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Morning Command Brief" meta="Generated 08:00 MYT" />
        <ul className="command-brief-list">
          {morningBrief.map((item, index) => (
            <li key={item}>
              <b>{index + 1}</b>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="content-grid">
        {clientQueue}
        <CareMomentsPanel activeClient={activeClient} careMoments={careMoments} />
      </div>
      <div className="content-grid">
        <MeetingsPanel clientsState={clientsState} meetings={meetings} />
        <RelationshipSuggestionsPanel
          activeClient={activeClient}
          giftRecommendation={giftRecommendation}
          meetingRecommendation={meetingRecommendation}
          relationshipDraft={relationshipDraft}
        />
      </div>
    </div>
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

function CareMomentsPanel({ activeClient, careMoments }) {
  return (
    <section className="panel care-panel">
      <PanelHeader title="Care Moments" meta={displayClientName(activeClient)} />
      <div className="stack">
        {careMoments.map((moment) => (
          <article className={`care-moment priority-${moment.priority.toLowerCase()}`} key={moment.id}>
            <div>
              <span>{moment.type} - {moment.due}</span>
              <strong>{moment.title}</strong>
              <p>{moment.reason}</p>
            </div>
            <b>{moment.priority}</b>
          </article>
        ))}
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

  return (
    <section className="panel relationship-suggestions">
      <PanelHeader title="Personalized Suggestions" meta={locked ? "Consent-safe" : relationshipDraft.tone} />
      <div className="suggestion-grid">
        <article>
          <span>Gift guardrail</span>
          <div>
            <strong>{giftRecommendation.recommendation}</strong>
            <p>{giftRecommendation.rationale}</p>
          </div>
          <b>{giftRecommendation.allowed ? giftRecommendation.budget : "Blocked"}</b>
        </article>
        <article>
          <span>Best slot</span>
          <div>
            <strong>{meetingRecommendation.slot}</strong>
            <p>{meetingRecommendation.reason}</p>
          </div>
          <b>{meetingRecommendation.channel}</b>
        </article>
        <article>
          <span>Telegram bridge</span>
          <div>
            <strong>{activeClient.telegramOptIn ? "Client opted in" : "Opt-in needed"}</strong>
            <p>
              {activeClient.telegramChatId
                ? "Chat ID is saved. Advisor can send after reviewing the draft."
                : "Add telegram_chat_id after the client starts the bot."}
            </p>
          </div>
          <b>{activeClient.telegramOptIn && activeClient.telegramChatId ? "Ready" : "Not ready"}</b>
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

function TelegramBotConsole({
  activeClient,
  composerMode,
  consentLocked,
  generatedDraft,
  onSend,
  setComposerMode,
  setTelegramDraftBody,
  telegramDraftBody,
  telegramReady,
  telegramStatus,
}) {
  const checks = [
    ["Consent verified", !consentLocked],
    ["Client opted in", Boolean(activeClient.telegramOptIn)],
    ["Chat ID saved", Boolean(activeClient.telegramChatId)],
    ["Advisor approval required", true],
  ];

  return (
    <section className="panel telegram-console">
      <PanelHeader title="Telegram Bot Console" meta={telegramReady ? "Ready to send" : "Setup needed"} />
      <div className="bot-status-card">
        <div>
          <span>Selected client</span>
          <strong>{displayClientName(activeClient)}</strong>
          <p>
            {telegramReady
              ? "This client can receive advisor-approved Telegram bot messages."
              : "Complete the readiness checklist before sending through the bot."}
          </p>
        </div>
        <b className={telegramReady ? "status ready" : "status pending"}>
          {telegramReady ? "Ready" : "Blocked"}
        </b>
      </div>

      <div className="bot-check-grid">
        {checks.map(([label, passed]) => (
          <article key={label} className={passed ? "passed" : "blocked"}>
            <span>{passed ? "Passed" : "Needed"}</span>
            <strong>{label}</strong>
          </article>
        ))}
      </div>

      <div className="mode-switch bot-mode-switch">
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

      <div className="bot-chat-preview">
        <article className="bot-bubble bot">
          <span>AdvisorFlow Bot</span>
          <p>{telegramDraftBody || generatedDraft.body}</p>
        </article>
        <article className="bot-bubble client">
          <span>Client</span>
          <p>Receives this in Telegram after the advisor clicks send.</p>
        </article>
      </div>

      <label className="telegram-editor">
        Edit before sending
        <textarea
          onChange={(event) => setTelegramDraftBody(event.target.value)}
          rows="7"
          value={telegramDraftBody}
        />
      </label>

      {telegramStatus.text && (
        <p className={`delivery-status delivery-${telegramStatus.tone}`}>
          {telegramStatus.text}
        </p>
      )}

      <button
        className="primary-action"
        disabled={telegramStatus.tone === "sending"}
        onClick={onSend}
        type="button"
      >
        {telegramStatus.tone === "sending" ? "Sending Telegram" : "Send Bot Message And Log"}
      </button>
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
  return (
    <section className="panel compliance-card">
      <PanelHeader title="Compliance Guardrail" meta={complianceRisk.level} />
      <div className={`risk-meter risk-${complianceRisk.level.toLowerCase()}`}>
        <span style={{ width: `${complianceRisk.score}%` }} />
      </div>
      <strong>{complianceRisk.reasons[0]}</strong>
      <ul className="compact-list">
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

function FollowUpManager({ activeTasks, completeTask, consentLocked, createFollowUp, followUpText, setFollowUpText }) {
  return (
    <section className="panel">
      <PanelHeader title="Follow-Up Manager" meta={`${activeTasks.length} active`} />
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
      </div>
    </section>
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

function MeetingsPanel({ clientsState, meetings }) {
  return (
    <section className="panel">
      <PanelHeader title="Calendar Intelligence" meta={`${meetings.length} meetings`} />
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
