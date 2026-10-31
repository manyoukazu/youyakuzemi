"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { PROVIDER_LABELS, connectionReady, type AIConfig, type Provider } from "../lib/ai-config";

type Model = { id: string; name: string };
const SERVICES: Record<Provider, { name: string; keyUrl: string }> = {
  gemini: { name: "Gemini", keyUrl: "https://aistudio.google.com/apikey" },
  openai: { name: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" }
};
export default function AISettings({ initial, locked, onSave, onCancel }: {
  initial: AIConfig; locked: boolean; onSave: (config: AIConfig) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AIConfig>(() => structuredClone(initial));
  const [models, setModels] = useState<Record<Provider, Model[]>>({ gemini: [], openai: [] });
  const [loading, setLoading] = useState<Provider | null>(null), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const provider = draft.provider, service = SERVICES[provider], model = draft.models[provider];
  const choices = models[provider];
  function setProvider(value: Provider) {
    request.current?.abort(); setLoading(null); setError("");
    setDraft(c => ({ ...c, provider: value }));
  }
  function setKey(value: string) {
    request.current?.abort(); setLoading(null); setError("");
    setModels(old => ({ ...old, [provider]: [] }));
    setDraft(c => ({ ...c, keys: { ...c.keys, [provider]: value } }));
  }
  function setModel(value: string) { setError(""); setDraft(c => ({ ...c, models: { ...c.models, [provider]: value } })); }
  async function loadModels() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(provider); setError("");
    try {
      const response = await fetch("/api/models", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": draft.keys[provider].trim() },
        body: JSON.stringify({ provider }), signal: controller.signal
      });
      const data = await response.json() as { models?: Model[]; error?: string };
      if (!response.ok || !Array.isArray(data.models)) throw new Error(data.error || "モデル一覧を取得できませんでした。");
      if (request.current !== controller) return;
      const fetchedModels = data.models; setModels(old => ({ ...old, [provider]: fetchedModels }));
      if (!fetchedModels.length) setError("このAPIキーで取得できるモデルがありません。利用権限をご確認ください。");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "モデル一覧を取得できませんでした。"); }
    finally { if (request.current === controller) setLoading(null); }
  }
  return <form className="ai-settings-form" onSubmit={e => {
    e.preventDefault();
    if (!connectionReady(draft)) { setError("APIキーと要約モデルを設定してください。"); return; }
    onSave(draft);
  }}>
    <p className="modal-lead">使うAIを選び、APIキーとモデルを設定してください。</p>
    <label className="field-label" htmlFor="ai-provider">使うAI</label>
    <select id="ai-provider" className="form-input" value={provider} disabled={locked} onChange={e => setProvider(e.target.value as Provider)}>
      {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
    </select>

    <label className="field-label" htmlFor="api-key">APIキー</label>
    <input className="form-input" id="api-key" type="password" value={draft.keys[provider]}
      onChange={e => setKey(e.target.value)} autoComplete="off" spellCheck={false}
      placeholder={`${service.name}のAPIキーを入力`} aria-describedby="api-key-hint" required disabled={locked} />
    <p className="field-hint" id="api-key-hint">{service.name}のAPIキーを使用します。
      <a href={service.keyUrl} target="_blank" rel="noreferrer">{service.name}のAPIキーを取得 ↗</a>
    </p>

    <label className="field-label" htmlFor="summary-model">要約モデル</label>
    <div className="model-toolbar">
      <select id="summary-model" className="form-input" disabled={locked} value={model} onChange={e => setModel(e.target.value)}>
        <option value="" disabled>モデルを選択</option>
        {model && !choices.some(m => m.id === model) && <option value={model}>{model}{choices.length ? "（一覧外の指定）" : ""}</option>}
        {choices.map(m => <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} · ${m.id}`}</option>)}
      </select>
      <button type="button" className="button" aria-label="モデル一覧を取得" disabled={locked || loading !== null || !draft.keys[provider].trim()} onClick={() => void loadModels()}>
        {loading !== null ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}一覧を取得
      </button>
    </div>
    {choices.length > 0 ? <span className="model-count" role="status">{choices.length}モデルを取得済み・全件表示</span> : <p className="field-hint">APIキーを入力すると、利用可能なモデルの一覧を取得できます。</p>}
    <details className="model-custom">
      <summary>モデルIDを直接入力</summary>
      <label className="field-label" htmlFor="custom-model-id">モデルID</label>
      <input id="custom-model-id" className="form-input model-id" disabled={locked} value={model}
        onChange={e => setModel(e.target.value)} placeholder="モデルIDを入力" autoComplete="off" spellCheck={false} />
    </details>
    <p className="field-hint">文章の要約に対応したモデルを選んでください。
      {provider === "gemini" && "Geminiでは音声入力にも対応したモデルが必要です。"}
    </p>

    {error && <p className="settings-error" role="alert">{error}</p>}
    {locked && <p className="field-hint">収音・要約が終わるか、エラーで一時停止した後に設定を変更できます。</p>}
    <div className="privacy-box"><ShieldCheck size={20} /><div>
      <strong>APIキーは、このページを開いている間だけ保持。</strong>
      <p>音声と文字起こしは選択したAIに送信します。各社APIの利用条件・料金が適用されます。</p>
    </div></div>
    <div className="modal-actions">
      <button type="button" className="button" onClick={onCancel}>閉じる</button>
      <button className="button primary" type="submit" disabled={locked}><Check size={16} />設定を保存</button>
    </div>
  </form>;
}
