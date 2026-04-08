const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'openai/gpt-4.1-mini';

const SYSTEM_PROMPT = `You are a creative copywriter for short video content (Reels/Shorts).
Given the original text from a video, generate content for repackaging it in Russian.

Return a JSON object with exactly these fields:
{
  "overlayText": "Short punchy text for the video overlay (1-2 lines, max 60 chars)",
  "title": "Catchy YouTube Shorts title in Russian (max 100 chars, SEO-optimized)",
  "description": "YouTube/Instagram description in Russian (2-3 sentences, include a call to action)",
  "hashtags": "#хэштег1 #хэштег2 #хэштег3 (5-8 relevant hashtags in Russian)"
}

Rules:
- ALL text must be in Russian
- overlayText: very short, bold, attention-grabbing — this goes ON the video
- title: optimized for YouTube search, use emotional hooks (цифры, вопросы, "как", "почему")
- description: informative, include CTA like "Подписывайтесь!" or "Ставьте лайк!"
- hashtags: mix of broad (#shorts #рилс) and topic-specific tags
- Return ONLY valid JSON, no markdown, no explanation`;

export interface GeneratedContent {
  overlayText: string;
  title: string;
  description: string;
  hashtags: string;
}

export async function generateContent(originalText: string): Promise<GeneratedContent> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Original text from video:\n\n${originalText}\n\nGenerate Russian content:` },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenRouter returned empty response');
  }

  try {
    const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);

    return {
      overlayText: parsed.overlayText || parsed.overlay_text || content,
      title: parsed.title || '',
      description: parsed.description || '',
      hashtags: parsed.hashtags || '',
    };
  } catch {
    // Fallback: treat entire response as overlay text
    return {
      overlayText: content,
      title: content.slice(0, 100),
      description: content,
      hashtags: '#shorts #рилс #видео',
    };
  }
}

// Backward-compatible wrapper
export async function generateText(originalText: string): Promise<string> {
  const result = await generateContent(originalText);
  return result.overlayText;
}
