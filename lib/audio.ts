export type AudioChunk = { id: string; audio: string; start: number; end: number };
export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const target = 16000, length = Math.floor(samples.length * target / rate); const buffer = new ArrayBuffer(44 + length * 2), v = new DataView(buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, "RIFF"); v.setUint32(4, 36 + length * 2, true); text(8, "WAVE"); text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, target, true); v.setUint32(28, target * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, "data"); v.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) { const pos = i * rate / target; const a = Math.floor(pos); const s = Math.max(-1, Math.min(1, (samples[a] || 0) * (1 - (pos - a)) + (samples[a + 1] || 0) * (pos - a))); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Uint8Array(buffer);
}
export class AudioCapture {
  private context?: AudioContext; private stream?: MediaStream; private node?: AudioWorkletNode; private source?: MediaStreamAudioSourceNode; private mute?: GainNode;
  private parts: Float32Array[] = []; private size = 0; private total = 0; private rate = 16000; private stopping = false;
  private flushes = new Map<string, () => void>();
  private seconds: number; private onChunk: (chunk: AudioChunk) => void; private onLevel: (level: number, seconds: number) => void; private onEnded: () => void;
  constructor(seconds: number, onChunk: (chunk: AudioChunk) => void, onLevel: (level: number, seconds: number) => void, onEnded: () => void) { this.seconds = seconds; this.onChunk = onChunk; this.onLevel = onLevel; this.onEnded = onEnded; }
  async start(source: "mic" | "tab") {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("このブラウザでは収音できません。HTTPSまたはlocalhostでChrome / Edgeをご利用ください。");
      this.stream = source === "tab" ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!this.stream.getAudioTracks().length) throw new Error("共有音声がありません。共有するタブを選び、「タブの音声も共有」をオンにしてください。");
      // Keep the display track alive: browsers can end the audio when the video track is stopped.
      for (const track of this.stream.getTracks()) track.onended = () => { if (!this.stopping) this.onEnded(); };
      this.context = new AudioContext({ sampleRate: 16000 }); this.rate = this.context.sampleRate;
      await this.context.audioWorklet.addModule("/recorder-worklet.js");
      this.node = new AudioWorkletNode(this.context, "capture-processor");
      this.node.port.onmessage = ({ data }) => { if (data.type === "flushed") { this.flushes.get(data.token)?.(); this.flushes.delete(data.token); return; } if (data.type !== "samples") return;
        const samples = data.samples as Float32Array; this.parts.push(samples); this.size += samples.length; let energy = 0; for (const s of samples) energy += s * s; this.onLevel(Math.sqrt(energy / samples.length), (this.total + this.size) / this.rate);
        if (this.size >= this.rate * this.seconds) this.emit();
      };
      this.source = this.context.createMediaStreamSource(new MediaStream(this.stream.getAudioTracks())); this.mute = this.context.createGain(); this.mute.gain.value = 0;
      this.source.connect(this.node); this.node.connect(this.mute); this.mute.connect(this.context.destination); await this.context.resume();
    } catch (error) { await this.close(); throw error; }
  }
  private emit() {
    if (!this.size) return; const samples = new Float32Array(this.size); let offset = 0; for (const part of this.parts) { samples.set(part, offset); offset += part.length; }
    const start = this.total / this.rate; this.total += this.size; this.parts = []; this.size = 0;
    let energy = 0; for (const sample of samples) energy += sample * sample;
    if (samples.length < this.rate * .15 || Math.sqrt(energy / samples.length) < .0006) return;
    const bytes = encodeWav(samples, this.rate); let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    this.onChunk({ id: crypto.randomUUID(), audio: btoa(binary), start, end: this.total / this.rate });
  }
  async pause() { await this.flush(false); this.emit(); }
  resume() { this.node?.port.postMessage({ type: "resume" }); }
  private async flush(recording: boolean) {
    if (!this.node || this.context?.state === "closed") return;
    const token = crypto.randomUUID(); await new Promise<void>((resolve) => { const timer = setTimeout(() => { this.flushes.delete(token); resolve(); }, 1200); this.flushes.set(token, () => { clearTimeout(timer); resolve(); }); this.node!.port.postMessage({ type: "flush", token, recording }); });
  }
  async stop() { this.stopping = true; await this.flush(false); this.emit(); await this.close(); }
  async close() { this.stopping = true; this.stream?.getTracks().forEach(t => t.stop()); this.source?.disconnect(); this.node?.disconnect(); this.mute?.disconnect(); if (this.context && this.context.state !== "closed") await this.context.close(); this.context = undefined; }
}
