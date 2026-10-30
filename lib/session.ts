export const SECTION_DEFS = [
  { id: "background", label: "背景", en: "BACKGROUND", hint: "どんな課題がある？", icon: "◎" },
  { id: "objective", label: "目的", en: "OBJECTIVE", hint: "何を明らかにする？", icon: "↗" },
  { id: "related", label: "関連研究", en: "RELATED WORK", hint: "これまでの研究と何が違う？", icon: "⋈" },
  { id: "methods", label: "手法", en: "METHODS", hint: "どうやって解決する？", icon: "⌘" },
  { id: "experiments", label: "実験", en: "EXPERIMENTS", hint: "どうやって確かめた？", icon: "◫" },
  { id: "results", label: "結論", en: "CONCLUSION", hint: "何がわかった？", icon: "✓" },
] as const;
export type SectionId = typeof SECTION_DEFS[number]["id"] | "summary";
export type Section = { id: SectionId; summary: string; detail: string; evidence: string[] };
export type Analysis = { transcript: string; title: string; currentSection: SectionId | ""; sections: Section[]; questions: string[]; terms: { term: string; meaning: string }[] };
export type Transcript = { id: string; start: number; end: number; text: string };
export type Session = { id: string; title: string; createdAt: string; duration: number; sections: Section[]; transcript: Transcript[]; questions: string[]; terms: Analysis["terms"]; currentSection: SectionId | ""; note: string; demo: boolean };
export function newSession(): Session { return { id: crypto.randomUUID(), title: "タイトル未設定の発表", createdAt: new Date().toISOString(), duration: 0, sections: [], transcript: [], questions: [], terms: [], currentSection: "", note: "", demo: false }; }
export function clock(seconds: number) { const n = Math.max(0, Math.floor(seconds)); return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`; }
export function markdown(s: Session) { return `# ${s.title}${s.demo ? "（デモ）" : ""}\n\n${new Date(s.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} / ${clock(s.duration)}\n\n${[...SECTION_DEFS, { id: "summary", label: "全体の要約" }].map(d => { const sec = s.sections.find(x => x.id === d.id); return `## ${d.label}\n\n${sec?.summary || "まだ話されていません。"}${sec?.detail ? `\n\n${sec.detail}` : ""}${sec?.evidence.length ? `\n\n発表中の表現：\n${sec.evidence.map(e => `> ${e}`).join("\n\n")}` : ""}`; }).join("\n\n")}\n\n## 質問のヒント\n\n${s.questions.map(q => `- ${q}`).join("\n")}\n\n## 用語メモ\n\n${s.terms.map(t => `- **${t.term}**：${t.meaning}`).join("\n")}\n\n## 自分のメモ\n\n${s.note}\n\n## 文字起こし\n\n${s.transcript.map(t => `[${clock(t.start)}–${clock(t.end)}] ${t.text}`).join("\n\n")}\n\n---\nAIによる要約です。聞き取りや解釈に誤りが含まれる場合があります。\n`; }
