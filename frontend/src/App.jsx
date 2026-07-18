import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, AlertCircle, X, Sun, Moon, MessageSquare, Layers, Brain, FolderOpen } from 'lucide-react';
import UploadPanel from './components/UploadPanel';
import ChatPanel from './components/ChatPanel';
import FlashcardPanel from './components/FlashcardPanel';
import QuizPanel from './components/QuizPanel';
import LandingPage from './components/LandingPage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const MODES = [
  { id: 'chat',       label: 'Chat',       Icon: MessageSquare },
  { id: 'flashcards', label: 'Flashcards', Icon: Layers },
  { id: 'quiz',       label: 'Quiz',       Icon: Brain },
];

export default function App() {
  const [view, setView] = useState(() => {
    const path = window.location.pathname;
    return path === '/app' ? 'app' : 'landing';
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studymate-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studymate-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const navigateTo = (newView) => {
    setView(newView);
    window.history.pushState(null, '', newView === 'app' ? '/app' : '/');
  };

  useEffect(() => {
    const handlePopState = () => {
      setView(window.location.pathname === '/app' ? 'app' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [documents, setDocuments]     = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming]  = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [studyMode, setStudyMode]     = useState('chat');
  const [drawerOpen, setDrawerOpen]   = useState(false); // mobile upload drawer

  // ── Upload Handler ─────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file) => {
    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        setUploadError(err.error || 'Upload failed');
        return;
      }
      const data = await res.json();
      setDocuments(prev => [...prev, { id: data.docId, name: file.name, summary: data.summary }]);
      setDrawerOpen(false); // auto-close drawer on mobile after upload
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Could not reach the server. Is the backend running?');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Clear Session ──────────────────────────────────────────────────────────
  const handleClearSession = useCallback(async () => {
    try { await fetch(`${BACKEND_URL}/api/session`, { method: 'DELETE' }); } catch { /* best-effort */ }
    setDocuments([]);
    setUploadError(null);
  }, []);

  const headerActive = isUploading || isStreaming;

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%' }}
        >
          <LandingPage onStart={() => navigateTo('app')} theme={theme} toggleTheme={toggleTheme} />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="app-shell"
        >
          {/* ── Header ── */}
          <header className="app-header" data-active={headerActive ? 'true' : 'false'}>
            <div className="shimmer-bar" />

            <motion.div
              className="app-header__logo" style={{ cursor: 'pointer' }}
              onClick={() => navigateTo('landing')}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            >
              <BookOpen size={16} />
            </motion.div>

            <h1 className="app-header__title" style={{ cursor: 'pointer' }} onClick={() => navigateTo('landing')}>
              StudyMate
            </h1>

            <span className="app-header__subtitle">
              Gemma 4 · {documents.length} doc{documents.length !== 1 ? 's' : ''}
            </span>

            {/* Desktop mode tabs */}
            <nav className="mode-tabs" role="tablist" aria-label="Study mode">
              {MODES.map(({ id, label, Icon }) => (
                <motion.button
                  key={id} role="tab" aria-selected={studyMode === id}
                  className={`mode-tab ${studyMode === id ? 'mode-tab--active' : ''}`}
                  onClick={() => setStudyMode(id)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                >
                  <Icon size={13} />
                  {label}
                  {studyMode === id && (
                    <motion.span className="mode-tab__indicator" layoutId="mode-tab-indicator" />
                  )}
                </motion.button>
              ))}
            </nav>

            {/* Mobile: files drawer toggle */}
            <motion.button
              id="mobile-files-btn"
              className="btn btn--icon mobile-files-btn"
              onClick={() => setDrawerOpen(o => !o)}
              aria-label="Toggle documents panel"
              whileTap={{ scale: 0.92 }}
            >
              <FolderOpen size={16} />
              {documents.length > 0 && (
                <span className="mobile-files-badge">{documents.length}</span>
              )}
            </motion.button>

            {/* Theme toggle */}
            <motion.button
              className="btn btn--icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{ borderRadius: '50%', padding: '6px', flexShrink: 0 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </motion.button>
          </header>

          {/* ── Upload Panel — sidebar on desktop, drawer on mobile ── */}
          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                className="drawer-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
              />
            )}
          </AnimatePresence>
          <div className={`upload-drawer ${drawerOpen ? 'upload-drawer--open' : ''}`}>
            <UploadPanel
              documents={documents}
              onUpload={handleUpload}
              onClearSession={handleClearSession}
              isUploading={isUploading}
            />
          </div>

          {/* ── Right panels — always mounted so state survives tab switches ── */}
          <div className="right-panel-host">
            <div className={studyMode === 'chat'       ? 'panel-slot' : 'panel-slot panel-slot--hidden'}>
              <ChatPanel documentCount={documents.length} onStreamingChange={setIsStreaming} />
            </div>
            <div className={studyMode === 'flashcards' ? 'panel-slot' : 'panel-slot panel-slot--hidden'}>
              <FlashcardPanel documentCount={documents.length} />
            </div>
            <div className={studyMode === 'quiz'       ? 'panel-slot' : 'panel-slot panel-slot--hidden'}>
              <QuizPanel documentCount={documents.length} />
            </div>
          </div>

          {/* ── Mobile Bottom Nav ── */}
          <nav className="mobile-bottom-nav" role="tablist" aria-label="Study mode">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id} role="tab" aria-selected={studyMode === id}
                className={`mobile-nav-tab ${studyMode === id ? 'mobile-nav-tab--active' : ''}`}
                onClick={() => setStudyMode(id)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* ── Upload Error Toast ── */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: 20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 15, x: '-50%' }}
                style={{
                  position: 'fixed', bottom: 24, left: '50%',
                  background: '#27272a', border: '1px solid #3f3f46', color: '#f4f4f5',
                  padding: '12px 20px', borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem', zIndex: 200, maxWidth: 380,
                  textAlign: 'center', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                }}
                onClick={() => setUploadError(null)}
              >
                <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span>{uploadError}</span>
                <X size={14} style={{ opacity: 0.5, marginLeft: 'auto', flexShrink: 0 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
