import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RotateCcw, Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const LETTER_COLOR = {
  A: 'var(--quiz-a)',
  B: 'var(--quiz-b)',
  C: 'var(--quiz-c)',
  D: 'var(--quiz-d)',
};

export default function QuizPanel({ documentCount, activeGroup }) {
  const [questions, setQuestions]   = useState([]);
  const [qIndex, setQIndex]         = useState(0);
  const [selected, setSelected]     = useState(null);   // 'A' | 'B' | 'C' | 'D' | null
  const [revealed, setRevealed]     = useState(false);
  const [score, setScore]           = useState(0);
  const [done, setDone]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [generated, setGenerated]   = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGenerated(false);
    setDone(false);
    setScore(0);
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: activeGroup })
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned an unexpected response (${res.status}). Is the backend running with the latest code?`);
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setQuestions(data.questions);
      setGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = (letter) => {
    if (revealed) return;
    setSelected(letter);
    setRevealed(true);
    if (letter === questions[qIndex].answer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (qIndex + 1 >= questions.length) {
      setDone(true);
    } else {
      setQIndex(i => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const restart = () => {
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setDone(false);
  };

  const q = questions[qIndex];
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const grade = pct >= 80 ? { label: 'Excellent', color: '#22c55e' }
              : pct >= 60 ? { label: 'Good',      color: '#f59e0b' }
              :               { label: 'Keep studying', color: '#ef4444' };

  return (
    <section className="panel quiz-panel">
      {/* ── Header */}
      <div className="panel-header">
        <div className="panel-header__left">
          <Brain size={15} className="panel-header__icon" />
          <span>Quiz {activeGroup && activeGroup !== 'All' ? `(${activeGroup})` : ''}</span>
          {questions.length > 0 && !done && (
            <span className="fc-badge">{questions.length} questions</span>
          )}
        </div>
        <div className="panel-header__actions">
          <motion.button
            id="quiz-generate-btn"
            className="btn btn--primary btn--sm"
            onClick={generate}
            disabled={loading || documentCount === 0}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
          >
            {loading ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
            {loading ? 'Generating…' : generated ? 'New Quiz' : 'Generate Quiz'}
          </motion.button>
        </div>
      </div>

      {/* ── Body */}
      <div className="quiz-body">
        {/* Empty state */}
        {!generated && !loading && (
          <motion.div
            className="fc-empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="fc-empty__icon">🧠</div>
            <p className="fc-empty__title">No quiz yet</p>
            <p className="fc-empty__sub">
              {documentCount === 0
                ? 'Upload a document first, then generate a quiz.'
                : `Hit Generate to create a 5-question multiple-choice quiz from your ${activeGroup === 'All' ? 'notes' : `"${activeGroup}" module`}.`}
            </p>
            {documentCount > 0 && (
              <motion.button
                className="btn btn--primary"
                onClick={generate}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                style={{ marginTop: '1rem' }}
              >
                <Brain size={14} /> Generate Quiz
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <motion.div className="fc-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="fc-spinner"><Loader2 size={32} className="spin" /></div>
            <p>Building your quiz…</p>
            <span>This takes about 10–15 seconds</span>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div className="fc-error">
            <p>⚠ {error}</p>
            <button className="btn btn--ghost btn--sm" onClick={generate}>Try again</button>
          </div>
        )}

        {/* Results screen */}
        {done && !loading && (
          <AnimatePresence>
            <motion.div
              className="quiz-results"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="quiz-results__score-ring">
                <svg viewBox="0 0 100 100" className="quiz-ring-svg">
                  <circle cx="50" cy="50" r="42" className="quiz-ring-bg" />
                  <circle
                    cx="50" cy="50" r="42"
                    className="quiz-ring-fill"
                    style={{
                      stroke: grade.color,
                      strokeDasharray: `${2 * Math.PI * 42}`,
                      strokeDashoffset: `${2 * Math.PI * 42 * (1 - pct / 100)}`,
                    }}
                  />
                </svg>
                <div className="quiz-ring-text">
                  <span className="quiz-ring-pct">{pct}%</span>
                  <span className="quiz-ring-sub">{score}/{questions.length}</span>
                </div>
              </div>

              <h2 className="quiz-results__title">{grade.label}!</h2>
              <p className="quiz-results__sub">
                You answered {score} out of {questions.length} questions correctly.
              </p>

              <div className="quiz-results__actions">
                <motion.button
                  className="btn btn--ghost"
                  onClick={restart}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw size={14} /> Retry Same Quiz
                </motion.button>
                <motion.button
                  className="btn btn--primary"
                  onClick={generate}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Brain size={14} /> New Quiz
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Active question */}
        {generated && q && !done && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key={qIndex}
              className="quiz-question"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {/* Progress */}
              <div className="fc-progress-bar">
                <div
                  className="fc-progress-bar__fill"
                  style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <p className="fc-counter">Question {qIndex + 1} of {questions.length}</p>

              {/* Question text */}
              <p className="quiz-q-text">{q.question}</p>

              {/* Options */}
              <div className="quiz-options">
                {q.options.map((opt) => {
                  const letter = opt[0]; // 'A', 'B', 'C', 'D'
                  const isCorrect  = letter === q.answer;
                  const isSelected = letter === selected;
                  let optClass = 'quiz-opt';
                  if (revealed && isCorrect)  optClass += ' quiz-opt--correct';
                  if (revealed && isSelected && !isCorrect) optClass += ' quiz-opt--wrong';

                  return (
                    <motion.button
                      key={letter}
                      className={optClass}
                      onClick={() => handleSelect(letter)}
                      disabled={revealed}
                      whileHover={!revealed ? { scale: 1.02, x: 4 } : {}}
                      whileTap={!revealed ? { scale: 0.98 } : {}}
                    >
                      <span
                        className="quiz-opt__letter"
                        style={{ background: LETTER_COLOR[letter] || 'var(--surface-hover)' }}
                      >
                        {letter}
                      </span>
                      <span className="quiz-opt__text">{opt.slice(3)}</span>
                      {revealed && isCorrect  && <CheckCircle2 size={16} className="quiz-opt__icon quiz-opt__icon--ok"  />}
                      {revealed && isSelected && !isCorrect && <XCircle size={16} className="quiz-opt__icon quiz-opt__icon--err" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation */}
              <AnimatePresence>
                {revealed && (
                  <motion.div
                    className="quiz-explanation"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <span className="quiz-explanation__label">📖 Explanation</span>
                    <p>{q.explanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next */}
              {revealed && (
                <motion.button
                  className="btn btn--primary quiz-next-btn"
                  onClick={handleNext}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {qIndex + 1 >= questions.length ? 'See Results' : 'Next Question'}
                  <ChevronRight size={15} />
                </motion.button>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
