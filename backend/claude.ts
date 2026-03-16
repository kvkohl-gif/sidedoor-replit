import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";

/**
 * Helper that mirrors the OpenAI chat.completions.create() call pattern
 * but routes through Claude. All callers can swap with minimal changes.
 *
 * @param opts.system  - system prompt string
 * @param opts.user    - user prompt string
 * @param opts.jsonMode - if true, instructs Claude to return valid JSON
 * @param opts.temperature - sampling temperature (0-1)
 * @param opts.maxTokens  - max tokens in response (default 4096)
 * @returns The text content of Claude's response
 */
export async function callClaude(opts: {
  system: string;
  user: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const systemPrompt = opts.jsonMode
    ? `${opts.system}\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No prose, no markdown code fences, no explanatory text before or after. Just the raw JSON object.`
    : opts.system;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.1,
    system: systemPrompt,
    messages: [
      { role: "user", content: opts.user },
    ],
  });

  // Extract text from the response
  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.text || "";

  // If JSON mode, strip any accidental markdown fences
  if (opts.jsonMode) {
    return raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  }

  return raw;
}

export { anthropic, MODEL };
