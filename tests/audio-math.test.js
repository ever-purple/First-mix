import test from "node:test";
import assert from "node:assert/strict";
import { clamp, dbToGain, equalPower, TRACK_PROFILES } from "../audio-engine.js";

test("clamp protects control ranges", () => {
  assert.equal(clamp(-2, -1, 1), -1);
  assert.equal(clamp(2, -1, 1), 1);
  assert.equal(clamp(0.25, -1, 1), 0.25);
});

test("equal-power crossfader reaches both endpoints", () => {
  assert.deepEqual(equalPower(-1), { a: 1, b: 0 });
  const right = equalPower(1);
  assert.ok(right.a < 1e-12);
  assert.equal(right.b, 1);
});

test("equal-power center keeps constant perceived power", () => {
  const center = equalPower(0);
  assert.ok(Math.abs(center.a - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(center.b - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(center.a ** 2 + center.b ** 2 - 1) < 1e-12);
});

test("decibel conversion uses standard amplitude ratio", () => {
  assert.equal(dbToGain(0), 1);
  assert.ok(Math.abs(dbToGain(-6) - 0.501187) < 0.00001);
});

test("training tracks are intentionally different songs", () => {
  assert.notEqual(TRACK_PROFILES.a.name, TRACK_PROFILES.b.name);
  assert.notEqual(TRACK_PROFILES.a.character, TRACK_PROFILES.b.character);
  assert.notEqual(TRACK_PROFILES.a.register, TRACK_PROFILES.b.register);
  assert.notEqual(TRACK_PROFILES.a.rhythm, TRACK_PROFILES.b.rhythm);
});
