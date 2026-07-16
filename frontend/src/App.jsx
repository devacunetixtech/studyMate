import { useState, useCallback } from 'react';
import UploadPanel from './components/UploadPanel';
import ChatPanel from './components/ChatPanel';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// ─── Logo SVG ────────────────────────────────────────────────────────────────
const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

export default function App() {
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
    <div className="app-shell">
      {/* ── Header */}
      <header className="app-header" data-active={headerActive ? 'true' : 'false'}>
        <div className="shimmer-bar" />
        <div className="app-header__logo">
          <LogoIcon />
        </div>
        <h1 className="app-header__title">StudyMate</h1>
        <span className="app-header__subtitle">
          Powered by Gemma 4 · {documents.length} document{documents.length !== 1 ? 's' : ''} in session
        </span>
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
      {uploadError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2E2419',
            color: '#F6F1E7',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.82rem',
            zIndex: 100,
            maxWidth: 380,
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setUploadError(null)}
        >
          ⚠️ {uploadError} <span style={{ opacity: 0.6, marginLeft: 8 }}>✕</span>
        </div>
      )}
    </div>
  );
}
