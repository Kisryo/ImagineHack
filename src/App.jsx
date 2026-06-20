import { useEffect, useMemo, useState } from "react";
import {
  advisors,
  auditLogsSeed,
  adminReviewItems,
  businessImpact as businessImpactSeed,
  complianceQueue,
  clients,
  cpdCourses,
  demoEvents,
  expensesSeed,
  meetings,
  overnightSignals,
  partners,
  referralOutcomes,
  tasks as taskSeed,
} from "./data.js";
import {
  buildDemoStory,
  buildMorningBrief,
  generateClientBrief,
  generateDraftMessage,
  generateNextBestActions,
  getPriorityClients,
  matchPartners,
  recommendCpd,
  scoreComplianceRisk,
  summarizeAdmin,
  summarizeBusinessImpact,
} from "./engines.js";

const advisor = advisors.find((person) => person.role === "Advisor");
const admin = advisors.find((person) => person.role === "Admin");

const seededReferrals = referralOutcomes.map((referral) => {
  const partner = partners.find((item) => item.id === referral.partnerId);
  return {
    ...referral,
    partnerName: partner?.name ?? "Partner desk",
    value: referral.expectedValue,
  };
});

const advisorRoutes = [
  ["/advisor/today", "Today"],
  ["/advisor/clients", "Clients"],
  ["/advisor/client", "Cockpit"],
  ["/advisor/actions", "Actions"],
  ["/advisor/partners", "Partners"],
  ["/advisor/learning", "Learning"],
  ["/advisor/claims", "Claims"],
];

const adminRoutes = [
  ["/admin/impact", "Impact"],
  ["/admin/compliance", "Compliance"],
  ["/admin/referrals", "Referrals"],
  ["/admin/audit", "Audit"],
];

function normalizePath(pathname) {
  const supported = new Set([...advisorRoutes, ...adminRoutes, ["/demo", "Demo"]].map(([path]) => path));
  return supported.has(pathname) ? pathname : "/advisor/today";
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

function buildImpactSummary({ auditLogs, businessImpactRows, consentRequests, cpd, referrals, tasks }) {
  const findRow = (pattern) => businessImpactRows.find((row) => pattern.test(row.label));
  const managedPremium = findRow(/managed premium/i)?.displayValue ?? "RM 0";
  const referralPipeline =
    findRow(/referral revenue|weighted referral/i)?.displayValue ??
    findRow(/referral/i)?.displayValue ??
    "RM 0";
  const openConsentRequests = consentRequests.filter((request) => request.status === "Pending admin review");
  const blockedRisks = auditLogs.filter((log) => log.risk === "High").length + openConsentRequests.length;
  const openTasks = tasks.filter((task) => task.status !== "Done").length;
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const followUpCompletion = Math.max(0, Math.round(((tasks.length - openTasks) / Math.max(tasks.length, 1)) * 100));
  const cpdReadiness = Math.min(100, Math.round((advisor.cpdHours / Math.max(advisor.cpdTarget, 1)) * 100));
  const referralHygiene = Math.min(100, 62 + referrals.length * 7);
  const trackFit = Math.min(
    98,
    78 + Math.min(referrals.length * 2, 8) + (blockedRisks > 0 ? 5 : 0) + (cpd.length > 3 ? 5 : 0)
  );

  return {
    blockedRisks,
    complianceHealth: overdueTasks > 0 ? `${blockedRisks} guardrails` : "Stable",
    cpdReadiness,
    followUpCompletion,
    managedPremium,
    referralHygiene,
    referralPipeline,
    trackFit,
  };
}

function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [role, setRole] = useState("Advisor");
  const [activeClientId, setActiveClientId] = useState("client-tan");
  const [tasks, setTasks] = useState(taskSeed);
  const [referrals, setReferrals] = useState(seededReferrals);
  const [expenses, setExpenses] = useState(expensesSeed);
  const [auditLogs, setAuditLogs] = useState(auditLogsSeed);
  const [clientsState, setClientsState] = useState(clients);
  const [consentRequests, setConsentRequests] = useState([
    {
      id: "consent-1",
      clientId: "client-lee",
      status: "Pending admin review",
      reason: "Advisor attempted to open a masked profile before PDPA refresh.",
    },
  ]);
  const [followUpText, setFollowUpText] = useState("Send legacy planning one-pager");
  const [expenseAmount, setExpenseAmount] = useState("38");
  const [composerMode, setComposerMode] = useState("follow-up");

  const activeClient = clientsState.find((client) => client.id === activeClientId);
  const activeTasks = tasks.filter((task) => task.clientId === activeClient.id && task.status !== "Done");
  const activeExpenses = expenses.filter((expense) => expense.clientId === activeClient.id);
  const activeReferrals = referrals.filter((referral) => referral.clientId === activeClient.id);
  const consentLocked = activeClient.consentStatus !== "Verified";

  const priorityClients = useMemo(() => getPriorityClients(clientsState, tasks), [clientsState, tasks]);
  const morningBrief = useMemo(() => buildMorningBrief(clientsState, tasks, meetings, overnightSignals), [clientsState, tasks]);
  const cpd = useMemo(() => recommendCpd(cpdCourses, clientsState, advisor), [clientsState]);
  const partnerMatches = useMemo(() => matchPartners(activeClient, partners), [activeClient]);
  const complianceRisk = useMemo(
    () => scoreComplianceRisk(activeClient, tasks, complianceQueue),
    [activeClient, tasks]
  );
  const clientBrief = useMemo(
    () => generateClientBrief(activeClient, tasks, overnightSignals, referrals),
    [activeClient, tasks, referrals]
  );
  const nextActions = useMemo(
    () => generateNextBestActions(activeClient, tasks, partners, complianceQueue),
    [activeClient, tasks]
  );
  const generatedDraft = useMemo(
    () => {
      const draftAction =
        composerMode === "referral"
          ? partnerMatches[0]?.name ?? "partner referral"
          : composerMode === "compliance"
            ? "consent refresh and audit evidence"
            : nextActions[0]?.title ?? "client follow-up";
      const channel = composerMode === "referral" ? "Email" : "WhatsApp";
      return generateDraftMessage(activeClient, draftAction, channel);
    },
    [composerMode, activeClient, partnerMatches, nextActions]
  );
  const businessImpactRows = useMemo(
    () => summarizeBusinessImpact(businessImpactSeed, clientsState, referrals),
    [clientsState, referrals]
  );
  const businessImpact = useMemo(
    () => buildImpactSummary({ businessImpactRows, tasks, referrals, auditLogs, cpd, consentRequests }),
    [businessImpactRows, tasks, referrals, auditLogs, cpd, consentRequests]
  );
  const adminMetrics = useMemo(
    () =>
      summarizeAdmin({
        clients: clientsState,
        tasks,
        referrals,
        expenses,
        complianceItems: complianceQueue,
        reviewItems: adminReviewItems,
      }),
    [tasks, referrals, expenses]
  );
  const demoStory = useMemo(
    () =>
      buildDemoStory({
        clients: clientsState,
        tasks,
        meetings,
        signals: overnightSignals,
        partners,
        complianceItems: complianceQueue,
        impactItems: businessImpactSeed,
        referrals,
      }),
    [clientsState, tasks, referrals]
  );

  useEffect(() => {
    const handlePopState = () => setCurrentPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    if (window.location.pathname !== currentPath) {
      window.history.replaceState({}, "", currentPath);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentPath.startsWith("/admin") && role !== "Admin") {
      setRole("Admin");
    }
    if (currentPath.startsWith("/advisor") && role !== "Advisor") {
      setRole("Advisor");
    }
  }, [currentPath, role]);

  function navigate(path) {
    const nextPath = normalizePath(path);
    if (nextPath === currentPath) return;
    window.history.pushState({}, "", nextPath);
    setCurrentPath(nextPath);
  }

  function addAudit(action, risk = "Low") {
    setAuditLogs((current) => [
      {
        id: `audit-${Date.now()}`,
        time: new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
        actor: role === "Admin" ? admin.name : advisor.name,
        action,
        risk,
      },
      ...current,
    ]);
  }

  function selectClient(clientId) {
    const selected = clientsState.find((client) => client.id === clientId);
    setActiveClientId(clientId);
    if (!selected) return;
    addAudit(
      selected.consentStatus === "Verified"
        ? `Viewed ${selected.name} client memory`
        : "Viewed masked profile for consent-locked client",
      selected.consentStatus === "Verified" ? "Low" : "High"
    );
  }

  function blockForConsent(action) {
    addAudit(`Blocked ${action} for consent-locked client until consent refresh`, "High");
  }

  function requestConsentRefresh(reason = "Advisor requested a consent refresh from the action composer.") {
    const alreadyOpen = consentRequests.some(
      (request) => request.clientId === activeClient.id && request.status !== "Approved"
    );
    if (!alreadyOpen) {
      setConsentRequests((current) => [
        {
          id: `consent-${Date.now()}`,
          clientId: activeClient.id,
          status: "Pending admin review",
          reason,
        },
        ...current,
      ]);
    }
    addAudit("Requested consent refresh for consent-locked client", "High");
  }

  function resolveConsentRequest(requestId, decision) {
    const request = consentRequests.find((item) => item.id === requestId);
    if (!request) return;

    setConsentRequests((current) =>
      current.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: decision === "Approved" ? "Approved" : "Rejected",
            }
          : item
      )
    );

    if (decision === "Approved") {
      setClientsState((current) =>
        current.map((client) =>
          client.id === request.clientId
            ? {
                ...client,
                consentStatus: "Verified",
                name: "Verified client profile",
                segment: "Emerging Affluent",
                occupation: "Client profile restored",
                location: "Verified location",
                prioritySignals: ["Consent refreshed", "Education planning review"],
                needs: ["education", "medical", "retirement"],
                assets: "RM 620k",
                annualPremium: 18000,
                household: "Verified household profile",
                propensity: 76,
                estimatedCoverageGap: 540000,
                nextBestOffer: "Education and maternity protection review",
                memory: [
                  "Prefers digital walkthroughs and quick simulations.",
                  "Family protection review requested.",
                  "Asked about education funding scenarios.",
                ],
                timeline: [
                  { date: "2026-06-20", type: "Consent", note: "Consent refresh approved by admin." },
                  { date: "2026-06-21", type: "Meeting", note: "Education and maternity coverage review." },
                ],
              }
            : client
        )
      );
    }

    addAudit(
      `${decision} consent refresh request for ${formatClientName(request.clientId, clientsState)}`,
      decision === "Approved" ? "Low" : "Medium"
    );
  }

  function createFollowUp(title = followUpText.trim(), source = "manual") {
    if (!title) return;
    if (consentLocked) {
      blockForConsent("follow-up creation");
      requestConsentRefresh("Follow-up was blocked because the selected client is consent-locked.");
      return;
    }
    setTasks((current) => [
      {
        id: `task-${Date.now()}`,
        clientId: activeClient.id,
        title,
        due: "2026-06-21",
        status: "Open",
        severity: source === "copilot" ? "high" : "medium",
      },
      ...current,
    ]);
    addAudit(`Created ${source} follow-up for ${activeClient.name}`, source === "copilot" ? "Medium" : "Low");
    setFollowUpText("");
  }

  function completeTask(taskId) {
    const targetTask = tasks.find((task) => task.id === taskId);
    const targetClient = clientsState.find((client) => client.id === targetTask?.clientId);
    const isConsentTask = /consent|pdpa/i.test(targetTask?.title ?? "");
    if (targetClient?.consentStatus !== "Verified" && !isConsentTask) {
      addAudit("Blocked task update for consent-locked client until consent refresh", "High");
      return;
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status: "Done" } : task))
    );
    addAudit(`Completed advisor follow-up${targetClient ? ` for ${formatClientName(targetClient.id, clientsState)}` : ""}`);
  }

  function createReferral(partner = partnerMatches[0], note = partner?.reason) {
    if (!partner) return;
    if (consentLocked) {
      blockForConsent("partner referral");
      requestConsentRefresh("Referral recommendation was blocked pending consent verification.");
      return;
    }
    setReferrals((current) => [
      {
        id: `ref-${Date.now()}`,
        clientId: activeClient.id,
        partnerId: partner.id,
        partnerName: partner.name,
        status: "Submitted",
        note,
        stage: "Advisor submitted",
        value: activeClient.annualPremium ? Math.round(activeClient.annualPremium * 0.45) : 0,
        expectedValue: activeClient.annualPremium ? Math.round(activeClient.annualPremium * 0.45) : 0,
        probability: 74,
      },
      ...current,
    ]);
    addAudit(`Created ${partner.name} referral for ${activeClient.name}`, "Medium");
  }

  function createExpense() {
    if (consentLocked) {
      blockForConsent("expense submission");
      return;
    }
    const amount = Number.parseFloat(expenseAmount);
    const normalizedAmount = Math.round(amount * 100) / 100;
    if (!Number.isFinite(amount) || normalizedAmount < 0.01 || normalizedAmount > 10000) {
      addAudit("Blocked invalid expense input", "Medium");
      return;
    }
    setExpenses((current) => [
      {
        id: `exp-${Date.now()}`,
        advisorId: advisor.id,
        clientId: activeClient.id,
        category: "Client follow-up",
        amount: normalizedAmount,
        status: normalizedAmount > 100 ? "Flagged" : "Pending",
        date: "2026-06-20",
      },
      ...current,
    ]);
    addAudit(
      `Submitted RM ${normalizedAmount} expense for ${activeClient.name}`,
      normalizedAmount > 100 ? "High" : "Low"
    );
    setExpenseAmount("");
  }

  function approveComposerDraft() {
    if (composerMode === "referral") {
      createReferral(partnerMatches[0], generatedDraft.body);
      return;
    }
    if (composerMode === "compliance") {
      requestConsentRefresh(generatedDraft.body);
      return;
    }
    createFollowUp(nextActions[0]?.title ?? generatedDraft.subject, "copilot");
  }

  return (
    <main className="app-shell">
      <TopBar
        role={role}
        setRole={(nextRole) => {
          setRole(nextRole);
          navigate(nextRole === "Admin" ? "/admin/impact" : "/advisor/today");
        }}
        businessImpact={businessImpact}
      />
      <div className="primary-layout">
        <NavigationShell currentPath={currentPath} navigate={navigate} role={role} />
        <div className="route-surface">
          {currentPath === "/demo" ? (
            <DemoPage
              auditLogs={auditLogs}
              businessImpact={businessImpact}
              demoStory={demoStory}
              navigate={navigate}
              priorityClients={priorityClients}
            />
          ) : role === "Advisor" ? (
            <AdvisorExperience
              activeClient={activeClient}
              activeClientId={activeClientId}
              activeExpenses={activeExpenses}
              activeReferrals={activeReferrals}
              activeTasks={activeTasks}
              businessImpact={businessImpact}
              clientBrief={clientBrief}
              clientsState={clientsState}
              complianceRisk={complianceRisk}
              composerMode={composerMode}
              consentLocked={consentLocked}
              cpd={cpd}
              createExpense={createExpense}
              createFollowUp={createFollowUp}
              createReferral={createReferral}
              expenseAmount={expenseAmount}
              followUpText={followUpText}
              generatedDraft={generatedDraft}
              meetings={meetings}
              morningBrief={morningBrief}
              navigate={navigate}
              nextActions={nextActions}
              onApproveDraft={approveComposerDraft}
              partnerMatches={partnerMatches}
              priorityClients={priorityClients}
              requestConsentRefresh={requestConsentRefresh}
              route={currentPath}
              selectClient={selectClient}
              setComposerMode={setComposerMode}
              setExpenseAmount={setExpenseAmount}
              setFollowUpText={setFollowUpText}
              completeTask={completeTask}
            />
          ) : (
            <AdminExperience
              adminMetrics={adminMetrics}
              adminReviewItems={adminReviewItems}
              auditLogs={auditLogs}
              businessImpact={businessImpact}
              businessImpactRows={businessImpactRows}
              clientsState={clientsState}
              complianceQueue={complianceQueue}
              consentRequests={consentRequests}
              cpd={cpd}
              expenses={expenses}
              referrals={referrals}
              resolveConsentRequest={resolveConsentRequest}
              route={currentPath}
              tasks={tasks}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function TopBar({ role, setRole, businessImpact }) {
  const user = role === "Advisor" ? advisor : admin;

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark">AF</div>
        <div>
          <p className="eyebrow">Track 1: secure, scalable, sustainable advisory platform</p>
          <h1>AdvisorFlow AI</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="score-pill">
          <span>Judge impact</span>
          <strong>{businessImpact.trackFit}%</strong>
        </div>
        <div className="identity">
          <span>{user.name}</span>
          <small>{user.role} demo login</small>
        </div>
        <div className="segmented" aria-label="Demo role">
          {["Advisor", "Admin"].map((item) => (
            <button
              className={role === item ? "active" : ""}
              key={item}
              onClick={() => setRole(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function NavigationShell({ currentPath, navigate, role }) {
  return (
    <aside className="side-nav">
      <div>
        <span>Advisor</span>
        {advisorRoutes.map(([path, label]) => (
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
      <div>
        <span>Admin</span>
        {adminRoutes.map(([path, label]) => (
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
      <button className={currentPath === "/demo" ? "active demo-link" : "demo-link"} onClick={() => navigate("/demo")} type="button">
        Guided Demo
      </button>
      <small>{role} workspace</small>
    </aside>
  );
}

function AdvisorExperience(props) {
  const {
    activeClient,
    activeClientId,
    activeExpenses,
    activeReferrals,
    activeTasks,
    businessImpact,
    clientBrief,
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
    meetings,
    morningBrief,
    navigate,
    nextActions,
    onApproveDraft,
    partnerMatches,
    priorityClients,
    requestConsentRefresh,
    selectClient,
    setComposerMode,
    setExpenseAmount,
    setFollowUpText,
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
            <strong>{client.consentStatus === "Verified" ? client.score : "Hold"}</strong>
            <small>
              {client.consentStatus === "Verified"
                ? client.prioritySignals.join(" / ")
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
        <div className="content-grid">
          <MeetingsPanel clientsState={clientsState} meetings={meetings} />
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
        {clientQueue}
        <div className="content-grid">
          <ClientMemory activeClient={activeClient} />
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
      <div className="content-grid three">
        <ActionComposer
          composerMode={composerMode}
          consentLocked={consentLocked}
          generatedDraft={generatedDraft}
          onApproveDraft={onApproveDraft}
          setComposerMode={setComposerMode}
        />
        <FollowUpManager
          activeTasks={activeTasks}
          completeTask={completeTask}
          consentLocked={consentLocked}
          createFollowUp={createFollowUp}
          followUpText={followUpText}
          setFollowUpText={setFollowUpText}
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
        <LearningPanel cpd={cpd} />
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
          <h2>One client signal becomes a governed advisor action plan.</h2>
          <p>
            AdvisorFlow connects client memory, CPD, partner matching, follow-ups, expense controls,
            and audit visibility into one morning command centre.
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
        <div className="brief-grid">
          {morningBrief.map((item) => (
            <article className="brief-card" key={item}>
              {item}
            </article>
          ))}
        </div>
      </section>
      <div className="content-grid">
        {clientQueue}
        <MeetingsPanel clientsState={clientsState} meetings={meetings} />
      </div>
    </div>
  );
}

function DemoRail({ demoEvents, demoStory }) {
  return (
    <aside className="demo-rail">
      <PanelHeader title="5 Minute Pitch Flow" meta="Live story" />
      <div className="story-stack">
        {demoStory.map((step, index) => (
          <article className="story-step" key={step.title}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <div>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="signal-feed">
        <strong>What changed overnight</strong>
        {demoEvents.slice(0, 4).map((event) => (
          <article key={event.id}>
            <span>{event.time}</span>
            <p>{event.title}</p>
            <b>{event.impact}</b>
          </article>
        ))}
      </div>
      <div className="judge-map">
        {[
          ["Technical", "30%"],
          ["Content", "20%"],
          ["Pitching", "20%"],
          ["Design", "15%"],
          ["Track Fit", "10%"],
          ["Growth", "5%"],
        ].map(([label, value]) => (
          <span key={label}>
            {label}
            <b>{value}</b>
          </span>
        ))}
      </div>
    </aside>
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

function ActionComposer({ composerMode, consentLocked, generatedDraft, onApproveDraft, setComposerMode }) {
  return (
    <section className="panel action-composer">
      <PanelHeader title="Action Composer" meta="Advisor approved" />
      <div className="mode-switch">
        {[
          ["follow-up", "Follow-up"],
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
        <p>{generatedDraft.body}</p>
        <ul>
          {generatedDraft.disclaimers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <button className="primary-action" onClick={onApproveDraft} type="button">
        {consentLocked && composerMode !== "compliance" ? "Log Blocked Action" : "Approve And Save"}
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

function LearningPanel({ cpd }) {
  return (
    <section className="panel">
      <PanelHeader title="CPD Readiness" meta={`${advisor.cpdHours}/${advisor.cpdTarget} hours`} />
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
  resolveConsentRequest,
  route,
  tasks,
}) {
  const flaggedExpenses = expenses.filter((expense) => ["Flagged", "Masked"].includes(expense.status));
  const highRiskLogs = auditLogs.filter((log) => log.risk === "High");
  const openConsentRequests = consentRequests.filter((request) => request.status === "Pending admin review");

  const impactHero = (
      <section className="command-hero admin-hero">
        <div>
          <p className="eyebrow">Organisation-wide capability</p>
          <h2>Admin sees productivity, partner pipeline, CPD growth, and compliance health in one view.</h2>
          <p>
            This is the scalability story for AAG x ASG: advisors act faster, leaders see risk earlier,
            and partner opportunities stop disappearing into private chats.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Track Fit" value={`${businessImpact.trackFit}%`} />
          <ImpactStat label="Readiness" value={`${businessImpact.cpdReadiness}%`} />
          <ImpactStat label="Compliance" value={businessImpact.complianceHealth} />
        </div>
      </section>
  );

  const impactDashboard = (
      <section className="panel span-all">
        <PanelHeader title="Business Impact Dashboard" meta="Judge scoring view" />
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
              {request.status === "Pending admin review" ? (
                <div className="review-actions">
                  <button onClick={() => resolveConsentRequest(request.id, "Approved")} type="button">
                    Approve
                  </button>
                  <button onClick={() => resolveConsentRequest(request.id, "Rejected")} type="button">
                    Reject
                  </button>
                </div>
              ) : (
                <b>{request.status}</b>
              )}
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
        <PanelHeader title="Admin Review Board" meta={`${adminReviewItems.length} controls`} />
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
        <PanelHeader title="Task Controls" meta={`${tasks.length} actions`} />
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
        {compliancePanel}
        {reviewPanel}
        {taskPanel}
      </div>
    );
  }

  if (route === "/admin/referrals") {
    return (
      <div className="admin-layout">
        {referralPanel}
        {coachingPanel}
        {reviewPanel}
      </div>
    );
  }

  if (route === "/admin/audit") {
    return (
      <div className="admin-layout">
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
      {referralPanel}
      {compliancePanel}
    </div>
  );
}

function DemoPage({ auditLogs, businessImpact, demoStory, navigate, priorityClients }) {
  return (
    <div className="demo-page">
      <section className="command-hero">
        <div>
          <p className="eyebrow">Guided Demo</p>
          <h2>A five-minute story from overnight signal to governed business impact.</h2>
          <p>
            Walk the judges through the advisor path first, prove consent masking, then end on admin impact
            and auditability.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Track Fit" value={`${businessImpact.trackFit}%`} />
          <ImpactStat label="Blocked Risks" value={businessImpact.blockedRisks} />
          <ImpactStat label="Pipeline Value" value={businessImpact.referralPipeline} />
        </div>
      </section>
      <DemoRail demoEvents={demoEvents} demoStory={demoStory} />
      <section className="panel">
        <PanelHeader title="Demo Controls" meta="Suggested path" />
        <div className="demo-actions">
          {[
            ["/advisor/today", "Start Morning Brief"],
            ["/advisor/client", `Open ${displayClientName(priorityClients[0])}`],
            ["/advisor/actions", "Show Blocked Actions"],
            ["/admin/impact", "Close With Impact"],
          ].map(([path, label]) => (
            <button key={path} onClick={() => navigate(path)} type="button">
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelHeader title="Latest Audit Evidence" meta={`${auditLogs.length} logs`} />
        <div className="audit-table">
          {auditLogs.slice(0, 4).map((log) => (
            <article key={log.id}>
              <span>{log.time}</span>
              <strong>{log.actor}</strong>
              <p>{log.action}</p>
              <b className={`risk-${log.risk.toLowerCase()}`}>{log.risk}</b>
            </article>
          ))}
        </div>
      </section>
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
