import { useState, useCallback } from 'react';

const MicIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: active ? 'var(--accent-2)' : undefined }}>
    <rect x="9" y="2" width="6" height="13" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="21" x2="12" y2="17"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
  </svg>
);

// Browser-native SpeechRecognition input — per PRD §6
// No external TTS/STT libraries
export default function VoiceButton({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useState(null);

  const handleClick = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert('Speech recognition is not supported in this browser. Please type your question.');
      return;
    }

    if (listening) {
      recognitionRef[0]?.stop();
      setListening(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
      setListening(false);
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef[0] = recognition; // store reference to allow manual stop
    recognition.start();
    setListening(true);
  }, [listening, onTranscript, recognitionRef]);

  return (
    <button
      id="voice-input-btn"
      onClick={handleClick}
      disabled={disabled}
      className={`btn btn--icon${listening ? ' pulse' : ''}`}
      title={listening ? 'Tap to stop listening' : 'Voice input'}
      aria-label={listening ? 'Stop listening' : 'Start voice input'}
      style={{
        color: listening ? 'var(--accent-2)' : undefined,
        borderColor: listening ? 'var(--accent-1)' : undefined,
      }}
    >
      <MicIcon active={listening} />
    </button>
  );
}
