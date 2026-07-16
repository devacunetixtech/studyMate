# StudyMate — Non-negotiable project standards

- The core model MUST be Gemma 4 (`gemma-4-26b-a4b-it` or `gemma-4-31b-it`), accessed via
  the Gemini API. Never substitute a Gemini model (e.g. gemini-2.5-flash) as the primary
  engine — this fails the hackathon's core judging criterion.
- SDK: use `@google/genai` only. Never `@google/generative-ai` (deprecated) or
  `getGenerativeModel()` — call `ai.models.generateContent()` / `generateContentStream()`
  directly.
- Search grounding tool syntax: `tools: [{ googleSearch: {} }]`.
- Stack: MERN — React (Vite) frontend, Node.js/Express backend, MongoDB optional.
- Voice features (playback/input) use browser-native SpeechSynthesis/SpeechRecognition —
  no external TTS/STT libraries.
- Design palette: warm cream/kraft-paper tones (#F6F1E7, #2E2419, #8A7A66), amber-to-cocoa
  gradient (#C9A24B → #8B5E3C) reserved only for active AI states. No blue/violet/magenta,
  no glassmorphism.
- This is a 2-day hackathon build — prioritize a working, demoable feature over polish or
  edge-case handling. Flag anything skipped rather than silently cutting it.
