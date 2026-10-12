import test from "node:test";
import assert from "node:assert/strict";
import { estimateBpmFromEnvelope } from "../bpm-analyzer.js";

test("BPM estimator identifies a regular 120 BPM pulse", () => {
  const envelope = new Float32Array(240);
  for (let i = 0; i < envelope.length; i += 10) envelope[i] = 1;
  const result = estimateBpmFromEnvelope(envelope, 20);
  assert.ok(Math.abs(result.bpm - 120) < 0.2);
});

test("BPM estimator identifies a regular 100 BPM pulse", () => {
  const envelope = new Float32Array(240);
  for (let i = 0; i < envelope.length; i += 12) envelope[i] = 1;
  const result = estimateBpmFromEnvelope(envelope, 20);
  assert.ok(Math.abs(result.bpm - 100) < 0.2);
});
