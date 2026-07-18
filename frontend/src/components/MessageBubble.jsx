import { Sparkles, User, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from './CopyButton';
import ResourceCards from './ResourceCards';

// ─── Avatar Icons ─────────────────────────────────────────────────────────────
const GemmaAvatar = () => (
  <div className="message__avatar message__avatar--assistant" title="Gemma 4">
    <Sparkles size={13} style={{ strokeWidth: 2.2 }} />
  </div>
);

const UserAvatar = () => (
  <div className="message__avatar message__avatar--user" title="You">
    <User size={13} style={{ strokeWidth: 2.2 }} />
  </div>
);

// ─── Message Bubble ───────────────────────────────────────────────────────────
export default function MessageBubble({ msg }) {
  const isAssistant = msg.sender === 'assistant';

  return (
    <div className={`message message--${msg.sender}`} id={`message-${msg.id}`}>
      {isAssistant ? <GemmaAvatar /> : <UserAvatar />}

      <div className="message__content">
        <div className="message__bubble">
          {isAssistant ? (
            <>
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown>
              </div>

              {/* Blinking cursor while streaming */}
              {msg.streaming && <span className="cursor" aria-hidden="true" />}

              {/* Footer: copy button + resource cards — shown only after streaming done */}
              {!msg.streaming && msg.text && (
                <>
                  <div className="message__bubble-footer">
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {msg.documentsUsed?.length ? (
                        <>
                          <FileText size={10} />
                          <span>
                            {msg.documentsUsed.length} doc{msg.documentsUsed.length > 1 ? 's' : ''} referenced
                          </span>
                        </>
                      ) : (
                        <span>StudyMate</span>
                      )}
                    </span>
                    <CopyButton text={msg.text} />
                  </div>
                  {msg.resources?.length > 0 && (
                    <ResourceCards resources={msg.resources} />
                  )}
                </>
              )}
            </>
          ) : (
            <span>{msg.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
