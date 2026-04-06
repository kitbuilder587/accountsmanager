import fs from 'node:fs';
import type { DetectedRegion, RegionAction } from '../../shared/reel.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const CLASSIFIER_MODEL = process.env.CLASSIFIER_MODEL || 'openai/gpt-4.1-mini';

const SYSTEM_PROMPT = `You are a video content analyst. You will receive a video frame screenshot and a list of detected text regions with their positions and content.

For each region, classify it as one of:
- "replace" — this is the MAIN caption/hook text of the video (the large text viewers read first). Usually there is only ONE such region, or a few lines forming one message. Pick the primary content text.
- "mask" — this is a third-party brand, watermark, or channel name that should be covered/hidden (e.g. @username, TikTok logo text, channel watermarks)
- "keep" — this is text that's part of the video content itself (text on objects, signs, UI elements in the actual footage) and should NOT be touched

Rules:
- There should be exactly ONE group of regions marked as "replace" (the main text to rewrite)
- Small text in corners is usually a watermark → "mask"
- Text on physical objects/screens in the video → "keep"
- If unsure, prefer "keep" over "mask"

Respond with a JSON array, one entry per region:
[{"id": "xxx", "action": "replace|mask|keep", "reason": "brief explanation"}]

Only output the JSON array, nothing else.`;

interface ClassifierResult {
  id: string;
  action: RegionAction;
  reason?: string;
}

export async function classifyRegions(
  regions: DetectedRegion[],
  framePath: string,
): Promise<DetectedRegion[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn('[Classifier] OPENROUTER_API_KEY not set, defaulting all to mask');
    return regions;
  }

  if (regions.length === 0) return regions;

  // Build region descriptions
  const regionList = regions.map((r, i) => {
    const pos = r.w > 0
      ? `position [x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}]`
      : 'unknown position';
    return `${i + 1}. id="${r.id}" ${pos} text="${r.text}" confidence=${r.confidence}`;
  }).join('\n');

  // Read frame image as base64
  const imageBase64 = fs.readFileSync(framePath).toString('base64');
  const mimeType = framePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
        {
          type: 'text',
          text: `Here are the detected text regions:\n\n${regionList}\n\nClassify each region.`,
        },
      ],
    },
  ];

  console.log(`[Classifier] Sending ${regions.length} regions + frame to ${CLASSIFIER_MODEL}...`);

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Classifier API error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.warn('[Classifier] Empty response, keeping defaults');
    return regions;
  }

  // Parse JSON from response (handle markdown code blocks)
  let results: ClassifierResult[];
  try {
    const jsonStr = content.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '');
    results = JSON.parse(jsonStr);
  } catch (err) {
    console.warn('[Classifier] Failed to parse response:', content);
    return regions;
  }

  // Apply classifications to regions
  const classifiedRegions = regions.map(region => {
    const classification = results.find(r => r.id === region.id);
    if (classification) {
      const action = ['replace', 'mask', 'keep'].includes(classification.action)
        ? classification.action as RegionAction
        : region.action;
      return { ...region, action, reason: classification.reason };
    }
    return region;
  });

  const counts = { replace: 0, mask: 0, keep: 0 };
  for (const r of classifiedRegions) counts[r.action]++;
  console.log(`[Classifier] Results: ${counts.replace} replace, ${counts.mask} mask, ${counts.keep} keep`);

  return classifiedRegions;
}
