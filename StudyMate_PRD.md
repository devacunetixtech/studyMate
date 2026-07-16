# StudyMate — Product Requirements Document
**Build With Gemma — GDGOC LAUTECH Hackathon | Track: Campus Infra for Student**

---

## 1. Problem Statement

Students juggling lecture notes, scanned manuals, and slide decks lose hours converting raw material into exam-ready knowledge. StudyMate turns any uploaded document (PDF, photo of handwritten notes, or slide image) into a structured summary, answers precise questions grounded in that material, and surfaces further reading — all through one lightweight, voice-enabled interface.

Students rarely study from a single source. StudyMate supports **ongoing sessions**: a student can keep adding related documents (a second PDF, a photo of extra notes, a past-question sheet) mid-session, and the assistant answers using everything uploaded so far — without re-processing already-seen material from scratch on every question.

---

## 2. Core Engine: Gemma 4 (Non-negotiable)

StudyMate's intelligence layer is **Gemma 4**, accessed through the Gemini API (same auth/key flow as Gemini, different model ID). This is not a stylistic choice — it is the hackathon's central judging criterion (Gemma Integration, 30%).

| Setting | Value |
|---|---|
| Primary model | `gemma-4-26b-a4b-it` (MoE — fast, good default) |
| Fallback / quality mode | `gemma-4-31b-it` (dense — higher quality, more latency) |
| SDK | `@google/genai` (current) — **not** `@google/generative-ai` (deprecated) |
| Auth | Gemini API key, same one already generated |
| Multimodal input | Image + PDF via `inlineData` parts |
| Grounding | Native `googleSearch` tool (built into the model call — this *is* the "Read More" feature) |

> ⚠️ Do not substitute `gemini-1.5-flash`, `gemini-2.5-flash`, or any other Gemini model as the primary engine. Gemma 4 must be the model actually generating the summaries and answers, or the submission fails the core rubric criterion.

---

## 3. System Prompt (Gemma 4 `systemInstruction`)

```
# Role & Objective
You are the core intelligence engine of StudyMate, an exam-preparation assistant for
university students. You process uploaded lecture notes, manuals, or slides (images or
PDFs), produce clear exam-focused summaries, answer questions grounded strictly in the
uploaded material, and surface further reading when asked.

# Ingestion & Summarization
- Produce a highly organized, exam-focused summary using markdown headers and bullet points.
- Every line should be something a student could plausibly be tested on — avoid filler.
- End every summary with a "Focus Areas" list of the 3 most important concepts to review.

# Multi-Document Sessions
- A session may contain more than one uploaded document. Treat all uploaded documents as
  one combined knowledge base for that session, unless the student asks about a specific one.
- When multiple documents are present, briefly note which document(s) support your answer
  (e.g. "According to your second upload..."), so the student can trace the source.
- Do not blend conflicting details from different documents without flagging the conflict.

# Grounded, Precise Q&A
- Answer using only facts stated in the uploaded material for that session. Do not add
  outside detail unless the student explicitly asks for more context or further reading.
- Be precise: quote or closely paraphrase the specific figures, definitions, or steps as
  they appear in the material, rather than a general approximation.
- If the answer isn't in the uploaded material, say so explicitly: "Based on your uploaded
  document(s), I couldn't find that specific detail, but here is what is generally true..."
  — then answer helpfully and accurately, clearly separated from the grounded answer.

# Further Reading
- If the user asks for "extra reading," "more resources," "online articles," or if a topic
  clearly needs external context, use your Google Search tool to find 2-3 credible,
  current sources (prioritize educational sites, official documentation, or academic sources)
  and briefly explain why each is relevant.
- Never fabricate a source, URL, or page number.

# Tone
Concise and structured. Students are reading under time pressure — no padding.
```

**Precision setting:** pair this prompt with a low `temperature` (0.2–0.3) in the model config. Lower temperature reduces the model's tendency to improvise or generalize, which matters more here than creativity.

Note: the custom `fetch_web_resources` function from earlier drafts is no longer needed. Gemma 4's native `googleSearch` tool replaces it entirely — one config flag instead of a hand-built function.

---

## 4. Tech Stack (MERN)

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Model access:** `@google/genai` npm package
- **File handling:** `multer` for uploads (memory storage is fine for a 2-day sprint)
- **Database:** MongoDB — optional; only add if you want persistent session history. Skip it if time is tight and keep state in React.
- **Voice:** Browser-native `SpeechSynthesis` (playback) + `SpeechRecognition` (input) — frontend only, no backend involvement, no extra dependencies.

---

## 5. Backend Implementation (corrected)

### Install
```bash
npm install express cors multer dotenv @google/genai
```

### Session architecture: why this makes multi-document sessions *faster*, not slower

The naive approach — resending every uploaded file's raw bytes on every chat message — gets slower and more expensive as a student adds more related documents. StudyMate avoids that with two layers:

1. **Ingest once, reuse text forever.** Each document is sent to Gemma 4 as raw multimodal data (image/PDF) only once, at upload time, to extract a text summary. Every subsequent chat call reuses that lightweight text instead of re-sending the original file. Text tokens are dramatically cheaper and faster to process than re-decoding images/PDFs repeatedly.
2. **Context caching (where supported).** On top of that, StudyMate creates a Gemini API context cache of the combined session text via `ai.caches.create()`, and references it on every chat call with `cachedContent`. This means the model only has to process the *new* question each time, not the full accumulated document context — so response time stays roughly flat even as more related documents are added.

> ⚠️ Context caching is model-specific and not guaranteed for every Gemma 4 variant — test this early on Day 1. The code below fails gracefully: if cache creation errors out, it automatically falls back to sending the combined text summaries directly (still much faster than resending raw files, just without the extra caching speedup).

### `server.js`

```javascript
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemma-4-26b-a4b-it'; // swap to 'gemma-4-31b-it' for higher quality, more latency

const SYSTEM_PROMPT = `
# Role & Objective
You are the core intelligence engine of StudyMate...
[paste full system prompt from Section 3 here]
`;

// Session store: supports multiple related documents, plus an optional
// context cache reference for fast repeated Q&A (fine as in-memory state
// for a hackathon demo — swap for MongoDB only if you need persistence)
let session = {
  documents: [],   // { id, name, mimeType, summary }
  cacheName: null, // Gemini context cache resource name, if supported
};

// --- Upload + Summarize (appends to the session, does not replace it) ---
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const base64Data = file.buffer.toString('base64');

    // One multimodal call per document, ever — this is the expensive step,
    // and it only happens once per file, not once per question.
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: file.mimetype, data: base64Data } },
          { text: 'Summarize this document for exam preparation.' }
        ]
      }],
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2 }
    });

    const docId = `doc_${Date.now()}`;
    session.documents.push({ id: docId, name: file.originalname, mimeType: file.mimetype, summary: response.text });

    await refreshSessionCache(); // keep the fast-path cache in sync with the new document

    res.json({ docId, summary: response.text, totalDocuments: session.documents.length });
  } catch (err) {
    console.error('Upload/summarize error:', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

// Rebuilds the session's context cache from all document summaries so far.
// Falls back silently if caching isn't available for this model.
async function refreshSessionCache() {
  try {
    const combinedText = session.documents
      .map(d => `--- Document: ${d.name} ---\n${d.summary}`)
      .join('\n\n');

    const cache = await ai.caches.create({
      model: MODEL,
      config: {
        contents: [{ role: 'user', parts: [{ text: combinedText }] }],
        systemInstruction: SYSTEM_PROMPT,
        ttl: '3600s' // 1 hour — plenty for a study session
      }
    });
    session.cacheName = cache.name;
  } catch (err) {
    console.warn('Context caching unavailable, falling back to direct text context:', err.message);
    session.cacheName = null;
  }
}

// --- Grounded, precise Q&A across all session documents + "Read More" ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (session.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload a study document first.' });
    }

    const config = {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }], // native grounding — this is the entire "Read More" feature
      temperature: 0.2 // precision over improvisation
    };

    let contents;
    if (session.cacheName) {
      // Fast path: cached document context — only the new question is processed fresh
      config.cachedContent = session.cacheName;
      contents = [{ role: 'user', parts: [{ text: message }] }];
    } else {
      // Fallback path: resend combined TEXT summaries (still far cheaper than raw files)
      const combinedText = session.documents
        .map(d => `--- Document: ${d.name} ---\n${d.summary}`)
        .join('\n\n');
      contents = [{ role: 'user', parts: [{ text: `${combinedText}\n\nQuestion: ${message}` }] }];
    }

    const response = await ai.models.generateContent({ model: MODEL, contents, config });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const resources = chunks.map(c => ({ title: c.web?.title || 'Web Resource', url: c.web?.uri }));

    res.json({
      reply: response.text,
      resources,
      documentsUsed: session.documents.map(d => d.name)
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(5000, () => console.log('StudyMate engine (Gemma 4) running on port 5000'));
```

**Key fixes vs. the earlier draft:** `@google/genai` (not `@google/generative-ai`), `ai.models.generateContent()` called directly (no `getGenerativeModel()` step), `response.text` as a property (not `response.response.text()`), and `tools: [{ googleSearch: {} }]` (not `{ type: 'google_search' }`).

**PDF handling note:** sending PDFs directly as `inlineData` with `mimeType: 'application/pdf'` works for most text-based PDFs. If a scanned/image-heavy PDF returns poor results during testing, fall back to extracting text first with `pdf-parse` and sending it as a plain text part instead — keep this as a tested contingency, not a default, to avoid burning setup time you may not need.

---

## 5a. Real-Time Streaming Responses

Waiting for a full response before showing anything reads as slow, even when total generation time is the same. StudyMate streams the answer token-by-token as Gemma generates it, using `generateContentStream` and Server-Sent Events (SSE) from Express to React.

### Backend: streaming chat endpoint

```javascript
// --- Streaming grounded Q&A (replaces /api/chat for the live UI) ---
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message } = req.body;
    if (session.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload a study document first.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const config = {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.2
    };

    let contents;
    if (session.cacheName) {
      config.cachedContent = session.cacheName;
      contents = [{ role: 'user', parts: [{ text: message }] }];
    } else {
      const combinedText = session.documents
        .map(d => `--- Document: ${d.name} ---\n${d.summary}`)
        .join('\n\n');
      contents = [{ role: 'user', parts: [{ text: `${combinedText}\n\nQuestion: ${message}` }] }];
    }

    const stream = await ai.models.generateContentStream({ model: MODEL, contents, config });

    let resources = [];
    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
      }
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        resources = groundingChunks.map(c => ({ title: c.web?.title || 'Web Resource', url: c.web?.uri }));
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', resources, documentsUsed: session.documents.map(d => d.name) })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Stream chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
    res.end();
  }
});
```

Keep the non-streaming `/api/chat` from Section 5 as a fallback — if SSE parsing gives you trouble mid-build, you can demo on the non-streaming version without losing functionality, and add streaming back once it's stable.

### Frontend: consuming the stream

```javascript
const handleSendMessage = async (e) => {
  if (e) e.preventDefault();
  if (!chatInput.trim()) return;

  const userMessage = chatInput;
  setChatInput('');
  setChatHistory(prev => [
    ...prev,
    { sender: 'user', text: userMessage },
    { sender: 'assistant', text: '', streaming: true } // placeholder that fills in live
  ]);

  const res = await fetch('http://localhost:5000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop(); // keep any incomplete event for the next read

    for (const line of events) {
      if (!line.startsWith('data: ')) continue;
      const payload = JSON.parse(line.slice(6));

      setChatHistory(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (payload.type === 'chunk') {
          last.text += payload.text;
        } else if (payload.type === 'done') {
          last.streaming = false;
          last.resources = payload.resources;
        }
        return updated;
      });
    }
  }
};
```

Render `msg.text` as it grows on every state update — no extra library needed, React's normal re-render handles the live-typing effect. Show a subtle blinking cursor or the amber shimmer hairline (Section 7) while `msg.streaming` is `true`, and remove it the instant the `done` event arrives.

---

## 5b. Copy Button on Responses

```jsx
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-[#8A7A66] hover:text-[#2E2419] transition-colors flex items-center gap-1"
      title="Copy response"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
```

Place this in the bottom-right corner of each assistant message bubble, only rendered once `msg.streaming` is `false` — copying a response that's still generating would copy a partial answer, which is worse than not offering the button until it's complete.

---

## 6. Frontend: Voice (no backend involvement)

```javascript
// Playback
function speakSummary(text) {
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`-]/g, ''));
  window.speechSynthesis.speak(utterance);
}

// Input
function startVoiceInput(onResult) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return alert('Speech recognition not supported in this browser.');
  const recognition = new Recognition();
  recognition.onresult = (e) => onResult(e.results[0][0].transcript);
  recognition.start();
}
```

(Full component wiring — upload handler, chat state, resource cards — can reuse the structure from your existing `StudyMate.jsx` draft, with two changes: the upload control stays visible and active throughout the session, not just before the first upload; and the left panel renders a running list of uploaded documents (name + a per-document "Listen" button) rather than a single summary that gets overwritten by each new file.)

---

## 7. Design Direction — Light, Minimal, Kraft-Paper Palette

**Palette (5 named values):**
- Canvas: warm cream `#F6F1E7` — soft, paper-like, not stark white
- Surface (cards/panels): slightly lifted off-white `#FDFBF6` with a 1px `#E4DBC8` hairline border
- Primary text: deep coffee brown `#2E2419` — warm, not pure black
- Secondary text: muted taupe `#8A7A66`
- Accent gradient (reserved strictly for active AI states — generating, listening, speaking): warm amber → cocoa, `#C9A24B → #8B5E3C`. Not a decorative background, not a button fill everywhere — only where the AI is visibly doing something.

This intentionally avoids a flashy or saturated look — no bright blues, no neon, no full-color gradient blocks. The gradient exists only as a thin, quiet signal, not a design centerpiece.

**Typography:** a clean, warm sans — `Inter` or system-ui — set with generous line height for scanning. No serif, no decorative display face; the brown/cream palette already carries the personality, the type should stay quiet.

**Layout principles:**
- Generous whitespace, rounded-xl corners (not pill-shaped), thin 1px hairlines instead of heavy borders or shadows
- Two-pane workspace: summaries and uploaded-document list on one side, grounded chat on the other
- The one animated moment in the interface: a thin amber-to-cocoa gradient hairline that shimmers slowly along the top edge of the active panel while Gemma is generating or a document is being ingested — stops immediately when the response lands. This is the interface's single signature move; everything else stays still.
- Mic and "Listen" buttons pulse gently (opacity, not color change) while active — no spinners
- Respect `prefers-reduced-motion`: disable the shimmer and pulses for users who request it

**Avoid:** bright blue/violet/magenta gradients, glassmorphism, heavy shadows, or any full-color hero blocks. The interface should read as calm and paper-like — closer to a well-designed study notebook than an AI product demo.

---

## 8. Feature Scope & Build Order (2 Days)

**Day 1 — Core (must work end-to-end by end of day):**
1. Upload flow (PDF/image) + Gemma 4 summary generation
2. Precise, grounded Q&A against the uploaded document (low temperature, strict grounding instructions)
3. Session support for a **second** uploaded document mid-session — confirm the chat correctly draws on both before adding anything else

**Day 2 — Differentiators:**
4. Native `googleSearch` grounding → "Read More" resource cards (near-zero build cost, do this first)
5. Context caching for the session (test early — see Section 5 fallback notes; don't let this block other work if it doesn't cooperate)
6. Streaming responses (Section 5a) — biggest perceived-speed win for the least risk; do this before voice
7. Copy button on responses (Section 5b) — trivial to add, do it alongside streaming
8. Voice summary playback (`SpeechSynthesis`)
9. Voice input (`SpeechRecognition`) — keep a typed-input fallback ready for the live demo
10. UI polish using the design direction above, rehearse demo, write Kaggle writeup

---

## 9. Rubric Alignment (for the Kaggle Writeup)

| Criterion | How StudyMate delivers |
|---|---|
| Gemma Integration (30%) | Gemma 4 is the sole model for ingestion, summarization, grounded Q&A, and native search-tool calling — not a wrapper around another model |
| Innovation & Impact (30%) | Solves a universal, high-frequency student pain point; grounded-answer behavior (not generic chat) is a meaningful design choice |
| Functionality (20%) | Narrow, tested feature set — upload → summary → grounded chat → resources — demoable in under 2 minutes |
| Presentation (20%) | Clear before/after story: messy notes in, structured exam-ready knowledge out |

---

## 10. Known Risks & Mitigations

- **Scanned/handwritten PDFs may OCR poorly** → test early on Day 1 with a real sample document, not a clean typed one; have a `pdf-parse` text-extraction fallback ready.
- **Voice input flakiness on some browsers/mics** → keep the typed-input box always visible; never let the live demo depend on voice succeeding.
- **API rate limits on free tier** → test your full demo flow once, end-to-end, before pitch time to confirm no throttling.
- **Offline claim** → this build uses the hosted API, not on-device Gemma. If you want to reference offline capability in the writeup, frame it as a documented roadmap item (Gemma 4 E2B/E4B via Ollama), not a built feature.
- **Context caching may not be supported for your chosen Gemma 4 variant** → confirmed by testing, not assumption — try it on Day 1 with a real document, and rely on the built-in text-summary fallback if it errors. Either way, the app stays fast because raw files are never re-sent after the first upload.
- **Multiple documents may contain conflicting information** → the system prompt instructs Gemma to flag conflicts rather than silently pick one; test this explicitly with two documents that disagree on a fact before demo day.
- **SSE stream parsing can be fiddly** (partial chunks arriving mid-JSON) → the buffer-and-split approach in Section 5a handles this, but test with a genuinely long response early; keep the non-streaming `/api/chat` endpoint as a fallback you can switch to instantly if streaming misbehaves during the live demo.
