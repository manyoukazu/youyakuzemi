class CaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(4096); this.index = 0; this.recording = true;
    this.port.onmessage = ({ data }) => { if (data.type === 'flush') { this.send(); this.recording = data.recording; this.port.postMessage({ type: 'flushed', token: data.token }); } if (data.type === 'resume') this.recording = true; };
  }
  send() { if (!this.index) return; const samples = this.buffer.slice(0, this.index); this.port.postMessage({ type: 'samples', samples }, [samples.buffer]); this.index = 0; }
  process(inputs) { const channels = inputs[0]; if (!this.recording || !channels?.[0]) return true;
    for (let i = 0; i < channels[0].length; i++) { let s = 0; for (const channel of channels) s += channel[i] || 0; this.buffer[this.index++] = s / channels.length; if (this.index === this.buffer.length) this.send(); }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
