import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { generateSmartLearningPath, detectKnowledgeGaps } from './openaiService.js';
import { generateKnowledgeGateQuiz } from './engines.js';
import { advisors, cpdModules as cpdModulesData } from './data.js';

export default function LearningFeature({ activeAdvisor, clientsState, cpdModules: cpdModulesProp, cpd, businessImpact }) {
  const safeCpd = Array.isArray(cpd) ? cpd : [];
  const safeCpdModules = Array.isArray(cpdModulesProp) ? cpdModulesProp : cpdModulesData;
  const safeClients = Array.isArray(clientsState) ? clientsState : [];
  const safeImpact = businessImpact || {};

  // Adaptive CPD state
  const [selectedAdvisorId, setSelectedAdvisorId] = useState(
    activeAdvisor?.id ?? advisors.find((a) => a.role === "Advisor")?.id ?? "adv-alex"
  );
  const selectedAdvisor = advisors.find((a) => a.id === selectedAdvisorId) ?? activeAdvisor ?? advisors[0];

  const [completedModules, setCompletedModules] = useState([]);
  const [completedCpdHours, setCompletedCpdHours] = useState(0);
  const cpdTarget = 40.0;

  const addAudit = (msg) => console.log('Audit:', msg);

  const [cpdRecommendation, setCpdRecommendation] = useState({});
  const [isGeneratingLearningPath, setIsGeneratingLearningPath] = useState(false);
  const [activeCoursePrototype, setActiveCoursePrototype] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  const [demoGapsActive, setDemoGapsActive] = useState(false);
  const [mockGaps, setMockGaps] = useState([]);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  // Gap detection: triggered when demoGapsActive is toggled on
  useEffect(() => {
    if (demoGapsActive && mockGaps.length === 0 && !isDetectingGaps) {
      setIsDetectingGaps(true);
      detectKnowledgeGaps(safeClients, safeCpdModules)
        .then((gaps) => {
          setMockGaps(Array.isArray(gaps) ? gaps : []);
        })
        .catch((err) => {
          console.error('detectKnowledgeGaps error:', err);
          setMockGaps([]);
        })
        .finally(() => setIsDetectingGaps(false));
    }
  }, [demoGapsActive, safeClients]);

  // Derive cpdRecentNotes from gaps
  const cpdRecentNotes = useMemo(() => {
    if (!demoGapsActive) return "";
    return mockGaps
      .filter((gap) => !completedModules.some((m) => m.id === gap.courseId))
      .map((gap) => gap.keyword)
      .join(' ');
  }, [demoGapsActive, completedModules, mockGaps]);

  // AI learning path recommendation
  useEffect(() => {
    const uncompletedModules = safeCpdModules.filter(
      (m) => !completedModules.some((cm) => cm.id === m.id)
    );
    if (uncompletedModules.length === 0) {
      setCpdRecommendation({});
      return;
    }
    setIsGeneratingLearningPath(true);
    generateSmartLearningPath(selectedAdvisor, safeClients, uncompletedModules, cpdRecentNotes)
      .then((rec) => {
        setCpdRecommendation(rec || {});
      })
      .catch((err) => {
        console.error('generateSmartLearningPath error:', err);
        setCpdRecommendation({});
      })
      .finally(() => setIsGeneratingLearningPath(false));
  }, [selectedAdvisor, safeClients, cpdRecentNotes, completedModules]);

  const handleSwitchAdvisor = useCallback((id) => {
    setSelectedAdvisorId(id);
    setLessonCompleted(false);
  }, []);

  const handleQuizSuccess = useCallback(() => {
    if (quizData && quizData.course) {
      const course = quizData.course;
      setCompletedCpdHours((prev) =>
        Math.min(cpdTarget, +(prev + (course.cpdHours ?? 2.0)).toFixed(1))
      );
      setCompletedModules((prev) => {
        if (prev.some((m) => m.id === course.id)) return prev;
        return [...prev, { ...course, completedAt: new Date().toISOString() }];
      });
      addAudit(`Completed CPD module & passed Knowledge Gate: ${course.title}`);
      if (cpdRecommendation.module && course.id === cpdRecommendation.module.id) {
        setLessonCompleted(true);
      }
    }
    setShowQuizModal(false);
    setQuizData(null);
  }, [quizData, cpdTarget, cpdRecommendation]);

  const filteredCpd = safeCpd.filter(
    (course) => !cpdRecommendation.module || course.id !== cpdRecommendation.module.id
  );

  return (
    <div className="page-stack">
      {showQuizModal && quizData && (
        <QuizModal
          quiz={quizData}
          onSuccess={handleQuizSuccess}
          onClose={() => setShowQuizModal(false)}
        />
      )}

      {/* Hero Banner */}
      <section className="cpd-hero-banner">
        <div>
          <p className="eyebrow">Adaptive CPD &amp; Learning Loop</p>
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

      {/* Gap Detection Panel */}
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
                .filter((gap) => !completedModules.some((m) => m.id === gap.courseId))
                .slice(0, 3)
                .map((gap) => (
                  <li key={gap.id}>
                    • <span>{gap.label}</span>
                  </li>
                ))}
              {mockGaps.filter((gap) => !completedModules.some((m) => m.id === gap.courseId)).length === 0 && (
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

      {/* Course Player or Learning Grid */}
      {activeCoursePrototype ? (
        <InlineCoursePlayer
          course={activeCoursePrototype}
          onClose={() => setActiveCoursePrototype(null)}
          onComplete={() => {
            const quiz = generateKnowledgeGateQuiz(
              activeCoursePrototype,
              selectedAdvisorId,
              safeClients
            );
            if (quiz) {
              setQuizData({ ...quiz, course: activeCoursePrototype });
              setShowQuizModal(true);
            } else {
              setCompletedModules((prev) => {
                if (prev.some((m) => m.id === activeCoursePrototype.id)) return prev;
                return [...prev, { ...activeCoursePrototype, completedAt: new Date().toISOString() }];
              });
              setCompletedCpdHours((prev) =>
                Math.min(cpdTarget, +(prev + (activeCoursePrototype.cpdHours ?? 2.0)).toFixed(1))
              );
            }
            setActiveCoursePrototype(null);
          }}
        />
      ) : (
        <>
          <div className="content-grid">
            <LearningPanel
              cpd={filteredCpd}
              completedModules={completedModules}
              onStartCourse={setActiveCoursePrototype}
              cpdRecommendation={cpdRecommendation}
              isGeneratingLearningPath={isGeneratingLearningPath}
            />
            <div className="cpd-right-stack">
              <CpdProgressGauge completed={completedCpdHours} target={cpdTarget} />
              <section className="panel advisor-readiness-panel">
                <PanelHeader title="Advisor Readiness" meta="Just-in-time learning" />
                <div className="readiness-split" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="readiness-col">
                    <strong>Learning Readiness</strong>
                    <p>• CPD Progress: {safeImpact.cpdReadiness || 0}% on track</p>
                    <p>• Next milestone: Aug 31</p>
                    <p>• On track for compliance</p>
                  </div>
                  <div className="readiness-col">
                    <strong>Activity Tracker</strong>
                    {(safeImpact.followUpCompletion || 0) > 0 ? (
                      <>
                        <p>• Follow-up completion: {safeImpact.followUpCompletion}%</p>
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

      {/* Study History */}
      <StudyHistoryPanel completedModules={completedModules} mockGaps={mockGaps} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

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
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>1. Core Concepts &amp; Overview</h4>
            <p style={{ marginBottom: '10px' }}>Welcome to <strong>{course.title}</strong>. This module focuses on exploring foundational principles tailored for your High Net Worth and Mass Affluent portfolios.</p>
            <p>Understanding these scenarios is critical for delivering compliant, effective, and highly personalized financial advice.</p>
          </>
        )}
        {slide === 2 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>2. Regulatory Updates &amp; Suitability</h4>
            <p style={{ marginBottom: '10px' }}>Recent guidelines emphasize the need for rigorous, transparent documentation.</p>
            <p>You must consistently log your suitability rationale when discussing these strategies, ensuring alignment with both client goals and regulatory frameworks.</p>
          </>
        )}
        {slide === 3 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>3. Application &amp; Next Steps</h4>
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
          <button className="btn secondary-action" onClick={nextSlide}>Continue Reading →</button>
        ) : (
          <button className="btn primary-action" onClick={onComplete} disabled={isCompleted}>
            {isCompleted ? 'Already Completed' : 'Finish Reading & Take Quiz'}
          </button>
        )}
      </div>
    </section>
  );
}

function LearningPanel({ cpd, completedModules, onStartCourse, cpdRecommendation, isGeneratingLearningPath }) {
  const recommendedMod = cpdRecommendation?.module;
  const safeCpd = Array.isArray(cpd) ? cpd : [];

  return (
    <section className="panel portfolio-courses-panel">
      <PanelHeader title="Smart Learning Path" meta="Portfolio-Matched Courses" />
      <div className="stack">
        {isGeneratingLearningPath ? (
          <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', padding: '10px' }}>
            🔄 AI is analyzing your portfolio to build a learning path...
          </div>
        ) : (
          recommendedMod && !completedModules.some((m) => m.id === recommendedMod.id) && (
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
              <button className="btn primary-action course-start-btn" onClick={() => onStartCourse(recommendedMod)} style={{ alignSelf: 'flex-start', marginTop: '10px' }}>
                Start Course →
              </button>
            </article>
          )
        )}

        {safeCpd.filter((course) => !completedModules.some((m) => m.id === course.id)).slice(0, 4).map((course) => {
          const status = course.id === 'cpd-mod-elective-young-family' ? 'In Progress: 60%' : 'Not started';
          const btnText = status.includes('In Progress') ? 'Continue →' : 'Start Course →';
          const icon = status.includes('In Progress') ? '📘' : '📗';
          return (
            <article className="course-card list-row" key={course.id}>
              <div className="course-card-content">
                <strong>{course.title}</strong>
                <div className="course-card-meta">
                  <span>🎯 Portfolio Match: {course.matchScore}%</span>
                  <span>⏱️ {course.cpdHours ?? 2.0} CPD hrs</span>
                </div>
                <div className="course-card-status">
                  <span>{icon} {status}</span>
                  {status.includes('In Progress') && (
                    <div className="progress-bar-mini">
                      <div className="fill" style={{ width: '60%' }}></div>
                    </div>
                  )}
                </div>
              </div>
              <button className="btn secondary-action course-start-btn" onClick={() => onStartCourse(course)}>
                {btnText}
              </button>
            </article>
          );
        })}
        {safeCpd.filter((course) => !completedModules.some((m) => m.id === course.id)).length === 0 && !recommendedMod && (
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
    <section className="panel cpd-gauge-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(19, 95, 78, 0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
      <PanelHeader title="CPD Progress" meta={`${pct}% complete`} />
      <div className="cpd-gauge-container" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
        
        {/* Glow effect under the SVG */}
        <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', boxShadow: '0 0 40px rgba(19, 95, 78, 0.15)' }}></div>
        
        <svg className="cpd-gauge-svg" viewBox="0 0 160 160" style={{ width: '170px', height: '170px', transform: 'rotate(-90deg)', dropShadow: '0px 4px 10px rgba(0,0,0,0.1)' }}>
          <defs>
            <linearGradient id="cpdGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1dd1a1" />
              <stop offset="100%" stopColor="#10ac84" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle 
            cx="80" 
            cy="80" 
            r={radius} 
            fill="none" 
            stroke="#edf2ee" 
            strokeWidth="12" 
          />
          <circle 
            cx="80" 
            cy="80" 
            r={radius} 
            fill="none" 
            stroke="url(#cpdGradient)" 
            strokeWidth="12" 
            strokeLinecap="round" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div className="cpd-gauge-label" style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <strong style={{ fontSize: '2.4rem', fontWeight: '900', color: '#10ac84', lineHeight: '1' }}>{completed}</strong>
          <span style={{ fontSize: '0.9rem', color: '#66756e', fontWeight: '600', marginTop: '2px' }}>/ {target} hrs</span>
          <span style={{ marginTop: '8px', padding: '4px 10px', background: '#eef6f2', color: '#135f4e', fontSize: '0.7rem', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {pct >= 100 ? 'Target Met' : 'On Track'}
          </span>
        </div>
      </div>
    </section>
  );
}

function StudyHistoryPanel({ completedModules, mockGaps = [] }) {
  const resolvedGaps = mockGaps.filter((g) => completedModules.some((m) => m.id === g.courseId));

  return (
    <section className="panel" id="study-history" style={{ marginTop: '20px' }}>
      <PanelHeader title="Study History" meta={`${completedModules.length} courses completed`} />
      <div className="stack">
        {completedModules.length === 0 ? (
          <p className="empty-state" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            You haven&apos;t completed any courses yet. Start a course to see your history and resolved gaps here!
          </p>
        ) : (
          <>
            {resolvedGaps.length > 0 && (
              <div style={{ padding: '12px', backgroundColor: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  ✅ Resolved Knowledge Gaps
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {resolvedGaps.map((g) => (
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
                  <span style={{ color: 'var(--success-color, #2b7a57)' }}>✅ Completed on {new Date(mod.completedAt).toLocaleDateString()}</span>
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

function QuizModal({ quiz, onSuccess, onClose }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedOption) {
      setError('Please select an answer.');
      return;
    }
    if (selectedOption === quiz.correctId) {
      onSuccess();
    } else {
      setError('Incorrect. Please try again or review the module.');
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
            <p>Based on your completion of &quot;{quiz.moduleTitle}&quot;</p>
          </div>
          <p className="quiz-question">{quiz.question}</p>
          <form onSubmit={handleSubmit} className="quiz-form">
            <div className="quiz-options">
              {quiz.options.map((opt) => (
                <label key={opt.id} className={`quiz-option ${selectedOption === opt.id ? 'selected' : ''}`}>
                  <input type="radio" name="quizAnswer" value={opt.id} checked={selectedOption === opt.id} onChange={() => { setSelectedOption(opt.id); setError(null); }} />
                  <span>{opt.text}</span>
                </label>
              ))}
            </div>
            {error && <p className="quiz-error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={!selectedOption}>Submit Answer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
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
