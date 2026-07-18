import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Primary: MoE — fast good default | Swap to 'gemma-4-31b-it' for higher quality
const MODEL = 'gemma-4-26b-a4b-it';

const SYSTEM_PROMPT = `
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
`;

// ─── Session Store ─────────────────────────────────────────────────────────────
// In-memory for the hackathon demo. Holds all uploaded docs + optional cache ref.
let session = {
  documents: [],   // { id, name, mimeType, summary, fullText, chunks }
  cacheName: null, // Gemini context cache resource name (null = use fallback)
};

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', model: MODEL }));

// ─── Session Info ──────────────────────────────────────────────────────────────
app.get('/api/session', (_req, res) => {
  res.json({
    documents: session.documents.map(d => ({
      id: d.id,
      name: d.name,
      summary: d.summary,
      group: d.group || 'General'
    })),
    cached: !!session.cacheName,
    totalDocuments: session.documents.length,
  });
});

// ─── Clear Session ─────────────────────────────────────────────────────────────
app.delete('/api/session', (_req, res) => {
  session = { documents: [], cacheName: null };
  res.json({ message: 'Session cleared' });
});

// ─── Context Cache Refresh ─────────────────────────────────────────────────────
// Rebuilds context cache from all summaries so far.
// Falls back silently — app always works, just without the speedup.
async function refreshSessionCache() {
  try {
    const combinedText = session.documents
      .map(d => `--- Document: ${d.name} ---\n${d.fullText || d.summary}`)
      .join('\n\n');

    const cache = await ai.caches.create({
      model: MODEL,
      config: {
        contents: [{ role: 'user', parts: [{ text: combinedText }] }],
        systemInstruction: SYSTEM_PROMPT,
        ttl: '3600s', // 1 hour — plenty for a study session
      },
    });
    session.cacheName = cache.name;
    console.log('✅ Context cache created:', cache.name);
  } catch (err) {
    console.warn('⚠️  Context caching unavailable, using text-fallback:', err.message);
    session.cacheName = null;
  }
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────
// Extracts plain text from a PDF buffer using pdf-parse v2.
// Returns '' if extraction fails — caller decides how to handle it.
async function extractPdfText(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    const text = result?.text || '';
    console.log(`   📝 pdf-parse extracted ${text.length} chars`);
    return text;
  } catch (err) {
    // Log the real error so we can diagnose why extraction fails
    console.warn('⚠️  pdf-parse extraction failed — reason:', err.message);
    return '';
  }
}

// Splits text into overlapping chunks.
// 40k chars ≈ 10k tokens — fits under the free-tier limit of 16k input tokens/min.
function chunkText(text, chunkSize = 40_000, overlap = 800) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Segment text into overlapping chunks for keyword retrieval (RAG)
function segmentText(text, size = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

// Simple TF-IDF/keyword overlap search to retrieve the most relevant sections of the manual
function retrieveRelevantContext(query, documents, maxChunks = 2) {
  // Common English stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out',
    'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can',
    'will', 'just', 'don', 'should', 'now', 'what', 'which', 'who', 'whom', 'this', 'that',
    'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'having', 'do', 'does', 'did', 'doing', 'i', 'me', 'my', 'myself', 'we', 'our',
    'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him',
    'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they',
    'them', 'their', 'theirs', 'themselves'
  ]);

  // Normalize query: lowercase, remove punctuation, split into words
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  console.log(`🔍 RAG Query keywords:`, words);

  // Always include document summaries first for global context
  let context = documents.map(d => `--- Document Summary: ${d.name} ---\n${d.summary}`).join('\n\n');
  context += '\n\n=== Relevant Sections from Documents ===\n\n';

  if (words.length === 0) {
    // If no keywords (e.g. "hello", "hi"), just return the summaries as context
    return context;
  }

  const scoredChunks = [];

  for (const doc of documents) {
    const chunks = doc.chunks || [doc.summary];
    for (const chunk of chunks) {
      let score = 0;
      const chunkLower = chunk.toLowerCase();

      for (const word of words) {
        // Count keyword occurrences in this chunk
        const matches = chunkLower.split(word).length - 1;
        if (matches > 0) {
          // Give higher weight if the keyword matches as a full word, but allow partial matches
          const wordBoundaryRegex = new RegExp('\\b' + word + '\\b', 'i');
          if (wordBoundaryRegex.test(chunkLower)) {
            score += matches * 3; // Word match gets triple weight
          } else {
            score += matches;
          }
        }
      }

      if (score > 0) {
        scoredChunks.push({ chunk, score, docName: doc.name });
      }
    }
  }

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // Take top chunks
  const topChunks = scoredChunks.slice(0, maxChunks);

  if (topChunks.length === 0) {
    // Fallback: If no keywords matched, include the first few chunks of the documents
    const fallbackChunks = [];
    for (const doc of documents) {
      if (doc.chunks && doc.chunks.length > 0) {
        fallbackChunks.push(...doc.chunks.slice(0, 2).map(c => ({ chunk: c, docName: doc.name })));
      }
    }
    context += fallbackChunks.map(tc => `--- Section from ${tc.docName} ---\n${tc.chunk}`).join('\n\n');
  } else {
    console.log(`   🎯 Retrieved ${topChunks.length} relevant chunks for grounding`);
    context += topChunks.map(tc => `--- Section from ${tc.docName} (Relevance Score: ${tc.score}) ---\n${tc.chunk}`).join('\n\n');
  }

  return context;
}

// Maximum chunks to summarize per upload on the free tier.
// Each chunk ≈ 10k tokens. At 16k tokens/min that's ~1 chunk/8s.
// 6 chunks = ~60s processing time and covers ~240k chars (most textbooks).
// ─── Set to Infinity on a paid API plan — no cap needed. ───────────────────
const MAX_CHUNKS = 6;

// Runs an array of async tasks in parallel batches of `concurrency`.
// Adds `staggerMs` delay between items within a batch to spread token load.
async function runInBatches(tasks, concurrency = 2, staggerMs = 12_000) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    // Stagger starts within the batch so both calls don't hit the API simultaneously
    const batchResults = await Promise.all(
      batch.map((task, idx) =>
        new Promise(resolve =>
          setTimeout(() => resolve(task()), idx * staggerMs)
        )
      )
    );
    results.push(...batchResults);
    // Wait between batches (not after the last one)
    if (i + concurrency < tasks.length) {
      console.log('   ⏱  Batch complete — waiting 8s before next batch…');
      await new Promise(r => setTimeout(r, 8_000));
    }
  }
  return results;
}

// Extracts the retry delay (seconds) from a 429 ApiError, if present.
function getRetryDelay(err) {
  try {
    const body = typeof err.message === 'string' ? JSON.parse(err.message) : err;
    const retryInfo = body?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      // retryDelay is e.g. "4s" or "4.398960854s"
      return Math.ceil(parseFloat(retryInfo.retryDelay)) * 1000;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

// Wraps an async fn with exponential backoff retry on 429 (rate limit),
// 503 (model overloaded), and transient network errors (ECONNRESET, fetch failed).
async function retryWithBackoff(fn, maxRetries = 5) {
  let delay = 10_000; // base delay when no hint is present
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.status === 429
        || err.message?.includes('RESOURCE_EXHAUSTED');
      const is503 = err.status === 503
        || err.message?.includes('UNAVAILABLE')
        || err.message?.includes('high demand');
      // Transient network drop — TLS reset before connection established
      const isNetwork = err.code === 'ECONNRESET'
        || err.cause?.code === 'ECONNRESET'
        || err.message?.includes('fetch failed')
        || err.message?.includes('socket disconnected');

      const isRetryable = is429 || is503 || isNetwork;
      if (!isRetryable || attempt === maxRetries) throw err;

      // For 429: use the API's own retryDelay hint when available.
      // For 503: wait longer — model capacity issues need more recovery time.
      // For network errors: short fixed delay, then exponential.
      const hinted = is429 ? getRetryDelay(err) : null;
      const base = is503 ? 20_000 : isNetwork ? 5_000 : delay;
      const wait = hinted ?? base;

      const reason = is429 ? 'Rate limited'
                   : is503 ? 'Model overloaded (503)'
                   : `Network error (${err.code || err.cause?.code || 'ECONNRESET'})`;
      console.warn(`   ⏳ ${reason} (attempt ${attempt}/${maxRetries}) — waiting ${(wait / 1000).toFixed(1)}s…`);
      await new Promise(r => setTimeout(r, wait + 500));
      delay = Math.min(delay * 2, 60_000); // exponential, cap at 60s
    }
  }
}

// Summarizes a single text part (chunk or full doc) via Gemma 4.
// Wrapped with retryWithBackoff so rate limits are handled transparently.
async function summarizeText(text, filename, chunkLabel = '') {
  const label = chunkLabel ? ` (${chunkLabel})` : '';
  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: `Document: ${filename}${label}\n\n${text}\n\nSummarize this content for exam preparation.` }],
      }],
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2 },
    });
    return response.text;
  });
}

// ─── Upload + Summarize ────────────────────────────────────────────────────────
// Strategy:
//   Images  → inlineData (multimodal, unchanged)
//   PDFs    → pdf-parse text extraction, then:
//             • Small PDF  (≤40k chars):  single text-part call
//             • Large PDF  (>40k chars):  chunk (40k each) → summarize with backoff → merge
// Raw file bytes are sent to the model ONCE, ever. All chat reuses the text summary.
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const group = req.body.group || 'General';

    console.log(`📄 Processing: ${file.originalname} (${file.mimetype}, ${(file.size / 1024).toFixed(1)} KB) in group "${group}"`);

    let summary;
    let fullText = '';
    let chunksList = [];

    if (file.mimetype === 'application/pdf') {
      // ── PDF path: text extraction first ────────────────────────────────────
      const extractedText = await extractPdfText(file.buffer);

      if (!extractedText.trim()) {
        // Text extraction failed — scanned/image-only PDF.
        // Only attempt inlineData for small files (<8 MB); large scanned PDFs
        // will definitely exceed the 262k token limit and must be rejected.
        const MB = file.size / (1024 * 1024);
        if (MB > 8) {
          console.log(`   ❌ Scanned PDF too large (${MB.toFixed(1)} MB) — rejecting`);
          return res.status(400).json({
            error: `This appears to be a scanned/image-only PDF (${MB.toFixed(1)} MB). ` +
                   'Text extraction returned no content and the file is too large to send as an image. ' +
                   'Please try a text-based PDF, or a smaller scanned document (under 8 MB).'
          });
        }
        // Small scanned PDF — attempt inlineData as last resort
        console.log(`   ℹ️  No text extracted — trying inlineData for small scanned PDF (${MB.toFixed(1)} MB)`);
        const base64Data = file.buffer.toString('base64');
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: file.mimetype, data: base64Data } },
              { text: 'Summarize this document for exam preparation.' },
            ],
          }],
          config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2 },
        });
        summary = response.text;
        fullText = summary;
        chunksList = [summary];
      } else if (extractedText.length <= 40_000) {
        // ── Small/medium PDF: single call with full text ────────────────────
        console.log(`   ℹ️  PDF text: ${extractedText.length} chars — single call`);
        summary = await summarizeText(extractedText, file.originalname);
        fullText = extractedText;
        chunksList = segmentText(extractedText);
      } else {
        // ── Large PDF: Single fast summarization call on the first 40k characters for preview,
        // while segmenting the entire document locally for RAG queries to completely avoid API rate limits.
        console.log(`   ℹ️  Large PDF: ${extractedText.length} chars. Summarizing first 40k chars for preview…`);
        const previewText = extractedText.slice(0, 40_000);
        summary = await summarizeText(previewText, file.originalname);

        // Append a note indicating this is an overview summary
        summary += `\n\n> ℹ️ *Note: This preview summary covers the introduction/overview of the document. The search chat feature has access to the full document (all ${Math.round(extractedText.length / 1000)}k characters).*`;

        fullText = extractedText;
        chunksList = segmentText(extractedText);
      }
    } else {
      // ── Image path: inlineData (unchanged) ─────────────────────────────────
      console.log('   ℹ️  Image — using inlineData');
      const base64Data = file.buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.mimetype, data: base64Data } },
            { text: 'Summarize this document for exam preparation.' },
          ],
        }],
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.2 },
      });
      summary = response.text;
      fullText = summary;
      chunksList = [summary];
    }

    const docId = `doc_${Date.now()}`;
    session.documents.push({
      id: docId,
      name: file.originalname,
      mimeType: file.mimetype,
      summary,
      fullText: fullText || summary,
      chunks: chunksList || [summary],
      group,
    });

    console.log(`✅ Document added to session (total: ${session.documents.length})`);
    await refreshSessionCache();

    res.json({
      docId,
      summary,
      totalDocuments: session.documents.length,
    });
  } catch (err) {
    console.error('❌ Upload/summarize error:', err);
    res.status(500).json({ error: 'Failed to process document', detail: err.message });
  }
});

// ─── Non-Streaming Chat (fallback — kept permanently per PRD §5) ───────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, group } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    if (session.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload a study document first.' });
    }

    const filteredDocs = group && group !== 'All'
      ? session.documents.filter(d => (d.group || 'General') === group)
      : session.documents;

    if (filteredDocs.length === 0) {
      return res.status(400).json({ error: `Please upload a document to the "${group}" module first.` });
    }

    const config = {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
    };

    const combinedText = retrieveRelevantContext(message, filteredDocs);
    const contents = [{ role: 'user', parts: [{ text: `${combinedText}\n\nQuestion: ${message}` }] }];

    const response = await ai.models.generateContent({ model: MODEL, contents, config });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const resources = chunks.map(c => ({ title: c.web?.title || 'Web Resource', url: c.web?.uri }));

    res.json({
      reply: response.text,
      resources,
      documentsUsed: filteredDocs.map(d => d.name),
    });
  } catch (err) {
    console.error('❌ Chat error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ─── Streaming Chat (SSE — primary UI path) ───────────────────────────────────
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, group } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }
    if (session.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload a study document first.' });
    }

    const filteredDocs = group && group !== 'All'
      ? session.documents.filter(d => (d.group || 'General') === group)
      : session.documents;

    if (filteredDocs.length === 0) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'error', error: `Please upload a document to the "${group}" module first.` })}\n\n`);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const config = {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
    };

    const combinedText = retrieveRelevantContext(message, filteredDocs);
    const contents = [{ role: 'user', parts: [{ text: `${combinedText}\n\nQuestion: ${message}` }] }];

    const stream = await ai.models.generateContentStream({ model: MODEL, contents, config });

    let resources = [];
    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
      }
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        resources = groundingChunks.map(c => ({
          title: c.web?.title || 'Web Resource',
          url: c.web?.uri,
        }));
      }
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      resources,
      documentsUsed: filteredDocs.map(d => d.name),
    })}\n\n`);
    res.end();
  } catch (err) {
    console.error('❌ Stream chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// ─── Update Document Metadata (PATCH) ────────────────────────────────────────
app.patch('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { group } = req.body;
    const doc = session.documents.find(d => d.id === id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    doc.group = group || 'General';
    console.log(`📂 Document "${doc.name}" moved to group "${doc.group}"`);
    await refreshSessionCache();
    res.json({ success: true, doc });
  } catch (err) {
    console.error('❌ Document PATCH error:', err);
    res.status(500).json({ error: 'Failed to update document group', detail: err.message });
  }
});

// ─── Flashcard Generator ──────────────────────────────────────────────────────
// Builds 10 Q&A flashcard pairs from all session document summaries.
// Returns a JSON array: [{ front, back }]
app.post('/api/flashcards', async (req, res) => {
  try {
    const { group } = req.body;
    const filteredDocs = group && group !== 'All'
      ? session.documents.filter(d => (d.group || 'General') === group)
      : session.documents;

    if (filteredDocs.length === 0) {
      return res.status(400).json({ error: `Please upload a study document to the "${group || 'General'}" module first.` });
    }

    const context = filteredDocs
      .map(d => `--- ${d.name} ---\n${d.summary}`)
      .join('\n\n');

    const prompt = `Based on the following study material, generate exactly 10 high-quality exam flashcards.
Return a JSON array: [{"front": "Question or concept term", "back": "Concise answer or definition (1-3 sentences max)"}]

Rules:
- Front should be a clear, testable question or key term.
- Back should be the direct, exam-ready answer — no padding.
- Cover a spread of topics from across the material.

Study Material:
${context}`;

    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert exam study helper. Generate raw JSON matching the requested format.",
          temperature: 0.2,
          responseMimeType: "application/json"
        },
      })
    );

    const raw = response.text.trim();
    const flashcards = JSON.parse(raw);
    
    // Support nested arrays or direct arrays depending on how the JSON is output
    const list = Array.isArray(flashcards) ? flashcards : (flashcards.flashcards || []);
    if (!Array.isArray(list)) throw new Error('Response is not an array');

    console.log(`✅ Generated ${list.length} flashcards`);
    res.json({ flashcards: list });
  } catch (err) {
    console.error('❌ Flashcard error:', err);
    res.status(500).json({ error: 'Failed to generate flashcards', detail: err.message });
  }
});

// ─── Quiz Generator ──────────────────────────────────────────────────────────
// Generates a 5-question multiple-choice quiz from session document summaries.
// Returns a JSON array: [{ question, options, answer, explanation }]
app.post('/api/quiz', async (req, res) => {
  try {
    const { group } = req.body;
    const filteredDocs = group && group !== 'All'
      ? session.documents.filter(d => (d.group || 'General') === group)
      : session.documents;

    if (filteredDocs.length === 0) {
      return res.status(400).json({ error: `Please upload a study document to the "${group || 'General'}" module first.` });
    }

    const context = filteredDocs
      .map(d => `--- ${d.name} ---\n${d.summary}`)
      .join('\n\n');

    const prompt = `Based on the following study material, generate exactly 5 multiple-choice quiz questions.
Return a JSON array: [{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "Brief explanation citing the material."}]

Rules:
- Each question must have exactly 4 options labeled A through D.
- The "answer" field must be exactly one letter: "A", "B", "C", or "D".
- Questions should test understanding, not just memorization.
- Cover different sections of the material.

Study Material:
${context}`;

    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert exam study helper. Generate raw JSON matching the requested format.",
          temperature: 0.2,
          responseMimeType: "application/json"
        },
      })
    );

    const raw = response.text.trim();
    const questions = JSON.parse(raw);
    
    const list = Array.isArray(questions) ? questions : (questions.questions || []);
    if (!Array.isArray(list)) throw new Error('Response is not an array');

    console.log(`✅ Generated ${list.length} quiz questions`);
    res.json({ questions: list });
  } catch (err) {
    console.error('❌ Quiz error:', err);
    res.status(500).json({ error: 'Failed to generate quiz', detail: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 StudyMate engine (Gemma 4) running on port ${PORT}`);
  console.log(`   Model: ${MODEL}`);
});
