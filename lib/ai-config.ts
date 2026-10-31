export type Provider = "gemini" | "openai" | "anthropic";
export type SpeechProvider = "direct" | "gemini" | "openai";
export type AIConfig = {
  provider: Provider;
  keys: Record<Provider, string>;
  models: Record<Provider, string>;
  speechProvider: SpeechProvider;
  speechModels: Record<"gemini" | "openai", string>;
  openaiApi: "responses" | "chat";
};
export const PROVIDER_LABELS: Record<Provider, string> = { gemini: "Gemini", openai: "OpenAI（ChatGPT）", anthropic: "Anthropic（Claude）" };
export function defaultAIConfig(): AIConfig { return {
  provider: "gemini", keys: { gemini: "", openai: "", anthropic: "" },
  models: { gemini: "gemini-3.8-flash", openai: "gpt-6-luna", anthropic: "claude-haiku-5-5" },
  speechProvider: "direct", speechModels: { gemini: "gemini-3.8-flash", openai: "gpt-transcribe" }, openaiApi: "responses"
}; }
export function connectionReady(c: AIConfig): boolean {
  return !!(c.keys[c.provider].trim() && c.models[c.provider].trim()
    && (c.speechProvider === "direct" ? c.provider === "gemini" : c.keys[c.speechProvider].trim() && c.speechModels[c.speechProvider].trim()));
}
export function requestSettings(c: AIConfig) {
  return { provider: c.provider, model: c.models[c.provider].trim(), speechProvider: c.speechProvider,
    speechModel: c.speechProvider === "direct" ? "" : c.speechModels[c.speechProvider].trim(), openaiApi: c.openaiApi };
}
export function requestHeaders(c: AIConfig) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": c.keys[c.provider].trim() };
  if (c.speechProvider !== "direct" && c.speechProvider !== c.provider) headers["x-speech-api-key"] = c.keys[c.speechProvider].trim();
  return headers;
}
export function destinationLabel(c: AIConfig) {
  const summary = PROVIDER_LABELS[c.provider];
  return c.speechProvider === "direct" || c.speechProvider === c.provider ? summary : `${PROVIDER_LABELS[c.speechProvider]}（音声）・${summary}（文字起こし）`;
}
