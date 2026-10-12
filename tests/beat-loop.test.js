import test from "node:test";
import assert from "node:assert/strict";
import { beatLoopRegion, loopedPosition } from "../audio-engine.js";

test("a four-beat loop snaps to the beat grid", () => {
  const region = beatLoopRegion(16.7, 120, 4, 60);
  assert.deepEqual(region, { start: 16.5, end: 18.5, beats: 4 });
});

test("an eight-beat loop stays inside the track near its end", () => {
  const region = beatLoopRegion(58, 120, 8, 60);
  assert.deepEqual(region, { start: 56, end: 60, beats: 8 });
});

test("playhead wraps within the loop instead of the full track", () => {
  const loop = { start: 16, end: 18, beats: 4 };
  assert.equal(loopedPosition(16, 2.25, loop, 60), 16.25);
  assert.equal(loopedPosition(16, 4.5, loop, 60), 16.5);
  assert.equal(loopedPosition(16, 2.25, null, 60), 18.25);
});

test("tracks shorter than the chosen loop cannot start one", () => {
  assert.equal(beatLoopRegion(0, 120, 8, 3), null);
});
