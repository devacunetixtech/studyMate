import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

// ─── SVG Icons (inline — no extra dep) ──────────────────────────────────────
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 12, height: 12 }}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

// ─── Component ───────────────────────────────────────────────────────────────
export default function UploadPanel({ documents, onUpload, onClearSession, isUploading }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [speakingId, setSpeakingId] = useState(null); // which doc is being spoken
  const [expandedDoc, setExpandedDoc] = useState(null);
  const fileInputRef = useRef(null);

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = ''; // reset so same file can be re-picked
  };

  // ── Voice Playback ──────────────────────────────────────────────────────
  const handleListen = (doc) => {
    if (speakingId === doc.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(doc.summary.replace(/[#*`\-]/g, ''));
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(doc.id);
    window.speechSynthesis.speak(utterance);
  };

  // ── Clear Session ───────────────────────────────────────────────────────
  const handleClear = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setExpandedDoc(null);
    onClearSession();
  };

  return (
    <div className="panel panel--left" data-active={isUploading ? 'true' : 'false'}>
      <div className="shimmer-bar" />

      {/* ── Panel Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="section-heading">Documents</div>
          {documents.length > 0 && (
            <span className="badge">{documents.length} in session</span>
          )}
        </div>
        {documents.length > 0 && (
          <button
            className="btn btn--ghost"
            onClick={handleClear}
            title="Clear session"
            style={{ fontSize: '0.75rem', padding: '5px 10px', gap: '4px' }}
          >
            <TrashIcon /> Clear
          </button>
        )}
      </div>

      <div className="panel__inner">
        {/* ── Drop Zone — always visible and active */}
        <div
          className={`drop-zone${isDragOver ? ' drop-zone--over' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          id="upload-dropzone"
          aria-label="Upload document"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-input"
          />
          <div className="drop-zone__icon">
            {isUploading
              ? <div className="spinner" style={{ margin: '0 auto', width: 28, height: 28 }} />
              : <UploadIcon />
            }
          </div>
          {isUploading ? (
            <p className="drop-zone__label">Processing document with Gemma 4…</p>
          ) : (
            <p className="drop-zone__label">
              <strong>Drop a file here</strong> or click to browse<br />
              PDF or image · multiple files supported
            </p>
          )}
        </div>

        {/* ── Document List */}
        {documents.length > 0 && (
          <div>
            <div className="section-heading" style={{ marginBottom: 8 }}>Uploaded</div>
            <div className="doc-list">
              {documents.map((doc, idx) => (
                <div key={doc.id}>
                  <div className="doc-item">
                    <div className="doc-item__icon">
                      <FileIcon />
                    </div>
                    <div
                      className="doc-item__name"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      title={doc.name}
                    >
                      {idx + 1}. {doc.name}
                    </div>
                    <button
                      className={`doc-item__listen${speakingId === doc.id ? ' pulse' : ''}`}
                      onClick={() => handleListen(doc)}
                      title={speakingId === doc.id ? 'Stop listening' : 'Listen to summary'}
                      aria-label={speakingId === doc.id ? 'Stop' : 'Listen'}
                      style={{ color: speakingId === doc.id ? 'var(--accent-2)' : undefined }}
                    >
                      {speakingId === doc.id ? <StopIcon /> : <SpeakerIcon />}
                      <span>{speakingId === doc.id ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>

                  {/* Expanded summary inline */}
                  {expandedDoc === doc.id && (
                    <div className="card card--sm summary-preview" style={{ marginTop: 4, borderRadius: '0 0 var(--radius-md) var(--radius-md)', borderTop: 'none' }}>
                      <ReactMarkdown>{doc.summary}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Latest Summary (most-recently uploaded) */}
        {documents.length > 0 && (
          <div>
            <div className="section-heading" style={{ marginBottom: 8 }}>
              Latest Summary
              <span style={{ marginLeft: 6, color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                — {documents[documents.length - 1].name}
              </span>
            </div>
            <div className="card summary-preview">
              <ReactMarkdown>{documents[documents.length - 1].summary}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ── Empty state */}
        {documents.length === 0 && !isUploading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '10px 0' }}>
            Upload a PDF or image to begin your study session.
          </div>
        )}
      </div>
    </div>
  );
}
