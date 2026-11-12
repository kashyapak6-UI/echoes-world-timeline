// Client-safe provider list (no secrets). Model names are suggestions — check the provider's docs for current ones.
export type ProviderId = "openai" | "anthropic" | "gemini" | "xai" | "openrouter" | "custom";
export const PROVIDERS: { id: ProviderId; label: string; baseUrl: string; model: string; keyUrl: string; note?: string }[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", keyUrl: "https://aistudio.google.com/app/apikey", note: "Uses Gemini's OpenAI-compatible endpoint." },
  { id: "xai", label: "xAI", baseUrl: "https://api.x.ai/v1", model: "grok-3-mini", keyUrl: "https://console.x.ai" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto", keyUrl: "https://openrouter.ai/keys" },
  { id: "custom", label: "Other (OpenAI-compatible)", baseUrl: "", model: "", keyUrl: "", note: "Any /chat/completions endpoint: enter its base URL and model." },
];
export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id);
