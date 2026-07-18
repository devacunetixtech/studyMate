import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, AlertCircle, X, Sun, Moon } from 'lucide-react';
import UploadPanel from './components/UploadPanel';
import ChatPanel from './components/ChatPanel';
import LandingPage from './components/LandingPage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function App() {
  const [view, setView] = useState(() => {
    // Support deep-linking to /app vs landing page
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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navigateTo = (newView) => {
    setView(newView);
    const newPath = newView === 'app' ? '/app' : '/';
    window.history.pushState(null, '', newPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setView(path === '/app' ? 'app' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [documents, setDocuments] = useState([]); // { id, name, summary }
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // ── Upload Handler ─────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        setUploadError(err.error || 'Upload failed');
        return;
      }

      const data = await res.json();
      setDocuments(prev => [
        ...prev,
        { id: data.docId, name: file.name, summary: data.summary },
      ]);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Could not reach the server. Is the backend running?');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Clear Session ──────────────────────────────────────────────────────────
  const handleClearSession = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/session`, { method: 'DELETE' });
    } catch {
      // Best-effort — if backend is unreachable, clear frontend state anyway
    }
    setDocuments([]);
    setUploadError(null);
  }, []);

  const headerActive = isUploading || isStreaming;

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ width: '100%', height: '100%' }}
        >
          <LandingPage onStart={() => navigateTo('app')} theme={theme} toggleTheme={toggleTheme} />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="app-shell"
        >
          {/* ── Header */}
          <header className="app-header" data-active={headerActive ? 'true' : 'false'}>
            <div className="shimmer-bar" />
            <motion.div 
              className="app-header__logo" 
              style={{ cursor: 'pointer' }} 
              onClick={() => navigateTo('landing')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <BookOpen size={16} />
            </motion.div>
            <h1 className="app-header__title" style={{ cursor: 'pointer' }} onClick={() => navigateTo('landing')}>
              StudyMate
            </h1>
            <span className="app-header__subtitle">
              Powered by Gemma 4 · {documents.length} document{documents.length !== 1 ? 's' : ''} in session
            </span>
            <motion.button
              className="btn btn--icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{ borderRadius: '50%', padding: '6px', marginLeft: '12px', flexShrink: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </motion.button>
          </header>

          {/* ── Upload Panel (left) */}
          <UploadPanel
            documents={documents}
            onUpload={handleUpload}
            onClearSession={handleClearSession}
            isUploading={isUploading}
          />

          {/* ── Chat Panel (right) */}
          <ChatPanel
            documentCount={documents.length}
            onStreamingChange={setIsStreaming}
          />

          {/* ── Upload Error Toast */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: 20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 15, x: '-50%' }}
                style={{
                  position: 'fixed',
                  bottom: 24,
                  left: '50%',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  color: '#f4f4f5',
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  zIndex: 100,
                  maxWidth: 380,
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
