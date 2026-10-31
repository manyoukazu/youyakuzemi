"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { PROVIDER_LABELS, connectionReady, type AIConfig, type Provider, type SpeechProvider } from "../lib/ai-config";

type Model = { id: string; name: string };
const KEY_LINKS = { gemini: "https://aistudio.google.com/apikey", openai: "https://platform.openai.com/api-keys" };
const KEY_LABELS = { gemini: "Gemini APIキー", openai: "OpenAI APIキー" };
function ModelPicker({ id, label, value, models, loading, disabled, canLoad, onLoad, onChange }: {
  id: string; label: string; value: string; models: Model[]; loading: boolean; disabled: boolean; canLoad: boolean;
  onLoad: () => void; onChange: (value: string) => void;
}) {
  return <div className="model-picker"><label className="field-label" htmlFor={id}>{label}</label>
    <div className="model-toolbar"><select className="form-input" aria-label={`${label}の一覧`} disabled={disabled || !models.length} value={models.some(m => m.id === value) ? value : ""} onChange={e => onChange(e.target.value)}>
      <option disabled value="">{models.length ? "一覧から選択" : "一覧を取得すると選択できます"}</option>
      {models.map(m => <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} · ${m.id}`}</option>)}
    </select><button type="button" className="button" aria-label={`${label}一覧を取得`} disabled={disabled || loading || !canLoad} onClick={onLoad}>{loading ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}一覧を取得</button></div>
    <input id={id} className="form-input model-id" aria-label={`${label}ID`} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} placeholder="モデルIDを直接入力することもできます" required autoComplete="off" spellCheck={false} />
    {models.length > 0 && <span className="model-count">{models.length}モデルを取得済み</span>}
  </div>;
}
export default function AISettings({ initial, locked, onSave, onCancel }: { initial: AIConfig; locked: boolean; onSave: (config: AIConfig) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<AIConfig>(() => structuredClone(initial));
  const [models, setModels] = useState<Record<Provider, Model[]>>({ gemini: [], openai: [] });
  const [loading, setLoading] = useState<Provider | null>(null), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const provider = draft.provider;
  function setProvider(value: Provider) { request.current?.abort(); setLoading(null); setError(""); setDraft(c => ({ ...c, provider: value, speechProvider: value === "gemini" ? "direct" : "openai" })); }
  function setKey(p: Provider, value: string) { request.current?.abort(); setLoading(null); setError(""); setModels(old => ({ ...old, [p]: [] })); setDraft(c => ({ ...c, keys: { ...c.keys, [p]: value } })); }
  async function loadModels(p: Provider) {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setLoading(p); setError("");
    try {
      const response = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": draft.keys[p].trim() }, body: JSON.stringify({ provider: p }), signal: controller.signal });
      const data = await response.json() as { models?: Model[]; error?: string }; if (!response.ok || !Array.isArray(data.models)) throw new Error(data.error || "モデル一覧を取得できませんでした。");
      if (request.current !== controller) return;
      const fetchedModels = data.models; setModels(old => ({ ...old, [p]: fetchedModels }));
      if (!data.models.length) setError("このAPIキーで取得できるモデルがありません。利用権限をご確認ください。");
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "モデル一覧を取得できませんでした。"); }
    finally { if (request.current === controller) setLoading(null); }
  }
  function keyField(p: Provider) { return <div className="key-field"><label className="field-label" htmlFor={`key-${p}`}>{KEY_LABELS[p]}</label><input className="form-input" id={`key-${p}`} type="password" value={draft.keys[p]} onChange={e => setKey(p, e.target.value)} autoComplete="off" spellCheck={false} placeholder="APIキーを入力" required disabled={locked} /><p className="field-hint"><a href={KEY_LINKS[p]} target="_blank" rel="noreferrer">APIキーを取得 ↗</a></p></div>; }
  return <form className="ai-settings-form" onSubmit={e => { e.preventDefault(); if (!connectionReady(draft)) { setError("要約と文字起こしに必要なAPIキー・モデルIDを入力してください。"); return; } onSave(draft); }}>
    <p className="modal-lead">要約に使うAIとモデルを選んでください。</p>
    <label className="field-label" htmlFor="ai-provider">要約に使うAI</label><select id="ai-provider" className="form-input" value={provider} disabled={locked} onChange={e => setProvider(e.target.value as Provider)}>
      {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
    </select>
    {keyField(provider)}
    <ModelPicker id="summary-model" label="要約モデル" value={draft.models[provider]} models={models[provider]} disabled={locked} loading={loading === provider} canLoad={!!draft.keys[provider].trim()} onLoad={() => void loadModels(provider)} onChange={value => setDraft(c => ({ ...c, models: { ...c.models, [provider]: value } }))} />
    <p className="field-hint">一覧にはAPIが返す全モデルを表示します。画像生成・音声出力・埋め込み専用など、要約に対応しないモデルは使用できません。利用可否はAPIキーの権限にも依存します。</p>
    {provider === "openai" && <><label className="field-label" htmlFor="openai-api">OpenAI API形式</label><select id="openai-api" className="form-input" disabled={locked} value={draft.openaiApi} onChange={e => setDraft(c => ({ ...c, openaiApi: e.target.value as AIConfig["openaiApi"] }))}><option value="responses">Responses API</option><option value="chat">Chat Completions API</option></select></>}
    <div className="speech-settings"><h3>音声の文字起こし</h3>
      <label className="field-label" htmlFor="speech-provider">音声の処理方法</label><select id="speech-provider" className="form-input" disabled={locked} value={draft.speechProvider} onChange={e => setDraft(c => ({ ...c, speechProvider: e.target.value as SpeechProvider }))}>
        {provider === "gemini" && <option value="direct">選択したGeminiモデルで音声を直接要約</option>}<option value="gemini">Geminiで文字起こし</option><option value="openai">OpenAIで文字起こし</option>
      </select>
      {draft.speechProvider !== "direct" && <>{draft.speechProvider !== provider ? keyField(draft.speechProvider) : <p className="field-hint">要約と同じAPIキーを使用します。</p>}
      <ModelPicker id="speech-model" label="文字起こしモデル" value={draft.speechModels[draft.speechProvider]} models={models[draft.speechProvider]} disabled={locked} loading={loading === draft.speechProvider} canLoad={!!draft.keys[draft.speechProvider].trim()} onLoad={() => { if (draft.speechProvider !== "direct") void loadModels(draft.speechProvider); }} onChange={value => setDraft(c => c.speechProvider === "direct" ? c : ({ ...c, speechModels: { ...c.speechModels, [c.speechProvider]: value } }))} />
      <p className="field-hint">{draft.speechProvider === "gemini" ? "音声入力に対応するGeminiモデルを指定してください。" : "Transcriptions API対応モデルを指定してください。例：gpt-transcribe"}</p></>}
    </div>
    {error && <p className="settings-error" role="alert">{error}</p>}
    {locked && <p className="field-hint">収音・要約が終わるか、エラーで一時停止した後に設定を変更できます。</p>}
    <div className="privacy-box"><ShieldCheck size={20} /><div><strong>APIキーは、ページを開いている間だけ保持。</strong><p>音声と文字起こしは選択したサービスへ送信します。キーをブラウザに永続保存しません。ChatGPTのチャット契約とは別に、各社APIの利用条件・料金が適用されます。</p></div></div>
    <div className="modal-actions"><button type="button" className="button" onClick={onCancel}>閉じる</button><button className="button primary" type="submit" disabled={locked}><Check size={16} />設定を保存</button></div>
  </form>;
}
