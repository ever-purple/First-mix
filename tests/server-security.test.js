import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function startApp(environment) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: "0", DASHSCOPE_API_KEY: "test-key", QWEN_MODEL: "test-model", ...environment },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const ready = new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("FIRST MIX test server did not start")), 5000);
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      const match = output.match(/FIRST MIX running at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`FIRST MIX test server exited (${code})`)); });
  });
  return { child, ready };
}

async function stopApp(child) {
  if (child.exitCode !== null) return;
  await new Promise(resolve => {
    child.once("exit", resolve);
    child.kill();
    setTimeout(resolve, 2000).unref();
  });
}

test("private files stay private and AI calls have a persistent daily ceiling", async t => {
  const directory = await mkdtemp(join(tmpdir(), "first-mix-security-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let providerCalls = 0;
  const provider = createServer((request, response) => {
    providerCalls += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ model: "test-model", choices: [{ message: { content: JSON.stringify({ styleTitle: "测试", taskTitle: "继续练习" }) } }] }));
  });
  await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const environment = {
    DASHSCOPE_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
    AI_USAGE_FILE: join(directory, "usage.json"),
    AI_DAILY_CALL_LIMIT: "2",
    AI_IP_DAILY_CALL_LIMIT: "5"
  };
  const app = startApp(environment);
  t.after(() => stopApp(app.child));
  const url = await app.ready;
  for (const path of ["/.env", "/.env.example", "/.git/config", "/.ai-usage.json", "/server.mjs", "/node_modules/three/package.json"]) {
    assert.equal((await fetch(url + path)).status, 404, `${path} must not be public`);
  }
  for (const path of ["/index.html", "/concepts/course-07-playable.html", "/assets/tracks/lesson-tracks.json", "/node_modules/three/build/three.module.js", "/node_modules/three/build/three.core.js"]) {
    assert.equal((await fetch(url + path)).status, 200, `${path} must remain public`);
  }
  const analyze = () => fetch(`${url}/api/ai/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "weekly", profile: {}, works: [{ bpm: 120 }] })
  });
  assert.equal((await analyze()).status, 200);
  assert.equal((await analyze()).status, 200);
  assert.equal((await analyze()).status, 429);
  assert.equal(providerCalls, 2);
  await stopApp(app.child);
  const restarted = startApp(environment);
  t.after(() => stopApp(restarted.child));
  const restartedUrl = await restarted.ready;
  const afterRestart = await fetch(`${restartedUrl}/api/ai/analyze`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "weekly", profile: {}, works: [{ bpm: 120 }] })
  });
  assert.equal(afterRestart.status, 429);
  assert.equal(providerCalls, 2);
  await stopApp(restarted.child);

  const perClient = startApp({ ...environment, AI_USAGE_FILE: join(directory, "per-client.json"), AI_DAILY_CALL_LIMIT: "4", AI_IP_DAILY_CALL_LIMIT: "1" });
  t.after(() => stopApp(perClient.child));
  const perClientUrl = await perClient.ready;
  const perClientAnalyze = () => fetch(`${perClientUrl}/api/ai/analyze`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "weekly", profile: {}, works: [{ bpm: 120 }] })
  });
  assert.equal((await perClientAnalyze()).status, 200);
  assert.equal((await perClientAnalyze()).status, 429);
  assert.equal(providerCalls, 3);
  await stopApp(perClient.child);

  const disabled = startApp({ ...environment, AI_USAGE_FILE: join(directory, "disabled.json"), AI_DAILY_CALL_LIMIT: "0" });
  t.after(() => stopApp(disabled.child));
  const disabledUrl = await disabled.ready;
  assert.equal((await fetch(`${disabledUrl}/api/ai/analyze`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "weekly", profile: {}, works: [{ bpm: 120 }] })
  })).status, 429);
  assert.equal(providerCalls, 3);
});
