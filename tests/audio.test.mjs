import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { encodeWav } from "../lib/audio.ts";

test("WAV chunks are independently decodable, resampled to 16kHz and clipped", () => {
  const samples = new Float32Array(48000); samples.fill(2);
  const bytes = encodeWav(samples, 48000), view = new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), "RIFF");
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 32000);
  assert.equal(bytes.length, 32044);
  assert.equal(view.getInt16(44, true), 32767);
});
test("worklet flush preserves final samples, stops on pause and resumes without losing data", () => {
  const messages = []; let Processor;
  class Base { port = { onmessage: null, postMessage: data => messages.push(data) }; }
  vm.runInNewContext(readFileSync(new URL("../public/recorder-worklet.js", import.meta.url), "utf8"), { AudioWorkletProcessor: Base, Float32Array, registerProcessor: (_, p) => { Processor = p; } });
  const recorder = new Processor();
  const input = new Float32Array(128); input.fill(.5);
  for (let i = 0; i < 33; i++) recorder.process([[input]]);
  recorder.port.onmessage({ data: { type: "flush", recording: false, token: "pause" } });
  assert.equal(messages.filter(m => m.type === "samples").reduce((n, m) => n + m.samples.length, 0), 4224);
  assert.equal(messages.at(-1).token, "pause");
  const before = messages.length; recorder.process([[input]]); assert.equal(messages.length, before);
  recorder.port.onmessage({ data: { type: "resume" } }); recorder.process([[input]]);
  recorder.port.onmessage({ data: { type: "flush", recording: false, token: "stop" } });
  assert.equal(messages.filter(m => m.type === "samples").reduce((n, m) => n + m.samples.length, 0), 4352);
});
