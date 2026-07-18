import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, Volume2, Square, Trash2, BookOpen, Search, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function UploadPanel({ documents, onUpload, onClearSession, isUploading }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [speakingId, setSpeakingId] = useState(null); // which doc is being spoken
  const [expandedDocs, setExpandedDocs] = useState({}); // { [docId]: boolean }
  const [searchTerm, setSearchTerm] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
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

  // ── Voice Playback with Speed Rate ──────────────────────────────────────
  const handleListen = (doc) => {
    if (speakingId === doc.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(doc.summary.replace(/[#*`\-]/g, ''));
    utterance.rate = playbackRate;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(doc.id);
    window.speechSynthesis.speak(utterance);
  };

  const cycleSpeed = () => {
    setPlaybackRate(prev => {
      if (prev === 1) return 1.25;
      if (prev === 1.25) return 1.5;
      return 1;
    });
    // Stop current speech when rate changes
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
  };

  // ── Expand/Collapse Summaries ───────────────────────────────────────────
  const toggleExpandDoc = (docId) => {
    setExpandedDocs(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

  const handleClear = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setExpandedDocs({});
    onClearSession();
  };

  // ── Filters & Computed ──────────────────────────────────────────────────
  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allExpanded = filteredDocs.length > 0 && filteredDocs.every(doc => expandedDocs[doc.id]);

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedDocs({});
    } else {
      const next = {};
      filteredDocs.forEach(doc => {
        next[doc.id] = true;
      });
      setExpandedDocs(next);
    }
  };

  return (
    <div className="panel panel--left" data-active={isUploading ? 'true' : 'false'}>
      <div className="shimmer-bar" />

      {/* ── Panel Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="section-heading">Documents</div>
          {documents.length > 0 && (
            <span className="badge">{documents.length}</span>
          )}
        </div>
        {documents.length > 0 && (
          <motion.button
            className="btn btn--ghost"
            onClick={handleClear}
            title="Clear session"
            style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '6px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </motion.button>
        )}
      </div>

      <div className="panel__inner">
        {/* ── Drop Zone — always visible and active */}
        <motion.div
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
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          transition={{ duration: 0.2 }}
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
            {isUploading ? (
              <div className="spinner" style={{ margin: '0 auto', width: 28, height: 28 }} />
            ) : (
              <UploadCloud size={28} strokeWidth={1.5} />
            )}
          </div>
          {isUploading ? (
            <p className="drop-zone__label" style={{ color: 'var(--accent-gold)', fontWeight: 500 }}>
              Analyzing syllabus / materials…
            </p>
          ) : (
            <p className="drop-zone__label">
              <strong>Drop your file</strong> here or click to browse<br />
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>PDF, JPEG, or PNG up to 10MB</span>
            </p>
          )}
        </motion.div>

        {/* ── Filter Input Bar (Visible if documents exist) */}
        {documents.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search uploaded files…"
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                fontSize: '0.82rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                outline: 'none',
                color: 'var(--text)'
              }}
              aria-label="Search documents"
            />
          </div>
        )}

        {/* ── Document List */}
        {documents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="section-heading">Uploaded</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn--ghost"
                  onClick={toggleExpandAll}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', gap: '3px', borderRadius: '4px' }}
                  title={allExpanded ? "Collapse all summaries" : "Expand all summaries"}
                >
                  {allExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={cycleSpeed}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', gap: '3px', borderRadius: '4px' }}
                  title="Cycle listening speed"
                >
                  <Sliders size={11} />
                  <span>{playbackRate}x</span>
                </button>
              </div>
            </div>

            <div className="doc-list">
              <AnimatePresence initial={false}>
                {filteredDocs.map((doc, idx) => {
                  const isExpanded = !!expandedDocs[doc.id];
                  const isSpeaking = speakingId === doc.id;
                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="doc-item" style={{ borderBottomLeftRadius: isExpanded ? 0 : undefined, borderBottomRightRadius: isExpanded ? 0 : undefined }}>
                        <div className="doc-item__icon">
                          <FileText size={14} />
                        </div>
                        <div
                          className="doc-item__name"
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleExpandDoc(doc.id)}
                          title={doc.name}
                        >
                          {idx + 1}. {doc.name}
                        </div>
                        <button
                          className={`doc-item__listen${isSpeaking ? ' pulse' : ''}`}
                          onClick={() => handleListen(doc)}
                          title={isSpeaking ? 'Stop listening' : 'Listen to summary'}
                          aria-label={isSpeaking ? 'Stop' : 'Listen'}
                          style={{ color: isSpeaking ? 'var(--accent-gold)' : undefined }}
                        >
                          {isSpeaking ? <Square size={10} style={{ fill: 'currentColor' }} /> : <Volume2 size={12} />}
                          <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                        </button>
                      </div>

                      {/* Expandable summary inline with smooth animation */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <div className="card card--sm summary-preview" style={{ borderRadius: '0 0 var(--radius-md) var(--radius-md)', borderTop: 'none', background: 'rgba(255,255,255,0.01)' }}>
                              <ReactMarkdown>{doc.summary}</ReactMarkdown>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* No match indicator */}
              {filteredDocs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '16px 0' }}>
                  No matches found for "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Latest Summary (most-recently uploaded) */}
        {documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div className="section-heading">
              Latest Summary
              <span style={{ marginLeft: 6, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                — {documents[documents.length - 1].name}
              </span>
            </div>
            <div className="card summary-preview">
              <ReactMarkdown>{documents[documents.length - 1].summary}</ReactMarkdown>
            </div>
          </motion.div>
        )}

        {/* ── Empty state */}
        {documents.length === 0 && !isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '30px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}
          >
            <BookOpen size={20} style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }} />
            <span>Upload notes or lecture PDFs to start studying.</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
