import { useEffect, useMemo, useState, useCallback } from "react";
import {
  advisors,
  auditLogsSeed,
  businessImpact as businessImpactSeed,
  complianceQueue,
  clients,
  cpdCourses,
  cpdModules,
  meetings,
  overnightSignals,
  tasks as taskSeed,
} from "./data.js";
import {
  buildMorningBrief,
  generateClientBrief,
  generateDraftMessage,
  generateNextBestActions,
  getPriorityClients,
  recommendCpd,
  recommendLearningModule,
  generateKnowledgeGateQuiz,
  scoreComplianceRisk,
  summarizeBusinessImpact,
} from "./engines.js";
import { hasSupabaseConfig } from "./supabaseClient.js";
import { loadAdvisorTodayData } from "./supabaseData.js";
import { generateClientSuggestions, detectKnowledgeGaps, generateSmartLearningPath } from "./openaiService.js";

const advisor = advisors.find((person) => person.role === "Advisor");

const advisorRoutes = [
  ["/advisor/today", "Today"],
  ["/advisor/clients", "Client Moments"],
  ["/advisor/client", "Client Assistant"],
  ["/advisor/actions", "Follow-Ups"],
  ["/advisor/learning", "Learning"],
];

function normalizePath(pathname) {
  const supported = new Set(advisorRoutes.map(([path]) => path));
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

function buildImpactSummary({ auditLogs, businessImpactRows, consentRequests, cpd, tasks }) {
  const findRow = (pattern) => businessImpactRows.find((row) => pattern.test(row.label));
  const managedPremium = findRow(/managed premium/i)?.displayValue ?? "RM 0";
  const openConsentRequests = consentRequests.filter((request) => request.status === "Pending review");
  const blockedRisks = auditLogs.filter((log) => log.risk === "High").length + openConsentRequests.length;
  const openTasks = tasks.filter((task) => task.status !== "Done").length;
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const followUpCompletion = Math.max(0, Math.round(((tasks.length - openTasks) / Math.max(tasks.length, 1)) * 100));
  const cpdReadiness = Math.min(100, Math.round((advisor.cpdHours / Math.max(advisor.cpdTarget, 1)) * 100));
  const trackFit = Math.min(
    98,
    78 + Math.min(openTasks * 2, 8) + (blockedRisks > 0 ? 5 : 0) + (cpd.length > 3 ? 5 : 0)
  );

  return {
    blockedRisks,
    complianceHealth: overdueTasks > 0 ? `${blockedRisks} guardrails` : "Stable",
    cpdReadiness,
    followUpCompletion,
    actionPipeline: `${openTasks} open`,
    managedPremium,
    trackFit,
  };
}

function mapSupabasePriorityClients(priorityQueue, clientsSource) {
  return priorityQueue.map((row) => {
    const localClient = clientsSource.find(
      (client) => client.name === row.name || client.id === row.client_id
    );

    if (localClient) {
      return {
        ...localClient,
        score: row.priority_score,
        prioritySignals: row.priority_reason
          ? row.priority_reason.split("; ").slice(0, 3)
          : localClient.prioritySignals,
      };
    }

    return {
      id: row.client_id,
      name: row.name,
      segment: row.segment ?? "Client",
      advisorId: row.advisor_id,
      consentStatus: row.consent_status === "verified" ? "Verified" : "Review due",
      prioritySignals: row.priority_reason ? row.priority_reason.split("; ").slice(0, 3) : ["Supabase priority signal"],
      score: row.priority_score,
      needs: [],
      annualPremium: row.total_premium ?? 0,
      estimatedCoverageGap: row.total_coverage ?? 0,
      memory: ["Loaded from Supabase priority queue."],
      timeline: [],
    };
  });
}

function buildSupabaseMorningBrief(priorityQueue, actionSuggestions) {
  const topClient = priorityQueue[0];
  const topAction = actionSuggestions[0];
  const consentBlocks = actionSuggestions.filter((item) => item.message_type === "compliance").length;

  return [
    topClient
      ? `${topClient.name} is top priority with score ${topClient.priority_score}: ${topClient.priority_reason}.`
      : "No Supabase priority rows returned yet.",
    `${actionSuggestions.length} open client signal(s) are ready for action today.`,
    topAction
      ? `Next suggested action: ${topAction.suggested_action}`
      : "No suggested action is available.",
    consentBlocks > 0
      ? `${consentBlocks} consent/compliance item(s) must be handled before private action.`
      : "No consent blocks found in today's Supabase suggestions.",
  ];
}

function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [activeClientId, setActiveClientId] = useState("client-tan");
  const [tasks, setTasks] = useState(taskSeed);
  const [auditLogs, setAuditLogs] = useState(auditLogsSeed);
  const [clientsState] = useState(clients);
  const [consentRequests, setConsentRequests] = useState([
    {
      id: "consent-1",
      clientId: "client-lee",
      status: "Pending review",
      reason: "Advisor attempted to open a masked profile before PDPA refresh.",
    },
  ]);
  const [followUpText, setFollowUpText] = useState("Send legacy planning one-pager");
  const [composerMode, setComposerMode] = useState("follow-up");
  const [supabaseToday, setSupabaseToday] = useState({
    actionSuggestions: [],
    error: null,
    loading: hasSupabaseConfig,
    priorityQueue: [],
  });

  // Adaptive CPD state
  const [selectedAdvisorId, setSelectedAdvisorId] = useState(advisors.find((a) => a.role === "Advisor")?.id ?? "adv-alex");
  const [completedCpdHours, setCompletedCpdHours] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [demoGapsActive, setDemoGapsActive] = useState(false);
  const [completedModules, setCompletedModules] = useState([]);
  const [activeCoursePrototype, setActiveCoursePrototype] = useState(null);

  const [mockGaps, setMockGaps] = useState([]);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  useEffect(() => {
    if (demoGapsActive && mockGaps.length === 0 && !isDetectingGaps) {
      setIsDetectingGaps(true);
      detectKnowledgeGaps(clientsState, cpdModules).then(gaps => {
        setMockGaps(gaps);
        setIsDetectingGaps(false);
      });
    }
  }, [demoGapsActive, clientsState]);

  const cpdRecentNotes = useMemo(() => {
    if (!demoGapsActive) return "";
    return mockGaps
      .filter((gap) => !completedModules.some((m) => m.id === gap.courseId))
      .map((gap) => gap.keyword)
      .join(" ");
  }, [demoGapsActive, completedModules, mockGaps]);

  const selectedAdvisor = advisors.find((a) => a.id === selectedAdvisorId) ?? advisors[0];
  const cpdTarget = 40.0;

  const [cpdRecommendation, setCpdRecommendation] = useState({});
  const [isGeneratingLearningPath, setIsGeneratingLearningPath] = useState(false);

  useEffect(() => {
    setIsGeneratingLearningPath(true);
    generateSmartLearningPath(selectedAdvisor, clientsState, cpdModules, cpdRecentNotes).then(rec => {
      setCpdRecommendation(rec);
      setIsGeneratingLearningPath(false);
    });
  }, [selectedAdvisor, clientsState, cpdRecentNotes]);

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState(null);

  const handleCompleteLesson = useCallback(() => {
    if (cpdRecommendation.module && !lessonCompleted) {
      setActiveCoursePrototype(cpdRecommendation.module);
    }
  }, [cpdRecommendation, lessonCompleted]);

  const handleQuizSuccess = useCallback(() => {
    if (quizData && quizData.course) {
      const course = quizData.course;
      setCompletedCpdHours((prev) => Math.min(cpdTarget, +(prev + (course.cpdHours ?? 2.0)).toFixed(1)));
      setCompletedModules((prev) => {
        if (prev.some((m) => m.id === course.id)) return prev;
        return [...prev, { ...course, completedAt: new Date().toISOString() }];
      });
      addAudit(`Completed CPD module & passed Knowledge Gate: ${course.title}`, "Low");
      
      // If it was the featured recommendation, also mark the featured lesson as completed
      if (cpdRecommendation.module && course.id === cpdRecommendation.module.id) {
        setLessonCompleted(true);
      }
    }
    setShowQuizModal(false);
    setQuizData(null);
  }, [quizData, addAudit, cpdTarget, cpdRecommendation]);

  const handleSwitchAdvisor = useCallback((id) => {
    setSelectedAdvisorId(id);
    setLessonCompleted(false);
  }, []);


  const activeClient = clientsState.find((client) => client.id === activeClientId);
  const activeTasks = tasks.filter((task) => task.clientId === activeClient.id && task.status !== "Done");
  const consentLocked = activeClient.consentStatus !== "Verified";

  const priorityClients = useMemo(() => getPriorityClients(clientsState, tasks), [clientsState, tasks]);
  const morningBrief = useMemo(() => buildMorningBrief(clientsState, tasks, meetings, overnightSignals), [clientsState, tasks]);
  const supabasePriorityClients = useMemo(
    () => mapSupabasePriorityClients(supabaseToday.priorityQueue, clientsState),
    [clientsState, supabaseToday.priorityQueue]
  );
  const displayedPriorityClients = supabasePriorityClients.length > 0 ? supabasePriorityClients : priorityClients;
  const displayedMorningBrief = useMemo(
    () =>
      supabaseToday.actionSuggestions.length > 0
        ? buildSupabaseMorningBrief(supabaseToday.priorityQueue, supabaseToday.actionSuggestions)
        : morningBrief,
    [morningBrief, supabaseToday.actionSuggestions, supabaseToday.priorityQueue]
  );
  const cpd = useMemo(() => recommendCpd(cpdCourses, clientsState, advisor), [clientsState]);
  const complianceRisk = useMemo(
    () => scoreComplianceRisk(activeClient, tasks, complianceQueue),
    [activeClient, tasks]
  );
  const clientBrief = useMemo(
    () => generateClientBrief(activeClient, tasks, overnightSignals, []),
    [activeClient, tasks]
  );
  const [nextActions, setNextActions] = useState([]);
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);

  useEffect(() => {
    if (activeClient) {
      setIsGeneratingActions(true);
      generateClientSuggestions(activeClient, clientBrief?.taskSummary || "").then(actions => {
        setNextActions(actions);
        setIsGeneratingActions(false);
      });
    } else {
      setNextActions([]);
    }
  }, [activeClient, clientBrief]);
  const generatedDraft = useMemo(
    () => {
      const draftAction =
        composerMode === "compliance"
            ? "consent refresh and audit evidence"
            : nextActions[0]?.title ?? "client follow-up";
      return generateDraftMessage(activeClient, draftAction, "WhatsApp");
    },
    [composerMode, activeClient, nextActions]
  );
  const businessImpactRows = useMemo(
    () => summarizeBusinessImpact(businessImpactSeed, clientsState, []),
    [clientsState]
  );
  const businessImpact = useMemo(
    () => buildImpactSummary({ businessImpactRows, tasks, auditLogs, cpd, consentRequests }),
    [businessImpactRows, tasks, auditLogs, cpd, consentRequests]
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
    let cancelled = false;

    async function loadSupabaseData() {
      if (!hasSupabaseConfig) {
        setSupabaseToday((current) => ({ ...current, loading: false }));
        return;
      }

      const result = await loadAdvisorTodayData();
      if (cancelled) return;

      setSupabaseToday({
        actionSuggestions: result.actionSuggestions,
        error: result.error,
        loading: false,
        priorityQueue: result.priorityQueue,
      });
    }

    loadSupabaseData();

    return () => {
      cancelled = true;
    };
  }, []);

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
        actor: advisor.name,
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
          status: "Pending review",
          reason,
        },
        ...current,
      ]);
    }
    addAudit("Requested consent refresh for consent-locked client", "High");
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

  function approveComposerDraft() {
    if (composerMode === "compliance") {
      requestConsentRefresh(generatedDraft.body);
      return;
    }
    createFollowUp(nextActions[0]?.title ?? generatedDraft.subject, "copilot");
  }

  return (
    <main className="app-shell">
      <TopBar
        businessImpact={businessImpact}
      />
      <div className="primary-layout">
        <NavigationShell currentPath={currentPath} navigate={navigate} />
        <div className="route-surface">
          <AdvisorExperience
            activeClient={activeClient}
            activeClientId={activeClientId}
            activeTasks={activeTasks}
            businessImpact={businessImpact}
            clientBrief={clientBrief}
            clientsState={clientsState}
            complianceRisk={complianceRisk}
            composerMode={composerMode}
            consentLocked={consentLocked}
            cpd={cpd}
            createFollowUp={createFollowUp}
            followUpText={followUpText}
            generatedDraft={generatedDraft}
            meetings={meetings}
            morningBrief={displayedMorningBrief}
            navigate={navigate}
            nextActions={nextActions}
            onApproveDraft={approveComposerDraft}
            priorityClients={displayedPriorityClients}
            requestConsentRefresh={requestConsentRefresh}
            route={currentPath}
            selectClient={selectClient}
            setComposerMode={setComposerMode}
            setFollowUpText={setFollowUpText}
            completeTask={completeTask}
            supabaseToday={supabaseToday}
            cpdRecommendation={cpdRecommendation}
            cpdRecentNotes={cpdRecentNotes}
            selectedAdvisorId={selectedAdvisorId}
            selectedAdvisor={selectedAdvisor}
            handleSwitchAdvisor={handleSwitchAdvisor}
            completedCpdHours={completedCpdHours}
            cpdTarget={cpdTarget}
            lessonCompleted={lessonCompleted}
            setLessonCompleted={setLessonCompleted}
            handleCompleteLesson={handleCompleteLesson}
            demoGapsActive={demoGapsActive}
            setDemoGapsActive={setDemoGapsActive}
            completedModules={completedModules}
            isGeneratingActions={isGeneratingActions}
            isDetectingGaps={isDetectingGaps}
            isGeneratingLearningPath={isGeneratingLearningPath}
            setCompletedModules={setCompletedModules}
            activeCoursePrototype={activeCoursePrototype}
            setActiveCoursePrototype={setActiveCoursePrototype}
            mockGaps={mockGaps}
            setCompletedCpdHours={setCompletedCpdHours}
            setShowQuizModal={setShowQuizModal}
            setQuizData={setQuizData}
          />
        </div>
      </div>
      {showQuizModal && quizData && (
        <QuizModal 
          quiz={quizData} 
          onSuccess={handleQuizSuccess} 
          onClose={() => setShowQuizModal(false)} 
        />
      )}
    </main>
  );
}

function TopBar({ businessImpact }) {
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
        <details className="score-pill score-dropdown">
          <summary>
            <span>Action readiness</span>
            <strong>{businessImpact.trackFit}% ▼</strong>
          </summary>
          <div className="dropdown-menu">
            <p>✅ Morning brief reviewed today</p>
            <p>✅ 3 client meetings prepared</p>
            <p>✅ CPD progress on track</p>
            <p>⚠️ 2 follow-ups overdue<br/><small>→ Complete these to reach 100%</small></p>
          </div>
        </details>
        <div className="identity">
          <span>{advisor.name}</span>
          <small>Advisor assistant workspace</small>
        </div>
      </div>
    </header>
  );
}

function NavigationShell({ currentPath, navigate }) {
  return (
    <aside className="side-nav">
      <div>
        <span>Advisor Assistant</span>
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
      <small title="Who to contact, why, and what to say.">Smart Outreach</small>
    </aside>
  );
}

function AdvisorExperience(props) {
  const {
    activeClient,
    activeClientId,
    activeTasks,
    businessImpact,
    clientBrief,
    clientsState,
    complianceRisk,
    composerMode,
    consentLocked,
    cpd,
    createFollowUp,
    followUpText,
    generatedDraft,
    meetings,
    morningBrief,
    navigate,
    nextActions,
    onApproveDraft,
    priorityClients,
    requestConsentRefresh,
    selectClient,
    setComposerMode,
    setFollowUpText,
    completeTask,
    route,
    supabaseToday,
    cpdRecommendation,
    cpdRecentNotes,
    selectedAdvisorId,
    selectedAdvisor,
    handleSwitchAdvisor,
    completedCpdHours,
    cpdTarget,
    lessonCompleted,
    setLessonCompleted,
    handleCompleteLesson,
    demoGapsActive,
    setDemoGapsActive,
    completedModules,
    setCompletedModules,
    activeCoursePrototype,
    setActiveCoursePrototype,
    mockGaps,
    setCompletedCpdHours,
    setShowQuizModal,
    setQuizData,
    isGeneratingActions,
    isDetectingGaps,
    isGeneratingLearningPath,
  } = props;

  const clientQueue = (
    <section className="panel">
      <PanelHeader title="Who Needs Attention Today" meta="Ranked by urgency and service risk" />
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
          <ClientMomentsPanel
            clientsState={clientsState}
            meetings={meetings}
            suggestions={supabaseToday.actionSuggestions}
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
        {clientQueue}
        <div className="content-grid">
          <ClientMemory activeClient={activeClient} />
          <CopilotPanel
            activeClient={activeClient}
            clientBrief={clientBrief}
            complianceRisk={complianceRisk}
            nextActions={nextActions}
            isGeneratingActions={isGeneratingActions}
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

  if (route === "/advisor/learning") {
    return (
      <div className="page-stack">
        <section className="cpd-hero-banner">
          <div>
            <p className="eyebrow">Adaptive CPD & Learning Loop</p>
            <h2>Personalised learning, powered by your portfolio.</h2>
            <p>Your next module is selected based on experience tier, client density, and real-time gap detection from your notes.</p>
          </div>
          <div className="cpd-advisor-switcher">
            <span>Demo advisor</span>
            <div className="mode-switch">
              {advisors.filter((a) => a.role === "Advisor").map((a) => (
                <button
                  key={a.id}
                  className={selectedAdvisorId === a.id ? "active" : ""}
                  onClick={() => handleSwitchAdvisor(a.id)}
                  type="button"
                >
                  {a.name} <small>({a.experienceLevel})</small>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div 
          className="cpd-auto-gaps" 
          onClick={() => { setDemoGapsActive(!demoGapsActive); setLessonCompleted(false); }}
          title="Click to toggle Demo state"
        >
          <div className="gaps-header">
            <strong>🔍 Gaps Detected From Your Recent Notes</strong>
            <small>Last scanned: just now</small>
          </div>
          <ul className="gaps-list">
            {isDetectingGaps ? (
              <li style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                🔄 AI is analyzing your notes and detecting knowledge gaps...
              </li>
            ) : (
              <>
                {mockGaps
                  .filter(gap => !completedModules.some((m) => m.id === gap.courseId))
                  .slice(0, 3)
                  .map((gap) => (
                    <li key={gap.id}>
                      • <span>{gap.label}</span>
                    </li>
                  ))}
                {mockGaps.filter(gap => !completedModules.some((m) => m.id === gap.courseId)).length === 0 && (
                  <li className="gap-completed">✅ All detected gaps have been addressed!</li>
                )}
              </>
            )}
          </ul>
          <div className="gaps-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>→ {mockGaps.every(g => completedModules.some(m => m.id === g.courseId)) ? "Great job clearing your knowledge gaps." : "These gaps triggered today's modules"}</span>
            <a href="#study-history" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 'bold' }}>View Study History</a>
          </div>
        </div>

        {activeCoursePrototype ? (
          <InlineCoursePlayer 
            course={activeCoursePrototype} 
            onClose={() => setActiveCoursePrototype(null)} 
            onComplete={() => {
              const quiz = generateKnowledgeGateQuiz(activeCoursePrototype, selectedAdvisorId, clientsState);
              if (quiz) {
                setQuizData({ ...quiz, course: activeCoursePrototype });
                setShowQuizModal(true);
              } else {
                setCompletedModules((prev) => {
                  if (prev.some((m) => m.id === activeCoursePrototype.id)) return prev;
                  return [...prev, { ...activeCoursePrototype, completedAt: new Date().toISOString() }];
                });
                setCompletedCpdHours((prev) => Math.min(cpdTarget, +(prev + (activeCoursePrototype.cpdHours ?? 2.0)).toFixed(1)));
              }
              setActiveCoursePrototype(null);
            }} 
          />
        ) : (
          <>
            <div className="content-grid">
              <LearningPanel 
                cpd={cpd.filter(course => !cpdRecommendation.module || course.id !== cpdRecommendation.module.id)} 
                completedModules={completedModules} 
                onStartCourse={setActiveCoursePrototype} 
                cpdRecommendation={cpdRecommendation}
                isGeneratingLearningPath={isGeneratingLearningPath}
              />
              <div className="cpd-right-stack">
                <CpdProgressGauge
                  completed={completedCpdHours}
                  target={cpdTarget}
                />
                <section className="panel advisor-readiness-panel">
                  <PanelHeader title="Advisor Readiness" meta="Just-in-time learning" />
                  <div className="readiness-split" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="readiness-col">
                      <strong>Learning Readiness</strong>
                      <p>• CPD Progress: {businessImpact.cpdReadiness}% on track</p>
                      <p>• Next milestone: Aug 31</p>
                      <p>• On track for compliance</p>
                    </div>
                    <div className="readiness-col">
                      <strong>Activity Tracker</strong>
                      {businessImpact.followUpCompletion > 0 ? (
                        <>
                          <p>• Follow-up completion: {businessImpact.followUpCompletion}%</p>
                          <p>• (32 of 43 follow-ups sent)</p>
                        </>
                      ) : (
                        <>
                          <p>• Follow-ups this week: --</p>
                          <p className="empty-state">📎 Connect your calendar to start tracking activity</p>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
        
        <StudyHistoryPanel completedModules={completedModules} mockGaps={mockGaps} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="command-hero">
        <div>
          <p className="eyebrow">Agent Daily Assistant</p>
          <h2>Know who to contact, why it matters, and what to say.</h2>
          <p>
            AdvisorFlow turns existing client data into daily priorities, ready-to-send messages,
            follow-ups, learning nudges, and consent-safe action prompts.
          </p>
        </div>
        <div className="impact-strip">
          <ImpactStat label="Priority Book" value={businessImpact.managedPremium} />
          <ImpactStat label="Open Actions" value={businessImpact.actionPipeline} />
          <ImpactStat label="Safety Blocks" value={businessImpact.blockedRisks} />
        </div>
      </section>

      <SupabaseConnectionPanel supabaseToday={supabaseToday} />

      <section className="panel">
        <PanelHeader title="Today's AI Assistant Brief" meta="Generated 08:00 MYT" />
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
        <ClientMomentsPanel suggestions={supabaseToday.actionSuggestions} meetings={meetings} clientsState={clientsState} />
      </div>
      <DailyActionSuggestions suggestions={supabaseToday.actionSuggestions} />
    </div>
  );
}

function SupabaseConnectionPanel({ supabaseToday }) {
  const status = !hasSupabaseConfig
    ? "Using seeded demo data"
    : supabaseToday.loading
      ? "Connecting to Supabase"
      : supabaseToday.error
        ? "Supabase error"
        : "Connected to Supabase";

  const detail = !hasSupabaseConfig
    ? "Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to read your live tables."
    : supabaseToday.error
      ? supabaseToday.error
      : `${supabaseToday.priorityQueue.length} priority rows and ${supabaseToday.actionSuggestions.length} action suggestions loaded.`;

  return (
    <section className={`panel supabase-panel ${supabaseToday.error ? "error" : ""}`}>
      <PanelHeader title="Backend Connection" meta={status} />
      <p className="quiet-text">{detail}</p>
    </section>
  );
}

function DailyActionSuggestions({ suggestions }) {
  const [copiedId, setCopiedId] = useState(null);
  const [sentIds, setSentIds] = useState([]);

  if (suggestions.length === 0) return null;

  async function copyMessage(suggestion) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(suggestion.draft_message);
    }
    setCopiedId(suggestion.event_id);
  }

  function markSent(suggestion) {
    setSentIds((current) =>
      current.includes(suggestion.event_id) ? current : [...current, suggestion.event_id]
    );
  }

  return (
    <section className="panel ready-actions">
      <PanelHeader title="Ready-To-Send Actions" meta={`${suggestions.length} open client moment(s)`} />
      <div className="action-card-grid">
        {suggestions.slice(0, 5).map((suggestion) => (
          <article className="smart-message-card" key={suggestion.event_id}>
            <div className="message-header">
              <div>
                <span>{suggestion.event_type.replaceAll("_", " ")}</span>
                <strong>{suggestion.client_name}</strong>
              </div>
              <b>{suggestion.priority_score}</b>
            </div>
            <p>{suggestion.suggested_action}</p>
            <blockquote>{suggestion.draft_message}</blockquote>
            {suggestion.message_type !== "birthday" && (
              <small>Compliance-safe: review suitability and consent before final advice.</small>
            )}
            <div className="message-actions">
              <button className="ghost" onClick={() => copyMessage(suggestion)} type="button">
                {copiedId === suggestion.event_id ? "Copied" : "Copy"}
              </button>
              <button onClick={() => markSent(suggestion)} type="button">
                {sentIds.includes(suggestion.event_id) ? "Sent" : "Mark sent"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientMomentsPanel({ suggestions, meetings, clientsState }) {
  const moments =
    suggestions.length > 0
      ? suggestions.slice(0, 4).map((suggestion) => ({
          id: suggestion.event_id,
          client: suggestion.client_name,
          detail: suggestion.title,
          meta: suggestion.event_type.replaceAll("_", " "),
        }))
      : meetings.slice(0, 4).map((meeting) => ({
          id: meeting.id,
          client: formatClientName(meeting.clientId, clientsState),
          detail: isClientLocked(meeting.clientId, clientsState) ? "Consent refresh pending" : meeting.topic,
          meta: meeting.time,
        }));

  return (
    <section className="panel">
      <PanelHeader title="Today's Client Moments" meta={suggestions.length > 0 ? "From Supabase events" : "Seeded fallback"} />
      <div className="stack">
        {moments.map((moment) => (
          <article className="list-row" key={moment.id}>
            <div>
              <strong>{moment.client}</strong>
              <span>{moment.detail}</span>
            </div>
            <b>{moment.meta}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function CopilotPanel({ activeClient, clientBrief, complianceRisk, nextActions, isGeneratingActions }) {
  const locked = activeClient.consentStatus !== "Verified";

  return (
    <section className="panel copilot-panel">
      <PanelHeader title="Client Assistant" meta={locked ? "Masked" : `${complianceRisk.level} risk`} />
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
            {isGeneratingActions ? (
              <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', padding: '10px' }}>
                🔄 AI is analyzing client profile to suggest actions...
              </div>
            ) : (
              nextActions.map((action) => (
                <article key={action.title}>
                  <span>{action.owner} - {action.priority}</span>
                  <strong>{action.title}</strong>
                  <p>{action.reason}</p>
                </article>
              ))
            )}
          </div>
          <div className="data-used">
            {["Client context", "Open tasks", "Client signals", "Message draft", "Consent guardrail"].map((item) => (
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
      <PanelHeader title="Smart Message Assistant" meta="Agent approved" />
      <div className="mode-switch">
        {[
          ["follow-up", "Follow-up"],
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
      <PanelHeader title="Client Context" meta={`${activeClient.segment} - ${activeClient.consentStatus}`} />
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

function StudyHistoryPanel({ completedModules, mockGaps = [] }) {
  const resolvedGaps = mockGaps.filter(g => completedModules.some(m => m.id === g.courseId));

  return (
    <section className="panel" id="study-history" style={{ marginTop: '20px' }}>
      <PanelHeader title="Study History" meta={`${completedModules.length} courses completed`} />
      <div className="stack">
        {completedModules.length === 0 ? (
          <p className="empty-state" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            You haven't completed any courses yet. Start a course to see your history and resolved gaps here!
          </p>
        ) : (
          <>
            {resolvedGaps.length > 0 && (
          <div style={{ padding: '12px', backgroundColor: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              ✅ Resolved Knowledge Gaps
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {resolvedGaps.map(g => (
                <li key={g.id} style={{ marginBottom: '4px' }}>{g.label}</li>
              ))}
            </ul>
          </div>
        )}
        
        <h4 style={{ margin: '5px 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          Completed Courses
        </h4>
        {completedModules.map((mod) => (
          <article className="list-row" key={mod.id}>
            <div>
              <strong>{mod.title}</strong>
              <span style={{ color: "var(--success-color, #2b7a57)" }}>✅ Completed on {new Date(mod.completedAt).toLocaleDateString()}</span>
            </div>
            <b>+{mod.cpdHours ?? 2.0} hrs</b>
          </article>
        ))}
          </>
        )}
      </div>
    </section>
  );
}

function InlineCoursePlayer({ course, onClose, onComplete }) {
  const isCompleted = course.completedAt != null;
  const [slide, setSlide] = useState(1);
  const totalSlides = 3;

  const nextSlide = () => {
    if (slide < totalSlides) setSlide(slide + 1);
  };

  return (
    <section className="panel inline-course-player" style={{ borderLeft: '4px solid var(--primary-color)' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0' }}>Interactive Course Module</h2>
            <span style={{ color: 'var(--text-secondary)' }}>{course.title}</span>
          </div>
          <button className="btn ghost" onClick={onClose} type="button" style={{ padding: '5px 10px' }}>Close</button>
        </div>
      </div>
      
      <div className="course-content-mock" style={{ minHeight: '180px', padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {slide === 1 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>1. Core Concepts & Overview</h4>
            <p style={{ marginBottom: '10px' }}>Welcome to <strong>{course.title}</strong>. This module focuses on exploring foundational principles tailored for your High Net Worth and Mass Affluent portfolios.</p>
            <p>Understanding these scenarios is critical for delivering compliant, effective, and highly personalized financial advice.</p>
          </>
        )}
        {slide === 2 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>2. Regulatory Updates & Suitability</h4>
            <p style={{ marginBottom: '10px' }}>Recent guidelines emphasize the need for rigorous, transparent documentation.</p>
            <p>You must consistently log your suitability rationale when discussing these strategies, ensuring alignment with both client goals and regulatory frameworks.</p>
          </>
        )}
        {slide === 3 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>3. Application & Next Steps</h4>
            <p style={{ marginBottom: '10px' }}>You have learned how to identify risks, structure appropriate solutions, and document your advice properly.</p>
            <p>Next, you must pass the <strong>Knowledge Gate</strong> assessment to verify your understanding and earn your {course.cpdHours ?? 2.0} CPD hours.</p>
          </>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Page {slide} of {totalSlides}</span>
        <div className="progress-bar-mini" style={{ width: '150px', flexGrow: 1, margin: '0 15px' }}>
          <div className="fill" style={{ width: `${(slide / totalSlides) * 100}%` }}></div>
        </div>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '30px' }}>
        {slide < totalSlides ? (
          <button className="btn secondary-action" onClick={nextSlide}>
            Continue Reading →
          </button>
        ) : (
          <button className="btn primary-action" onClick={onComplete} disabled={isCompleted}>
            {isCompleted ? "Already Completed" : "Finish Reading & Take Quiz"}
          </button>
        )}
      </div>
    </section>
  );
}

function LearningPanel({ cpd, completedModules, onStartCourse, cpdRecommendation, isGeneratingLearningPath }) {
  const recommendedMod = cpdRecommendation?.module;
  
  return (
    <section className="panel portfolio-courses-panel">
      <PanelHeader title="Smart Learning Path" meta="Portfolio-Matched Courses" />
      <div className="stack">
        {isGeneratingLearningPath ? (
          <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', padding: '10px' }}>
            🔄 AI is analyzing your portfolio to build a learning path...
          </div>
        ) : recommendedMod && !completedModules.some(m => m.id === recommendedMod.id) && (
          <article className="course-card list-row featured-course" style={{ borderLeft: '4px solid var(--primary-color)', backgroundColor: 'var(--surface-color)' }}>
            <div className="course-card-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⭐ AI Recommended</span>
              </div>
              <strong>{recommendedMod.title}</strong>
              <div className="course-card-meta">
                <span>🎯 Portfolio Match: 100%</span>
                <span>⏱️ {recommendedMod.cpdHours ?? 2.0} CPD hrs</span>
              </div>
              <div className="course-card-status" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-color)', borderRadius: '4px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Strategic Reasoning:</span>
                <span style={{ fontStyle: 'italic', lineHeight: '1.4' }}>{cpdRecommendation.strategicReasoning}</span>
              </div>
            </div>
            <button 
              className="btn primary-action course-start-btn"
              onClick={() => onStartCourse(recommendedMod)}
              style={{ alignSelf: 'flex-start', marginTop: '10px' }}
            >
              Start Course →
            </button>
          </article>
        )}

        {cpd.filter(course => !completedModules.some(m => m.id === course.id)).slice(0, 4).map((course) => {
          const status = course.id === "cpd-mod-elective-young-family" ? "In Progress: 60%" : "Not started";
          const btnText = status.includes("In Progress") ? "Continue →" : "Start Course →";
          const icon = status.includes("In Progress") ? "📘" : "📗";
          return (
            <article className={`course-card list-row`} key={course.id}>
              <div className="course-card-content">
                <strong>{course.title}</strong>
                <div className="course-card-meta">
                  <span>🎯 Portfolio Match: {course.matchScore}%</span>
                  <span>⏱️ {course.cpdHours ?? 2.0} CPD hrs</span>
                </div>
                <div className="course-card-status">
                  <span>{icon} {status}</span>
                  {status.includes("In Progress") && (
                    <div className="progress-bar-mini">
                      <div className="fill" style={{ width: '60%' }}></div>
                    </div>
                  )}
                </div>
              </div>
              <button 
                className={`btn secondary-action course-start-btn`}
                onClick={() => onStartCourse(course)}
              >
                {btnText}
              </button>
            </article>
          );
        })}
        {cpd.filter(course => !completedModules.some(m => m.id === course.id)).length === 0 && !recommendedMod && (
          <p className="empty-state" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            🎉 You have completed all portfolio-matched courses!
          </p>
        )}
      </div>
    </section>
  );
}


function CpdProgressGauge({ completed, target }) {
  const pct = Math.min(100, Math.round((completed / target) * 100));
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <section className="panel cpd-gauge-panel">
      <PanelHeader title="CPD Progress" meta={`${pct}% complete`} />
      <div className="cpd-gauge-container">
        <svg className="cpd-gauge-svg" viewBox="0 0 160 160">
          <circle
            className="cpd-gauge-bg"
            cx="80" cy="80" r={radius}
            fill="none" strokeWidth="12"
          />
          <circle
            className="cpd-gauge-fill"
            cx="80" cy="80" r={radius}
            fill="none" strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="cpd-gauge-label">
          <strong>{completed.toFixed(1)}</strong>
          <span>/ {target.toFixed(1)} hrs</span>
          <small className="regulatory-label">Annual Requirement</small>
        </div>
      </div>
    </section>
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

function QuizModal({ quiz, onSuccess, onClose }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedOption) {
      setError("Please select an answer.");
      return;
    }
    if (selectedOption === quiz.correctId) {
      onSuccess();
    } else {
      setError("Incorrect. Please try again or review the module.");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content quiz-modal">
        <header className="modal-header">
          <h2>Knowledge Gate</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          <div className="quiz-context">
            <strong>Contextual Assessment:</strong>
            <p>Based on your completion of "{quiz.moduleTitle}"</p>
          </div>
          <p className="quiz-question">{quiz.question}</p>
          <form onSubmit={handleSubmit} className="quiz-form">
            <div className="quiz-options">
              {quiz.options.map((opt) => (
                <label key={opt.id} className={`quiz-option ${selectedOption === opt.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizAnswer"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => {
                      setSelectedOption(opt.id);
                      setError(null);
                    }}
                  />
                  <span>{opt.text}</span>
                </label>
              ))}
            </div>
            {error && <p className="quiz-error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={!selectedOption}>
                Submit Answer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
