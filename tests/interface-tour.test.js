import test from "node:test";
import assert from "node:assert/strict";
import { InterfaceTour, INTERFACE_TOUR_STEPS } from "../interface-tour.js";

test("interface tour introduces every core beginner concept", () => {
  const names = INTERFACE_TOUR_STEPS.map(step => step.name).join(" ");
  for (const term of ["Deck", "BPM", "Beat", "Sync", "Crossfader", "EQ"]) assert.match(names, new RegExp(term));
});

test("interface tour completes after the final concept", () => {
  const tour = new InterfaceTour();
  tour.start();
  for (let i = 0; i < INTERFACE_TOUR_STEPS.length; i += 1) tour.next();
  assert.equal(tour.active, false);
});
