import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("course 03 completion continues directly to course 04", async () => {
  const course03 = await readFile(new URL("../concepts/course-03-playable.html", import.meta.url), "utf8");

  assert.match(course03, /href="course-04-playable-standard\.html"/);
  assert.doesNotMatch(course03, /04 尚未制作/);
});

test("course 04 continues directly to course 05", async () => {
  const course04 = await readFile(new URL("../concepts/course-04-playable-standard.html", import.meta.url), "utf8");

  assert.match(course04, /course-05-playable\.html/);
});

test("the complete basic route connects from course 00 through course 06", async () => {
  const filenames = [
    "course-00-playable.html",
    "course-01-playable.html",
    "course-02-playable.html",
    "course-03-playable.html",
    "course-04-playable-standard.html",
    "course-05-playable.html"
  ];
  const expectedNext = [
    "course-01-playable.html",
    "course-02-playable.html",
    "course-03-playable.html",
    "course-04-playable-standard.html",
    "course-05-playable.html",
    "course-06-playable.html"
  ];

  for (let index = 0; index < filenames.length; index += 1) {
    const source = await readFile(new URL(`../concepts/${filenames[index]}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(expectedNext[index].replaceAll(".", "\\.")), `${filenames[index]} should continue to ${expectedNext[index]}`);
  }
});

test("course 06 completion opens course 07", async () => {
  const course06 = await readFile(new URL("../concepts/course-06-playable.html", import.meta.url), "utf8");
  const course06Script = await readFile(new URL("../concepts/course-06-playable-v2.js", import.meta.url), "utf8");
  assert.match(course06, /id="goCourse07"/);
  assert.match(course06Script, /goCourse07.*course-07-playable\.html/);
});

test("the learning page includes course 07", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /number: "07".*course-07-playable\.html/);
});

test("course 02 no longer contains the inactive course 01 implementation", async () => {
  const course02 = await readFile(new URL("../concepts/course-02-playable.html", import.meta.url), "utf8");

  assert.doesNotMatch(course02, /legacyCourse01/);
  assert.doesNotMatch(course02, /first-mix-course-01-complete/);
});

test("legacy course 04 entry points immediately redirect to the standard lesson", async () => {
  for (const filename of ["course-04-playable.html", "course-04-playable-redesign.html"]) {
    const source = await readFile(new URL(`../concepts/${filename}`, import.meta.url), "utf8");
    assert.match(source, /location\.replace\('course-04-playable-standard\.html'\)/);
  }
});
