import test from "node:test";
import assert from "node:assert/strict";
import { TutorialMachine, TUTORIAL_STEPS, phrasePosition } from "../tutorial-engine.js";

test("quick course completes without EQ actions", () => {
  const tutorial = new TutorialMachine();
  assert.equal(tutorial.step, TUTORIAL_STEPS.PLAY);
  tutorial.dispatch("PLAY_A", { now: 100 });
  tutorial.dispatch("TICK", { now: 2099 });
  assert.equal(tutorial.step, TUTORIAL_STEPS.LISTEN);
  tutorial.dispatch("TICK", { now: 2100 });
  assert.equal(tutorial.step, TUTORIAL_STEPS.SYNC);
  tutorial.dispatch("SYNC_B");
  tutorial.dispatch("HEARD_MIX");
  tutorial.dispatch("HEARD_B_ONLY");
  assert.equal(tutorial.step, TUTORIAL_STEPS.COMPLETE);
});

test("EQ course requires the staged frequency handoff", () => {
  const tutorial = new TutorialMachine();
  tutorial.setCourse("eq");
  tutorial.startAt(TUTORIAL_STEPS.SYNC);
  tutorial.dispatch("SYNC_B");
  assert.equal(tutorial.step, TUTORIAL_STEPS.CUT_B_LOW);
  tutorial.dispatch("HEARD_MIX");
  assert.equal(tutorial.step, TUTORIAL_STEPS.CUT_B_LOW);
  tutorial.dispatch("CUT_B_LOW");
  tutorial.dispatch("HEARD_MIX");
  tutorial.dispatch("SWAPPED_LOW");
  tutorial.dispatch("MOVED_MID");
  tutorial.dispatch("CLEANED_HIGH");
  tutorial.dispatch("HEARD_B_ONLY");
  assert.equal(tutorial.step, TUTORIAL_STEPS.COMPLETE);
});

test("tutorial ignores actions performed out of order", () => {
  const tutorial = new TutorialMachine();
  tutorial.dispatch("SYNC_B");
  tutorial.dispatch("HEARD_MIX");
  assert.equal(tutorial.step, TUTORIAL_STEPS.PLAY);
});

test("local coach becomes more specific without AI", () => {
  const tutorial = new TutorialMachine();
  const first = tutorial.coach();
  const second = tutorial.coach();
  assert.notEqual(first, second);
  assert.match(second, /声音/);
});

test("phrase position identifies bars and the next 16-beat start", () => {
  assert.deepEqual(phrasePosition(0), { beatIndex: 0, beat: 1, bar: 1, phase: 0, isPhraseStart: true });
  assert.equal(phrasePosition(2).bar, 2);
  assert.equal(phrasePosition(7.5).beat, 16);
  assert.equal(phrasePosition(8).isPhraseStart, true);
  assert.equal(phrasePosition(8.4).isPhraseStart, false);
});
