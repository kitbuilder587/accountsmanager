const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'openai/gpt-4.1-mini';

const SYSTEM_PROMPT = `You are a creative copywriter for short video content.
Your task: take the original text from a video reel and create a new, engaging Russian-language version.

Rules:
- Keep the same general meaning/topic but make it fresh and catchy
- Write in Russian
- Keep it short and punchy (suitable for video overlay text)
- Do not use hashtags
- Return ONLY the new text, nothing else`;

export async function generateText(originalText: string): Promise<string> {
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
        { role: 'user', content: `Original text from video:\n\n${originalText}\n\nCreate a new Russian version:` },
      ],
      max_tokens: 200,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} — ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const generated = data.choices?.[0]?.message?.content?.trim();
  if (!generated) {
    throw new Error('OpenRouter returned empty response');
  }

  return generated;
}
