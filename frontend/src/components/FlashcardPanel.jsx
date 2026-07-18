import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight, Shuffle, Download, RotateCcw, Loader2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function FlashcardPanel({ documentCount }) {
  const [cards, setCards]         = useState([]);
  const [index, setIndex]         = useState(0);
  const [flipped, setFlipped]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [generated, setGenerated] = useState(false);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === ' ')          { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGenerated(false);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/flashcards`, { method: 'POST' });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned an unexpected response (${res.status}). Is the backend running with the latest code?`);
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setCards(data.flashcards);
      setIndex(0);
      setFlipped(false);
      setGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const shuffle = () => {
    setCards(prev => [...prev].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
  };

  const next = () => {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.min(i + 1, cards.length - 1)), 120);
  };

  const prev = () => {
    setFlipped(false);
    setTimeout(() => setIndex(i => Math.max(i - 1, 0)), 120);
  };

  const exportCSV = () => {
    const csv  = ['Front,Back', ...cards.map(c =>
      `"${c.front.replace(/"/g,'""')}","${c.back.replace(/"/g,'""')}"`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'studymate_flashcards.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = cards[index];

  return (
    <section className="panel flashcard-panel">
      {/* ── Header */}
      <div className="panel-header">
        <div className="panel-header__left">
          <Sparkles size={15} className="panel-header__icon" />
          <span>Flashcards</span>
          {cards.length > 0 && (
            <span className="fc-badge">{cards.length} cards</span>
          )}
        </div>
        <div className="panel-header__actions">
          {cards.length > 0 && (
            <>
              <motion.button
                className="btn btn--ghost btn--sm"
                onClick={shuffle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                title="Shuffle cards"
              >
                <Shuffle size={13} /> Shuffle
              </motion.button>
              <motion.button
                className="btn btn--ghost btn--sm"
                onClick={exportCSV}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                title="Export to Anki CSV"
              >
                <Download size={13} /> Export CSV
              </motion.button>
            </>
          )}
          <motion.button
            id="fc-generate-btn"
            className="btn btn--primary btn--sm"
            onClick={generate}
            disabled={loading || documentCount === 0}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
          >
            {loading ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
            {loading ? 'Generating…' : generated ? 'Regenerate' : 'Generate'}
          </motion.button>
        </div>
      </div>

      {/* ── Body */}
      <div className="fc-body">
        {!generated && !loading && (
          <motion.div
            className="fc-empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="fc-empty__icon">🃏</div>
            <p className="fc-empty__title">No flashcards yet</p>
            <p className="fc-empty__sub">
              {documentCount === 0
                ? 'Upload a document first, then generate flashcards.'
                : 'Hit Generate to create 10 exam-ready flashcards from your notes.'}
            </p>
            {documentCount > 0 && (
              <motion.button
                className="btn btn--primary"
                onClick={generate}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                style={{ marginTop: '1rem' }}
              >
                <Sparkles size={14} /> Generate Flashcards
              </motion.button>
            )}
          </motion.div>
        )}

        {loading && (
          <motion.div
            className="fc-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="fc-spinner">
              <Loader2 size={32} className="spin" />
            </div>
            <p>Crafting your flashcards…</p>
            <span>This takes about 10–15 seconds</span>
          </motion.div>
        )}

        {error && (
          <div className="fc-error">
            <p>⚠ {error}</p>
            <button className="btn btn--ghost btn--sm" onClick={generate}>Try again</button>
          </div>
        )}

        {generated && card && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="fc-stage"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {/* ── Progress */}
              <div className="fc-progress-bar">
                <div
                  className="fc-progress-bar__fill"
                  style={{ width: `${((index + 1) / cards.length) * 100}%` }}
                />
              </div>
              <p className="fc-counter">{index + 1} / {cards.length}</p>

              {/* ── Flip Card */}
              <div
                className={`fc-card ${flipped ? 'fc-card--flipped' : ''}`}
                onClick={() => setFlipped(f => !f)}
                role="button"
                tabIndex={0}
                aria-label={flipped ? 'Card back — click to flip' : 'Card front — click to flip'}
                onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}
              >
                <div className="fc-card__inner">
                  <div className="fc-card__face fc-card__face--front">
                    <span className="fc-face-label">Question</span>
                    <p className="fc-card__text">{card.front}</p>
                    <span className="fc-flip-hint">Click to reveal answer · Space</span>
                  </div>
                  <div className="fc-card__face fc-card__face--back">
                    <span className="fc-face-label">Answer</span>
                    <p className="fc-card__text">{card.back}</p>
                    <span className="fc-flip-hint">Click to flip back</span>
                  </div>
                </div>
              </div>

              {/* ── Navigation */}
              <div className="fc-nav">
                <motion.button
                  className="btn btn--icon fc-nav__btn"
                  onClick={prev}
                  disabled={index === 0}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Previous card"
                >
                  <ChevronLeft size={18} />
                </motion.button>

                <div className="fc-dots">
                  {cards.map((_, i) => (
                    <button
                      key={i}
                      className={`fc-dot ${i === index ? 'fc-dot--active' : ''}`}
                      onClick={() => { setFlipped(false); setIndex(i); }}
                      aria-label={`Go to card ${i + 1}`}
                    />
                  ))}
                </div>

                <motion.button
                  className="btn btn--icon fc-nav__btn"
                  onClick={next}
                  disabled={index === cards.length - 1}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Next card"
                >
                  <ChevronRight size={18} />
                </motion.button>
              </div>

              <p className="fc-kb-hint">← → to navigate · Space to flip</p>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
