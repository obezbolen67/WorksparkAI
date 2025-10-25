#!/usr/bin/env node
/**
 * Generate local MP3 voice previews using ElevenLabs TTS.
 *
 * Requirements:
 * - Node 18+ (built-in fetch)
 * - ELEVENLABS_API_KEY must be set in environment
 *
 * Usage examples (Windows cmd):
 *   set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs
 *   set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs --voices=9BWtsMINqrJLrRacOk9x,21m00Tcm4TlvDq8ikWAM
 *   set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs --text="Hi, this is a short sample." --out="FexoApp/public/voices"
 *
 * Flags:
 *   --voices    Comma-separated voice IDs. Defaults to curated list (Aria, Rachel, Drew, Burt Reynolds™)
 *   --text      Preview text. Defaults to per-voice name phrase.
 *   --model     Model id (default: env ELEVENLABS_TTS_MODEL or 'eleven_v3')
 *   --out       Output directory (default: FexoApp/public/voices)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const curated = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew' },
  { id: '4YYIPFl9wE5c4L2eu2Gb', name: 'Burt Reynolds™' },
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--voices=')) out.voices = arg.split('=')[1];
    else if (arg.startsWith('--text=')) out.text = arg.split('=')[1];
    else if (arg.startsWith('--model=')) out.model = arg.split('=')[1];
    else if (arg.startsWith('--out=')) out.out = arg.split('=')[1];
  }
  return out;
}

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.length ? v : fallback;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeBinary(filePath, buffer) {
  await fs.writeFile(filePath, Buffer.from(buffer));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchTts({ apiKey, voiceId, text, model }) {
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const body = { text, model_id: model };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = 'unknown_error';
    try {
      const txt = await resp.text();
      detail = JSON.parse(txt)?.detail?.status || JSON.parse(txt)?.error || txt;
    } catch (_) {}
    throw new Error(`TTS failed for ${voiceId}: ${resp.status} ${detail}`);
  }

  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = getEnv('ELEVENLABS_API_KEY');
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY is required. Set it in your environment.');
    process.exit(1);
  }

  const outDir = path.resolve(args.out || path.join(__dirname, '..', 'public', 'voices'));
  const model = args.model || getEnv('ELEVENLABS_TTS_MODEL', 'eleven_v3');

  let voices;
  if (args.voices) {
    const ids = args.voices.split(',').map(s => s.trim()).filter(Boolean);
    // Map IDs to name placeholders for text interpolation
    voices = ids.map(id => ({ id, name: id }));
  } else {
    voices = curated;
  }

  await ensureDir(outDir);
  console.log(`[generator] Output dir: ${outDir}`);
  console.log(`[generator] Model: ${model}`);

  for (const v of voices) {
    const text = args.text || `Hi, I am ${v.name}. This is a sample of my voice.`;
    const target = path.join(outDir, `${v.id}.mp3`);

    // Skip if file exists
    try {
      await fs.access(target);
      console.log(`[generator] Skip existing ${path.basename(target)}`);
      continue;
    } catch (_) {}

    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[generator] (${attempt}/${maxAttempts}) Fetching ${v.id} ...`);
        const buf = await fetchTts({ apiKey, voiceId: v.id, text, model });
        await writeBinary(target, buf);
        console.log(`[generator] Saved ${path.basename(target)} (${(buf.length/1024).toFixed(1)} KB)`);
        // brief spacing to be gentle with rate limits
        await sleep(400);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[generator] Error: ${msg}`);
        if (attempt < maxAttempts) {
          const backoff = 800 * attempt;
          console.log(`[generator] Retrying after ${backoff}ms...`);
          await sleep(backoff);
        } else {
          console.error(`[generator] Failed to fetch preview for ${v.id} after ${maxAttempts} attempts.`);
        }
      }
    }
  }

  console.log('[generator] Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
