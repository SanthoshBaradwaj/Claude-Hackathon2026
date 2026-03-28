import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a balanced, neutral news prompt generator for Pulse, a collective opinion platform.

Given an array of news articles, generate one prompt object per article that invites diverse perspectives. Do NOT lead users toward any opinion. Each prompt must be concise (1-2 sentences), accessible, and provocative enough to spark genuine engagement.

Respond with ONLY a valid JSON array — no markdown, no explanation, no wrapper object. The array must have exactly one element per input article, in the same order.

Each element must match this schema exactly:
{
  "article_id": "<the id field from the input article>",
  "balanced_prompt": "neutral open-ended question",
  "specific_prompt": "targeted question on a specific aspect",
  "emotional_prompt": "question engaging emotional or values-based reasoning",
  "factual_prompt": "question about factual assessment or prediction",
  "safety_category": "safe | sensitive | flagged",
  "neutral_summary": "1-2 sentence neutral summary for display"
}`;

export interface ArticleInput {
  id: string;
  headline: string;
  description?: string;
  source?: string;
  category?: string;
}

export interface GeneratedPrompt {
  article_id: string;
  balanced_prompt: string;
  specific_prompt: string;
  emotional_prompt: string;
  factual_prompt: string;
  safety_category: string;
  neutral_summary: string;
}

const CHUNK_SIZE = 50;

export async function generatePromptsForArticles(
  articles: ArticleInput[]
): Promise<GeneratedPrompt[]> {
  if (articles.length === 0) return [];

  const chunks: ArticleInput[][] = [];
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    chunks.push(articles.slice(i, i + CHUNK_SIZE));
  }

  const results: GeneratedPrompt[] = [];
  for (const chunk of chunks) {
    const chunkResults = await callClaudeForChunk(chunk);
    results.push(...chunkResults);
  }
  return results;
}

async function callClaudeForChunk(articles: ArticleInput[]): Promise<GeneratedPrompt[]> {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  const userMessage = buildUserMessage(articles);

  let text = await callClaude(model, userMessage);
  let parsed: GeneratedPrompt[];

  try {
    parsed = parseArray(text, articles.length);
  } catch {
    // Retry once with explicit instruction
    const retryMessage =
      userMessage + '\n\nReturn only the JSON array, nothing else.';
    text = await callClaude(model, retryMessage);
    parsed = parseArray(text, articles.length);
  }

  return parsed;
}

async function callClaude(model: string, userMessage: string): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

function buildUserMessage(articles: ArticleInput[]): string {
  const payload = articles.map((a) => ({
    id: a.id,
    headline: a.headline,
    description: a.description || '',
    source: a.source || '',
    category: a.category || 'general',
  }));
  return `Generate prompts for these articles:\n${JSON.stringify(payload, null, 2)}`;
}

function parseArray(text: string, expectedCount: number): GeneratedPrompt[] {
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  const data = JSON.parse(cleaned);

  if (!Array.isArray(data)) {
    throw new Error('Claude returned a non-array response');
  }
  if (data.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} prompts, got ${data.length}`
    );
  }

  return data.map((item) => ({
    article_id: item.article_id || '',
    balanced_prompt: item.balanced_prompt || '',
    specific_prompt: item.specific_prompt || '',
    emotional_prompt: item.emotional_prompt || '',
    factual_prompt: item.factual_prompt || '',
    safety_category: item.safety_category || 'safe',
    neutral_summary: item.neutral_summary || '',
  }));
}
