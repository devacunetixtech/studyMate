import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, Volume2, Square, Trash2, BookOpen, Search, Sliders, ChevronDown, ChevronUp, FolderPlus, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function UploadPanel({
  documents,
  groups = ['General'],
  activeGroup = 'All',
  onSelectGroup,
  onCreateGroup,
  onMoveDocument,
  onUpload,
  onClearSession,
  isUploading
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [speakingId, setSpeakingId] = useState(null); // which doc is being spoken
  const [expandedDocs, setExpandedDocs] = useState({}); // { [docId]: boolean }
  const [searchTerm, setSearchTerm] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
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
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      // Smart group assignment on drop
      const targetGroup = activeGroup === 'All' ? 'General' : activeGroup;
      onUpload(files, targetGroup);
    }
  }, [onUpload, activeGroup]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const targetGroup = activeGroup === 'All' ? 'General' : activeGroup;
      onUpload(files, targetGroup);
    }
    e.target.value = ''; // reset
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

  // ── Create Custom Module/Group ──────────────────────────────────────────
  const handleAddGroupSubmit = (e) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (name) {
      if (!groups.includes(name)) {
        onCreateGroup(name);
        onSelectGroup(name); // Auto focus new module
      }
      setNewGroupName('');
      setShowAddGroupInput(false);
    }
  };

  // ── Filters & Computed ──────────────────────────────────────────────────
  // Filter docs matching searchTerm
  const searchedDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter docs matching active focus Group (or show all if activeGroup is 'All')
  const filteredDocs = searchedDocs.filter(doc =>
    activeGroup === 'All' ? true : (doc.group || 'General') === activeGroup
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
          <div className="section-heading">Syllabus Material</div>
          {documents.length > 0 && (
            <span className="badge">{documents.length}</span>
          )}
        </div>
        {documents.length > 0 && (
          <motion.button
            className="btn btn--ghost"
            onClick={handleClear}
            title="Clear all session materials"
            style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '6px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </motion.button>
        )}
      </div>

      <div className="panel__inner">
        {/* ── Syllabus Modules Navigation */}
        <div className="modules-nav">
          <div className="modules-nav__header">
            <span className="modules-nav__title">Syllabus Modules</span>
            <button
              className="btn btn--ghost modules-nav__add-btn"
              onClick={() => setShowAddGroupInput(prev => !prev)}
              title="Add Syllabus Group/Module"
              aria-label="Add Syllabus Group"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          <AnimatePresence>
            {showAddGroupInput && (
              <motion.form
                onSubmit={handleAddGroupSubmit}
                className="modules-nav__add-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <input
                  type="text"
                  placeholder="e.g. Maths 101, Biology..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="btn btn--primary btn--xs">Add</button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="modules-nav__list">
            <button
              className={`modules-nav__item ${activeGroup === 'All' ? 'modules-nav__item--active' : ''}`}
              onClick={() => onSelectGroup('All')}
            >
              <span className="modules-nav__item-name">📁 All Materials</span>
              <span className="modules-nav__item-badge">{documents.length}</span>
            </button>
            {groups.map(grp => {
              const count = documents.filter(d => (d.group || 'General') === grp).length;
              return (
                <button
                  key={grp}
                  className={`modules-nav__item ${activeGroup === grp ? 'modules-nav__item--active' : ''}`}
                  onClick={() => onSelectGroup(grp)}
                >
                  <span className="modules-nav__item-name">📚 {grp}</span>
                  <span className="modules-nav__item-badge">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Drop Zone (always points uploads to active focus module) */}
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
          whileHover={{ scale: 1.002 }}
          whileTap={{ scale: 0.998 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="file-input"
            multiple // Multi-File Upload enabled
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
              Analyzing syllabus files…
            </p>
          ) : (
            <p className="drop-zone__label">
              <strong>Drag & drop documents</strong> here or browse<br />
              <span style={{ fontSize: '0.73rem', opacity: 0.7 }}>
                PDF, JPEG, or PNG · Scoping to: <strong style={{ color: 'var(--accent-gold)' }}>{activeGroup === 'All' ? 'General' : activeGroup}</strong>
              </span>
            </p>
          )}
        </motion.div>

        {/* ── Search (Visible if documents exist) */}
        {documents.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeGroup === 'All' ? 'all' : activeGroup} files…`}
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
        {filteredDocs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="section-heading">Syllabus Contents</div>
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

                        {/* Document group movement menu */}
                        <div className="doc-item__actions">
                          <div className="doc-item__group-mover" title="Move to syllabus group">
                            <select
                              value={doc.group || 'General'}
                              onChange={(e) => onMoveDocument(doc.id, e.target.value)}
                              aria-label="Move syllabus group"
                            >
                              {groups.map(grp => (
                                <option key={grp} value={grp}>{grp}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            className={`doc-item__listen${isSpeaking ? ' pulse' : ''}`}
                            onClick={() => handleListen(doc)}
                            title={isSpeaking ? 'Stop listening' : 'Listen to summary'}
                            aria-label={isSpeaking ? 'Stop' : 'Listen'}
                            style={{ color: isSpeaking ? 'var(--accent-gold)' : undefined }}
                          >
                            {isSpeaking ? <Square size={10} style={{ fill: 'currentColor' }} /> : <Volume2 size={12} />}
                          </button>
                        </div>
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
                  No matches found for search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state */}
        {filteredDocs.length === 0 && !isUploading && documents.length > 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '30px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <FolderOpen size={16} style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }} />
            <span>No documents uploaded in active module: <strong>{activeGroup}</strong></span>
          </div>
        )}

        {/* ── Latest Summary (most-recently uploaded of active group) */}
        {filteredDocs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div className="section-heading">
              Latest Summary
              <span style={{ marginLeft: 6, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                — {filteredDocs[filteredDocs.length - 1].name}
              </span>
            </div>
            <div className="card summary-preview">
              <ReactMarkdown>{filteredDocs[filteredDocs.length - 1].summary}</ReactMarkdown>
            </div>
          </motion.div>
        )}

        {/* ── Initial Empty state */}
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
