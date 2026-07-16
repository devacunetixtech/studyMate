# StudyMate — Implementation Plan

> **Hackathon: Build With Gemma — GDGOC LAUTECH | Track: Campus Infra for Student**
> **Stack:** React (Vite) + Node.js/Express | **Model:** Gemma 4 via `@google/genai`

---

## Architecture Overview

```
studyMate/
├── backend/
│   ├── server.js          ← Express API (upload, chat, streaming)
│   ├── package.json
│   └── .env               ← GEMINI_API_KEY (already exists at root; symlinked or copied)
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css      ← Global design system (kraft-paper palette)
        └── components/
            ├── UploadPanel.jsx     ← Dropzone + document list + per-doc Listen button
            ├── ChatPanel.jsx       ← Streaming message thread
            ├── MessageBubble.jsx   ← Renders markdown + CopyButton
            ├── CopyButton.jsx      ← Clipboard copy with 1.5s feedback
            ├── ResourceCards.jsx   ← "Read More" grounding results
            └── VoiceButton.jsx     ← Mic input + speak output (browser-native)
```

### Request Flow

```
User uploads PDF/image
  → POST /api/upload (multer memoryStorage)
      → ai.models.generateContent() [inline multimodal — once per file]
          → summary stored in session.documents[]
          → refreshSessionCache() → ai.caches.create() [with text-fallback]
  ← { docId, summary, totalDocuments }

User asks question
  → POST /api/chat/stream (SSE)
      → if session.cacheName → cachedContent fast path
      → else → combined text summaries fallback
      → ai.models.generateContentStream() + tools: [{ googleSearch: {} }]
  ← SSE stream: { type: 'chunk', text } … { type: 'done', resources, documentsUsed }
```

---

## Day 1 — Core Features (must work end-to-end)

### Phase 0 — Project Scaffolding

**Tasks:**
1. Initialize Vite + React frontend in `studyMate/frontend/`
2. Initialize Express backend in `studyMate/backend/`
3. Install all dependencies
4. Copy `.env` to `backend/` (or use dotenv with path override)
5. Confirm `node --version` ≥ 18 (for native `fetch` + ESM support)

**Backend deps:**
```bash
npm install express cors multer dotenv @google/genai
```

**Frontend deps:**
```bash
npm install react react-dom react-markdown
```

---

### Phase 1 — Backend: Session Store + Upload Endpoint

**File:** `backend/server.js`

**Implementation details:**
- ESM (`"type": "module"` in package.json) — matches the PRD's `import` syntax
- In-memory `session` object: `{ documents: [], cacheName: null }`
- `POST /api/upload` — multer single file → `inlineData` base64 → `ai.models.generateContent()`
  - Appends `{ id, name, mimeType, summary }` to `session.documents`
  - Calls `refreshSessionCache()` after every upload
- `refreshSessionCache()` — wraps `ai.caches.create()` in try/catch; sets `session.cacheName = null` on failure (graceful fallback)
- `POST /api/chat` — non-streaming fallback (kept permanently per PRD §5)
- System prompt pasted in full from PRD §3

**Critical rules (from Project_standard.md):**
- `new GoogleGenAI({ apiKey })` — not `GoogleGenerativeAI`
- `ai.models.generateContent()` — NOT `ai.getGenerativeModel().generateContent()`
- `response.text` — NOT `response.response.text()`
- `tools: [{ googleSearch: {} }]` — NOT `{ type: 'google_search' }`
- Temperature: `0.2`

**Verification checkpoint:** `curl -X POST localhost:5000/api/upload -F "file=@test.pdf"` returns `{ docId, summary }`.

---

### Phase 2 — Backend: Streaming Endpoint

**File:** `backend/server.js` (added to same file)

**Implementation details:**
- `POST /api/chat/stream` → SSE headers → `ai.models.generateContentStream()`
- Same cache/fallback logic as `/api/chat`
- Loop: for each chunk, `res.write(`data: ${JSON.stringify({ type:'chunk', text })}`)` 
- On loop end: `res.write(`data: ${JSON.stringify({ type:'done', resources, documentsUsed })}`)` → `res.end()`
- On error: `res.write(`data: ${JSON.stringify({ type:'error', error })}`)` → `res.end()`
- Grounding chunks extracted from `chunk.candidates?.[0]?.groundingMetadata?.groundingChunks`

**Verification checkpoint:** `curl -N -X POST localhost:5000/api/chat/stream -H "Content-Type: application/json" -d '{"message":"summarize"}'` produces a live SSE stream.

---

### Phase 3 — Frontend: Design System

**File:** `frontend/src/index.css`

**Implementation details (kraft-paper palette):**
```
--color-canvas:     #F6F1E7   ← body background
--color-surface:    #FDFBF6   ← card/panel backgrounds
--color-border:     #E4DBC8   ← 1px hairlines
--color-text:       #2E2419   ← primary text
--color-muted:      #8A7A66   ← secondary text
--color-accent-1:   #C9A24B   ← amber (gradient start)
--color-accent-2:   #8B5E3C   ← cocoa (gradient end)
```

- Font: `Inter` from Google Fonts (loaded via `<link>` in `index.html`)
- CSS custom properties on `:root`
- `.shimmer-bar` keyframe animation: gradient hairline that sweeps left→right, only active while `data-streaming="true"` on the panel
- `@media (prefers-reduced-motion: reduce)` disables shimmer and mic pulse
- `.pulse` keyframe: opacity 1 → 0.5 → 1 (mic/listen button while active)
- Two-panel grid layout: `display: grid; grid-template-columns: 360px 1fr`

**Avoid:** glassmorphism, box-shadow heavy styling, blue/violet/magenta, pill-shaped buttons.

---

### Phase 4 — Frontend: UploadPanel Component

**File:** `frontend/src/components/UploadPanel.jsx`

**Implementation details:**
- Drag-and-drop zone + click-to-browse (accepts `image/*`, `application/pdf`)
- Upload stays **always visible and active** (not replaced by summary — see PRD §6 note)
- On file select → POST to `/api/upload` → shows loading state (shimmer on panel top) → on success, appends doc to list
- Document list: each entry shows `{ name, docId }` + a per-document **"Listen"** button
- "Listen" button calls `speakSummary(doc.summary)` via `SpeechSynthesis`
- Summary display: renders the most-recently uploaded doc's summary (for quick reference) with `react-markdown`
- Shows total document count: "2 documents in session"
- Props: `{ documents, onUpload }` (lift state up to `App.jsx`)

---

### Phase 5 — Frontend: ChatPanel + MessageBubble + CopyButton

**Files:** `ChatPanel.jsx`, `MessageBubble.jsx`, `CopyButton.jsx`

**ChatPanel implementation:**
- Receives `{ documents }` count to show "Upload a document to start" empty state
- Input bar: `<textarea>` (multiline) + send button + mic button (`VoiceButton`)
- On submit: calls `handleSendMessage()` → uses SSE fetch pattern from PRD §5a exactly
- SSE consumer: `getReader()` + `TextDecoder` + buffer-and-split `\n\n` approach
- Chat history state: `[{ sender, text, streaming, resources }]`
- The last assistant message gets `streaming: true` → displays blinking cursor CSS animation
- `data-streaming` attribute toggled on ChatPanel div to trigger shimmer hairline
- Auto-scrolls to bottom on every new message/chunk (ref on bottom sentinel div)

**MessageBubble implementation:**
- Renders `msg.text` via `react-markdown`
- Shows blinking cursor `|` span while `msg.streaming === true`
- Shows `CopyButton` only when `msg.streaming === false` (bottom-right of bubble)
- Shows `ResourceCards` when `msg.resources?.length > 0`

**CopyButton implementation:** Exact code from PRD §5b — `navigator.clipboard.writeText()` + 1.5s "Copied" feedback.

---

### Phase 6 — Frontend: ResourceCards + VoiceButton

**ResourceCards:** Maps `resources` array → card with title + clickable URL → `target="_blank" rel="noopener"`. Styled as compact, bordered cards (surface bg + border hairline). Only shown when resources exist.

**VoiceButton:** Wraps `startVoiceInput(onResult)` from PRD §6. On transcript → sets chat input text. Pulses (opacity animation) while recording. Falls back silently (no crash) if `SpeechRecognition` unavailable.

---

### Phase 7 — End-to-End Verification (Day 1 Gate)

Before moving to Day 2, manually verify:
- [x] Upload a real PDF → summary generated and displayed
- [x] Ask a question → streamed answer appears token-by-token
- [x] Upload a **second** document → chat correctly references both ("According to your second upload...")
- [x] Context cache: check server logs — either "cache created" or fallback warning (both valid)
- [x] Grounding: ask for "more resources" → ResourceCards appear with live URLs
- [x] CopyButton: copies response text correctly
- [x] Typing fallback works if mic button not clicked

---

## Day 2 — Differentiators (in priority order)

1. **Google Search grounding / Read More cards** — already implemented via `tools: [{ googleSearch: {} }]` in streaming endpoint; just verify ResourceCards render correctly with real grounding data
2. **Context caching** — verified on Day 1; no additional code needed; already built
3. **Streaming** — already built in Day 1; Day 2 just verifies and polishes
4. **Copy button** — already built in Day 1
5. **Voice playback** — `speakSummary()` already wired to "Listen" buttons in UploadPanel
6. **Voice input** — `VoiceButton` already wired in ChatPanel; Day 2 is polishing the UX
7. **UI polish** — refine shimmer animation timing, whitespace, mobile responsiveness if time allows
8. **Demo rehearsal** — 2-minute demo: upload doc → summary → question → streamed answer → second doc → combined answer → "read more" resources

---

## File Creation Order (sequential, no skipping)

| # | File | Notes |
|---|------|-------|
| 1 | `backend/package.json` | `"type": "module"` for ESM |
| 2 | `backend/server.js` | All endpoints in one file |
| 3 | `frontend/` | Vite scaffold via npx |
| 4 | `frontend/index.html` | Add Inter font + meta tags |
| 5 | `frontend/src/index.css` | Full design system first |
| 6 | `frontend/src/App.jsx` | Session state owner, two-panel layout |
| 7 | `frontend/src/components/UploadPanel.jsx` | |
| 8 | `frontend/src/components/CopyButton.jsx` | |
| 9 | `frontend/src/components/MessageBubble.jsx` | Depends on CopyButton |
| 10 | `frontend/src/components/ResourceCards.jsx` | |
| 11 | `frontend/src/components/VoiceButton.jsx` | |
| 12 | `frontend/src/components/ChatPanel.jsx` | Assembles 7–11 |
| 13 | `frontend/src/main.jsx` | Entry point |

---

## Risk Mitigations (from PRD §10)

| Risk | Mitigation already in plan |
|------|---------------------------|
| Scanned PDF OCR poor | `inlineData` first; `pdf-parse` text-extraction fallback noted |
| Context caching unsupported | `try/catch` in `refreshSessionCache()` — falls back to combined text |
| SSE partial chunk parsing | buffer-and-split `\n\n` approach per PRD §5a |
| Voice input flakiness | Typed input always visible; voice is additive, never sole input |
| API rate limits | Single end-to-end test before demo day |
| Multi-doc conflicts | System prompt instructs Gemma to flag conflicts |

---

## Non-Negotiable Rules Summary

| Rule | Where enforced |
|------|---------------|
| Model: `gemma-4-26b-a4b-it` (primary) | `MODEL` const in server.js |
| SDK: `@google/genai` only | package.json + imports |
| Call pattern: `ai.models.generateContent()` | All model calls |
| Response access: `response.text` (property) | All response reads |
| Search tool: `tools: [{ googleSearch: {} }]` | Both chat endpoints |
| Temperature: `0.2` | All model calls |
| Voice: browser-native only | VoiceButton.jsx |
| Design: no blue/violet/glassmorphism | index.css |
