import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendHorizontal, BookOpen, Sparkles, Download } from 'lucide-react';
import MessageBubble from './MessageBubble';
import VoiceButton from './VoiceButton';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function ChatPanel({ documentCount, onStreamingChange }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const idCounter = useRef(0);

  const newId = () => `msg-${Date.now()}-${idCounter.current++}`;

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ── Notify parent of streaming state (for shimmer bar) ───────────────────
  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setChatInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    }
  };

  // ── Send Message (SSE streaming — PRD §5a) ───────────────────────────────
  const handleSendMessage = useCallback(async (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isStreaming) return;

    const userMsgId = newId();
    const assistantMsgId = newId();

    setChatInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setChatHistory(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text },
      { id: assistantMsgId, sender: 'assistant', text: '', streaming: true, resources: [], documentsUsed: [] },
    ]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setChatHistory(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          last.text = `⚠️ ${err.error || 'Something went wrong.'}`;
          last.streaming = false;
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      // ── SSE buffer-and-split per PRD §5a ────────────────────────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEventStr = (eventStr) => {
        if (!eventStr.startsWith('data: ')) return;
        let payload;
        try {
          payload = JSON.parse(eventStr.slice(6));
        } catch {
          return;
        }

        setChatHistory(prev => {
          const lastIdx = prev.length - 1;
          if (lastIdx < 0 || prev[lastIdx].id !== assistantMsgId) return prev;

          const last = prev[lastIdx];
          let newText = last.text;
          let newStreaming = last.streaming;
          let newResources = last.resources;
          let newDocumentsUsed = last.documentsUsed;

          if (payload.type === 'chunk') {
            newText += payload.text;
          } else if (payload.type === 'done') {
            newStreaming = false;
            newResources = payload.resources || [];
            newDocumentsUsed = payload.documentsUsed || [];
          } else if (payload.type === 'error') {
            newText = `⚠️ ${payload.error}`;
            newStreaming = false;
          }

          const updated = [...prev];
          updated[lastIdx] = {
            ...last,
            text: newText,
            streaming: newStreaming,
            resources: newResources,
            documentsUsed: newDocumentsUsed,
          };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const events = buffer.split('\n\n');
            for (const eventStr of events) {
              if (eventStr.trim()) {
                processEventStr(eventStr);
              }
            }
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop(); // keep incomplete trailing event for next read

        for (const eventStr of events) {
          processEventStr(eventStr);
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
      setChatHistory(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          last.text = '⚠️ Connection error. Please try again.';
          last.streaming = false;
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [chatInput, isStreaming]);

  // ── Handle Enter key (Shift+Enter = newline) ─────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Voice transcript handler ──────────────────────────────────────────────
  const handleVoiceTranscript = useCallback((transcript) => {
    setChatInput(transcript);
    textareaRef.current?.focus();
  }, []);

  // ── Export Chat as Markdown ───────────────────────────────────────────────
  const handleExportChat = () => {
    if (chatHistory.length === 0) return;

    let content = `# StudyMate Chat Notes\n*Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*\n\n---\n\n`;

    chatHistory.forEach((msg) => {
      const sender = msg.sender === 'user' ? 'Student' : 'StudyMate';
      content += `### 💬 ${sender}\n${msg.text}\n\n`;

      if (msg.resources?.length > 0) {
        content += `**Further Reading References:**\n`;
        msg.resources.forEach((res) => {
          content += `- [${res.title || res.url}](${res.url})\n`;
        });
        content += `\n`;
      }
      
      content += `---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `studymate-notes-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = chatHistory.length === 0;
  const noDoc = documentCount === 0;

  return (
    <div className="panel panel--right" data-active={isStreaming ? 'true' : 'false'}>
      <div className="shimmer-bar" />

      {/* ── Panel Header */}
      <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="section-heading">Study Chat</div>
        {chatHistory.length > 0 && (
          <motion.button
            className="btn btn--ghost"
            onClick={handleExportChat}
            title="Export session as Markdown notes"
            style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '6px', borderRadius: '6px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={13} />
            <span>Export Notes</span>
          </motion.button>
        )}
      </div>

      {/* ── Message Thread */}
      <div className="chat-messages" id="chat-messages">
        {isEmpty && (
          <div className="chat-empty">
            <BookOpen className="chat-empty__icon" />
            <p className="chat-empty__text">
              {noDoc
                ? 'Ready for study session'
                : 'Ask anything about your documents'}
            </p>
            <p className="chat-empty__desc">
              {noDoc
                ? 'Upload a study document on the left to begin compiling notes and querying information.'
                : 'StudyMate is ready to answer syllabus questions, generate summaries, or search for external research paper links.'}
            </p>
            {!noDoc && (
              <motion.div 
                style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, width: '100%', maxWidth: 360 }}
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
                }}
              >
                {['Summarize the key points for the exam.', 'What are the most important concepts I should know?', 'Find me further reading on this topic.'].map((suggestion) => (
                  <motion.button
                    key={suggestion}
                    className="btn btn--ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.8rem', textAlign: 'left', padding: '10px 14px' }}
                    onClick={() => {
                      setChatInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    whileHover={{ x: 4, borderColor: 'var(--accent-gold)', background: 'rgba(212,175,55,0.02)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Sparkles size={11} style={{ marginRight: 8, color: 'var(--accent-gold)', flexShrink: 0 }} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{suggestion}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {chatHistory.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
            >
              <MessageBubble msg={msg} />
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar */}
      <div className="chat-input-bar">
        <VoiceButton
          onTranscript={handleVoiceTranscript}
          disabled={isStreaming || noDoc}
        />
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={chatInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={noDoc ? 'Upload a document first…' : 'Ask a question… '}
          disabled={isStreaming || noDoc}
          rows={1}
          aria-label="Chat input"
        />
        <motion.button
          id="send-btn"
          className="btn btn--primary"
          onClick={handleSendMessage}
          disabled={isStreaming || noDoc || !chatInput.trim()}
          aria-label="Send message"
          style={{ padding: '9px 14px' }}
          whileHover={(!isStreaming && !noDoc && chatInput.trim()) ? { scale: 1.05 } : {}}
          whileTap={(!isStreaming && !noDoc && chatInput.trim()) ? { scale: 0.95 } : {}}
        >
          {isStreaming ? (
            <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#000' }} />
          ) : (
            <SendHorizontal size={14} />
          )}
        </motion.button>
      </div>
    </div>
  );
}
