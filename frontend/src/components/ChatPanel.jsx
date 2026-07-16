import { useState, useRef, useEffect, useCallback, useId } from 'react';
import MessageBubble from './MessageBubble';
import VoiceButton from './VoiceButton';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="chat-empty__icon">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

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

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = chatHistory.length === 0;
  const noDoc = documentCount === 0;

  console.log('=== ChatPanel Render ===', {
    isStreaming,
    chatHistory: chatHistory.map(m => ({ id: m.id, sender: m.sender, streaming: m.streaming, resourcesCount: m.resources?.length, resources: m.resources }))
  });

  return (
    <div className="panel panel--right" data-active={isStreaming ? 'true' : 'false'}>
      <div className="shimmer-bar" />

      {/* ── Message Thread */}
      <div className="chat-messages" id="chat-messages">
        {isEmpty && (
          <div className="chat-empty">
            <BookIcon />
            <p className="chat-empty__text">
              {noDoc
                ? 'Upload a study document on the left to begin.'
                : 'Ask a question about your uploaded document(s).'}
            </p>
            {!noDoc && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, width: '100%', maxWidth: 360 }}>
                {['Summarize the key points for the exam.', 'What are the most important concepts I should know?', 'Find me further reading on this topic.'].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="btn btn--ghost"
                    style={{ justifyContent: 'flex-start', fontSize: '0.8rem', textAlign: 'left' }}
                    onClick={() => {
                      setChatInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chatHistory.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

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
          placeholder={noDoc ? 'Upload a document first…' : 'Ask a question… (Enter to send, Shift+Enter for newline)'}
          disabled={isStreaming || noDoc}
          rows={1}
          aria-label="Chat input"
        />
        <button
          id="send-btn"
          className="btn btn--primary"
          onClick={handleSendMessage}
          disabled={isStreaming || noDoc || !chatInput.trim()}
          aria-label="Send message"
          style={{ padding: '9px 14px' }}
        >
          {isStreaming
            ? <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
            : <SendIcon />
          }
        </button>
      </div>
    </div>
  );
}
