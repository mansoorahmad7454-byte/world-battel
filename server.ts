import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const EDGE_FEMALE_VOICES: Record<string, string> = {
  en: 'en-US-AriaNeural',
  ur: 'ur-PK-UzmaNeural',
  hi: 'hi-IN-SwaraNeural',
  ru: 'ru-RU-SvetlanaNeural',
  ar: 'ar-SA-ZariyahNeural',
  tr: 'tr-TR-EmelNeural',
  es: 'es-ES-ElviraNeural',
  fr: 'fr-FR-DeniseNeural',
  de: 'de-DE-TanjaNeural',
  pt: 'pt-BR-FranciscaNeural',
  ja: 'ja-JP-NanamiNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
};

const LANGUAGE_STYLE_NAMES: Record<string, string> = {
  en: 'energetic English',
  ur: 'passionate native Pakistani Urdu',
  hi: 'passionate native Indian Hindi',
  ru: 'passionate native Russian',
  ar: 'passionate native Arabic',
  tr: 'passionate native Turkish',
  es: 'passionate native Spanish',
  fr: 'passionate native French',
  de: 'passionate native German',
  pt: 'passionate native Portuguese',
  ja: 'passionate native Japanese',
  zh: 'passionate native Mandarin Chinese',
};

const TTS_LANG_TAGS: Record<string, string> = {
  en: 'en',
  ur: 'ur',
  hi: 'hi',
  ru: 'ru',
  ar: 'ar',
  tr: 'tr',
  es: 'es',
  fr: 'fr',
  de: 'de',
  pt: 'pt',
  ja: 'ja',
  zh: 'zh-CN',
};

interface CachedAudio {
  audio: string;
  mimeType: string;
}

const ttsCache = new Map<string, CachedAudio>();
const MAX_CACHE_ENTRIES = 220;
let geminiTtsDisabled = false;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function synthesizeEdgeNeuralTts(
  text: string,
  lang: string,
  emotion: string
): Promise<CachedAudio | null> {
  const voiceName = EDGE_FEMALE_VOICES[lang] || EDGE_FEMALE_VOICES.en;
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 7000,
    synthesisTimeoutMs: 12000,
  });

  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const rate = emotion === 'victory' ? '+6%' : emotion === 'countdown' ? '+8%' : '+4%';
    const pitch = emotion === 'victory' ? '+2Hz' : 'default';
    const { audioStream } = tts.toStream(escapeXml(text), { rate, pitch });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    if (combined.length === 0) return null;

    return {
      audio: combined.toString('base64'),
      mimeType: 'audio/mpeg',
    };
  } catch {
    return null;
  } finally {
    try {
      tts.close();
    } catch {
      // ignore socket close errors
    }
  }
}

function splitTextChunks(text: string, maxLen = 175): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function fetchMultilingualFallbackAudio(text: string, lang: string): Promise<CachedAudio | null> {
  const tl = TTS_LANG_TAGS[lang] || 'en';
  const chunks = splitTextChunks(text, 175);
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!resp.ok) return null;
    const arr = await resp.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }

  if (buffers.length === 0) return null;
  const combined = Buffer.concat(buffers);
  return {
    audio: combined.toString('base64'),
    mimeType: 'audio/mpeg',
  };
}

app.post('/api/tts', async (req, res) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : 'en';
    const emotion = typeof req.body?.emotion === 'string' ? req.body.emotion : 'excited';

    if (!rawText) {
      res.status(400).json({ error: 'Missing text for TTS' });
      return;
    }

    const text = rawText.slice(0, 380);
    const cacheKey = `${lang}:${emotion}:${text}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ audio: cached.audio, mimeType: cached.mimeType, cached: true });
      return;
    }

    // 1. Primary: Realistic Neural Female Voices (Urdu, Hindi, English & all 12 languages)
    let result: CachedAudio | null = await synthesizeEdgeNeuralTts(text, lang, emotion);

    // 2. Secondary: Gemini TTS if available on the active billing tier
    if (!result && process.env.GEMINI_API_KEY && !geminiTtsDisabled) {
      try {
        const langLabel = LANGUAGE_STYLE_NAMES[lang] || 'energetic English';
        const styleInstruction =
          emotion === 'victory'
            ? `Triumphant, thrilled female Formula 1 sports commentator celebrating a dramatic win in ${langLabel}. Clear pronunciation, natural cadence, stadium excitement.`
            : emotion === 'countdown'
              ? `Crisp, commanding female Formula 1 race starter counting down in ${langLabel}. Clear punchy delivery.`
              : `Excited, fluent female Formula 1 sports broadcaster calling live wheel-to-wheel action in ${langLabel}. Smooth, confident, expressive without hesitation.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: {
                    style: styleInstruction,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          result = { audio: base64Audio, mimeType: 'audio/wav' };
        }
      } catch (geminiErr) {
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        if (
          msg.includes('403') ||
          msg.includes('PERMISSION_DENIED') ||
          msg.includes('API_KEY_INVALID') ||
          msg.includes('billing')
        ) {
          if (!geminiTtsDisabled) {
            geminiTtsDisabled = true;
            console.warn('Gemini TTS unavailable on current project tier; relying on Neural TTS & audio fallback.');
          }
        }
      }
    }

    // 3. Final network backup
    if (!result) {
      result = await fetchMultilingualFallbackAudio(text, lang);
    }

    if (!result) {
      res.json({ audio: null, fallback: 'browser' });
      return;
    }

    if (ttsCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey) ttsCache.delete(oldestKey);
    }
    ttsCache.set(cacheKey, result);

    res.json({ audio: result.audio, mimeType: result.mimeType });
  } catch {
    res.json({ audio: null, fallback: 'browser' });
  }
});

interface ServerHallEntry {
  code: string;
  name: string;
  wins: number;
  arenaWins: number;
  raceWins: number;
  warWins: number;
  fighterWins?: number;
  lastWinAt: number;
}

const HOF_FILE = path.join(os.tmpdir(), 'flags_war_hall_of_fame_v1.json');

function readServerHof(): ServerHallEntry[] {
  try {
    if (!fs.existsSync(HOF_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(HOF_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeServerHof(entries: ServerHallEntry[]): void {
  try {
    const sorted = [...entries].sort((a, b) =>
      b.wins !== a.wins ? b.wins - a.wins : b.lastWinAt - a.lastWinAt
    );
    fs.writeFileSync(HOF_FILE, JSON.stringify(sorted), 'utf-8');
  } catch {
    // ignore disk errors
  }
}

app.get('/api/hall-of-fame', (_req, res) => {
  res.json({ entries: readServerHof() });
});

app.post('/api/hall-of-fame', (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : code;
  const source = typeof req.body?.source === 'string' ? req.body.source : 'arena';
  if (!code) {
    res.status(400).json({ error: 'Missing country code' });
    return;
  }

  const list = readServerHof();
  const now = Date.now();
  let found = list.find((e) => e.code === code);
  if (!found) {
    found = {
      code,
      name,
      wins: 0,
      arenaWins: 0,
      raceWins: 0,
      warWins: 0,
      fighterWins: 0,
      lastWinAt: now,
    };
    list.push(found);
  }
  found.name = name || found.name;
  found.wins += 1;
  if (source === 'arena') found.arenaWins += 1;
  else if (source === 'carrace') found.raceWins += 1;
  else if (source === 'warmap') found.warWins += 1;
  else if (source === 'fighter') found.fighterWins = (found.fighterWins || 0) + 1;
  found.lastWinAt = now;

  writeServerHof(list);
  res.json({ entries: readServerHof() });
});

app.delete('/api/hall-of-fame', (_req, res) => {
  writeServerHof([]);
  res.json({ entries: [] });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flags War Arena server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
