const fs = require('fs');
const code = fs.readFileSync('App_lebin.jsx', 'utf8');

const componentsToExtract = ['InlineCoursePlayer', 'LearningPanel', 'CpdProgressGauge', 'StudyHistoryPanel', 'QuizModal'];
let extractedComponents = '';
componentsToExtract.forEach(comp => {
  const startIdx = code.indexOf('function ' + comp);
  if (startIdx === -1) return;
  const nextFuncIdx = code.indexOf('\nfunction ', startIdx + 1);
  const endIdx = nextFuncIdx === -1 ? code.lastIndexOf('export default') : nextFuncIdx;
  extractedComponents += code.substring(startIdx, endIdx) + '\n\n';
});

const learningFeatureCode = `import React, { useState, useEffect, useCallback } from 'react';
import { generateSmartLearningPath, detectKnowledgeGaps } from './openaiService.js';
import { generateKnowledgeGateQuiz } from './engines.js';
import { formatClientName } from './data.js'; // Ensure correct imports

export default function LearningFeature({ activeAdvisor, clientsState, cpdModules, cpdRecentNotes, cpd, businessImpact }) {
  const [completedModules, setCompletedModules] = useState([]);
  const [completedCpdHours, setCompletedCpdHours] = useState(activeAdvisor.cpdHours || 0);
  const cpdTarget = activeAdvisor.cpdTarget || 40;
  
  const addAudit = (msg) => console.log('Audit:', msg);

  const [cpdRecommendation, setCpdRecommendation] = useState({});
  const [isGeneratingLearningPath, setIsGeneratingLearningPath] = useState(false);
  const [activeCoursePrototype, setActiveCoursePrototype] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [mockGaps, setMockGaps] = useState([]);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  useEffect(() => {
    setIsGeneratingLearningPath(true);
    generateSmartLearningPath(activeAdvisor, clientsState, cpdModules, cpdRecentNotes).then(rec => {
      setCpdRecommendation(rec);
      setIsGeneratingLearningPath(false);
    });
  }, [activeAdvisor, clientsState, cpdRecentNotes, cpdModules]);

  useEffect(() => {
    setIsDetectingGaps(true);
    detectKnowledgeGaps(clientsState, cpdModules).then(gaps => {
      setMockGaps(gaps);
      setIsDetectingGaps(false);
    });
  }, [clientsState, cpdModules]);

  const handleQuizSuccess = useCallback(() => {
    if (quizData && quizData.course) {
      const course = quizData.course;
      setCompletedCpdHours((prev) => Math.min(cpdTarget, +(prev + (course.cpdHours ?? 2.0)).toFixed(1)));
      setCompletedModules((prev) => {
        if (prev.some((m) => m.id === course.id)) return prev;
        return [...prev, { ...course, completedAt: new Date().toISOString() }];
      });
      addAudit(\`Completed CPD module & passed Knowledge Gate: \${course.title}\`, 'Low');
      if (cpdRecommendation.module && course.id === cpdRecommendation.module.id) {
        setLessonCompleted(true);
      }
    }
    setShowQuizModal(false);
    setQuizData(null);
  }, [quizData, addAudit, cpdTarget, cpdRecommendation, setCompletedCpdHours, setCompletedModules]);

  return (
    <>
      {showQuizModal && quizData && (
        <QuizModal quiz={quizData} onSuccess={handleQuizSuccess} onClose={() => setShowQuizModal(false)} />
      )}
      <div className="content-grid">
        <div className="panel advisor-readiness-panel">
          <div className="panel-header">
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
                {mockGaps.filter(gap => !completedModules.some(m => m.id === gap.courseId)).slice(0, 3).map(gap => (
                  <li key={gap.id}>• <span>{gap.label}</span></li>
                ))}
                {mockGaps.filter(gap => !completedModules.some((m) => m.id === gap.courseId)).length === 0 && (
                  <li className="gap-completed">✅ All detected gaps have been addressed!</li>
                )}
              </>
            )}
          </ul>
        </div>
      </div>

      {activeCoursePrototype ? (
        <InlineCoursePlayer 
          course={activeCoursePrototype} 
          onClose={() => setActiveCoursePrototype(null)} 
          onComplete={() => {
            const quiz = generateKnowledgeGateQuiz(activeCoursePrototype, activeAdvisor.id, clientsState);
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
        <div className="content-grid">
          <LearningPanel 
            cpd={cpd.filter(course => !cpdRecommendation.module || course.id !== cpdRecommendation.module.id)} 
            completedModules={completedModules} 
            onStartCourse={setActiveCoursePrototype} 
            cpdRecommendation={cpdRecommendation}
            isGeneratingLearningPath={isGeneratingLearningPath}
          />
          <div className="cpd-right-stack">
            <CpdProgressGauge completed={completedCpdHours} target={cpdTarget} />
            <section className="panel advisor-readiness-panel">
              <div className="panel-header">
                <h2>Advisor Readiness</h2>
                <span>Just-in-time learning</span>
              </div>
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
      )}
      <div className="content-grid">
        <StudyHistoryPanel completedModules={completedModules} mockGaps={mockGaps} />
      </div>
    </>
  );
}

// Extracted Components Below
\n` + extractedComponents;

fs.writeFileSync('src/LearningFeature.jsx', learningFeatureCode);
console.log('src/LearningFeature.jsx created successfully.');
