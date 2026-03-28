import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a semantic analysis engine for Pulse. Given a user's opinion response to a news prompt, extract structured semantic features.

Be precise with numerical scores. Analyze the actual content, not surface-level keywords.

Respond with ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "stance": <float -1.0 to 1.0, position from strongly against to strongly in favor>,
  "sentiment": <float -1.0 to 1.0, emotional tone from very negative to very positive>,
  "emotion": "<primary emotion: anger | hope | fear | curiosity | frustration | pride | sadness | amusement | disgust | surprise>",
  "certainty": <float 0.0 to 1.0, confidence in their position>,
  "primary_concern": "<the main issue or worry in 2-5 words>",
  "primary_value": "<core value driving position: fairness | freedom | safety | equality | tradition | progress | stability | community | efficiency | accountability>",
  "trust_level": <float 0.0 to 1.0, trust toward institutions/actors mentioned>,
  "urgency": <float 0.0 to 1.0, how urgently they feel action is needed>,
  "policy_preference": "<preferred direction: regulate | deregulate | educate | invest | restrict | maintain | reform | abolish | none>",
  "normalized_summary": "<1 sentence distilled restatement of their position>",
  "keywords": ["<3-5 key themes>"]
}`;

export interface RawFactors {
  stance: number;
  sentiment: number;
  emotion: string;
  certainty: number;
  primary_concern: string;
  primary_value: string;
  trust_level: number;
  urgency: number;
  policy_preference: string;
  normalized_summary: string;
  keywords: string[];
}

const FALLBACK: RawFactors = {
  stance: 0,
  sentiment: 0,
  emotion: 'curiosity',
  certainty: 0.5,
  primary_concern: 'general concern',
  primary_value: 'fairness',
  trust_level: 0.5,
  urgency: 0.5,
  policy_preference: 'none',
  normalized_summary: 'No clear position expressed.',
  keywords: [],
};

export async function extractFeatures(
  promptText: string,
  rawText: string
): Promise<RawFactors> {
  const userMessage = `Prompt: ${promptText}\nUser's Response: ${rawText}`;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  let text: string;
  try {
    text = await callClaude(model, userMessage);
  } catch {
    return FALLBACK;
  }

  try {
    return parseFactors(text);
  } catch {
    // Retry once
    try {
      text = await callClaude(model, userMessage);
      return parseFactors(text);
    } catch {
      return FALLBACK;
    }
  }
}

async function callClaude(model: string, userMessage: string): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return content.text;
}

function parseFactors(text: string): RawFactors {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const d = JSON.parse(cleaned);
  return {
    stance: clamp(Number(d.stance), -1, 1),
    sentiment: clamp(Number(d.sentiment), -1, 1),
    emotion: d.emotion || 'curiosity',
    certainty: clamp(Number(d.certainty), 0, 1),
    primary_concern: d.primary_concern || 'general concern',
    primary_value: d.primary_value || 'fairness',
    trust_level: clamp(Number(d.trust_level), 0, 1),
    urgency: clamp(Number(d.urgency), 0, 1),
    policy_preference: d.policy_preference || 'none',
    normalized_summary: d.normalized_summary || '',
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
  };
}

function clamp(val: number, min: number, max: number): number {
  if (isNaN(val)) return (min + max) / 2;
  return Math.min(max, Math.max(min, val));
}
