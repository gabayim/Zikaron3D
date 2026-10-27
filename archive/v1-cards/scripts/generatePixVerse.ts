/**
 * Zikaron3D - Automated PixVerse Asset Pipeline
 * Batch generates 1:1 square, 720p, 5-second living diorama animations with native audio enabled
 * using the PixVerse V6 REST API (https://app-api.pixverse.ai/openapi/v2/video/text/generate).
 *
 * Usage:
 *   npx tsx scripts/generatePixVerse.ts                # Generate all missing cards
 *   npx tsx scripts/generatePixVerse.ts --card ruby_gem  # Generate specific card
 *   npx tsx scripts/generatePixVerse.ts --force        # Re-generate existing cards
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import process from 'process';

// Load .env variables if present
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

interface CardPromptConfig {
  id: string;
  name: string;
  prompt: string;
}

interface ManifestEntry {
  id: string;
  name: string;
  file: string;
  url?: string;
  videoId?: number;
  frame0?: string;
  optimized?: string;
}

interface GenerationJob {
  card: CardPromptConfig;
  videoId: number;
  traceId: string;
}

const CARDS_DIR = path.resolve(process.cwd(), 'assets/cards');
const MANIFEST_PATH = path.join(CARDS_DIR, 'manifest.json');
const PIXVERSE_BASE_URL = 'https://app-api.pixverse.ai';
const GENERATE_ENDPOINT = `${PIXVERSE_BASE_URL}/openapi/v2/video/text/generate`;
const RESULT_ENDPOINT_PREFIX = `${PIXVERSE_BASE_URL}/openapi/v2/video/result/`;

const POLL_INTERVAL_MS = 6_000; // 6 seconds
const MAX_POLL_ATTEMPTS = 50; // ~5 minutes per job
const MAX_CONCURRENT_JOBS = 4; // Safety limit below PixVerse cap of 5

const CARD_PROMPTS: CardPromptConfig[] = [
  {
    id: 'ruby_gem',
    name: 'Ruby Gem',
    prompt:
      'A radiant floating 3D ruby gemstone diorama, glowing crimson crystal facets refracting warm light, cinematic studio lighting, floating ruby sparks, 1:1 square, ultra high quality, seamless 3D artifact motion',
  },
  {
    id: 'cosmic_star',
    name: 'Cosmic Star',
    prompt:
      'A glowing cosmic star diorama, pulsing celestial cyan light, revolving star clusters, stellar nebulas drifting, cinematic 3D render, 1:1 square, hyper-detailed, ethereal living card',
  },
  {
    id: 'golden_ring',
    name: 'Golden Ring',
    prompt:
      'An ornate ancient golden ring floating in zero gravity, pure gold engravings glowing, spinning slowly, golden stardust motes, luxury 3D render, 1:1 square',
  },
  {
    id: 'crystal_prism',
    name: 'Crystal Prism',
    prompt:
      'A towering crystalline prism floating in an ethereal void, casting rainbow prismatic refractions, amethyst and quartz glow, 3D diorama, 1:1 square',
  },
  {
    id: 'sacred_flame',
    name: 'Sacred Flame',
    prompt:
      'A sacred eternal flame dancing on a dark volcanic altar, vibrant orange and violet embers swirling, cinematic slow motion, 3D diorama, 1:1 square',
  },
  {
    id: 'water_drop',
    name: 'Water Drop',
    prompt:
      'A pristine crystal water droplet suspended in mid-air, ripples forming on surface, deep sapphire reflections, liquid glass physics, 3D diorama, 1:1 square',
  },
  {
    id: 'emerald_leaf',
    name: 'Emerald Leaf',
    prompt:
      'A mystical glowing emerald leaf carved from jade, vibrant neon green veins pulsing with nature energy, dew drops, 3D diorama, 1:1 square',
  },
  {
    id: 'lightning_orb',
    name: 'Lightning Orb',
    prompt:
      'A crackling electric plasma orb, bright yellow and electric violet lightning arcs leaping within glass sphere, energy pulses, 3D diorama, 1:1 square',
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, (response: http.IncomingMessage) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return resolve(downloadFile(response.headers.location, destPath));
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err: Error) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Call PixVerse V6 Text-to-Video API
 * POST https://app-api.pixverse.ai/openapi/v2/video/text/generate
 */
async function requestVideoGeneration(
  apiKey: string,
  prompt: string
): Promise<{ videoId: number; traceId: string }> {
  const traceId = crypto.randomUUID();
  const payload = JSON.stringify({
    model: 'v6',
    prompt,
    quality: '720p',
    aspect_ratio: '1:1',
    duration: 5,
    generate_audio_switch: true,
  });

  const response = await fetch(GENERATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'API-KEY': apiKey,
      'Ai-trace-id': traceId,
      'Content-Type': 'application/json',
    },
    body: payload,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PixVerse API HTTP ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as any;

  if (data?.ErrCode !== 0) {
    throw new Error(
      `PixVerse generation error [${data?.ErrCode}]: ${data?.ErrMsg || 'Unknown error'}`
    );
  }

  const videoId = data?.Resp?.video_id;
  if (!videoId) {
    throw new Error(`PixVerse did not return a valid video_id: ${JSON.stringify(data)}`);
  }

  return { videoId, traceId };
}

/**
 * Poll PixVerse task status until finished
 * GET https://app-api.pixverse.ai/openapi/v2/video/result/{video_id}
 */
async function pollTaskResult(
  apiKey: string,
  videoId: number
): Promise<{ status: number; videoUrl: string | null; errMsg?: string }> {
  const traceId = crypto.randomUUID();
  const url = `${RESULT_ENDPOINT_PREFIX}${videoId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'API-KEY': apiKey,
        'Ai-trace-id': traceId,
      },
    });

    if (!response.ok) {
      return { status: -1, videoUrl: null, errMsg: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as any;

    if (data?.ErrCode !== 0) {
      return {
        status: -1,
        videoUrl: null,
        errMsg: `ErrCode ${data?.ErrCode}: ${data?.ErrMsg}`,
      };
    }

    // Status codes:
    // 1 = Completed
    // 5 = Generating
    // 7 = Moderation failed
    // 8 = Generation failed
    const status = typeof data?.Resp?.status === 'number' ? data.Resp.status : 5;
    const videoUrl = data?.Resp?.url || null;

    return { status, videoUrl };
  } catch (err: any) {
    return { status: -1, videoUrl: null, errMsg: err.message };
  }
}

async function main() {
  const apiKey = process.env.PIXVERSE_API_KEY;

  if (!apiKey || apiKey === 'your_pixverse_api_key_here') {
    console.error('===========================================================');
    console.error(' ERROR: Missing PIXVERSE_API_KEY in environment or .env');
    console.error(' Please set PIXVERSE_API_KEY in your .env file or shell:');
    console.error(' export PIXVERSE_API_KEY="your_actual_api_key"');
    console.error('===========================================================');
    process.exit(1);
  }

  if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
  }

  // Load existing manifest
  let manifest: Record<string, ManifestEntry> = {};
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch {}
  }

  const args = process.argv.slice(2);
  const isForce = args.includes('--force');
  const targetCardIndex = args.indexOf('--card');
  const targetCardId = targetCardIndex !== -1 ? args[targetCardIndex + 1] : null;

  const targetCards = targetCardId
    ? CARD_PROMPTS.filter((c) => c.id === targetCardId)
    : CARD_PROMPTS;

  if (targetCardId && targetCards.length === 0) {
    console.error(`Error: Unknown card id "${targetCardId}".`);
    console.error(`Available ids: ${CARD_PROMPTS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  // Filter missing cards
  const cardsToGenerate = targetCards.filter((card) => {
    const destPath = path.join(CARDS_DIR, `${card.id}.mp4`);
    if (fs.existsSync(destPath) && !isForce) {
      console.log(`✓ [${card.id}] Already exists at ${destPath} — skipping`);
      manifest[card.id] = manifest[card.id] ?? {
        id: card.id,
        name: card.name,
        file: `assets/cards/${card.id}.mp4`,
      };
      return false;
    }
    return true;
  });

  if (cardsToGenerate.length === 0) {
    console.log(`\n✓ All ${targetCards.length} requested cards already generated.`);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`\n======================================================`);
  console.log(`  Zikaron3D - PixVerse V6 Living Card Video Pipeline`);
  console.log(`  Endpoint: ${GENERATE_ENDPOINT}`);
  console.log(`  Resolution: 720p | Ratio: 1:1 | Duration: 5s | Audio: ON`);
  console.log(`  Cards to generate: ${cardsToGenerate.length}`);
  console.log(`======================================================\n`);

  // Batch submission with concurrency control
  const activeJobs: GenerationJob[] = [];
  const completedJobs: { card: CardPromptConfig; videoUrl: string; videoId: number }[] = [];
  const failedCardIds: string[] = [];

  let nextIndex = 0;

  while (nextIndex < cardsToGenerate.length || activeJobs.length > 0) {
    // Fill active slots up to MAX_CONCURRENT_JOBS
    while (activeJobs.length < MAX_CONCURRENT_JOBS && nextIndex < cardsToGenerate.length) {
      const card = cardsToGenerate[nextIndex++];
      process.stdout.write(`  [${card.id}] Submitting text-to-video request... `);
      try {
        const { videoId, traceId } = await requestVideoGeneration(apiKey, card.prompt);
        activeJobs.push({ card, videoId, traceId });
        console.log(`✓ video_id=${videoId}`);
      } catch (err: any) {
        console.log(`✗ Error: ${err.message}`);
        failedCardIds.push(card.id);
      }
      // Brief pause between submissions
      await sleep(1000);
    }

    if (activeJobs.length === 0) break;

    // Wait before polling cycle
    await sleep(POLL_INTERVAL_MS);

    // Poll active jobs
    for (let i = activeJobs.length - 1; i >= 0; i--) {
      const job = activeJobs[i];
      const { status, videoUrl, errMsg } = await pollTaskResult(apiKey, job.videoId);

      if (status === 1 && videoUrl) {
        console.log(`  ✓ [${job.card.id}] Rendering complete! video_id=${job.videoId}`);
        completedJobs.push({ card: job.card, videoUrl, videoId: job.videoId });
        activeJobs.splice(i, 1);
      } else if (status === 7) {
        console.error(`  ✗ [${job.card.id}] Moderation check failed`);
        failedCardIds.push(job.card.id);
        activeJobs.splice(i, 1);
      } else if (status === 8) {
        console.error(`  ✗ [${job.card.id}] Generation failed on server`);
        failedCardIds.push(job.card.id);
        activeJobs.splice(i, 1);
      } else if (status === -1) {
        console.warn(`  ⚠ [${job.card.id}] Polling warning: ${errMsg}`);
      } else {
        process.stdout.write(`  [${job.card.id}] Rendering in progress (status: ${status})...\n`);
      }
    }
  }

  // Download all completed videos
  if (completedJobs.length > 0) {
    console.log(`\n━━━ Downloading ${completedJobs.length} Video Assets ━━━\n`);
  }

  for (const item of completedJobs) {
    const destPath = path.join(CARDS_DIR, `${item.card.id}.mp4`);
    process.stdout.write(`  [${item.card.id}] Downloading to ${destPath}... `);
    try {
      await downloadFile(item.videoUrl, destPath);
      const sizeBytes = fs.statSync(destPath).size;
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      console.log(`✓ (${sizeMb} MB)`);

      manifest[item.card.id] = {
        id: item.card.id,
        name: item.card.name,
        file: `assets/cards/${item.card.id}.mp4`,
        url: item.videoUrl,
        videoId: item.videoId,
      };
    } catch (err: any) {
      console.log(`✗ Download failed: ${err.message}`);
      failedCardIds.push(item.card.id);
    }
  }

  // Update manifest file
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n======================================================`);
  console.log(`  Asset Pipeline Run Completed`);
  console.log(`  ✓ Success: ${completedJobs.length}`);
  if (failedCardIds.length > 0) {
    console.log(`  ✗ Failed:  ${failedCardIds.length} (${failedCardIds.join(', ')})`);
  }
  console.log(`  Manifest saved: ${MANIFEST_PATH}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
