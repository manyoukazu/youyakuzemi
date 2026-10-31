export type Provider = "gemini" | "openai";
export type AIConfig = {
  provider: Provider;
  keys: Record<Provider, string>;
  models: Record<Provider, string>;
};
export const PROVIDER_LABELS: Record<Provider, string> = { gemini: "Gemini", openai: "ChatGPT（OpenAI）" };
export function defaultAIConfig(): AIConfig { return {
  provider: "gemini", keys: { gemini: "", openai: "" },
  models: { gemini: "gemini-3.8-flash", openai: "gpt-6-luna" }
}; }
export function connectionReady(c: AIConfig): boolean {
  return !!(c.keys[c.provider].trim() && c.models[c.provider].trim());
}
export function requestSettings(c: AIConfig) {
  return { provider: c.provider, model: c.models[c.provider].trim() };
}
export function requestHeaders(c: AIConfig) {
  return { "Content-Type": "application/json", "x-api-key": c.keys[c.provider].trim() };
}
export function destinationLabel(c: AIConfig) { return PROVIDER_LABELS[c.provider]; }
