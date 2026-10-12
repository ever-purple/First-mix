import { createReadStream, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { extname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[2] === "") continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}
const port = Number(process.env.PORT ?? 4177);
const host = process.env.HOST || "127.0.0.1";
const qwenModel = process.env.QWEN_MODEL || "qwen-flash";
const dashscopeBaseUrl = (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
const dashscopeApiKey = process.env.DASHSCOPE_API_KEY || "";
const nonnegativeLimit = (name, fallback) => {
  const value = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
};
const aiDailyLimit = nonnegativeLimit("AI_DAILY_CALL_LIMIT", 20);
const aiIpDailyLimit = nonnegativeLimit("AI_IP_DAILY_CALL_LIMIT", 5);
const aiUsageFile = resolve(process.env.AI_USAGE_FILE || join(root, ".ai-usage.json"));
const aiClientCalls = new Map();
let aiUsage;
let aiUsageUnavailable = false;
let activeAiCalls = 0;
try {
  aiUsage = JSON.parse(readFileSync(aiUsageFile, "utf8"));
  if (!aiUsage || typeof aiUsage.day !== "string" || !Number.isSafeInteger(aiUsage.count) || aiUsage.count < 0) throw new Error("Invalid AI usage state");
} catch (error) {
  if (error.code === "ENOENT") aiUsage = { day: "", count: 0 };
  else aiUsageUnavailable = true;
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request, limit = 65536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("请求内容过大"), { status: 413, code: "request_too_large" });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("请求格式错误"), { status: 400, code: "invalid_json" }); }
}

function clientAddress(request) {
  const remote = request.socket.remoteAddress || "unknown";
  const forwarded = request.headers["x-real-ip"];
  return (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1")
    && typeof forwarded === "string" && isIP(forwarded) ? forwarded : remote;
}

function reserveAiCall(request) {
  if (aiUsageUnavailable) throw Object.assign(new Error("AI 用量记录不可用，已暂停分析以避免超额调用"), { status: 503, code: "usage_state_unavailable" });
  const day = new Date().toISOString().slice(0, 10);
  if (aiUsage.day !== day) { aiUsage = { day, count: 0 }; aiClientCalls.clear(); }
  const client = clientAddress(request);
  const clientCount = aiClientCalls.get(client) || 0;
  if (activeAiCalls >= 2 || aiUsage.count >= aiDailyLimit || clientCount >= aiIpDailyLimit) {
    throw Object.assign(new Error("今日 AI 分析次数已达上限，请稍后再试"), { status: 429, code: "ai_rate_limited" });
  }
  const next = { day, count: aiUsage.count + 1 };
  try {
    const temporaryFile = `${aiUsageFile}.${process.pid}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(next), { mode: 0o600 });
    renameSync(temporaryFile, aiUsageFile);
  } catch {
    aiUsageUnavailable = true;
    throw Object.assign(new Error("AI 用量记录无法保存，已暂停分析以避免超额调用"), { status: 503, code: "usage_state_unavailable" });
  }
  aiUsage = next;
  aiClientCalls.set(client, clientCount + 1);
  activeAiCalls += 1;
}

const publicAssetTypes = new Set([".gif", ".ico", ".jpeg", ".jpg", ".json", ".mp3", ".m4a", ".ogg", ".png", ".svg", ".wav", ".webp"]);
const publicFontTypes = new Set([".ttf", ".woff2"]);
function publicFileFor(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  if (!requested.startsWith("/") || requested.includes("\\")) return null;
  const parts = requested.slice(1).split("/");
  if (parts.some(part => !part || part.startsWith(".") || part === "..")) return null;
  const extension = extname(parts.at(-1)).toLowerCase();
  const allowed = parts.length === 1
    ? requested === "/index.html" || /^[a-z0-9-]+\.(?:css|js)$/i.test(parts[0])
    : parts[0] === "node_modules"
      ? requested === "/node_modules/three/build/three.module.js" || requested === "/node_modules/three/build/three.core.js"
      : parts[0] === "concepts"
        ? new Set([".css", ".html", ".js"]).has(extension)
        : parts[0] === "assets" ? publicAssetTypes.has(extension)
          : parts[0] === "fonts" && publicFontTypes.has(extension);
  if (!allowed) return null;
  const file = resolve(root, ...parts);
  const subpath = relative(root, file);
  return subpath === ".." || subpath.startsWith(`..${sep}`) ? null : file;
}

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const text = (value, max = 160) => String(value || "").trim().slice(0, max);

function practicePrompt(payload) {
  const metrics = payload?.metrics || {};
  return {
    instruction: "你是 FIRST MIX 的 DJ AI 教练。只能根据给出的实时数值反馈，不能声称听过音频。分数应以本地技术分为基准，最多上下调整 5 分。教练提示只说当前最重要的一个动作，限 28 个汉字。返回 JSON。",
    data: {
      playingA: Boolean(metrics.playingA), playingB: Boolean(metrics.playingB),
      bpmA: clamp(metrics.bpmA, 40, 240), bpmB: clamp(metrics.bpmB, 40, 240), bpmDifference: clamp(metrics.bpmDifference, 0, 200),
      crossfaderToB: clamp(metrics.crossfaderToB), lowA: clamp(metrics.lowA, -12, 12), lowB: clamp(metrics.lowB, -12, 12),
      volumeA: clamp(metrics.volumeA), volumeB: clamp(metrics.volumeB),
      localScores: { beat: clamp(metrics.localBeat), handoff: clamp(metrics.localHandoff), clarity: clamp(metrics.localClarity), total: clamp(metrics.localTotal) }
    },
    output: { total: "0-100整数", beat: "0-100整数", handoff: "0-100整数", clarity: "0-100整数", coach: "当前动作提示", summary: "不超过36字的评分总结" }
  };
}

function weeklyPrompt(payload) {
  const profile = payload?.profile || {};
  const works = Array.isArray(payload?.works) ? payload.works.slice(0, 3) : [];
  return {
    instruction: "你是 FIRST MIX 的 DJ 学习分析师。只分析非练习曲作品和真实控制记录，不要虚构听感。给出一个易记的中文风格名、1到3条做得好的地方、1到3条需要注意的失误，以及唯一学习任务。每条判断必须能由输入数值支持；没有证据就少写，不要凑数。文案简短，返回 JSON。",
    data: {
      controls: { deck: clamp(profile.deck, 0, 9999), eq: clamp(profile.eq, 0, 9999), mix: clamp(profile.mix, 0, 9999) },
      averageBpm: clamp(profile.averageBpm, 40, 240),
      works: works.map(work => ({ bpm: clamp(work.bpm, 40, 240), energy: clamp(work.energy, 0, 1), dynamics: clamp(work.dynamics, 0, 40), brightness: clamp(work.brightness, 0, 1), duration: clamp(work.duration, 0, 7200) }))
    },
    output: { styleTitle: "2-7字风格名", styleCopy: "不超过42字", styleTags: ["标签1", "标签2", "标签3"], wins: ["1到3条有数据依据的亮点，每条不超过24字"], risks: ["1到3条有数据依据的失误或风险，每条不超过24字"], taskTitle: "不超过18字", taskCopy: "不超过55字" }
  };
}

function normalizeAiResult(mode, value) {
  if (mode === "practice") {
    return {
      total: Math.round(clamp(value.total)), beat: Math.round(clamp(value.beat)), handoff: Math.round(clamp(value.handoff)), clarity: Math.round(clamp(value.clarity)),
      coach: text(value.coach, 40) || "继续保持当前操作。", summary: text(value.summary, 60) || "AI 已完成本次技术分析。"
    };
  }
  const tags = Array.isArray(value.styleTags) ? value.styleTags.map(tag => text(tag, 16)).filter(Boolean).slice(0, 3) : [];
  const wins = Array.isArray(value.wins) ? value.wins.map(item => text(item, 40)).filter(Boolean).slice(0, 3) : [];
  const risks = Array.isArray(value.risks) ? value.risks.map(item => text(item, 40)).filter(Boolean).slice(0, 3) : [];
  return {
    styleTitle: text(value.styleTitle, 18) || "稳健衔接型", styleCopy: text(value.styleCopy, 80), styleTags: tags,
    wins, risks, taskTitle: text(value.taskTitle, 40) || "完成一次反向交接", taskCopy: text(value.taskCopy, 100)
  };
}

async function callQwen(mode, payload) {
  if (!dashscopeApiKey) throw Object.assign(new Error("尚未配置 DASHSCOPE_API_KEY"), { status: 503, code: "ai_not_configured" });
  const prompt = mode === "practice" ? practicePrompt(payload) : weeklyPrompt(payload);
  const providerResponse = await fetch(`${dashscopeBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "authorization": `Bearer ${dashscopeApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: qwenModel,
      messages: [
        { role: "system", content: `${prompt.instruction}\n严格输出与 output 描述一致的 JSON 对象，不要 Markdown。` },
        { role: "user", content: JSON.stringify({ data: prompt.data, output: prompt.output }) }
      ],
      response_format: { type: "json_object" },
      enable_thinking: false,
      temperature: 0.2,
      max_tokens: mode === "practice" ? 220 : 460
    }),
    signal: AbortSignal.timeout(15000)
  });
  const body = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) throw Object.assign(new Error(body?.error?.message || `Qwen 请求失败 (${providerResponse.status})`), { status: 502, code: "provider_error" });
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error("Qwen 未返回分析内容"), { status: 502, code: "empty_ai_response" });
  let parsed;
  try { parsed = JSON.parse(content); }
  catch { throw Object.assign(new Error("Qwen 返回格式无法解析"), { status: 502, code: "invalid_ai_response" }); }
  return { ...normalizeAiResult(mode, parsed), provider: "qwen", model: body.model || qwenModel, usage: body.usage || null };
}

const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { sendJson(response, 400, { error: "请求地址错误" }); return; }
  if (pathname === "/api/ai/status" && request.method === "GET") {
    sendJson(response, 200, { configured: Boolean(dashscopeApiKey), provider: "qwen", model: qwenModel });
    return;
  }
  if (pathname === "/api/ai/analyze" && request.method === "POST") {
    let reserved = false;
    try {
      if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { error: "仅接受 JSON 请求", code: "unsupported_media_type" }); return;
      }
      const body = await readJsonBody(request);
      const mode = body.mode === "weekly" ? "weekly" : body.mode === "practice" ? "practice" : null;
      if (!mode) { sendJson(response, 400, { error: "不支持的 AI 分析类型", code: "invalid_mode" }); return; }
      if (!dashscopeApiKey) { sendJson(response, 503, { error: "AI 尚未配置", code: "ai_not_configured" }); return; }
      reserveAiCall(request);
      reserved = true;
      sendJson(response, 200, await callQwen(mode, body));
    } catch (error) {
      sendJson(response, error.status || 500, { error: error.message || "AI 分析失败", code: error.code || "ai_error" });
    } finally {
      if (reserved) activeAiCalls -= 1;
    }
    return;
  }
  if (pathname.startsWith("/api/")) { sendJson(response, 404, { error: "Not found" }); return; }
  if (request.method !== "GET" && request.method !== "HEAD") { sendJson(response, 405, { error: "Method not allowed" }); return; }
  const file = publicFileFor(pathname);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": mime[extname(file)] || "application/octet-stream",
    "cache-control": "no-store"
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(file).pipe(response);
}).listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`FIRST MIX running at http://${displayHost}:${server.address().port}`);
});
