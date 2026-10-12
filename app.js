import { AudioEngine } from "./audio-engine.js";
import { TutorialMachine, TUTORIAL_STEPS, phrasePosition } from "./tutorial-engine.js";
import { InterfaceTour } from "./interface-tour.js";
import { createController } from "./controller-3d.js?v=20261013-free-zoom-seam-4";
import { createTrackLibrary } from "./track-library.js?v=20261010-compact-2";
import { setupPracticeLayout } from "./practice-layout.js?v=20261013-fullscreen-exit-11";
import { saveWork, getWorks, deleteWork } from "./works-store.js";
import { analyzeWeeklyProfile, getAiStatus } from "./ai-client.js";

const engine = new AudioEngine();
let samplerContext;
let controller3d;
let practiceLayout;
const tutorial = new TutorialMachine();
const interfaceTour = new InterfaceTour();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const runtime = { completionTimer: null, inactivityTimer: null, phraseButtonTimer: null, renderedStep: null, tourTarget: null, freeMix: false, phraseMode: false, activeSkill: null, hotCueLessonActive: false, currentCourse: "beat", moduleIndex: 0, moduleUnlocked: false, conceptStep: 0, myView: "progress", myActivityDate: null, activityMonthOffset: 0, phraseCycles: 0, phraseHits: 0, lastPhraseBeat: null, lastPhraseSuccessCycle: -1, userTracks: { a: false, b: false }, activeWorkId: null };
let workObjectUrls = [];
let libraryWorks = [];
let recordTimer = null;
let recordSeconds = 0;
let recordStartedAt = 0;
let recordWaveformTimer = null;
let recordWaveformSamples = [];

const COURSE_ORDER = ["phrase", "beat", "prep", "levels", "eq", "selection", "final"];
const LEARNING_COURSES = [
  { number: "00", title: "第一次交接", description: "先认识机器，再亲手完成一次从 A 到 B 的交接。", listDescription: "播放、Cue、Sync、LOW 与 Crossfader", route: "./concepts/course-00-playable.html" },
  { number: "01", title: "设置开始位置", description: "听到想要的开头，暂停并保存可以随时返回的 Cue 点。", listDescription: "找到音乐入口并验证返回", route: "./concepts/course-01-playable.html" },
  { number: "02", title: "听懂音乐结构", description: "用耳朵分清节拍、小节与乐句，找到适合交接的位置。", listDescription: "节拍、小节与 16 拍乐句", route: "./concepts/course-02-playable.html" },
  { number: "03", title: "让两首歌对齐", description: "先校正速度，再让两首歌的拍点落在同一位置。", listDescription: "BPM 与拍点同步", route: "./concepts/course-03-playable.html" },
  { number: "04", title: "在正确时间接入", description: "从目标位置回退 16 拍，让 B 在计划好的第一拍进入。", listDescription: "Cue、提前量与唱盘微调", route: "./concepts/course-04-playable-standard.html" },
  { number: "05", title: "让转场保持清晰", description: "对齐基础电平，再交换两首歌的低频与声音重心。", listDescription: "GAIN、LOW 与 Crossfader", route: "./concepts/course-05-playable.html" },
  { number: "06", title: "量出转场长度", description: "听两个片段，量出共存上限，判断该用短交接还是长混合。", listDescription: "测量拍数，选择 16 拍或 32 拍", route: "./concepts/course-06-playable.html" },
  { number: "07", title: "练习两种转场", description: "在打碟台跟练 16 拍短交接，再完成 32 拍长混并保存作品。", listDescription: "16 拍短交接、32 拍长混与作品评分", route: "./concepts/course-07-playable.html" }
];
const COURSE_PROGRESS_KEY = "first-mix-course-progress-v1";
const ACTIVITY_LOG_KEY = "first-mix-activity-log-v1";
const DJ_PROFILE_KEY = "first-mix-dj-profile-v1";
const WEEKLY_AI_KEY = "first-mix-weekly-ai-v3";
const MIX_STORY_NOTES_KEY = "first-mix-story-notes-v1";
const MODULE_COURSES = {
  phrase: {
    number: "00", title: "完成第一次交接", intro: "直接操作打碟台，让一首歌从 A 交给 B。",
    steps: [
      { kind: "action", action: "cue-demo", title: "把 Cue 放在旋律开头", question: "Cue 就是歌曲的起跑标记。先听短前奏，在《欢乐颂》主旋律进入时暂停并保存 Cue。", label: "设置 A 的 Cue", success: "你已经跳过前奏，准确回到主旋律开头；这就是 Cue 的用途。" },
      { kind: "action", action: "sync-demo", title: "准备并同步 B", question: "启动右侧 Deck B，再按 Sync 让两首歌的速度和拍点贴齐。", label: "完成 B 的同步", success: "A 和 B 已一起走；现在可以开始把声音交给 B。" },
      { kind: "action", action: "transition-demo", title: "把声音交给 B", question: "先交换低频，再把 Crossfader 推到 B，完成第一次交接。", label: "完成第一次交接", success: "完成：A 退场，B 接住了。你已经走过一次完整的基础流程。" }
    ]
  },
  prep: {
    number: "02", title: "找到第一拍", intro: "听出新乐句的开头，并把 Cue 放在第一拍。",
    steps: [
      { kind: "action", action: "count", title: "跟着鼓点数拍", question: "播放训练音乐，跟着数 1、2、3、4，感受重音回到 1。", label: "开始数拍", success: "四拍是一小节，连续的小节组成乐句。" },
      { kind: "action", action: "cue", title: "在第一拍设 Cue", question: "听到新乐句重新开始时，把当前位置设为 Cue。", label: "设置 Cue", success: "Cue 已记住这个入口，你可以随时回到这里。" },
      { kind: "action", action: "hotcue", title: "反复确认入口", question: "连续触发三次 Cue，确认每次都从同一第一拍开始。", label: "触发 Cue", success: "入口稳定，下一课就能用它对齐另一首歌。" }
    ]
  },
  levels: {
    number: "03", title: "让两首同步", intro: "先让速度一致，再把两首歌的拍点贴齐。",
    steps: [
      { kind: "range", title: "把速度调到一致", question: "A 是 120 BPM，把 B 从 124 调到 120。", min: 116, max: 128, value: 124, step: .5, expected: 120, tolerance: .5, unit: "BPM", success: "速度一致了，但鼓点位置还可能前后错开。", retry: "继续移动速度推子，让 B 接近 120 BPM。" },
      { kind: "action", action: "cue-b", title: "给 B 设置起跑点", question: "暂停 B，把唱盘移到第一拍，再按 CUE B 保存起跑点。", label: "设置 B 的 Cue", success: "B 的第一拍已经保存成起跑点。" },
      { kind: "action", title: "让拍点贴齐", question: "启动 A 和 B 后按 Sync，再轻推唱盘修正前后位置。", action: "sync", label: "同步并微调 B", success: "两层鼓点已经贴齐。Sync 负责速度，耳朵负责最后确认。" }
    ]
  },
  eq: {
    number: "04", title: "音量与电平", intro: "让两边一样有力，同时给峰值留下空间。",
    steps: [
      { kind: "range", title: "给峰值留余量", question: "把示例峰值从 −18 dB 调到 −12 至 −6 dB。", min: 0, max: 12, value: 0, step: 1, base: -18, low: -12, high: -6, meter: true, success: "电平够响，也没有撞到红区。", retry: "让峰值留在 −12 到 −6 dB。" },
      { kind: "range", title: "匹配两边响度", question: "B 比 A 轻 6 dB，用 Gain 把它补到接近 A。", min: 0, max: 12, value: 0, step: 1, base: -15, expected: 6, tolerance: 2, meter: true, success: "两边响度接近，切换时不会忽大忽小。", retry: "再靠近一点，让 B 峰值约为 −9 dB。" },
      { kind: "action", action: "faders", title: "用通道推子确认", question: "分别推入 A 和 B，确认两边听起来一样有力。", label: "确认音量", success: "Gain 决定输入余量，通道推子决定混音中的音量。" }
    ]
  },
  selection: {
    number: "05", title: "基础转场", intro: "在乐句边界交换低频，让两首歌自然交接。",
    steps: [
      { kind: "action", action: "lowcut", title: "先切掉 B 的低频", question: "B 还没进入主输出前，先把 LOW 拉低，避免两个底鼓打架。", label: "切掉 B 低频", success: "B 的旋律可以进来，底鼓仍由 A 负责。" },
      { kind: "action", action: "blend", title: "在新乐句推入 B", question: "等到 A 的新乐句边界，再慢慢推入 B。", label: "推入 B", success: "两首歌在完整句子边界相遇，不会像半句话被打断。" },
      { kind: "action", action: "bassswap", title: "交换低频并淡出 A", question: "恢复 B 的 LOW，同时收掉 A 的 LOW，再把 Crossfader 推向 B。", label: "完成低频交换", success: "基础转场完成：一个底鼓离开，另一个底鼓接手。" }
    ]
  },
  final: {
    number: "06", title: "你的第一段 Mix", intro: "选歌、准备、转场并录下完整成果。",
    steps: [
      { kind: "action", action: "pick", title: "选一组速度接近的歌", question: "先听三组预览，选择速度与能量衔接最自然的一组。", label: "完成选歌", success: "第一次练习优先选速度接近、能量变化清楚的组合。" },
      { kind: "action", action: "perform", title: "连续完成两次转场", question: "按 Cue、同步、电平与低频交换的顺序完成整段 Mix。", label: "开始完整演练", success: "你已经把零散动作连成一套工作流。" },
      { kind: "action", action: "record", title: "录制并保存作品", question: "开始录制，完成最后一次转场，再结束并保存到本机。", label: "前往打碟台录制", success: "第一段 Mix 已准备好保存；重要作品记得及时下载。" }
    ]
  }
};

const MODULE_WIDGETS = {
  phrase: { label: "控台功能演示", hint: "轻触预览技巧声音", kind: "energy" },
  prep: { label: "第一拍与 Cue", hint: "轻触观察乐句起点", kind: "beats" },
  levels: { label: "双层拍点", hint: "轻触看两层鼓点贴齐", kind: "beats" },
  eq: { label: "峰值与音量", hint: "轻触观察安全余量", kind: "meter" },
  selection: { label: "低频交换", hint: "轻触试听转场前后", kind: "energy" },
  final: { label: "完整工作流", hint: "轻触回顾六个动作", kind: "energy" }
};

const LEARNING_ZONE_COPY = Object.freeze({
  "deck-a": "Deck A 是左侧音轨区：唱盘显示当前歌曲的位置，也能用手轻推或回拨。点亮左侧唱盘。",
  "transport-a": "播放区在左侧唱盘下方：Play 负责开始或暂停；Cue 负责回到准备好的起点。点亮这组按键。",
  "mixer": "Mixer 位于正中央：EQ 改变高、中、低频，竖向推杆控制每一路音量。点亮中间调音区。",
  "crossfader": "Crossfader 是中央最下方的横推杆：向左只听 A，向右逐渐交给 B。点亮横推杆。",
  "deck-b": "Deck B 是右侧准备区：下一首歌先在这里找第一拍、对齐速度，再进入主输出。点亮右侧唱盘。",
  "play-a": "先点 Play A，听短前奏。等《欢乐颂》主旋律出现时，再进行下一步。",
  "pause-a": "听到主旋律了吗？现在点 Play A 暂停。这个位置就是你想保留的歌曲入口。",
  "set-cue-a": "点 CUE A，把当前暂停位置保存为起跑标记。Cue 可以理解为给歌曲加一个书签。",
  "replay-a": "再点 Play A，让音乐离开刚才保存的起跑点。",
  "cue-a": "音乐已经向前走了。点 CUE A，它会回到刚才保存的起跑点并停住。",
  "play-b": "点 Play B 启动右侧音轨。此时两首歌都在播放，但拍点还不一定贴齐。",
  "sync-b": "点 Sync。系统先统一速度并对齐拍点；之后仍要用耳朵确认是否自然。",
  "low-swap": "点亮中央低频区：先收掉 A 的低频，再让 B 的低频接手，避免两个底鼓打架。",
  "cross-to-b": "把 Crossfader 从 A 推到 B。主输出会逐渐离开 A，交给 B。",
  "finish-b": "确认 B 正在独立播放，A 已经退场；这就是一次最基础的转场。"
});

function readCourseProgress() {
  const done = new Set();
  try {
    JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY) || "[]").forEach((course) => done.add(course));
  } catch {}

  const standaloneCourses = { phrase: "00", beat: "01", prep: "02", levels: "03", eq: "04", selection: "05" };
  Object.entries(standaloneCourses).forEach(([course, number]) => {
    if (localStorage.getItem(`first-mix-course-${number}-complete`) === "true") done.add(course);
  });
  return done;
}

function markCourseCompleted(course) {
  if (!COURSE_ORDER.includes(course)) return;
  const done = readCourseProgress();
  const isNewCompletion = !done.has(course);
  done.add(course);
  localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify([...done]));
  if (isNewCompletion) logActivity("learning", `完成课程：${courseNames[course]}`, courseDescriptions[course]);
  const button = $(`[data-course="${course}"]`);
  if (button) {
    button.closest("li")?.classList.add("is-complete");
    const state = button.querySelector(".course-state");
    if (state) state.textContent = "已完成";
  }
}

function restoreCourseProgress() {
  readCourseProgress().forEach((course) => {
    const button = $(`[data-course="${course}"]`);
    if (!button) return;
    button.closest("li")?.classList.add("is-complete");
    const state = button.querySelector(".course-state");
    if (state) state.textContent = "已完成";
  });
}

restoreCourseProgress();

function nextCourse(course) {
  const index = COURSE_ORDER.indexOf(course);
  return COURSE_ORDER[index + 1] || null;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function localDateKey(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readActivityLog() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || "[]"); }
  catch { return []; }
}

function logActivity(type, title, detail = "") {
  const activity = readActivityLog();
  activity.unshift({ id: crypto.randomUUID?.() || `activity-${Date.now()}`, type, title, detail, createdAt: Date.now() });
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activity.slice(0, 500)));
}

const ACTIVITY_LABELS = Object.freeze({ learning: "学习", work: "作品" });

function summarizeDailyActivity(items) {
  const courseRows = new Map();
  const rows = [];
  items.forEach(item => {
    if (!item.courseNumber) {
      rows.push({ ...item, repeatCount: 1 });
      return;
    }
    const key = String(item.courseNumber);
    const existing = courseRows.get(key);
    if (existing) {
      existing.repeatCount += 1;
    } else {
      const row = { ...item, repeatCount: 1 };
      courseRows.set(key, row);
      rows.push(row);
    }
  });
  return rows;
}

function activityTitle(item) {
  return `${item.title}${item.repeatCount > 1 ? ` · ${item.repeatCount}遍` : ""}`;
}

function renderActivityCalendar(completedCourses = 0) {
  const calendar = $("#activityCalendar");
  if (!calendar) return;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = localDateKey(today);
  const windowCenter = new Date(today);
  windowCenter.setDate(windowCenter.getDate() + runtime.activityMonthOffset * 15);
  const windowEnd = new Date(windowCenter);
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - 14);
  const middleDate = new Date(windowStart);
  middleDate.setDate(middleDate.getDate() + 7);
  if (!runtime.myActivityDate) runtime.myActivityDate = localDateKey(middleDate);
  const activity = readActivityLog().filter(item => item.type === "learning" || item.type === "work");
  const byDate = activity.reduce((dates, item) => {
    const key = localDateKey(item.createdAt);
    (dates[key] ||= []).push(item);
    return dates;
  }, {});
  const visibleDates = Array.from({ length: 15 }, (_, index) => {
    const date = new Date(windowStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const visibleKeys = new Set(visibleDates.map(date => localDateKey(date)));
  const periodActivity = activity.filter(item => visibleKeys.has(localDateKey(item.createdAt)));
  const shortDate = value => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(value);
  $("#activityMonth").textContent = `${shortDate(windowStart)} — ${shortDate(windowEnd)}`;
  $("#activitySummary").textContent = activity.length
    ? `近 15 天 ${periodActivity.length} 条学习与作品记录`
    : completedCourses
      ? `已有 ${completedCourses} 节学习进度；早期记录未包含完成日期。`
      : "学习和作品会自动留在完成当天。";
  $("#activityMonthNext").disabled = runtime.activityMonthOffset >= 0;
  const selectedDate = new Date(`${runtime.myActivityDate}T12:00:00`);
  if (selectedDate < windowStart || selectedDate > windowEnd) {
    runtime.myActivityDate = localDateKey(middleDate);
  }
  const days = visibleDates.map((date, index) => {
    const day = date.getDate();
    const month = date.getMonth();
    const key = localDateKey(date);
    const itemsForDay = byDate[key] || [];
    const displayItems = summarizeDailyActivity(itemsForDay);
    const types = new Set(itemsForDay.map(item => item.type));
    const count = itemsForDay.length;
    const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3;
    const classes = [`level-${level}`, key === todayKey ? "is-today" : "", key === runtime.myActivityDate ? "is-selected" : "", ...[...types].map(type => `has-${type}`)].filter(Boolean).join(" ");
    const labels = [...types].map(type => ACTIVITY_LABELS[type]).join("、");
    const selected = key === runtime.myActivityDate;
    const details = count
      ? displayItems.slice(0, 3).map(item => `<em><time>${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time><b>${escapeHTML(activityTitle(item))}</b><small>${escapeHTML(item.detail || (item.type === "learning" ? "课程已完成" : "作品已保存"))}</small></em>`).join("")
      : `<b>留一段时间给音乐</b><small>当天还没有学习或录制记录</small>`;
    const times = itemsForDay.map(item => new Date(item.createdAt)).filter(dateValue => Number.isFinite(dateValue.getTime())).sort((a, b) => a - b);
    const formatTime = dateValue => new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(dateValue);
    const timeRange = times.length ? ` · ${formatTime(times[0])}${times.length > 1 ? `–${formatTime(times[times.length - 1])}` : ""}` : "";
    return `<button class="activity-day ${classes}" type="button" data-activity-date="${key}" title="${month + 1}月${day}日 · ${count} 条记录" aria-label="第${index + 1}天，${month + 1}月${day}日${labels ? `，有${labels}记录` : "，无记录"}" aria-pressed="${selected}"><span class="activity-date-label"><b>${index + 1}</b></span><span class="activity-track" aria-hidden="true"></span><output class="activity-overlay"><small class="activity-overlay-date">${month + 1}月${day}日${timeRange} · ${count} 条记录</small>${details}</output></button>`;
  }).join("");
  calendar.innerHTML = days;
  shapeActivityBands(calendar.querySelector(".activity-day.is-selected") || calendar.querySelector(".activity-day"));
}

function shapeActivityBands(target) {
  const calendar = $("#activityCalendar");
  if (!calendar || !target) return;
  const rows = [...calendar.querySelectorAll(".activity-day")];
  const focusIndex = rows.indexOf(target);
  if (focusIndex < 0) return;
  const widths = [86, 82, 78, 73, 67, 60, 53, 46, 40, 35, 31, 27, 24, 21, 19];
  rows.forEach((row, index) => {
    const distance = Math.min(widths.length - 1, Math.abs(index - focusIndex));
    row.style.setProperty("--proximity-size", `${widths[distance]}%`);
    row.classList.toggle("is-proximity-focus", index === focusIndex);
    row.style.setProperty("--band-index", index);
    row.style.setProperty("--overlay-top", `${(7 - index) * 18 + 9}px`);
  });
}

function renderDailyActivity(items) {
  const selected = new Date(`${runtime.myActivityDate}T12:00:00`);
  const today = localDateKey() === runtime.myActivityDate;
  $("#dailyActivityTitle").textContent = today ? "今天完成了什么" : new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(selected);
  $("#dailyActivityDate").textContent = new Intl.DateTimeFormat("zh-CN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(selected);
  $("#dailyActivityCount").textContent = `${items.length} 条记录`;
  $("#dailyActivityEmpty").hidden = items.length > 0;
  $("#dailyActivityList").innerHTML = summarizeDailyActivity(items).map(item => `<article class="daily-activity-item is-${escapeHTML(item.type)}"><span aria-hidden="true"></span><div><small>${ACTIVITY_LABELS[item.type] || "记录"}</small><strong>${escapeHTML(activityTitle(item))}</strong>${item.detail ? `<p>${escapeHTML(item.detail)}</p>` : ""}</div><time>${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></article>`).join("");
}

function readDjProfile() {
  try {
    return { deck: 0, eq: 0, mix: 0, bpmTotal: 0, bpmSamples: 0, lastActiveDate: null, ...JSON.parse(localStorage.getItem(DJ_PROFILE_KEY) || "{}") };
  } catch {
    return { deck: 0, eq: 0, mix: 0, bpmTotal: 0, bpmSamples: 0, lastActiveDate: null };
  }
}

function writeDjProfile(profile) {
  localStorage.setItem(DJ_PROFILE_KEY, JSON.stringify(profile));
}

const profileControlThrottle = new Map();
function recordProfileControl(group) {
  const now = Date.now();
  if (now - (profileControlThrottle.get(group) || 0) < 650) return;
  profileControlThrottle.set(group, now);
  const profile = readDjProfile();
  profile[group] = Math.min(9999, Number(profile[group] || 0) + 1);
  profile.lastActiveDate = localDateKey(now);
  writeDjProfile(profile);
}

function hasPersonalTrackPair() {
  return Boolean(runtime.userTracks.a && runtime.userTracks.b);
}

function recordProfileBpm(value) {
  if (!Number.isFinite(value) || value < 40 || value > 240) return;
  const profile = readDjProfile();
  profile.bpmTotal = Number(profile.bpmTotal || 0) + value;
  profile.bpmSamples = Number(profile.bpmSamples || 0) + 1;
  profile.lastActiveDate = localDateKey();
  writeDjProfile(profile);
}

function profileDirection(profile) {
  const groups = [["deck", Number(profile.deck || 0)], ["eq", Number(profile.eq || 0)], ["mix", Number(profile.mix || 0)]];
  const [leader, score] = groups.sort((a, b) => b[1] - a[1])[0];
  if (!score) return { title: "等待你的第一段声音", copy: "去打碟台播放、调 EQ 或完成一次转场，声音 DNA 就会开始变化。", tags: ["FIRST TAKE", "120 BPM", "等待第一段 MIX"] };
  if (leader === "eq") return { title: "细节平衡型", copy: "你会主动整理高、中、低频，让两首歌在交接时保持清楚。", tags: ["EQ FOCUS", "CLEAN BLEND", "细节控"] };
  if (leader === "mix") return { title: "完整交接型", copy: "你更常推动 Crossfader 和同步动作，声音重心会从 A 清楚地交到 B。", tags: ["A → B", "LONG BLEND", "转场优先"] };
  return { title: "节拍行动派", copy: "你最常直接操作唱盘、播放与 Cue，偏好先动手找到音乐入口。", tags: ["DECK FIRST", "CUE READY", "节拍驱动"] };
}

async function renderMyProfile() {
  const profile = readDjProfile();
  const activityDates = new Set(readActivityLog().map(item => localDateKey(item.createdAt)));
  if (profile.lastActiveDate) activityDates.add(profile.lastActiveDate);
  let works = [];
  try { works = await getWorks(); } catch { /* the works panel displays the storage recovery message */ }
  const bpm = profile.bpmSamples ? Math.round(profile.bpmTotal / profile.bpmSamples) : 120;
  const interactions = Number(profile.deck || 0) + Number(profile.eq || 0) + Number(profile.mix || 0);
  $("#profileDays").textContent = activityDates.size;
  $("#profileWorks").textContent = works.length;
  $("#profileBpm").textContent = bpm;
  $("#djProfileTitle").textContent = "本周练习足迹";
  $("#djProfileSummary").textContent = interactions
    ? `已记录 ${interactions} 次有效控制；选择日期查看当天的学习与作品。`
    : "每一次学习、录制和控制都会落在这里。";
  const max = Math.max(1, Number(profile.deck || 0), Number(profile.eq || 0), Number(profile.mix || 0));
  $$('[data-profile-heat]').forEach(zone => {
    const value = Number(profile[zone.dataset.profileHeat] || 0);
    zone.style.setProperty("--heat", `${.18 + value / max * .82}`);
    zone.classList.toggle("is-active", value > 0);
  });
  renderActivityCalendar(readCourseProgress().size);
  await renderWeeklyAiCoach(works);
}

function currentWeekKey(value = new Date()) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return localDateKey(date);
}

function readWeeklyAi() {
  try { return JSON.parse(localStorage.getItem(WEEKLY_AI_KEY) || "null"); }
  catch { return null; }
}

let weeklyAiConnectionState = "unknown";

function weeklyLearningDirection(works) {
  const recent = works.filter(work => work.aiEligible && work.analysis).slice(0, 3);
  const average = key => recent.reduce((sum, work) => sum + Number(work.analysis?.[key] || 0), 0) / Math.max(1, recent.length);
  const bpm = Math.round(average("bpm") || 120);
  const energy = average("energy");
  const dynamics = average("dynamics");
  const brightness = average("brightness");
  if (bpm >= 128 || energy >= .24) return { title: "本周练：长转场与能量控制", copy: "你的个人 Mix 推进感很强。试着用 16–32 拍完成一次更慢的交接，让能量变化不只依靠快速切换。" };
  if (brightness >= .16) return { title: "本周练：低频交换", copy: "你的作品瞬态和高频轮廓比较突出。下一步练习只保留一个底鼓，并在乐句边界交换 LOW。" };
  if (dynamics >= 8) return { title: "本周练：Gain 与音量匹配", copy: "你的 Mix 保留了明显动态。练习在转场前匹配两边响度，让安静段落也保持稳定的听感。" };
  return { title: "本周练：Cue 与第一拍", copy: "你的作品整体较平稳。下一步把 Cue 放在新乐句第一拍，并用 16 拍提前量准备 Deck B。" };
}

async function renderWeeklyAiCoach(works = null, { refreshStatus = false } = {}) {
  if (!$("#runWeeklyAi")) return;
  const allWorks = works || await getWorks().catch(() => []);
  const eligible = allWorks.filter(work => work.aiEligible === true && work.sourceKind === "personal-pair" && work.analysis);
  const saved = readWeeklyAi();
  const isCurrent = saved?.week === currentWeekKey();
  const aiStatus = await getAiStatus({ refresh: refreshStatus }).catch(() => null);
  weeklyAiConnectionState = aiStatus ? (aiStatus.configured ? "connected" : "unconfigured") : "unavailable";
  $("#aiWeeklyResult").hidden = true;
  if (isCurrent) {
    $("#aiWeeklyStatus").textContent = `本周已生成 · ${saved.model || "Qwen"}`;
    $("#aiWeeklyCopy").textContent = "Qwen 已根据非练习曲作品和真实操作记录生成本周画像。";
    $("#runWeeklyAi").disabled = false;
    $("#runWeeklyAi").textContent = "打开本周分析";
    delete $("#runWeeklyAi").dataset.preview;
    renderAiDirectionModal(saved);
    return;
  }
  if (weeklyAiConnectionState !== "connected") {
    $("#aiWeeklyStatus").textContent = weeklyAiConnectionState === "unconfigured" ? "AI 未连接" : "连接状态待确认";
    $("#runWeeklyAi").disabled = false;
    $("#runWeeklyAi").dataset.preview = "true";
    $("#runWeeklyAi").textContent = "查看分析条件";
    $("#aiWeeklyCopy").textContent = weeklyAiConnectionState === "unconfigured"
      ? "尚未连接 Qwen；连接后还需用自己的两首音乐录制作品。内置练习曲不计入本周 AI 分析。"
      : "暂时无法确认 AI 连接，请稍后重试。内置练习曲不计入本周 AI 分析。";
    return;
  }
  $("#aiWeeklyStatus").textContent = eligible.length ? "本周 1 次" : "已连接 · 待作品";
  $("#runWeeklyAi").disabled = false;
  $("#runWeeklyAi").textContent = eligible.length ? "生成本周分析" : "查看分析条件";
  if (eligible.length) delete $("#runWeeklyAi").dataset.preview;
  else $("#runWeeklyAi").dataset.preview = "true";
  $("#aiWeeklyCopy").textContent = eligible.length
    ? `已找到 ${eligible.length} 段非练习曲作品。将同时判断风格与下一步，生成后本周不能重测。`
    : "内置练习曲不计入本周 AI 分析。请在 Deck A、B 载入自己的音乐并完成录制。";
}

function renderAiDirectionModal(saved) {
  if (!saved || !$("#aiDirectionModal")) return;
  const style = saved.styleTitle ? { title: saved.styleTitle, copy: saved.styleCopy, tags: saved.styleTags || [] } : profileDirection(readDjProfile());
  const hasResult = saved.source === "qwen" && !saved.processing && !saved.error;
  const concise = (value, limit = 64) => {
    const text = String(value || "").trim().split(/(?<=[。！？])\s*/u)[0] || "";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  };
  const previewState = ["connected", "unconfigured"].includes(saved.previewState) ? saved.previewState : "unavailable";
  $("#aiAnalysisState").textContent = saved.processing ? "Qwen · 正在解析"
    : saved.error ? "Qwen · 解析未完成"
      : saved.preview ? ({ connected: "Qwen 已连接 · 等待个人作品", unavailable: "界面预览 · 连接待确认", unconfigured: "界面预览 · AI 未连接" })[previewState] : `Qwen · ${saved.model || "声音分析"}`;
  $("#aiWaterHint").textContent = saved.processing ? "声音线索正在汇聚"
    : saved.error ? "解析已中断"
      : saved.preview ? "动态预览 · 尚未开始解析" : "解析已完成";
  $("#aiDirectionStyleTitle").textContent = saved.processing ? "AI 正在解析"
    : saved.error ? "解析未完成"
      : hasResult ? "分析完成" : saved.preview ? ({ connected: "尚无可分析的个人作品", unavailable: "连接状态待确认", unconfigured: "AI 尚未连接" })[previewState] : "等待分析";
  $("#aiDirectionStyleCopy").textContent = hasResult
    ? `${style.title} · ${concise(style.copy, 50)}`
    : concise(style.copy, 55);
  $$("#aiDirectionModal .ai-map-node").forEach(node => { node.hidden = !hasResult; });
  $("#aiFindings").hidden = !hasResult;
  $("#aiDirectionTask").hidden = !hasResult;
  $("#aiDirectionTaskTitle").textContent = concise(saved.title, 30);
  $("#aiDirectionTaskCopy").textContent = concise(saved.copy, 58);
  const renderFindingList = (selector, items, emptyCopy) => {
    const safeItems = Array.isArray(items) ? items.map(item => concise(item, 58)).filter(Boolean).slice(0, 1) : [];
    $(selector).innerHTML = (safeItems.length ? safeItems : [emptyCopy]).map(item => `<li>${escapeHTML(item)}</li>`).join("");
  };
  renderFindingList("#aiWins", saved.wins, "等待 AI 从真实作品中确认亮点");
  renderFindingList("#aiRisks", saved.risks, "等待 AI 从真实作品中定位失误");
  const profile = readDjProfile();
  const max = Math.max(1, Number(profile.deck || 0), Number(profile.eq || 0), Number(profile.mix || 0));
  $("#aiMapDeck").textContent = `${Math.round(Number(profile.deck || 0) / max * 100)}%`;
  $("#aiMapEq").textContent = `${Math.round(Number(profile.eq || 0) / max * 100)}%`;
  $("#aiMapMix").textContent = `${Math.round(Number(profile.mix || 0) / max * 100)}%`;
}

let aiWaterFrame = 0;
let aiWaterResizeObserver = null;
let aiWaterMetrics = { deck: .5, eq: .5, mix: .5 };
let aiVisualMode = "preview";
let aiVisualStartedAt = 0;

function drawAiColorBlobsFrame(time = 0) {
  const canvas = $("#aiWaterCanvas");
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = bounds.width;
  const height = bounds.height;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const motionFactor = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? .65 : 1;
  const elapsed = Math.max(0, (time - aiVisualStartedAt) / 1000) * motionFactor;
  const halfGap = aiVisualMode === "processing"
    ? width * (.045 + .14 * Math.exp(-elapsed / 1.65))
    : aiVisualMode === "result"
      ? width * (.045 + .012 * Math.sin(elapsed * .85))
      : width * (.11 + .075 * Math.cos(elapsed * 1.25));
  const centerX = width * (.5 + Math.sin(elapsed * .68) * .018);
  const centerY = height * (.52 + Math.sin(elapsed * .74) * .018);
  const small = Math.min(width, height);

  const makeShape = (x, y, rx, ry, phase) => {
    context.beginPath();
    for (let point = 0; point <= 72; point += 1) {
      const angle = point / 72 * Math.PI * 2;
      const contour = 1 + Math.sin(angle * 3 + elapsed * .95 + phase) * .12
        + Math.cos(angle * 5 - elapsed * .72 + phase) * .05
        + Math.sin(angle * 2 - elapsed * .58 - phase) * .035;
      const px = x + Math.cos(angle) * rx * contour;
      const py = y + Math.sin(angle) * ry * contour;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  };

  const colors = [
    ["rgba(121,82,207,.58)", "rgba(121,82,207,.26)", "rgba(121,82,207,0)"],
    ["rgba(186,255,46,.53)", "rgba(186,255,46,.23)", "rgba(186,255,46,0)"]
  ];
  for (let index = 0; index < 2; index += 1) {
    const x = centerX + (index ? halfGap : -halfGap)
      + Math.sin(elapsed * (index ? .88 : 1.05) + index * 1.8) * width * .022;
    const y = centerY + Math.sin(elapsed * (index ? .93 : .81) + index * 2.1) * height * .068;
    const rx = small * .32;
    const ry = small * .31;
    const gradient = context.createRadialGradient(x - rx * .22, y - ry * .22, 3, x, y, rx * 1.24);
    gradient.addColorStop(0, colors[index][0]);
    gradient.addColorStop(.52, colors[index][1]);
    gradient.addColorStop(1, colors[index][2]);
    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(4px)";
    context.shadowColor = colors[index][1];
    context.shadowBlur = 22;
    context.fillStyle = gradient;
    makeShape(x, y, rx, ry, index * 1.7);
    context.fill();
    context.restore();
  }

  // White light at the overlap keeps the app's violet/lime pair from mixing to grey.
  const overlap = Math.max(0, 1 - halfGap / (small * .36));
  if (overlap > 0) {
    const glow = context.createRadialGradient(centerX, centerY, 1, centerX, centerY, small * .28);
    glow.addColorStop(0, `rgba(255,255,255,${(.55 * overlap).toFixed(3)})`);
    glow.addColorStop(.55, `rgba(255,255,255,${(.22 * overlap).toFixed(3)})`);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(centerX - small * .28, centerY - small * .28, small * .56, small * .56);
  }

  // Fine grain belongs to the painted area only; labels remain crisp DOM text.
  const grainPhase = Math.floor(time / 220);
  for (let index = 0; index < 340; index += 1) {
    const x = (Math.sin(index * 91.73 + grainPhase * .08) * .5 + .5) * width;
    const y = (Math.sin(index * 47.19 + grainPhase * .11) * .5 + .5) * height;
    context.fillStyle = index % 3 ? "rgba(255,255,255,.08)" : "rgba(33,28,39,.025)";
    context.fillRect(x, y, 1, 1);
  }
}

function stopAiWater() {
  cancelAnimationFrame(aiWaterFrame);
  aiWaterFrame = 0;
  aiWaterResizeObserver?.disconnect();
  aiWaterResizeObserver = null;
}

function startAiWater(profile = readDjProfile(), mode = "preview") {
  const canvas = $("#aiWaterCanvas");
  if (!canvas) return;
  const maximum = Math.max(1, Number(profile.deck || 0), Number(profile.eq || 0), Number(profile.mix || 0));
  aiWaterMetrics = {
    deck: Number(profile.deck || 0) / maximum,
    eq: Number(profile.eq || 0) / maximum,
    mix: Number(profile.mix || 0) / maximum
  };
  stopAiWater();
  aiVisualMode = mode;
  aiVisualStartedAt = performance.now();
  aiWaterResizeObserver = new ResizeObserver(() => drawAiColorBlobsFrame(performance.now()));
  aiWaterResizeObserver.observe(canvas);
  const animate = time => {
    if ($("#aiDirectionModal")?.hidden) return;
    drawAiColorBlobsFrame(time);
    aiWaterFrame = requestAnimationFrame(animate);
  };
  aiWaterFrame = requestAnimationFrame(animate);
}

function openAiDirectionModal(allowEmpty = false, mode = "auto") {
  const saved = readWeeklyAi();
  const current = saved?.week === currentWeekKey() ? saved : null;
  if (!current && !allowEmpty) return;
  if ($("#aiDirectionModal").parentElement !== document.body) document.body.append($("#aiDirectionModal"));
  const processing = mode === "processing";
  const previewState = ["connected", "unconfigured"].includes(weeklyAiConnectionState) ? weeklyAiConnectionState : "unavailable";
  renderAiDirectionModal(current || (processing ? {
    processing: true,
    styleTitle: "正在解析你的 Mix",
    styleCopy: "正在读取作品的节奏与控制记录。",
    title: "分析完成后，再决定下一步",
    copy: "你可以关闭弹窗，完成后再回来查看。",
    wins: [], risks: []
  } : {
    preview: true,
    previewState,
    styleTitle: previewState === "connected" ? "等待个人作品" : "等待真实分析",
    styleCopy: previewState === "connected"
      ? "内置练习曲不计入本周 AI 分析；请在 Deck A、B 载入自己的音乐并完成录制。"
      : previewState === "unavailable"
        ? "暂时无法确认 AI 连接；请稍后重试，并用自己的两首音乐完成录制。"
        : "连接 Qwen，并用自己的两首音乐完成录制后，这里会生成声音风格。",
    styleTags: ["真实作品", "控制记录"],
    title: "先完成一段个人 Mix",
    copy: "内置练习曲不计入本周 AI 分析；请用自己的两首音乐完成录制。",
    wins: [], risks: []
  }));
  $("#aiDirectionModal").hidden = false;
  document.body.classList.add("ai-direction-open");
  requestAnimationFrame(() => startAiWater(readDjProfile(), processing ? "processing" : current ? "result" : "preview"));
  const closeButton = $("#closeAiDirection");
  (getComputedStyle(closeButton).display === "none" ? $("#aiDirectionModal .ai-direction-shell") : closeButton)
    .focus({ preventScroll: true });
}

function closeAiDirectionModal() {
  if (!$("#aiDirectionModal")) return;
  $("#aiDirectionModal").hidden = true;
  document.body.classList.remove("ai-direction-open");
  stopAiWater();
  $("#runWeeklyAi")?.focus({ preventScroll: true });
}

async function runWeeklyAiCoach() {
  const works = await getWorks().catch(() => []);
  const eligible = works.filter(work => work.aiEligible === true && work.sourceKind === "personal-pair" && work.analysis);
  await renderWeeklyAiCoach(works, { refreshStatus: true });
  if (readWeeklyAi()?.week === currentWeekKey()) { openAiDirectionModal(); return; }
  if ($("#runWeeklyAi").dataset.preview === "true" || !eligible.length) { openAiDirectionModal(true); return; }
  const button = $("#runWeeklyAi");
  button.disabled = true;
  button.textContent = "Qwen 分析中…";
  $("#aiWeeklyCopy").textContent = "正在读取作品节奏、动态、频谱与控制热区。";
  openAiDirectionModal(true, "processing");
  try {
    const profile = readDjProfile();
    const averageBpm = profile.bpmSamples ? Number(profile.bpmTotal || 0) / Number(profile.bpmSamples) : 120;
    const ai = await analyzeWeeklyProfile(
      { deck: profile.deck, eq: profile.eq, mix: profile.mix, averageBpm },
      eligible.slice(0, 3).map(work => ({ ...work.analysis, duration: work.duration }))
    );
    localStorage.setItem(WEEKLY_AI_KEY, JSON.stringify({
      week: currentWeekKey(), title: ai.taskTitle, copy: ai.taskCopy,
      styleTitle: ai.styleTitle, styleCopy: ai.styleCopy, styleTags: ai.styleTags,
      wins: ai.wins, risks: ai.risks,
      source: "qwen", model: ai.model, createdAt: Date.now(), workIds: eligible.slice(0, 3).map(work => work.id)
    }));
    await renderWeeklyAiCoach(works);
    if (!$("#aiDirectionModal").hidden) openAiDirectionModal(false, "result");
  } catch (error) {
    button.disabled = false;
    button.textContent = "重新连接 Qwen";
    $("#aiWeeklyStatus").textContent = "生成失败";
    $("#aiWeeklyCopy").textContent = error.message || "Qwen 暂时不可用，请稍后重试。";
    if (!$("#aiDirectionModal").hidden) {
      renderAiDirectionModal({
        error: true,
        styleTitle: "本次解析未完成",
        styleCopy: error.message || "Qwen 暂时不可用，请稍后重试。",
        title: "稍后再试一次",
        copy: "作品仍保存在设备上，不需要重新录制。",
        wins: [], risks: []
      });
      startAiWater(readDjProfile(), "result");
    }
  }
}

async function openMyView(view) {
  const safeView = view === "works" ? "works" : "progress";
  runtime.myView = safeView;
  $$("[data-my-view]").forEach(button => {
    const active = button.dataset.myView === safeView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  $$("[data-my-panel]").forEach(panel => { panel.hidden = panel.dataset.myPanel !== safeView; });
  if (safeView === "progress") await renderMyProfile();
  if (safeView === "works") await renderWorksLibrary();
}

function renderInterfaceTour() {
  const view = interfaceTour.snapshot();
  runtime.tourTarget?.classList.remove("tour-target");
  runtime.tourTarget = null;
  document.body.classList.toggle("tour-active", view.active);
  $("#interfaceTour").hidden = !view.active;
  if (!view.active) return;
  runtime.tourTarget = $(view.step.selector);
  runtime.tourTarget?.classList.add("tour-target");
  runtime.tourTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
  $("#tourProgress").textContent = `界面介绍 ${view.index + 1} / ${view.total}`;
  $("#tourTitle").textContent = view.step.name;
  $("#tourDescription").textContent = view.step.description;
  $("#nextTour").textContent = view.isLast ? "开始练习" : "下一个";
  $("#nextTour").focus();
}

function startInterfaceTour() {
  clearTimeout(runtime.inactivityTimer);
  interfaceTour.start();
  renderInterfaceTour();
}

function finishInterfaceTour(skipped = false) {
  interfaceTour.skip();
  localStorage.setItem("first-mix-interface-tour-v2-seen", skipped ? "skipped" : "complete");
  renderInterfaceTour();
  $("#playA").focus();
  scheduleInactivityHint();
}

function selectCourse(course) {
  $$(".course-list li").forEach((item) => item.classList.remove("is-current"));
  const button = $(`[data-course="${course}"]`);
  button?.closest("li")?.classList.add("is-current");
  $$("[data-course]").forEach((item) => item.removeAttribute("aria-current"));
  button?.setAttribute("aria-current", "step");
  const activeCourse = $("#activeCourse");
  if (activeCourse) activeCourse.textContent = courseNames[course] || "第一次转场";
}

const courseNames = {
  beat: "节拍与乐句", phrase: "认识打碟台", prep: "找到第一拍",
  levels: "让两首同步", eq: "音量与电平",
  selection: "基础转场", final: "你的第一段 Mix"
};

const courseDescriptions = {
  beat: "听懂节拍、小节与乐句",
  phrase: "先认识控台，再试听它能带来的惊喜",
  prep: "听出乐句开头并设好 Cue",
  levels: "用速度、Cue 和微调把鼓点贴齐",
  eq: "匹配响度并给峰值留下空间",
  selection: "在乐句边界完成低频交换",
  final: "选歌、表演、录制并保存作品"
};

const COURSE_WIDGETS = {
  beat: { title: "A / B 试听", hint: "先听鼓点，再听旋律层", labels: ["A 鼓点", "A+B", "B 旋律"] },
  phrase: { title: "16 拍计数器", hint: "跟着亮点找到下一句第一拍", labels: ["1", "8", "16"] },
  prep: { title: "对拍准备", hint: "比较 Cue、BPM 和 Sync", labels: ["CUE", "120", "SYNC"] },
  levels: { title: "峰值灯", hint: "把声音留在安全范围", labels: ["−12", "−6", "0"] },
  eq: { title: "三段 EQ", hint: "分开听低、中、高频", labels: ["LOW", "MID", "HIGH"] },
  selection: { title: "能量轨迹", hint: "比较下一首的情绪走势", labels: ["LOW", "MID", "HIGH"] },
  final: { title: "转场流程", hint: "把整套动作连起来", labels: ["A", "MIX", "B"] }
};

const COURSE_SOUNDSETS = {
  beat: { style: "hiphop", genre: "HIP-HOP", a: "重拍底鼓", b: "切分采样感旋律", note: "鼓点留白清楚，适合第一次数拍" },
  phrase: { style: "song", genre: "旋律训练", a: "欢乐颂 · 前奏与主旋律", b: "接入和弦", note: "先听前奏，再用 Cue 找回主旋律开头" },
  prep: { style: "kpop", genre: "K-POP", a: "明亮律动", b: "副歌合成器", note: "同组声音继续练第一拍与 Cue" },
  levels: { style: "pop", genre: "POP", a: "流行鼓组", b: "宽阔和弦", note: "层次稳定，适合练速度与拍点同步" },
  eq: { style: "folkfusion", genre: "民乐融合", a: "低鼓与弹拨", b: "五声音阶碎片", note: "东方音色遇上国际节奏，频段区别更清楚" },
  selection: { style: "folkfusion", genre: "民乐融合", a: "低鼓与弹拨", b: "五声音阶碎片", note: "用音色反差练低频交换" },
  final: { style: "pop", genre: "GLOBAL POP", a: "流行鼓组", b: "上扬主旋律", note: "换一组声音完成最终 Mix" }
};

function syncBpmInputs() {
  for (const deckId of ["a", "b"]) {
    const bpm = engine.decks[deckId]?.track?.bpm;
    if (!bpm) continue;
    const upper = deckId.toUpperCase();
    $(`#bpmInput${upper}`).value = bpm.toFixed(1);
    $(`#bpm${upper}`).textContent = bpm.toFixed(0);
  }
}

async function applyCourseSoundset(course) {
  runtime.userTracks.a = false;
  runtime.userTracks.b = false;
  const soundset = COURSE_SOUNDSETS[course] || COURSE_SOUNDSETS.beat;
  const aName = $("#deckATitle>span:last-child");
  const bName = $("#deckBTitle>span:last-child");
  try {
    const loaded = await engine.loadCourseTracks(course);
    const a = loaded?.find((track) => track.deck === "a");
    const b = loaded?.find((track) => track.deck === "b");
    if (a) {
      if (aName) aName.textContent = `${a.title} · ${a.style}`;
      if (bName) bName.textContent = b ? `${b.title} · ${b.style}` : "等待载入 B";
      syncBpmInputs();
      $("#practiceDisplayStatus").textContent = `${a.style}${b ? ` → ${b.style}` : ""} · 真实曲目`;
      return;
    }
  } catch { /* 曲目不可用时回退到合成训练轨 */ }
  engine.setTrainingStyle(soundset.style);
  if (aName) aName.textContent = `${soundset.a} · ${soundset.genre}`;
  if (bName) bName.textContent = `${soundset.b} · ${soundset.genre}`;
  syncBpmInputs();
  $("#practiceDisplayStatus").textContent = `${soundset.genre} · ${soundset.note}`;
}

function renderCourseWidget(course) {
  const widget = COURSE_WIDGETS[course];
  if (!widget) return;
  $("#courseWidget").hidden = false;
  $("#courseWidgetTitle").textContent = widget.title;
  $("#courseWidgetHint").textContent = widget.hint;
  $("#courseWidgetControls").innerHTML = widget.labels.map((label, index) => `<button type="button" data-course-widget-step="${index}" aria-pressed="${index === 0}"><i></i><span>${label}</span></button>`).join("");
}

let carouselIndex = 0;
let carouselPointerStart = null;
let carouselDidDrag = false;
let suppressCarouselClick = false;

function renderCourseCarousel(nextIndex = carouselIndex) {
  const items = $$(".course-list li");
  carouselIndex = (nextIndex + items.length) % items.length;
  items.forEach((item, index) => {
    let relative = index - carouselIndex;
    if (relative > items.length / 2) relative -= items.length;
    if (relative < -items.length / 2) relative += items.length;
    const angle = relative * Math.PI / 6;
    const visible = Math.abs(relative) <= 2;
    const edge = Math.abs(relative) === 2;
    const distance = Math.abs(relative) === 0 ? 0 : Math.abs(relative) === 1 ? 124 : 228;
    const orbitX = relative === 0 ? "50%" : relative < 0 ? `calc(50% - ${distance}px)` : `calc(50% + ${distance}px)`;
    item.style.setProperty("--orbit-x", orbitX);
    item.style.setProperty("--orbit-y", `${2 + (1 - Math.cos(angle)) * 132}px`);
    item.style.setProperty("--orbit-scale", relative === 0 ? "1.14" : Math.abs(relative) === 1 ? ".93" : ".78");
    item.style.setProperty("--orbit-opacity", visible ? (edge ? ".78" : "1") : "0");
    item.style.pointerEvents = visible ? "auto" : "none";
    item.style.zIndex = String(10 - Math.abs(relative));
    item.classList.toggle("is-orbit-current", relative === 0);
    item.classList.toggle("is-orbit-edge", edge);
    item.querySelector("button").tabIndex = visible ? 0 : -1;
  });
  const currentButton = items[carouselIndex]?.querySelector("[data-course]");
  const currentName = currentButton?.querySelector("strong")?.textContent || "认识节拍";
  const currentDescription = courseDescriptions[currentButton?.dataset.course] || "听懂两段歌从哪里接起来";
  const title = document.createElement("strong");
  const description = document.createElement("span");
  title.textContent = currentName;
  description.textContent = currentDescription;
  $("#courseCarouselName").replaceChildren(title, description);
  $("#courseCarouselName").dataset.course = currentButton?.dataset.course || "beat";
}

$("#coursePrev").addEventListener("click", () => renderCourseCarousel(carouselIndex - 1));
$("#courseNext").addEventListener("click", () => renderCourseCarousel(carouselIndex + 1));
$("#courseCarouselName").addEventListener("click", (event) => startCourse(event.currentTarget.dataset.course));
$(".course-list").addEventListener("pointerdown", (event) => {
  carouselPointerStart = { x: event.clientX, lastX: event.clientX, lastTime: performance.now(), velocity: 0, button: event.target.closest("[data-course]") };
  carouselDidDrag = false;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.currentTarget.classList.add("is-dragging");
});
$(".course-list").addEventListener("pointermove", (event) => {
  if (!carouselPointerStart) return;
  event.preventDefault();
  const now = performance.now();
  const elapsed = Math.max(8, now - carouselPointerStart.lastTime);
  carouselPointerStart.velocity = (event.clientX - carouselPointerStart.lastX) / elapsed;
  carouselPointerStart.lastX = event.clientX;
  carouselPointerStart.lastTime = now;
  const delta = event.clientX - carouselPointerStart.x;
  if (Math.abs(delta) > 6) carouselDidDrag = true;
  event.currentTarget.style.setProperty("--drag-x", `${delta * .72}px`);
});
$(".course-list").addEventListener("pointerup", (event) => {
  if (carouselPointerStart == null) return;
  const tappedButton = carouselPointerStart.button;
  const tappedIndex = tappedButton ? $$(".course-list li").indexOf(tappedButton.closest("li")) : -1;
  const tappedCourse = tappedButton?.dataset.course;
  const wasDrag = carouselDidDrag;
  const delta = event.clientX - carouselPointerStart.x;
  const projected = delta + carouselPointerStart.velocity * 150;
  carouselPointerStart = null;
  event.currentTarget.classList.remove("is-dragging");
  event.currentTarget.style.setProperty("--drag-x", "0px");
  if (!wasDrag && tappedIndex >= 0 && tappedCourse) {
    suppressCarouselClick = true;
    const needsCentering = tappedIndex !== carouselIndex;
    renderCourseCarousel(tappedIndex);
    if (!needsCentering) startCourse(tappedCourse);
    return;
  }
  const steps = Math.max(-3, Math.min(3, Math.round(-projected / 72)));
  renderCourseCarousel(carouselIndex + steps);
});
$(".course-list").addEventListener("pointercancel", (event) => {
  carouselPointerStart = null;
  event.currentTarget.classList.remove("is-dragging");
  event.currentTarget.style.setProperty("--drag-x", "0px");
});
let carouselWheelTimer = null;
$(".course-list").addEventListener("wheel", (event) => {
  event.preventDefault();
  if (carouselWheelTimer) return;
  const direction = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) > 0 ? 1 : -1;
  renderCourseCarousel(carouselIndex + direction);
  carouselWheelTimer = window.setTimeout(() => { carouselWheelTimer = null; }, 220);
}, { passive: false });

function renderModuleCourse() {
  const course = MODULE_COURSES[runtime.currentCourse];
  if (!course) return;
  if (controller3d?.host?.closest("#moduleStage")) $("#mixer").before(controller3d.host);
  const step = course.steps[runtime.moduleIndex];
  runtime.moduleUnlocked = false;
  runtime.conceptStep = 0;
  delete document.body.dataset.learningZone;
  document.body.classList.remove("lesson-finished");
  $("#moduleFinish").hidden = true;
  $("#moduleStage").hidden = false;
  $("#moduleProgress").hidden = false;
  $("#moduleFeedback").hidden = false;
  $("#moduleRestart").hidden = false;
  $("#moduleAdvance").disabled = false;
  $("#moduleFeedback").textContent = "";
  $("#moduleAdvance").hidden = step.kind === "choice" || (runtime.currentCourse === "phrase" && step.kind === "action");
  $("#moduleAdvance").textContent = step.kind === "range" ? "检查一下" : step.kind === "action" ? step.label : "继续";
  $("#moduleLabel").textContent = `学习 ${course.number} · ${runtime.moduleIndex + 1} / ${course.steps.length}`;
  document.body.style.setProperty("--lesson-progress", `${((runtime.moduleIndex + 1) / course.steps.length) * 100}%`);
  $("#moduleTitle").textContent = step.title;
  $("#moduleIntro").textContent = step.question;
  $("#moduleProgress").innerHTML = course.steps.map((item, index) => `<div class="module-knowledge ${index < runtime.moduleIndex ? "is-done" : ""} ${index === runtime.moduleIndex ? "is-current" : ""}" aria-label="${item.title}${index < runtime.moduleIndex ? "，已完成" : index === runtime.moduleIndex ? "，正在学习" : "，未开始"}"><i aria-hidden="true"></i><span>${item.title}</span></div>`).join("");
  if (step.kind === "choice") {
    $("#moduleStage").innerHTML = `<fieldset class="module-choice"><legend>选一个</legend>${step.options.map((option, index) => `<button type="button" data-module-answer="${index}"><span>${String.fromCharCode(65 + index)}</span>${option}</button>`).join("")}</fieldset>`;
  } else if (step.kind === "range") {
    const display = (value) => step.unit === "BPM" ? `${Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1)} BPM` : `${(step.base + Number(value)).toFixed(0)} dB`;
    $("#moduleStage").innerHTML = `<div class="module-range-wrap">${step.meter ? `<div class="module-meter"><div class="module-meter-readout"><span>当前峰值</span><strong id="moduleMeterValue">${display(step.value)}</strong></div><div class="module-meter-track"><i id="moduleMeterFill"></i></div><div class="module-meter-scale"><span>−24</span><span>−12</span><span>−6</span><span>0 dB</span></div><small>绿色留有余量 · 不要顶到红区</small></div>` : `<div class="module-bpm-readout"><span>Deck B</span><strong id="moduleRangeValue">${display(step.value)}</strong></div>`}<label class="module-range"><span>${step.unit === "BPM" ? "校正速度" : "调整 Gain"}</span><input id="moduleRangeInput" type="range" min="${step.min}" max="${step.max}" step="${step.step || 1}" value="${step.value}" aria-label="${step.unit === "BPM" ? "校正 Deck B 的 BPM" : "调整示例 Gain"}" /><output id="moduleRangeOutput">${step.unit === "BPM" ? display(step.value) : `+${step.value} dB Gain`}</output></label></div>`;
    updateModuleRange();
  } else {
    const controllerConcepts = {
      controls: `<div class="controller-concept controller-zones" aria-label="打碟台五个区域"><button class="is-current" data-concept-part="0" data-zone="deck-a"><b>Deck A</b><small>左侧播放区</small></button><button data-concept-part="1" data-zone="transport-a" disabled><b>Play / Cue</b><small>开始与返回起点</small></button><button data-concept-part="2" data-zone="mixer" disabled><b>Mixer</b><small>EQ 与音量</small></button><button data-concept-part="3" data-zone="crossfader" disabled><b>Crossfader</b><small>A 与 B 的交接</small></button><button data-concept-part="4" data-zone="deck-b" disabled><b>Deck B</b><small>右侧准备区</small></button></div>`,
      "cue-demo": `<div class="controller-concept controller-cue-steps" aria-label="设置并验证 Cue"><button class="is-current" data-concept-part="0" data-zone="play-a" data-cue-demo="play"><b>播放</b><small>找到想开始的位置</small></button><button data-concept-part="1" data-zone="pause-a" data-cue-demo="pause" disabled><b>暂停</b><small>停在目标位置</small></button><button data-concept-part="2" data-zone="set-cue-a" data-cue-demo="set" disabled><b>存 Cue</b><small>保存起跑标记</small></button><button data-concept-part="3" data-zone="replay-a" data-cue-demo="replay" disabled><b>再播放</b><small>离开起跑点</small></button><button data-concept-part="4" data-zone="cue-a" data-cue-demo="return" disabled><b>回 Cue</b><small>返回标记并停住</small></button></div>`,
      "sync-demo": `<div class="controller-concept controller-cue-steps" aria-label="同步 B 的两步操作"><button class="is-current" data-concept-part="0" data-zone="play-b" data-mix-operation="play-b"><b>播放 B</b><small>启动右侧音轨</small></button><button data-concept-part="1" data-zone="sync-b" data-mix-operation="sync-b" disabled><b>Sync</b><small>统一速度和拍点</small></button></div>`,
      "transition-demo": `<div class="controller-concept controller-cue-steps" aria-label="完成转场的三步操作"><button class="is-current" data-concept-part="0" data-zone="low-swap" data-mix-operation="low-swap"><b>低频交换</b><small>让 B 的底鼓接手</small></button><button data-concept-part="1" data-zone="cross-to-b" data-mix-operation="cross-to-b" data-requires-drag disabled><b>推向 B</b><small>亲手拖动 Crossfader</small></button><button data-concept-part="2" data-zone="finish-b" data-mix-operation="finish-b" disabled><b>确认交接</b><small>A 退场，B 继续</small></button></div>`
    };
    $("#moduleStage").innerHTML = runtime.currentCourse === "phrase" && controllerConcepts[step.action]
      ? controllerConcepts[step.action]
      : `<div class="module-action-card"><span class="module-action-icon" aria-hidden="true">Ⅱ</span><p>这一步会直接操作练习 Deck</p><small>只使用内置训练音乐，不会打开或上传你的文件。</small></div>`;
  }
  const widget = runtime.currentCourse === "phrase" ? null : MODULE_WIDGETS[runtime.currentCourse];
  if (widget) {
    $("#moduleStage").insertAdjacentHTML("afterbegin", `<button class="module-mini-widget" type="button" data-widget-preview data-kind="${widget.kind}"><span><strong>${widget.label}</strong><small>${widget.hint}</small></span><i aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i></button>`);
  }
  if (runtime.currentCourse === "phrase" && ["cue-demo", "sync-demo", "transition-demo"].includes(step.action)) {
    const firstZone = { "cue-demo": "play-a", "sync-demo": "play-b", "transition-demo": "low-swap" }[step.action];
    document.body.dataset.learningZone = firstZone;
    $("#moduleFeedback").textContent = LEARNING_ZONE_COPY[firstZone];
    if (controller3d?.host) {
      $("#moduleStage").append(controller3d.host);
    }
  }
}

function updateModuleRange() {
  const input = $("#moduleRangeInput");
  if (!input) return;
  const step = MODULE_COURSES[runtime.currentCourse].steps[runtime.moduleIndex];
  const value = Number(input.value);
  const display = step.unit === "BPM" ? `${value.toFixed(Number.isInteger(value) ? 0 : 1)} BPM` : `${(step.base + value).toFixed(0)} dB`;
  const output = $("#moduleRangeOutput");
  const meter = $("#moduleMeterValue");
  if (output) output.textContent = step.unit === "BPM" ? display : `+${value} dB Gain`;
  if (meter) meter.textContent = display;
  const fill = $("#moduleMeterFill");
  if (fill) {
    const peak = step.base + value;
    fill.style.width = `${Math.max(0, Math.min(100, (peak + 24) / 24 * 100))}%`;
    fill.classList.toggle("is-hot", peak > -6);
  }
}

function unlockModuleStep(message) {
  showCharacterReaction("correct", "对了，继续！");
  runtime.moduleUnlocked = true;
  $("#moduleProgress .is-current")?.classList.add("is-done");
  $("#moduleFeedback").textContent = message;
  $("#moduleAdvance").textContent = runtime.moduleIndex === MODULE_COURSES[runtime.currentCourse].steps.length - 1 ? "完成学习" : "继续";
  $("#moduleAdvance").hidden = false;
}

async function previewCourseTechnique(kind) {
  if (!engine.context) {
    await engine.initialize();
    document.body.classList.add("audio-ready");
    $("#soundGate").setAttribute("aria-pressed", "true");
    $("#soundGate span").textContent = "声音已启动";
    void applyCourseSoundset(runtime.currentCourse).catch(() => {});
  }
  await engine.previewTeachingDemo(kind);
}

function advanceModuleConcept(button) {
  if (!button || button.disabled || Number(button.dataset.conceptPart) !== runtime.conceptStep) return false;
  button.classList.remove("is-current");
  button.classList.add("is-done");
  runtime.conceptStep += 1;
  const next = $(`#moduleStage [data-concept-part="${runtime.conceptStep}"]`);
  if (next) {
    next.disabled = false;
    next.classList.add("is-current");
    if (next.dataset.zone) {
      document.body.dataset.learningZone = next.dataset.zone;
      $("#moduleFeedback").textContent = LEARNING_ZONE_COPY[next.dataset.zone] || "";
    }
  } else {
    delete document.body.dataset.learningZone;
    unlockModuleStep(MODULE_COURSES.phrase.steps[runtime.moduleIndex].success);
  }
  return true;
}

$("#moduleStage").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-concept-part]");
  if (!button || button.disabled || runtime.currentCourse !== "phrase") return;
  const index = Number(button.dataset.conceptPart);
  if (index !== runtime.conceptStep) return;
  if (button.dataset.requiresDrag != null) {
    $("#moduleFeedback").textContent = "按住打碟台中央最下方的 Crossfader，把它从中间亲手推到右侧 B；到达 85% 后才会解锁下一步。";
    controller3d?.host?.querySelector('[data-source="crossfader"]')?.focus({ preventScroll: true });
    return;
  }
  if (button.dataset.cueDemo) {
    if (!engine.decks.a || !engine.decks.b) await activateAudio();
    if (button.dataset.cueDemo === "play" || button.dataset.cueDemo === "replay") {
      if (!engine.decks.a.playing) await engine.toggle("a");
    } else if (button.dataset.cueDemo === "pause") {
      if (engine.decks.a.position() < 3.8) {
        $("#moduleFeedback").textContent = "前奏还没结束。继续听，等清楚的《欢乐颂》主旋律出现后再暂停。";
        return;
      }
      if (engine.decks.a.playing) await engine.toggle("a");
    } else if (button.dataset.cueDemo === "set" || button.dataset.cueDemo === "return") {
      engine.cueDeck("a");
    }
  }
  if (button.dataset.mixOperation) {
    if (!engine.decks.a || !engine.decks.b) await activateAudio();
    if (button.dataset.mixOperation === "play-b") {
      if (!engine.decks.a.playing) await engine.toggle("a");
      if (!engine.decks.b.playing) await engine.toggle("b");
    } else if (button.dataset.mixOperation === "sync-b") {
      await engine.syncB();
    } else if (button.dataset.mixOperation === "low-swap") {
      engine.setEq("a", "low", -12);
      engine.setEq("b", "low", 0);
      engine.setCrossfader(0);
      $("#lowA").value = -12;
      $("#lowB").value = 0;
      $("#crossfader").value = 0;
      renderCrossfader(0);
    } else if (button.dataset.mixOperation === "finish-b") {
      if (engine.decks.a.playing) engine.decks.a.pause();
      setTransport("a", false);
      setTransport("b", true);
    }
  }
  if (button.dataset.techniquePreview) {
    button.classList.add("is-playing");
    await previewCourseTechnique(button.dataset.techniquePreview);
    window.setTimeout(() => button.classList.remove("is-playing"), 1400);
  }
  advanceModuleConcept(button);
});

async function checkModuleStep() {
  const course = MODULE_COURSES[runtime.currentCourse];
  const step = course?.steps[runtime.moduleIndex];
  if (!step) return;
  if (runtime.moduleUnlocked) {
    if (runtime.moduleIndex < course.steps.length - 1) {
      runtime.moduleIndex += 1;
      renderModuleCourse();
      return;
    }
    markCourseCompleted(runtime.currentCourse);
    $("#moduleStage").hidden = true;
    $("#moduleProgress").hidden = true;
    $("#moduleFeedback").hidden = true;
    $("#moduleRestart").hidden = true;
    $("#moduleAdvance").hidden = true;
    $("#moduleFinishTitle").textContent = runtime.currentCourse === "phrase" ? "第一次交接完成" : `${course.title}，完成`;
    const next = nextCourse(runtime.currentCourse);
    $("#moduleNext").textContent = next ? `继续：${courseNames[next]}` : "返回学习页";
    document.body.classList.add("lesson-finished");
    $("#moduleFinish").hidden = false;
    return;
  }
  if (step.kind === "range") {
    const value = Number($("#moduleRangeInput").value);
    const passed = step.unit === "BPM"
      ? Math.abs(value - step.expected) <= step.tolerance
      : step.expected != null
        ? Math.abs(value - step.expected) <= step.tolerance
        : step.base + value >= step.low && step.base + value <= step.high;
    if (passed) unlockModuleStep(step.success);
    else { $("#moduleFeedback").textContent = step.retry; showCharacterReaction("wrong", "再试一次，你可以的"); }
    return;
  }
  if (step.kind === "action" && step.action === "sync") {
    $("#moduleAdvance").disabled = true;
    $("#moduleFeedback").textContent = "正在准备练习 Deck…";
    try {
      if (!engine.decks.a || !engine.decks.b) await engine.initialize();
      document.body.classList.add("audio-ready");
      if (!engine.decks.a?.playing) engine.toggle("a");
      await engine.syncB();
      unlockModuleStep(step.success);
    } catch {
      $("#moduleFeedback").textContent = "声音还没准备好。点顶部“启动声音”，再试一次。";
    } finally {
      $("#moduleAdvance").disabled = false;
    }
    return;
  }
  if (step.kind === "action") unlockModuleStep(step.success);
}

$("#moduleStage").addEventListener("click", (event) => {
  const preview = event.target.closest("[data-widget-preview]");
  if (preview) {
    preview.classList.toggle("is-playing");
    const hint = preview.querySelector("small");
    if (hint) hint.textContent = preview.classList.contains("is-playing") ? "正在演示，轻触暂停" : MODULE_WIDGETS[runtime.currentCourse]?.hint || "轻触预览";
    return;
  }
  const button = event.target.closest("[data-module-answer]");
  if (!button) return;
  const step = MODULE_COURSES[runtime.currentCourse]?.steps[runtime.moduleIndex];
  if (!step || step.kind !== "choice") return;
  const correct = Number(button.dataset.moduleAnswer) === step.answer;
  $$("#moduleStage [data-module-answer]").forEach((option) => {
    option.classList.remove("is-wrong");
    if (correct) {
      option.disabled = true;
      if (Number(option.dataset.moduleAnswer) === step.answer) option.classList.add("is-correct");
    }
  });
  if (correct) unlockModuleStep(step.success);
  else { button.classList.add("is-wrong"); $("#moduleFeedback").textContent = step.retry; showCharacterReaction("wrong", "再试一次，你可以的"); }
});
$("#moduleStage").addEventListener("input", updateModuleRange);
$("#moduleAdvance").addEventListener("click", checkModuleStep);
$("#moduleRestart").addEventListener("click", () => { runtime.moduleIndex = 0; renderModuleCourse(); });
$("#moduleNext").addEventListener("click", () => {
  const next = nextCourse(runtime.currentCourse);
  if (next) startCourse(next);
  else closeCourseScreen();
});

function setAppNav(active) {
  const tabs = { learning: $("#navHome"), mixer: $("#navPractice"), works: $("#navConsole") };
  Object.entries(tabs).forEach(([key, tab]) => {
    const selected = key === active;
    tab.classList.toggle("is-active", selected);
    if (selected) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
}

function formatWorkDuration(seconds) {
  const value = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function readBlobPlaybackDuration(blob, timeout = 3200) {
  if (!blob?.size) return Promise.resolve(0);
  return new Promise(resolve => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(blob);
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };
    const timer = window.setTimeout(() => finish(0), timeout);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => finish(audio.duration), { once: true });
    audio.addEventListener("error", () => finish(0), { once: true });
    audio.src = url;
  });
}

async function analyzePersonalMix(blob, bpm = 120) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const fallback = { bpm, energy: .18, dynamics: 6, brightness: .1 };
  if (!AudioContextClass || !blob?.arrayBuffer) return fallback;
  let context;
  try {
    context = new AudioContextClass();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const data = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(data.length / 180000));
    let sum = 0;
    let peak = 0;
    let crossings = 0;
    let previous = data[0] || 0;
    let samples = 0;
    for (let index = 0; index < data.length; index += stride) {
      const value = data[index];
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
      if ((value >= 0) !== (previous >= 0)) crossings += 1;
      previous = value;
      samples += 1;
    }
    const rms = Math.sqrt(sum / Math.max(1, samples));
    const dynamics = 20 * Math.log10(Math.max(.0001, peak) / Math.max(.0001, rms));
    return {
      bpm,
      energy: Math.min(1, rms),
      dynamics: Math.max(0, Math.min(24, dynamics)),
      brightness: Math.min(1, crossings / Math.max(1, samples) * 8)
    };
  } catch {
    return fallback;
  } finally {
    context?.close?.();
  }
}

function flatRealWaveform(count = 96) {
  return Array.from({ length: count }, () => 0.035);
}

function resampleRealWaveform(values, count = 96) {
  if (!Array.isArray(values) || !values.length) return flatRealWaveform(count);
  if (values.length === count) {
    return values.map((value) => Math.max(0.02, Math.min(1, Number(value) || 0)));
  }
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * values.length) / count);
    const end = Math.max(start + 1, Math.ceil(((index + 1) * values.length) / count));
    const slice = values.slice(start, end);
    return Math.max(0.02, Math.min(1, Math.max(...slice.map((value) => Number(value) || 0))));
  });
}

function sampleMasterWaveform() {
  const samples = engine.readWaveform();
  if (!samples?.length) return;
  let sum = 0;
  let peak = 0;
  for (const value of samples) {
    const amplitude = Math.abs((value - 128) / 128);
    sum += amplitude * amplitude;
    peak = Math.max(peak, amplitude);
  }
  const rms = Math.sqrt(sum / samples.length);
  recordWaveformSamples.push(Math.min(1, Math.max(0.02, rms * 2.7 + peak * 0.28)));
}

async function readRealWaveform(blob, count = 96) {
  if (!blob?.size) return flatRealWaveform(count);
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return flatRealWaveform(count);
  let context;
  try {
    context = new AudioContextClass();
    const decoded = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const channel = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / count));
    const values = Array.from({ length: count }, (_, index) => {
      const start = index * blockSize;
      const end = index === count - 1 ? channel.length : Math.min(channel.length, start + blockSize);
      let peak = 0;
      let sum = 0;
      let sampleCount = 0;
      for (let cursor = start; cursor < end; cursor += 1) {
        const amplitude = Math.abs(channel[cursor]);
        peak = Math.max(peak, amplitude);
        sum += amplitude * amplitude;
        sampleCount += 1;
      }
      const rms = sampleCount ? Math.sqrt(sum / sampleCount) : 0;
      return Math.min(1, Math.max(0.02, rms * 2.4 + peak * 0.22));
    });
    return resampleRealWaveform(values, count);
  } catch (error) {
    return flatRealWaveform(count);
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

function waveformHTML(values) {
  return values.map((value, index) => `<i style="--wave:${Math.round(value * 100)}%;--delay:${index * -18}ms"></i>`).join("");
}

const MIX_STORY_CHAPTERS = [
  { key: "intro", label: "Intro", ratio: 0, copy: "作品从这里开始，先让听众进入你的声音空间。" },
  { key: "deck-a", label: "Deck A", ratio: .12, copy: "第一首歌建立节奏与能量，给后面的变化留下参照。" },
  { key: "blend", label: "Blend", ratio: .31, copy: "两首歌第一次同时出现，注意频率是否互相遮挡。" },
  { key: "handoff", label: "Handoff", ratio: .5, copy: "转场瞬间：声音重心从 A 交给 B，最值得回听。" },
  { key: "deck-b", label: "Deck B", ratio: .64, copy: "第二首歌接住主输出，确认底鼓、音量和节拍保持稳定。" },
  { key: "outro", label: "Outro", ratio: .87, copy: "收尾让作品落地，也给下一段音乐留下出口。" }
];

function readMixStoryNotes() {
  try { return JSON.parse(localStorage.getItem(MIX_STORY_NOTES_KEY) || "{}"); }
  catch { return {}; }
}

function mixStoryMoods(work) {
  const analysis = work?.analysis || {};
  const moods = [];
  if (Number(analysis.energy) >= .24 || Number(work?.bpm) >= 128) moods.push("高能");
  else if (Number(work?.bpm) <= 106) moods.push("慢热");
  else moods.push("流动");
  moods.push(Number(analysis.brightness) >= .16 ? "明亮" : "柔和");
  moods.push(Number(analysis.dynamics) >= 8 ? "有层次" : "稳定");
  return moods;
}

function renderMixStory(work) {
  if (!work) return;
  const duration = Math.max(1, Number(work.duration || 1));
  $("#mixStoryChapters").innerHTML = MIX_STORY_CHAPTERS.map(chapter => {
    const time = duration * chapter.ratio;
    return `<button type="button" data-story-chapter="${chapter.key}" data-story-time="${time}"><span>${escapeHTML(chapter.label)}</span><time>${formatWorkDuration(time)}</time></button>`;
  }).join("");
  $("#mixStoryMoods").innerHTML = mixStoryMoods(work).map(mood => `<span>${escapeHTML(mood)}</span>`).join("");
  runtime.activeStoryKey = "intro";
  syncMixStory(true);
}

function syncMixStory(force = false) {
  const work = activeLibraryWork();
  if (!work || !$("#mixStoryChapters")) return;
  const audio = $("#libraryAudio");
  const duration = Number.isFinite(audio.duration) ? audio.duration : Math.max(1, Number(work.duration || 1));
  const progress = duration ? (audio.currentTime || 0) / duration : 0;
  let chapter = MIX_STORY_CHAPTERS[0];
  for (const item of MIX_STORY_CHAPTERS) if (progress >= item.ratio) chapter = item;
  if (!force && runtime.activeStoryKey === chapter.key) return;
  runtime.activeStoryKey = chapter.key;
  $$("[data-story-chapter]").forEach(button => {
    const active = button.dataset.storyChapter === chapter.key;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
  });
  const chapterTime = duration * chapter.ratio;
  $("#libraryNowLabel").textContent = chapter.label.toUpperCase();
  $("#mixStoryMomentTime").textContent = formatWorkDuration(chapterTime);
  $("#mixStoryMomentTitle").textContent = chapter.key === "handoff" ? "转场瞬间 · Handoff" : chapter.label;
  $("#mixStoryMomentCopy").textContent = chapter.copy;
  $("#mixStoryFace").dataset.expression = chapter.key;
  $("#mixStoryNote").value = readMixStoryNotes()[work.id]?.[chapter.key] || "";
  $("#mixStorySave").textContent = "保存备注";
}

function saveMixStoryNote() {
  const work = activeLibraryWork();
  if (!work || !runtime.activeStoryKey) return;
  const notes = readMixStoryNotes();
  notes[work.id] ||= {};
  notes[work.id][runtime.activeStoryKey] = $("#mixStoryNote").value.trim();
  localStorage.setItem(MIX_STORY_NOTES_KEY, JSON.stringify(notes));
  $("#mixStorySave").textContent = "已保存";
}

async function shareMixStoryPoster() {
  const work = activeLibraryWork();
  if (!work) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#d9efea"); gradient.addColorStop(.52, "#e7e0f2"); gradient.addColorStop(1, "#f0dfda");
  context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = "#211c27"; context.fillRect(70, 76, 940, 1040);
  context.fillStyle = "#baff2e"; context.font = "700 34px sans-serif"; context.fillText("FIRST MIX / MIX STORY", 118, 145);
  context.fillStyle = "#ffffff"; context.font = "700 68px sans-serif";
  const title = work.title.length > 22 ? `${work.title.slice(0, 22)}…` : work.title;
  context.fillText(title, 118, 255);
  context.fillStyle = "#b9afbE"; context.font = "500 28px sans-serif"; context.fillText(`${work.date}  ·  ${formatWorkDuration(work.duration)}`, 118, 310);
  const values = resampleRealWaveform(work.waveform, 96);
  context.fillStyle = "#a985f1";
  values.forEach((value, index) => {
    const width = 760 / values.length;
    const height = 330 * value;
    context.fillRect(120 + index * width, 590 - height / 2, Math.max(4, width - 5), height);
  });
  context.fillStyle = "#baff2e"; context.font = "700 30px sans-serif";
  context.fillText(mixStoryMoods(work).join("  /  "), 118, 820);
  context.strokeStyle = "rgba(255,255,255,.24)"; context.lineWidth = 2; context.beginPath(); context.moveTo(118, 900); context.lineTo(960, 900); context.stroke();
  context.fillStyle = "#ffffff"; context.font = "600 32px sans-serif"; context.fillText("Intro  ·  Deck A  ·  Blend", 118, 970); context.fillText("Handoff  ·  Deck B  ·  Outro", 118, 1020);
  context.fillStyle = "#211c27"; context.font = "700 38px sans-serif"; context.fillText("YOUR FIRST MIX, DONE RIGHT", 70, 1215);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const file = new File([blob], `${work.title}-mix-story.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: work.title, text: "我的 FIRST MIX 作品故事", files: [file] }); return; } catch { /* download remains available after share cancellation */ }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = file.name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function activeLibraryWork() {
  return libraryWorks.find(work => work.id === runtime.activeWorkId) || null;
}

function syncLibraryPlayer() {
  const audio = $("#libraryAudio");
  const work = activeLibraryWork();
  const total = Number.isFinite(audio.duration) ? audio.duration : Number(work?.duration || 0);
  const progress = $("#libraryProgress");
  progress.max = total || 1;
  progress.value = Math.min(audio.currentTime || 0, total || 1);
  progress.style.setProperty("--player-progress", `${total ? (audio.currentTime || 0) / total * 100 : 0}%`);
  progress.setAttribute("aria-valuetext", `${formatWorkDuration(audio.currentTime || 0)} / ${formatWorkDuration(total)}`);
  $("#libraryElapsed").textContent = formatWorkDuration(audio.currentTime || 0);
  $("#libraryDuration").textContent = formatWorkDuration(total);
  $("#libraryPlayer").classList.toggle("is-playing", !audio.paused);
  $("#libraryPlay").setAttribute("aria-label", audio.paused ? "播放" : "暂停");
  $$('[data-work-id]').forEach(card => {
    const active = card.dataset.workId === runtime.activeWorkId;
    card.classList.toggle("is-active", active);
    card.classList.toggle("is-playing", active && !audio.paused);
    card.querySelector("[data-player-toggle]")?.setAttribute("aria-label", active && !audio.paused ? "暂停" : "播放");
  });
  syncMixStory();
}

async function activateLibraryWork(id, autoplay = true) {
  const audio = $("#libraryAudio");
  const work = libraryWorks.find(item => item.id === id);
  if (!work) return;
  if (runtime.activeWorkId !== id) {
    audio.pause();
    runtime.activeWorkId = id;
    audio.src = work.url;
    $("#libraryPlayerTitle").textContent = work.title;
    $("#libraryPlayerMeta").textContent = `${work.date} · ${formatWorkDuration(work.duration)}`;
    $("#libraryWave").innerHTML = waveformHTML(work.waveform);
    renderMixStory(work);
    $("#libraryPlayer").hidden = false;
    setLibraryPlayerExpanded(true);
    syncLibraryPlayer();
  }
  if (autoplay) {
    if (!audio.paused) audio.pause();
    else try { await audio.play(); } catch { /* the player remains ready when autoplay is unavailable */ }
  }
  syncLibraryPlayer();
}

function stepLibraryWork(offset) {
  if (!libraryWorks.length) return;
  const index = Math.max(0, libraryWorks.findIndex(work => work.id === runtime.activeWorkId));
  const target = libraryWorks[(index + offset + libraryWorks.length) % libraryWorks.length];
  activateLibraryWork(target.id, true);
}

function setLibraryPlayerExpanded(expanded) {
  const player = $("#libraryPlayer");
  const toggle = $("#libraryPlayerExpand");
  player.classList.toggle("is-expanded", expanded);
  player.tabIndex = expanded ? -1 : 0;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "收起播放器" : "展开播放器");
}

function closeLibraryPlayer() {
  const audio = $("#libraryAudio");
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  runtime.activeWorkId = null;
  $("#libraryPlayer").hidden = true;
  setLibraryPlayerExpanded(false);
  $("#libraryPlayer").classList.remove("is-playing");
  syncLibraryPlayer();
}

function setupLibraryPlayer() {
  const audio = $("#libraryAudio");
  audio.addEventListener("loadedmetadata", syncLibraryPlayer);
  audio.addEventListener("timeupdate", syncLibraryPlayer);
  audio.addEventListener("play", syncLibraryPlayer);
  audio.addEventListener("pause", syncLibraryPlayer);
  audio.addEventListener("ended", () => stepLibraryWork(1));
  $("#libraryPlay").addEventListener("click", async () => {
    if (!activeLibraryWork()) return;
    if (audio.paused) try { await audio.play(); } catch { /* media error is reflected by the paused state */ }
    else audio.pause();
  });
  $("#libraryProgress").addEventListener("input", event => { audio.currentTime = Number(event.currentTarget.value); syncLibraryPlayer(); });
  $("#libraryBack").addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  $("#libraryForward").addEventListener("click", () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
  $("#libraryPrevious").addEventListener("click", () => stepLibraryWork(-1));
  $("#libraryNext").addEventListener("click", () => stepLibraryWork(1));
  $("#libraryPlayerClose").addEventListener("click", closeLibraryPlayer);
  $("#libraryPlayerExpand").addEventListener("click", () => {
    setLibraryPlayerExpanded(!$("#libraryPlayer").classList.contains("is-expanded"));
  });
  const player = $("#libraryPlayer");
  player.addEventListener("click", event => {
    if (player.classList.contains("is-expanded") || event.target.closest("button,a,input,textarea,select,[contenteditable]")) return;
    setLibraryPlayerExpanded(true);
  });
  player.addEventListener("keydown", event => {
    if (event.target !== player || player.classList.contains("is-expanded") || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    setLibraryPlayerExpanded(true);
  });
  $("#mixStoryChapters").addEventListener("click", event => {
    const button = event.target.closest("[data-story-chapter]");
    if (!button) return;
    audio.currentTime = Number(button.dataset.storyTime || 0);
    runtime.activeStoryKey = null;
    syncMixStory(true);
  });
  $("#mixStorySave").addEventListener("click", saveMixStoryNote);
  $("#mixStoryShare").addEventListener("click", shareMixStoryPoster);
}

async function renderWorksLibrary() {
  if (!$("#libraryPlayer").hidden) closeLibraryPlayer();
  workObjectUrls.forEach(URL.revokeObjectURL);
  workObjectUrls = [];
  libraryWorks = [];
  const list = $("#worksList");
  const preview = new URLSearchParams(window.location.search).get("works-preview");
  if (preview === "filled" || preview === "empty") {
    const filled = preview === "filled";
    $("#worksEmpty").hidden = filled;
    $("#worksStorageNote").hidden = !filled;
    $("#worksCount").textContent = filled ? "版式预览 · 2 段示例 Mix" : "版式预览 · 暂无作品";
    const sampleWave = Array.from({ length: 96 }, (_, index) => .16 + .7 * Math.abs(Math.sin(index * .17) * Math.cos(index * .043 + .3)));
    list.innerHTML = filled ? [
      { order: "02", title: "傍晚的第一次转场", date: "10月11日 · 18:42", duration: "02:36", bpm: "120 BPM" },
      { order: "01", title: "给夜晚留一点节奏", date: "10月9日 · 21:15", duration: "03:18", bpm: "124 BPM" }
    ].map(work => `<div class="work-swipe"><article class="work-item work-player wave-work work-preview-card"><span class="work-cover" aria-hidden="true"><span>${work.order}</span><i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path class="play-shape" d="M8 5v14l11-7Z"/></svg></span><div class="work-info"><strong>${work.title}</strong><span>${work.date} · ${work.duration}</span><small>${work.bpm}</small></div><div class="work-wave" aria-hidden="true">${waveformHTML(sampleWave)}</div><button class="work-menu-toggle" type="button" data-work-menu-toggle aria-label="查看示例作品操作" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button><div class="work-menu" data-work-menu hidden><button type="button" disabled title="示例作品不可下载">下载 · 预览</button><button type="button" disabled title="示例作品不可重命名">重命名 · 预览</button><button type="button" disabled title="示例作品不可删除">删除 · 预览</button></div></article></div>`).join("") : "";
    return;
  }
  try {
    const works = await getWorks();
    $("#worksEmpty").hidden = works.length > 0;
    $("#worksStorageNote").hidden = works.length === 0;
    $("#worksCount").textContent = works.length ? `${works.length} 段本机 Mix，点按封面开始回听。` : "保存你真正想再听一次的 Mix。";
    libraryWorks = await Promise.all(works.map(async (work, index) => {
      const measuredDuration = await readBlobPlaybackDuration(work.blob);
      let normalizedWork = work;
      if (measuredDuration > Number(work.duration || 0) + 1) {
        normalizedWork = { ...work, duration: measuredDuration };
        await saveWork(normalizedWork);
      }
      const url = URL.createObjectURL(normalizedWork.blob);
      workObjectUrls.push(url);
      const date = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(normalizedWork.createdAt));
      const ext = normalizedWork.type.includes("ogg") ? "ogg" : "webm";
      const waveform = Array.isArray(normalizedWork.waveform) && normalizedWork.waveform.length
        ? resampleRealWaveform(normalizedWork.waveform, 96)
        : await readRealWaveform(normalizedWork.blob, 96);
      normalizedWork.waveform = waveform;
      return { ...normalizedWork, url, date, ext, waveform, order: String(works.length - index).padStart(2, "0") };
    }));
    list.innerHTML = libraryWorks.map(work => `<div class="work-swipe"><button class="work-swipe-delete" type="button" data-delete-work="${work.id}" tabindex="-1">删除</button><article class="work-item work-player wave-work" data-swipe-content data-work-id="${work.id}"><button class="work-cover" type="button" data-player-toggle aria-label="播放 ${escapeHTML(work.title)}"><span>${work.order}</span><i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path class="play-shape" d="M8 5v14l11-7Z"/><path class="pause-shape" d="M6.5 5h3v14h-3zm8 0h3v14h-3z"/></svg></button><div class="work-info"><strong>${escapeHTML(work.title)}</strong><span>${work.date} · ${formatWorkDuration(work.duration)}</span>${work.bpm ? `<small>${Math.round(work.bpm)} BPM</small>` : ""}</div><div class="work-wave" aria-hidden="true">${waveformHTML(work.waveform)}</div><button class="work-menu-toggle" type="button" data-work-menu-toggle aria-label="更多操作" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button><div class="work-menu" data-work-menu hidden><a href="${work.url}" download="${escapeHTML(work.title)}.${work.ext}">下载</a><button type="button" data-delete-work="${work.id}">删除</button></div></article></div>`).join("");
    list.querySelectorAll("[data-work-id]").forEach(card => {
      const menu = card.querySelector("[data-work-menu]");
      const rename = document.createElement("button");
      rename.type = "button";
      rename.dataset.workRename = "";
      rename.textContent = "重命名";
      menu.insertBefore(rename, menu.querySelector("[data-delete-work]"));
      const form = document.createElement("form");
      form.className = "work-rename-form";
      form.hidden = true;
      form.innerHTML = '<input name="title" type="text" maxlength="40" required aria-label="作品新名称"><button type="submit">保存</button><button type="button" data-cancel-rename>取消</button>';
      card.querySelector(".work-info").append(form);
    });
  } catch {
    $("#worksEmpty").hidden = false;
    $("#worksStorageNote").hidden = true;
    $("#worksCount").textContent = "本机作品暂时无法读取。";
    list.innerHTML = '<p class="works-error">无法读取本机作品。请检查浏览器是否允许站点存储。</p>';
  }
}

$("#worksList").addEventListener("click", async event => {
  const renameButton = event.target.closest("[data-work-rename]");
  if (renameButton) {
    const card = renameButton.closest("[data-work-id]");
    const form = card?.querySelector(".work-rename-form");
    if (!form) return;
    card.classList.add("is-renaming");
    form.hidden = false;
    form.elements.title.value = libraryWorks.find(work => work.id === card.dataset.workId)?.title || "";
    card.querySelector("[data-work-menu]").hidden = true;
    card.querySelector("[data-work-menu-toggle]").setAttribute("aria-expanded", "false");
    form.elements.title.focus();
    form.elements.title.select();
    return;
  }
  const cancelRename = event.target.closest("[data-cancel-rename]");
  if (cancelRename) {
    const card = cancelRename.closest("[data-work-id]");
    card.classList.remove("is-renaming");
    card.querySelector(".work-rename-form").hidden = true;
    card.querySelector("[data-work-menu-toggle]").focus();
    return;
  }
  const playButton = event.target.closest("[data-player-toggle]");
  if (playButton) {
    const card = playButton.closest("[data-work-id]");
    if (card) await activateLibraryWork(card.dataset.workId, true);
    return;
  }
  const menuToggle = event.target.closest("[data-work-menu-toggle]");
  if (menuToggle) {
    const menu = menuToggle.parentElement.querySelector("[data-work-menu]");
    const opening = menu.hidden;
    $$("[data-work-menu]").forEach(item => { item.hidden = true; item.classList.remove("opens-up"); });
    $$("[data-work-menu-toggle]").forEach(item => item.setAttribute("aria-expanded", "false"));
    menu.hidden = !opening;
    menuToggle.setAttribute("aria-expanded", String(opening));
    if (opening) menu.classList.toggle("opens-up", menu.getBoundingClientRect().bottom > window.innerHeight - 92);
    return;
  }
  const button = event.target.closest("[data-delete-work]");
  if (!button) return;
  await deleteWork(button.dataset.deleteWork);
  await renderWorksLibrary();
});

document.addEventListener("pointerdown", event => {
  if (!document.body.classList.contains("works-open")) return;
  if (event.target.closest("#worksList [data-work-menu], #worksList [data-work-menu-toggle]")) return;
  $$("#worksList [data-work-menu]:not([hidden])").forEach(menu => { menu.hidden = true; menu.classList.remove("opens-up"); });
  $$("#worksList [data-work-menu-toggle][aria-expanded='true']").forEach(button => button.setAttribute("aria-expanded", "false"));
});

$("#worksList").addEventListener("submit", async event => {
  const form = event.target.closest(".work-rename-form");
  if (!form) return;
  event.preventDefault();
  const card = form.closest("[data-work-id]");
  const title = form.elements.title.value.trim();
  if (!title) { form.elements.title.focus(); return; }
  const saveButton = form.querySelector('[type="submit"]');
  saveButton.disabled = true;
  try {
    const original = (await getWorks()).find(work => work.id === card.dataset.workId);
    if (!original) throw new Error("作品不存在");
    await saveWork({ ...original, title });
    const current = libraryWorks.find(work => work.id === original.id);
    if (current) current.title = title;
    card.querySelector(".work-info strong").textContent = title;
    card.querySelector("[data-player-toggle]").setAttribute("aria-label", `播放 ${title}`);
    card.querySelector(".work-menu a[download]").download = `${title}.${current?.ext || "webm"}`;
    if (runtime.activeWorkId === original.id) $("#libraryPlayerTitle").textContent = title;
    card.classList.remove("is-renaming");
    form.hidden = true;
    card.querySelector("[data-work-menu-toggle]").focus();
  } catch {
    form.elements.title.setCustomValidity("保存失败，请再试一次");
    form.elements.title.reportValidity();
    form.elements.title.addEventListener("input", () => form.elements.title.setCustomValidity(""), { once: true });
  } finally {
    saveButton.disabled = false;
  }
});

$("#worksList").addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const form = event.target.closest(".work-rename-form");
  if (form) { event.preventDefault(); form.querySelector("[data-cancel-rename]").click(); return; }
  const menu = event.target.closest("[data-work-menu]");
  if (!menu) return;
  event.preventDefault();menu.hidden = true;menu.classList.remove("opens-up");
  const toggle = menu.parentElement.querySelector("[data-work-menu-toggle]");
  toggle.setAttribute("aria-expanded", "false");toggle.focus();
});

const SWIPE_DELETE_WIDTH = 88;
let workSwipe = null;

function settleWorkSwipe(content, open) {
  content.closest(".work-swipe")?.classList.toggle("is-open", open);
  content.style.transform = open ? `translateX(-${SWIPE_DELETE_WIDTH}px)` : "";
  const deleteButton = content.closest(".work-swipe")?.querySelector(".work-swipe-delete");
  if (deleteButton) deleteButton.tabIndex = open ? 0 : -1;
}

$("#worksList").addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" || event.target.closest("audio,a,button,input")) return;
  const content = event.target.closest("[data-swipe-content]");
  if (!content) return;
  $$("#worksList [data-swipe-content]").forEach(item => { if (item !== content) settleWorkSwipe(item, false); });
  workSwipe = { content, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, base: content.closest(".work-swipe")?.classList.contains("is-open") ? -SWIPE_DELETE_WIDTH : 0, horizontal: null };
  content.setPointerCapture(event.pointerId);
});

$("#worksList").addEventListener("pointermove", event => {
  if (!workSwipe || workSwipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - workSwipe.startX;
  const dy = event.clientY - workSwipe.startY;
  if (workSwipe.horizontal == null && Math.max(Math.abs(dx), Math.abs(dy)) > 6) workSwipe.horizontal = Math.abs(dx) > Math.abs(dy);
  if (!workSwipe.horizontal) return;
  event.preventDefault();
  const offset = Math.max(-SWIPE_DELETE_WIDTH, Math.min(0, workSwipe.base + dx));
  workSwipe.content.style.transform = `translateX(${offset}px)`;
});

function finishWorkSwipe(event) {
  if (!workSwipe || workSwipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - workSwipe.startX;
  const open = workSwipe.horizontal && workSwipe.base + dx < -(SWIPE_DELETE_WIDTH * .42);
  settleWorkSwipe(workSwipe.content, open);
  workSwipe = null;
}

$("#worksList").addEventListener("pointerup", finishWorkSwipe);
$("#worksList").addEventListener("pointercancel", finishWorkSwipe);

async function toggleRecording() {
  const button = $("#recordButton");
  const recorder = $("#mixRecorder");
  if (!recorder.classList.contains("is-recording")) {
    try {
      await engine.startRecording();
      recordWaveformSamples = [];
      window.clearInterval(recordWaveformTimer);
      sampleMasterWaveform();
      recordWaveformTimer = window.setInterval(sampleMasterWaveform, 90);
      recordSeconds = 0;
      recordStartedAt = Date.now();
      $("#recordTime").textContent = "00:00";
      $("#recordStatus").textContent = "正在记录打碟台最终输出";
      button.textContent = "结束并保存";
      recorder.classList.add("is-recording");
      recordTimer = window.setInterval(() => { recordSeconds += 1; $("#recordTime").textContent = formatWorkDuration(recordSeconds); }, 1000);
    } catch (error) {
      $("#recordStatus").textContent = error.message;
    }
    return;
  }
  try {
    const stoppedAt = Date.now();
    const result = await engine.stopRecording();
    window.clearInterval(recordWaveformTimer);
    recordWaveformTimer = null;
    sampleMasterWaveform();
    window.clearInterval(recordTimer);
    const createdAt = Date.now();
    const stamp = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt)).replace(/[\/:]/g,"-").replace(/\s/g,"_");
    const bpmA = Number($("#bpmA").textContent) || 120;
    const bpmB = Number($("#bpmB").textContent) || bpmA;
    const bpm = Math.round((bpmA + bpmB) / 2);
    const aiEligible = hasPersonalTrackPair();
    const analysis = aiEligible ? await analyzePersonalMix(result.blob, bpm) : null;
    const waveform = resampleRealWaveform(recordWaveformSamples, 96);
    const duration = Math.max(1, result.duration || 0, recordSeconds, recordStartedAt ? (stoppedAt - recordStartedAt) / 1000 : 0);
    await saveWork({ id: crypto.randomUUID(), title: `FIRST MIX_${stamp}`, createdAt, duration, type: result.type, bpm, sourceKind: aiEligible ? "personal-pair" : "training-or-mixed", aiEligible, analysis, waveform, blob: result.blob });
    if (aiEligible) recordProfileBpm(bpm);
    logActivity("work", "保存了一段 Mix", `${formatWorkDuration(duration)} · 本机作品记录`);
    $("#recordStatus").textContent = "已临时保存在本机，可前往“我的作品”下载";
    button.textContent = "再次录制";
    recorder.classList.remove("is-recording");
    recordStartedAt = 0;
  } catch (error) {
    window.clearInterval(recordWaveformTimer);
    recordWaveformTimer = null;
    recordStartedAt = 0;
    $("#recordStatus").textContent = error.message;
  }
}

$("#recordButton").addEventListener("click", toggleRecording);

function setPracticeCoach(enabled) {
  document.body.classList.toggle("practice-coach-on", enabled);
  const button = $("#coachToggle");
  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = enabled ? "教练已开" : "打开教练";
  localStorage.setItem("fm-practice-coach", enabled ? "on" : "off");
}

setPracticeCoach(localStorage.getItem("fm-practice-coach") !== "off");
$("#coachToggle").addEventListener("click", () => setPracticeCoach(!document.body.classList.contains("practice-coach-on")));

const PRACTICE_GUIDE_STEPS = [
  {
    title: "Deck A / B 与 LOAD",
    copy: "左边 Deck A 播放当前歌曲，右边 Deck B 准备下一首。两侧的 LOAD 分别给对应唱盘载入课程音乐或本机歌曲。",
    try: "点任一侧 LOAD，看看它会载入到哪一边。",
    targets: () => [controller3d?.host?.querySelector('[data-source="loadA"]')]
  },
  {
    title: "PLAY / PAUSE",
    copy: "PLAY / PAUSE 控制这一侧歌曲开始、暂停。它只改变这首歌是否在走，不负责设置返回位置。",
    try: "按左侧 PLAY / PAUSE，听 A 的节拍，再按一次暂停。",
    targets: () => [controller3d?.host?.querySelector('[data-source="playA"]')]
  },
  {
    title: "CUE：记住歌曲入口",
    copy: "暂停在想要的入口后按 CUE，可保存起点。播放后再按 CUE，就会停下并回到保存的位置；如果还没设过点，首次按下会先保存当前位置。",
    try: "播放 A 几秒后按 CUE，看屏幕是否显示“已保存 Cue”。",
    targets: () => [controller3d?.host?.querySelector('[data-source="cueA"]')]
  },
  {
    title: "唱盘：找拍点和微调",
    copy: "拖动唱盘可前后移动歌曲位置。拖机身空白处可调整观看角度；滚轮或双指缩放，放大后按住 Shift 拖动或双指移动，可查看边缘控件。",
    try: "轻拖左侧唱盘，看时间变化；再放大机身，移动视角查看边缘。",
    targets: () => [controller3d?.host?.querySelector('[data-source="jogA"]')]
  },
  {
    title: "TEMPO：改变播放速度",
    copy: "外侧的 TEMPO 推子改变歌曲实际速度。BPM 是每分钟拍数：数值升高会更快，降低会更慢。它不是音量推子。",
    try: "播放 A 后缓慢推 TEMPO，听鼓点间隔并看 BPM 同步变化。",
    targets: () => [controller3d?.host?.querySelector('[data-source="bpmInputA"]')]
  },
  {
    title: "BEAT SYNC：把两首歌对齐",
    copy: "BEAT SYNC 让 B 跟随 A 的当前速度，并尽量把拍点对在一起。它不会自动把 B 放进主输出，仍要用音量推子或 Crossfader 交接。",
    try: "先播放 A，再启动 B 并按 BEAT SYNC，观察两侧 BPM。",
    targets: () => [controller3d?.host?.querySelector('[data-source="syncB"]')]
  },
  {
    title: "HIGH：声音的亮度",
    copy: "HIGH 控制高频，例如踩镲和声音边缘的明亮感。两首歌同时很亮时，轻收一边的 HIGH 能减少刺耳感。",
    try: "播放 A，缓慢转动中央的 HIGH，听亮度变化。",
    targets: () => [controller3d?.host?.querySelector('[data-source="highA"]')]
  },
  {
    title: "MID：旋律和人声的存在感",
    copy: "MID 控制中频，许多人声、旋律和主体乐器都在这里。转场时收掉旧歌的 MID，能让新歌更清楚。",
    try: "比较 MID 调低前后，人声或旋律是否更靠后。",
    targets: () => [controller3d?.host?.querySelector('[data-source="midA"]')]
  },
  {
    title: "LOW：底鼓和低音",
    copy: "LOW 控制低频。两首歌叠放时，常先收掉 B 的 LOW，交接时再让 B 的低频接手，避免两个底鼓打架。",
    try: "先听 A 的底鼓，再把 LOW A 降低，比较声音厚度。",
    targets: () => [controller3d?.host?.querySelector('[data-source="lowA"]')]
  },
  {
    title: "FILTER：改变音色",
    copy: "中央两列最上方、HIGH 上面的旋钮就是 FILTER，A 和 B 各有一个。向左削去高频，向右削去低频，回到中间恢复原声。",
    try: "播放 A，左右拖动 A 列的 FILTER 听变化；双击旋钮可回到原声。",
    targets: () => [controller3d?.host?.querySelector('[data-source="filterA"]')]
  },
  {
    title: "通道音量推子：每首歌多响",
    copy: "中央两根竖推子分别控制 A 和 B 的音量。推高会让该首歌更响；它与外侧控制速度的 TEMPO 完全不同。",
    try: "只播放 A 时，缓慢移动左侧通道推子，听响度变化。",
    targets: () => [controller3d?.host?.querySelector('[data-source="volumeA"]')]
  },
  {
    title: "Crossfader：把声音交给另一首",
    copy: "底部横推子决定主输出中的 A/B 比例：最左只听 A，中间两首混合，最右只听 B。转场通常沿着它慢慢推进。",
    try: "两边都播放后，缓慢从左推到右，听声音如何交接。",
    targets: () => [controller3d?.host?.querySelector('[data-source="crossfader"]')]
  },
  {
    title: "HOT CUE：多个定位点",
    copy: "CUE 返回单个定位点并暂停；HOT CUE 每个打击垫可保存一个独立位置，触发后跳转并继续播放。按住 Shift 点击已保存的垫子可删除该点。",
    try: "播放 A，选 HOT CUE，点空白垫保存；再点一次触发，按住 Shift 点击可删除。",
    targets: () => [controller3d?.host?.querySelector('[data-source="mode-hot-cue-a"]'),controller3d?.host?.querySelector('[data-source="pad-a-1"]')]
  },
  {
    title: "LOOP：重复 4 或 8 拍",
    copy: "先按 LOOP，再按第 1 个打击垫循环 4 拍，或按第 2 个循环 8 拍；按第 3 个 OFF 退出，歌曲继续正常播放。",
    try: "播放 A，依次按 LOOP、4、8、OFF，比较两种循环长度。",
    targets: () => [controller3d?.host?.querySelector('[data-source="mode-loop-a"]'),controller3d?.host?.querySelector('[data-source="pad-a-1"]'),controller3d?.host?.querySelector('[data-source="pad-a-2"]'),controller3d?.host?.querySelector('[data-source="pad-a-3"]')]
  },
  {
    title: "PAD FX1：瞬时音效",
    copy: "选 PAD FX1 后，打击垫会对正在播放的歌曲短暂施加滤波效果。它用于点缀，不负责切歌或保存位置。",
    try: "播放 A，选 PAD FX1 后按一个垫子，听音色短暂变化。",
    targets: () => [controller3d?.host?.querySelector('[data-source="mode-pad-fx1-a"]'),controller3d?.host?.querySelector('[data-source="pad-a-1"]')]
  },
  {
    title: "BEAT JUMP：按拍数移动",
    copy: "选 BEAT JUMP 后，打击垫可按固定拍数向前或向后跳。它适合重新对齐乐句，不改变原曲的 BPM。",
    try: "选 BEAT JUMP，轻按垫子，观察屏幕时间前后移动。",
    targets: () => [controller3d?.host?.querySelector('[data-source="mode-beat-jump-a"]'),controller3d?.host?.querySelector('[data-source="pad-a-1"]')]
  },
  {
    title: "SAMPLER：直接触发声音",
    copy: "选 SAMPLER 后，打击垫会触发独立音效，例如底鼓、拍手、踩镲和电子音；即使歌曲没播放，也可以先试听。",
    try: "选 SAMPLER，按左侧任一个垫子，听它直接发声。",
    targets: () => [controller3d?.host?.querySelector('[data-source="mode-sampler-a"]'),controller3d?.host?.querySelector('[data-source="pad-a-1"]')]
  },
  {
    title: "电子屏：看速度、位置和波形",
    copy: "两侧电子屏显示曲名、BPM、播放时间、剩余时间及波形。耳朵负责判断听感，屏幕帮助你确认位置和两边速度。",
    try: "播放一首歌，留意时间、波形和播放状态怎样更新。",
    targets: () => [controller3d?.host?.querySelector(".model-display-flat")]
  },
  {
    title: "EQ / VOL 数值区",
    copy: "电子屏里的 EQ / VOL 可展开查看两边的高、中、低频及音量数值。这里和机身旋钮、推子同步，方便细调。",
    try: "点开任一侧 EQ / VOL，改变一个数值再看机身反馈。",
    expandAdjust: true,
    targets: () => [...(controller3d?.host?.querySelectorAll(".display-adjust") || [])]
  },
  {
    title: "录制 Mix：保存一次完整练习",
    copy: "录制会保存打碟台主输出的声音。开始录制前先检查两侧音乐和音量；完成后保存作品，并及时下载到自己的设备。",
    try: "准备好 A/B 后，点顶部“开始录制”；结束后到“我的作品”查看。",
    targets: () => [document.querySelector(".mix-recorder")]
  },
  {
    title: "教练与分析：看练习反馈",
    copy: "教练会提示当前该关注的节拍、衔接或清晰度。未连接 AI 时显示本地提示；连接后才会生成 AI 分析，不会提前给出结论。",
    try: "练完一段转场，再看提示和技术分；用它检查下一次练习方向。",
    coach: true,
    targets: () => [controller3d?.host?.querySelector(".model-coach"),controller3d?.host?.querySelector(".model-ai-score")]
  }
];
let practiceGuideIndex = 0;
let practiceGuideCoachWasOn = true;
let practiceGuideAdjustStates = [];
let practiceGuideScrollPosition = { windowY: 0, mainY: 0 };
let practiceGuideRenderToken = 0;
const practiceGuideSpotlight = document.createElement("div");
practiceGuideSpotlight.className = "practice-guide-spotlight";
practiceGuideSpotlight.hidden = true;
practiceGuideSpotlight.setAttribute("aria-hidden", "true");
document.body.append(practiceGuideSpotlight);

function updatePracticeGuideSpotlight(targets) {
  const rects = targets.map(target => target.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  if (!rects.length) {
    practiceGuideSpotlight.hidden = true;
    return;
  }
  const padding = 7;
  const left = Math.max(5, Math.min(...rects.map(rect => rect.left)) - padding);
  const top = Math.max(5, Math.min(...rects.map(rect => rect.top)) - padding);
  const right = Math.min(innerWidth - 5, Math.max(...rects.map(rect => rect.right)) + padding);
  const bottom = Math.min(innerHeight - 5, Math.max(...rects.map(rect => rect.bottom)) + padding);
  Object.assign(practiceGuideSpotlight.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
  practiceGuideSpotlight.hidden = false;
}

function clearPracticeGuideTargets() {
  $$(".is-practice-guide-target").forEach(element => element.classList.remove("is-practice-guide-target"));
  practiceGuideSpotlight.hidden = true;
}

function renderPracticeGuideStep() {
  const step = PRACTICE_GUIDE_STEPS[practiceGuideIndex];
  if (!step || $("#practiceGuide").hidden) return;
  const renderToken = ++practiceGuideRenderToken;
  clearPracticeGuideTargets();
  document.body.dataset.practiceGuideStep = String(practiceGuideIndex + 1);
  if (step.expandAdjust) $$(".display-adjust").forEach(details => { details.open = true; });
  if (step.coach) setPracticeCoach(true);
  const targets = step.targets().filter(Boolean);
  targets.forEach(element => element.classList.add("is-practice-guide-target"));
  $("#practiceGuideProgress").textContent = `${practiceGuideIndex + 1} / ${PRACTICE_GUIDE_STEPS.length}`;
  $("#practiceGuideTitle").textContent = step.title;
  $("#practiceGuideCopy").textContent = step.copy;
  $("#practiceGuideTry").textContent = step.try;
  $("#practiceGuidePrevious").disabled = practiceGuideIndex === 0;
  $("#practiceGuideNext").textContent = practiceGuideIndex === PRACTICE_GUIDE_STEPS.length - 1 ? "完成" : "下一步";
  requestAnimationFrame(() => {
    if (renderToken !== practiceGuideRenderToken || $("#practiceGuide").hidden) return;
    const main = $("main");
    const target = targets[0];
    // scrollIntoView also scrolls the overflow-hidden body on mobile, trapping the page below its top.
    if (target && main.contains(target)) {
      const rect = target.getBoundingClientRect();
      const safeTop = Math.max(150, main.getBoundingClientRect().top + 150);
      const safeBottom = Math.min(innerHeight - 240, main.getBoundingClientRect().bottom - 240);
      if (rect.top < safeTop || rect.bottom > safeBottom) {
        main.scrollTop += rect.top - Math.max(safeTop, (safeTop + safeBottom - rect.height) / 2);
      }
    }
    updatePracticeGuideSpotlight(targets);
    window.setTimeout(() => {
      if (renderToken === practiceGuideRenderToken && !$("#practiceGuide").hidden) updatePracticeGuideSpotlight(targets);
    }, 380);
  });
}

function openPracticeGuide() {
  if (!document.body.classList.contains("practice-open")) return;
  if (!controller3d) controller3d = createController(engine);
  if (controller3d?.host?.closest("#moduleStage")) $("#mixer").before(controller3d.host);
  practiceGuideCoachWasOn = document.body.classList.contains("practice-coach-on");
  practiceGuideAdjustStates = $$(".display-adjust").map(details => details.open);
  practiceGuideScrollPosition = { windowY: window.scrollY, mainY: $("main").scrollTop };
  document.body.scrollTop = 0;
  practiceGuideIndex = 0;
  $("#practiceGuide").hidden = false;
  $("#practiceGuideButton").setAttribute("aria-expanded", "true");
  document.body.classList.add("practice-guide-open");
  renderPracticeGuideStep();
}

function closePracticeGuide({ restore = true } = {}) {
  const guide = $("#practiceGuide");
  if (!guide) return;
  ++practiceGuideRenderToken;
  clearPracticeGuideTargets();
  guide.hidden = true;
  $("#practiceGuideButton")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("practice-guide-open");
  delete document.body.dataset.practiceGuideStep;
  if (restore) {
    $$(".display-adjust").forEach((details, index) => { details.open = Boolean(practiceGuideAdjustStates[index]); });
    setPracticeCoach(practiceGuideCoachWasOn);
    requestAnimationFrame(() => {
      $("main").scrollTop = practiceGuideScrollPosition.mainY;
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = practiceGuideScrollPosition.windowY;
    });
  }
}

$("#practiceGuideButton").addEventListener("click", () => {
  if ($("#practiceGuide").hidden) openPracticeGuide(); else closePracticeGuide();
});
$("#practiceGuideClose").addEventListener("click", () => closePracticeGuide());
$("#practiceGuidePrevious").addEventListener("click", () => {
  practiceGuideIndex = Math.max(0, practiceGuideIndex - 1);
  renderPracticeGuideStep();
});
$("#practiceGuideNext").addEventListener("click", () => {
  if (practiceGuideIndex >= PRACTICE_GUIDE_STEPS.length - 1) return closePracticeGuide();
  practiceGuideIndex += 1;
  renderPracticeGuideStep();
});
document.body.append($("#practiceGuide"));
window.addEventListener("resize", () => {
  if ($("#practiceGuide").hidden) return;
  updatePracticeGuideSpotlight(PRACTICE_GUIDE_STEPS[practiceGuideIndex].targets().filter(Boolean));
});

function openCourseScreen(course) {
  closePracticeGuide();
  closeTechniquesSheet({ immediate: true });
  document.body.classList.remove("lesson-finished");
  delete document.body.dataset.learningZone;
  $("#moduleFinish").hidden = true;
  document.body.dataset.course = course;
  document.body.classList.add("course-open", "course-console");
  document.body.classList.toggle("app-course-phrase", course === "phrase");
  document.body.classList.toggle("app-course-module", Boolean(MODULE_COURSES[course]));
  $("#workspaceBar").hidden = false;
  $("#workspaceTitle").textContent = courseNames[course];
  $("#workspaceMode").textContent = course === "phrase" ? "听觉训练" : "双通道练习";
  renderCourseWidget(course);
  setAppNav("learning");
  window.scrollTo(0, 0);
}

function closeCourseScreen() {
  closeTechniquesSheet({ immediate: true });
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  setTransport("a", false);
  setTransport("b", false);
  document.body.classList.remove("course-open", "course-console", "app-course-phrase", "app-course-module", "console-focus", "works-open", "practice-open");
  document.body.classList.remove("lesson-finished");
  delete document.body.dataset.learningZone;
  $("#moduleFinish").hidden = true;
  document.body.classList.add("hub-open");
  $("#workspaceBar").hidden = true;
  $("#courseWidget").hidden = true;
  $("#successSheet").hidden = true;
  setAppNav("learning");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => $("#courseTitle")?.focus?.({ preventScroll: true }), 350);
}

$("#courseWidgetControls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-course-widget-step]");
  if (!button) return;
  $$("#courseWidgetControls button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  $("#courseWidget").classList.remove("is-pulsing");
  requestAnimationFrame(() => $("#courseWidget").classList.add("is-pulsing"));
});

async function startCourse(course) {
  if (!controller3d) controller3d = createController(engine);
  if (controller3d?.host?.closest("#moduleStage")) $("#mixer").before(controller3d.host);
  runtime.freeMix = false;
  runtime.currentCourse = course;
  runtime.moduleIndex = 0;
  applyCourseSoundset(course);
  selectCourse(course);
  openCourseScreen(course);
  const moduleMode = Boolean(MODULE_COURSES[course]);
  runtime.phraseMode = course === "phrase" && !moduleMode;
  // Course 00 uses its own full-screen game layout even though it is backed by
  // the modular lesson runtime rather than the legacy phrase trainer.
  document.body.classList.toggle("app-course-phrase", course === "phrase");
  $("#moduleLesson").hidden = !moduleMode;
  $("#phraseLesson").hidden = !runtime.phraseMode;
  $("#lessonSection").hidden = runtime.phraseMode || moduleMode;
  tutorial.setCourse(course === "eq" || course === "final" ? "eq" : "quick");
  reset();
  if (moduleMode) {
    renderModuleCourse();
    return;
  }
  if (course === "phrase") {
    runtime.phraseCycles = 0;
    runtime.phraseHits = 0;
    runtime.lastPhraseBeat = null;
    runtime.lastPhraseSuccessCycle = -1;
    $("#phraseReadout").textContent = "等待播放";
    $("#phraseModeLabel").textContent = "第 1 遍 · 看着学";
    $("#phraseCycles").textContent = "抓对 0";
    $("#phraseFeedback").textContent = "第一遍看提示，第二遍盲听。";
    $("#markPhrase").disabled = true;
    $("#phraseSuccess").hidden = true;
    setTimeout(() => $("#startPhrase").focus({ preventScroll: true }), 350);
    return;
  }
  if (course === "eq") {
    if (!engine.decks.a || !engine.decks.b) await activateAudio();
    engine.toggle("a");
    tutorial.startAt(TUTORIAL_STEPS.SYNC);
    renderTutorial();
    await engine.syncB();
    showCoach("已为你准备好相同拍点。第二章从切掉 B 的低频开始，你可以专心听 EQ 如何改变转场。");
  }
  if (course === "final") {
    tutorial.startAt(TUTORIAL_STEPS.PLAY);
    renderTutorial();
  }
  setTimeout(() => (course === "eq" ? $("#lowB") : $("#lessonPrimaryAction"))?.focus({ preventScroll: true }), 350);
}

function progressIndex(step) {
  if (step <= TUTORIAL_STEPS.LISTEN) return step;
  if (step === TUTORIAL_STEPS.SYNC) return 2;
  if (step === TUTORIAL_STEPS.QUICK_MIX || step <= TUTORIAL_STEPS.INTRO_B) return 3;
  if (step === TUTORIAL_STEPS.SWAP_LOW) return 4;
  if (step <= TUTORIAL_STEPS.CLEAN_HIGH) return 5;
  if (step === TUTORIAL_STEPS.B_ONLY) return 6;
  return 7;
}

function highlightCurrentControl(step) {
  $$('[data-tutorial-control]').forEach((control) => control.classList.remove('is-next'));
  const ids = {
    [TUTORIAL_STEPS.CUT_B_LOW]: ['lowB'],
    [TUTORIAL_STEPS.QUICK_MIX]: ['crossfader'],
    [TUTORIAL_STEPS.INTRO_B]: ['crossfader'],
    [TUTORIAL_STEPS.SWAP_LOW]: ['lowA', 'lowB'],
    [TUTORIAL_STEPS.MOVE_MID]: ['midA'],
    [TUTORIAL_STEPS.CLEAN_HIGH]: ['highA'],
    [TUTORIAL_STEPS.B_ONLY]: ['crossfader']
  }[step] || [];
  ids.forEach((id) => document.getElementById(id)?.classList.add('is-next'));
}

const LESSON_ACTIONS = {
  [TUTORIAL_STEPS.PLAY]: { label: "播放 A", target: "playA", run: true, why: "先只听一首歌，耳朵更容易找到稳定的拍子。" },
  [TUTORIAL_STEPS.LISTEN]: { label: "听四拍…", target: null, disabled: true, why: "先听四个稳定鼓点，再加入第二首歌。" },
  [TUTORIAL_STEPS.SYNC]: { label: "同步 B", target: "syncB", run: true, why: "Sync 会把 B 的拍点与 A 对齐，但不会立刻把 B 放出来。" },
  [TUTORIAL_STEPS.QUICK_MIX]: { label: "去推 Crossfader", target: "crossfader", why: "推到中间后，两首歌会同时被听见。" },
  [TUTORIAL_STEPS.CUT_B_LOW]: { label: "去调 B 低频", target: "lowB", why: "先移走 B 的底鼓，避免两个低频叠在一起。" },
  [TUTORIAL_STEPS.INTRO_B]: { label: "引入 B", target: "crossfader", why: "先让 B 的中高频进入，转场会更干净。" },
  [TUTORIAL_STEPS.SWAP_LOW]: { label: "交换低频", target: "lowA", why: "先收 A，再放 B，低频不会突然变得过重。" },
  [TUTORIAL_STEPS.MOVE_MID]: { label: "收掉 A 中频", target: "midA", why: "中频承载大部分旋律，收掉后 A 会退到背景。" },
  [TUTORIAL_STEPS.CLEAN_HIGH]: { label: "收掉 A 高频", target: "highA", why: "最后移走 A 的亮度，让 B 完整接管。" },
  [TUTORIAL_STEPS.B_ONLY]: { label: "只留下 B", target: "crossfader", why: "推到最右边，A 会完全退出。" },
  [TUTORIAL_STEPS.COMPLETE]: { label: "转场完成", target: null, disabled: true, why: "你已经完成一次从 A 到 B 的声音交接。" }
};

function renderLessonAction(step) {
  const action = LESSON_ACTIONS[step] || LESSON_ACTIONS[TUTORIAL_STEPS.PLAY];
  const button = $("#lessonPrimaryAction");
  button.textContent = action.label;
  button.disabled = Boolean(action.disabled);
  button.dataset.target = action.target || "";
  button.dataset.run = action.run ? "true" : "false";
  $("#lessonWhyText").textContent = action.why;
  $("#lessonPauseButton").disabled = !engine.decks.a?.playing;
}

function renderTutorial({ preserveCoach = false } = {}) {
  const view = tutorial.snapshot();
  const currentProgress = progressIndex(view.step);
  $("#lessonTitle").textContent = view.copy.title;
  $("#lessonHint").textContent = view.copy.hint;
  renderLessonAction(view.step);
  $$(".lesson-progress span").forEach((item, index) => {
    item.classList.toggle("is-current", index === currentProgress);
    item.classList.toggle("is-done", index < currentProgress);
  });
  $("#workspaceMode").textContent = `第 ${currentProgress + 1} / 8 步`;
  $("#playA").classList.toggle("is-next", view.step === TUTORIAL_STEPS.PLAY);
  $("#syncB").classList.toggle("is-next", view.step === TUTORIAL_STEPS.SYNC);
  $("#crossfader").dataset.tutorialControl = "true";
  $$(".control-bank input").forEach((input) => { input.dataset.tutorialControl = "true"; });
  highlightCurrentControl(view.step);
  const localSyncReady = Boolean(engine.decks.a?.track.bpm && engine.decks.b?.track.bpm);
  $("#syncB").disabled = runtime.freeMix ? !localSyncReady : view.step !== TUTORIAL_STEPS.SYNC;
  $("#playB").disabled = !(view.completed || runtime.freeMix);
  $("#crossfader").disabled = !(view.canCrossfade || runtime.freeMix);
  $("#handoff").classList.toggle("is-locked", !(view.canCrossfade || runtime.freeMix));
  $$(".advanced-controls").forEach((controls) => {
    const locked = !(view.canAdjustEq || runtime.freeMix);
    controls.classList.toggle("is-locked", locked);
    controls.inert = locked;
    controls.querySelectorAll("input").forEach((input) => { input.disabled = locked; });
  });
  if (!preserveCoach && runtime.renderedStep !== view.step) {
    $("#coachMessage").hidden = true;
    runtime.renderedStep = view.step;
  }
  scheduleInactivityHint();
}

$("#lessonPrimaryAction").addEventListener("click", async (event) => {
  const target = document.getElementById(event.currentTarget.dataset.target);
  if (!target) return;
  if (event.currentTarget.dataset.run === "true") {
    target.click();
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => target.focus({ preventScroll: true }), 350);
});

$("#previewA").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  if (engine.decks.b?.playing) engine.toggle("b");
  $("#crossfader").value = -100;
  engine.setCrossfader(-1);
  renderCrossfader(-1);
  if (!engine.decks.a?.playing) engine.toggle("a");
});

$("#previewB").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  if (engine.decks.a?.playing) engine.toggle("a");
  $("#crossfader").value = 100;
  engine.setCrossfader(1);
  renderCrossfader(1);
  if (!engine.decks.b?.playing) engine.toggle("b");
});

$("#lessonPauseButton").addEventListener("click", async () => {
  if (!engine.decks.a) return;
  await engine.toggle("a");
  noteActivity();
});

function showCoach(message) {
  const coach = $("#coachMessage");
  coach.textContent = message;
  coach.hidden = false;
}

function scheduleInactivityHint() {
  clearTimeout(runtime.inactivityTimer);
  if (!document.body.classList.contains("course-open") || document.body.classList.contains("practice-open") || interfaceTour.active || runtime.moduleUnlocked) return;
  runtime.inactivityTimer = setTimeout(() => showCharacterReaction("hint", "需要提示吗？"), 12000);
}

function noteActivity() { scheduleInactivityHint(); }

let reactionTimer;
const reaction = document.createElement("aside");
reaction.className = "character-reaction";
reaction.hidden = true;
reaction.setAttribute("aria-live", "polite");
reaction.innerHTML = '<img class="reaction-face" src="./assets/characters/dj-feedback-avatar-v1.png" alt=""><span class="reaction-copy"></span>';
document.body.append(reaction);
// Keep the completion layer at the viewport root. A blurred lesson card creates a
// containing block that otherwise traps fixed children and causes the celebration
// to remain offset after returning to the hub.
document.body.append($("#moduleFinish"));
function showCharacterReaction(kind, message) {
  if (!document.body.classList.contains("course-open") || document.body.classList.contains("practice-open")) return;
  clearTimeout(reactionTimer);
  reaction.dataset.kind = kind;
  reaction.querySelector(".reaction-copy").textContent = message;
  reaction.hidden = false;
  reactionTimer = setTimeout(() => { reaction.hidden = true; }, kind === "hint" ? 6500 : 3200);
}
["pointerdown", "keydown", "input"].forEach(type => document.addEventListener(type, () => {
  scheduleInactivityHint();
}, { passive: true }));
new MutationObserver(() => {
  reaction.hidden = true;
  scheduleInactivityHint();
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

async function enterConsoleMode() {
  closeTechniquesSheet({ immediate: true });
  document.body.classList.add("console-focus");
  document.body.classList.remove("works-open");
  $("#worksLibrary").hidden = true;
  setAppNav("mixer");
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.("landscape");
  } catch {
    showCoach("浏览器没有允许自动旋转。请手动横置手机，控台会自动切换为横屏布局。");
  }
  $("#exitConsole").hidden = false;
  $("#mixer").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function exitConsoleMode() {
  document.body.classList.remove("console-focus");
  setAppNav("learning");
  try { screen.orientation?.unlock?.(); } catch { /* optional browser feature */ }
  if (document.fullscreenElement) await document.exitFullscreen?.();
  $("#exitConsole").hidden = true;
}

function learningStatusIcon(complete) {
  return complete
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>已完成</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg><span>进入</span>';
}

function renderUnifiedLearning() {
  const completed = new Set(LEARNING_COURSES
    .filter(course => localStorage.getItem(`first-mix-course-${course.number}-complete`) === "true")
    .map(course => course.number));
  const current = LEARNING_COURSES.find(course => !completed.has(course.number)) || LEARNING_COURSES.at(-1);
  const completedCount = completed.size;
  $("#routeCount").textContent = `${completedCount} / ${LEARNING_COURSES.length}`;
  $("#routeProgress").style.width = `${completedCount / LEARNING_COURSES.length * 100}%`;
  $("#currentNumber").textContent = current.number;
  $("#currentState").textContent = "今天从这里开始";
  $("#currentTitle").textContent = current.title;
  $("#currentDescription").textContent = current.description;
  $("#currentAction").href = current.route;
  $("#currentAction span").textContent = completedCount === LEARNING_COURSES.length ? "再练一次" : completedCount ? `继续 ${current.number}` : "开始学习";
  $("#lessonList").innerHTML = LEARNING_COURSES.map(course => {
    const routeIndex = LEARNING_COURSES.indexOf(course);
    const complete = completed.has(course.number);
    const isCurrent = course.number === current.number && completedCount < LEARNING_COURSES.length;
    return `<li class="${complete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}">
      <a href="${course.route}" ${isCurrent ? 'aria-current="step"' : ""}>
        <span class="lesson-route-card">
          <span class="lesson-number">${course.number}</span>
          <span class="lesson-copy"><strong>${course.title}</strong><small>${course.listDescription}</small></span>
          <em class="lesson-status">${learningStatusIcon(complete)}</em>
        </span>
        <span class="route-node ${routeIndex % 2 === 0 ? "has-avatar" : ""}" style="--avatar-index:${Math.floor(routeIndex / 2)}" aria-hidden="true"></span>
      </a>
    </li>`;
  }).join("");
}

function showLearningStage(stage) {
  const basics = stage === "basics";
  $("#basicsTab").classList.toggle("is-active", basics);
  $("#skillsTab").classList.toggle("is-active", !basics);
  $("#basicsTab").setAttribute("aria-selected", String(basics));
  $("#skillsTab").setAttribute("aria-selected", String(!basics));
  $("#basicsPanel").hidden = !basics;
  $("#skillsPanel").hidden = basics;
}

function syncEntryView(view, skill = "") {
  document.documentElement.dataset.entryView = view;
  document.documentElement.dataset.entrySkill = skill;
}

let routeTransitionToken = 0;
function beginRouteTransition(view, skill = "") {
  const token = ++routeTransitionToken;
  syncEntryView(view, skill);
  document.documentElement.classList.add("route-changing");
  return token;
}
function finishRouteTransition(token) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== routeTransitionToken) return;
    document.documentElement.classList.add("app-ready");
    document.documentElement.classList.remove("route-changing");
  }));
}

function placePracticeLandscapeButton(skill = null) {
  const button = $("#practiceLandscape");
  const anchor = $("#practiceLandscapeAnchor");
  const lessonId = { "hot-cue": "hotCueLesson", loop: "loopLesson", filter: "filterLesson" }[skill];
  const head = lessonId ? $(`#${lessonId} .hot-cue-lesson-head`) : null;
  button.classList.toggle("is-skill-inline", Boolean(head));
  if (head) head.append(button);
  else anchor.after(button);
}

function clearSkillPracticeState() {
  runtime.activeSkill = null;
  runtime.hotCueLessonActive = false;
  document.body.classList.remove("skill-hot-cue-open", "skill-loop-open", "skill-filter-open", "skill-practice-open");
  placePracticeLandscapeButton();
  $$(".skill-lesson").forEach(lesson => { lesson.hidden = true; });
  $("#loopControls").hidden = true;
  $("#filterControls").hidden = true;
  $("#hotCueDelete").hidden = true;
  document.dispatchEvent(new CustomEvent("hot-cue-delete-mode", { detail: { enabled: false } }));
}

function openUnifiedLearning(stage = "basics") {
  const routeToken = beginRouteTransition("learning");
  if ($("#practiceOrientationChoice").open) $("#practiceOrientationChoice").close();
  closePracticeGuide();
  closeTechniquesSheet({ immediate: true });
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  engine.clearBeatLoop("a");
  if (runtime.activeSkill === "filter") {
    $("#filterA").value = "0";
    $("#filterA").dispatchEvent(new Event("input", { bubbles: true }));
  }
  clearSkillPracticeState();
  document.body.classList.remove("hub-open", "course-open", "course-console", "app-course-phrase", "app-course-module", "console-focus", "practice-open", "works-open");
  document.body.classList.add("learning-open");
  $("#unifiedLearning").hidden = false;
  $("#worksLibrary").hidden = true;
  $("#freeMix").hidden = true;
  renderUnifiedLearning();
  showLearningStage(stage === "skills" ? "skills" : "basics");
  setAppNav("learning");
  window.history.replaceState(null, "", `./index.html?view=learning${stage === "skills" ? "&stage=skills" : ""}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  finishRouteTransition(routeToken);
}

const landscapePreferenceKey = "first-mix-landscape-default";
const landscapeSessionKey = "first-mix-landscape-session";
function landscapePreference() {
  try {
    if (localStorage.getItem(landscapePreferenceKey) === "landscape") return "landscape";
    return sessionStorage.getItem(landscapeSessionKey);
  } catch { return null; }
}
function rememberLandscapeChoice(choice, always) {
  try {
    sessionStorage.setItem(landscapeSessionKey, choice);
    if (choice === "landscape" && always) localStorage.setItem(landscapePreferenceKey, "landscape");
  } catch { /* storage may be unavailable; the current choice still works */ }
}

function openPracticeDeck({ skill = null } = {}) {
  const normalizedSkill = ["hot-cue", "loop", "filter"].includes(skill) ? skill : null;
  const routeToken = beginRouteTransition("practice", normalizedSkill || "");
  closeTechniquesSheet({ immediate: true });
  closePracticeGuide();
  clearTimeout(runtime.completionTimer);
  runtime.completionTimer = null;
  $("#successSheet").hidden = true;
  $("#moduleFinish").hidden = true;
  $("#phraseSuccess").hidden = true;
  document.body.classList.remove("lesson-finished");
  if (!controller3d) controller3d = createController(engine);
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  engine.clearBeatLoop("a");
  engine.clearBeatLoop("b");
  $("#filterA").value = "0";
  $("#filterA").dispatchEvent(new Event("input", { bubbles: true }));
  setTransport("a", false);
  setTransport("b", false);
  runtime.activeSkill = normalizedSkill;
  runtime.hotCueLessonActive = runtime.activeSkill === "hot-cue";
  document.body.classList.toggle("skill-hot-cue-open", runtime.hotCueLessonActive);
  document.body.classList.toggle("skill-loop-open", runtime.activeSkill === "loop");
  document.body.classList.toggle("skill-filter-open", runtime.activeSkill === "filter");
  document.body.classList.toggle("skill-practice-open", Boolean(runtime.activeSkill));
  $$(".skill-lesson").forEach(lesson => { lesson.hidden = lesson.id !== ({ "hot-cue": "hotCueLesson", loop: "loopLesson", filter: "filterLesson" }[runtime.activeSkill]); });
  placePracticeLandscapeButton(runtime.activeSkill);
  $("#hotCueLessonStart").hidden = false;
  $("#hotCueLessonStatus").textContent = "使用内置曲目《Venus》。播放后，1、2 号打击垫各有一个示范 Cue 点。";
  $("#loopLessonStart").hidden = false;
  $("#loopLessonStatus").textContent = "播放内置曲目后，点模型上的 LOOP，再点 4 或 8 打击垫；点 OFF 退出。";
  $("#filterLessonStart").hidden = false;
  $("#filterLessonStatus").textContent = "使用内置曲目《EDM at Midnight》。播放后拖动 FILTER，比较声音的变化。";
  $("#loopControls").hidden = true;
  $("#filterControls").hidden = true;
  $("#skillFilterSlider").value = "0";
  $("#skillFilterValue").textContent = "原声";
  $("#hotCueDelete").hidden = true;
  $("#hotCueDelete").setAttribute("aria-pressed", "false");
  $("#hotCueDelete").textContent = "删除 Cue 点";
  document.dispatchEvent(new CustomEvent("hot-cue-delete-mode", { detail: { enabled: false } }));
  document.dispatchEvent(new Event("hot-cue-reset"));
  runtime.freeMix = true;
  $("#practiceOrientation").textContent = "横屏获得最佳体验 · 也可以竖屏继续操作";
  document.body.classList.remove("works-open", "course-console", "app-course-phrase", "app-course-module", "console-focus", "learning-open");
  document.body.classList.add("hub-open", "course-open", "practice-open");
  document.body.scrollTop = 0;
  $("main").scrollTop = 0;
  $("#unifiedLearning").hidden = true;
  $("#workspaceBar").hidden = true;
  $("#courseWidget").hidden = true;
  $("#worksLibrary").hidden = true;
  $("#freeMix").hidden = false;
  $("#exitConsole").hidden = true;
  renderTutorial();
  setAppNav("mixer");
  const requestedLandscape = new URLSearchParams(window.location.search).get("landscape") === "1";
  window.history.replaceState(null, "", `./index.html?view=practice${runtime.activeSkill ? `&skill=${runtime.activeSkill}` : ""}${requestedLandscape ? "&landscape=1" : ""}`);
  const savedLandscapeChoice = landscapePreference();
  if (matchMedia("(pointer: coarse)").matches && innerHeight > innerWidth && !savedLandscapeChoice && !requestedLandscape) {
    const choice = $("#practiceOrientationChoice");
    if (!choice.open) choice.showModal();
  } else if (requestedLandscape || savedLandscapeChoice === "landscape") {
    practiceLayout?.requestLandscape();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  finishRouteTransition(routeToken);
}

$("#practiceOrientationStay").addEventListener("click", () => {
  rememberLandscapeChoice("portrait", false);
  $("#practiceOrientationChoice").close();
});
$("#practiceOrientationRotate").addEventListener("click", () => {
  rememberLandscapeChoice("landscape", $("#practiceRememberLandscape").checked);
  $("#practiceOrientationChoice").close();
  practiceLayout?.requestLandscape();
});
$("#practiceOrientationChoice").addEventListener("cancel", () => rememberLandscapeChoice("portrait", false));

const SKILL_TRACKS = {
  "hot-cue": { course: "beat", title: "Venus", offset: 0, status: "每个打击垫对应一个 Cue 点。1 号是较轻的前段，2 号是节奏段；连续触发对比，空白垫可保存新点。" },
  loop: { course: "phrase", title: "EDM at Midnight", offset: 16, status: "点模型上的 LOOP，再点 4 或 8 打击垫；点 OFF 退出循环。" },
  filter: { course: "phrase", title: "EDM at Midnight", offset: 16, status: "拖动 FILTER：向左削去高频，向右削去低频，回到中间恢复原声。" }
};

async function startSkillLesson(skill) {
  const config = SKILL_TRACKS[skill];
  const ids = { "hot-cue": ["hotCueLessonStatus", "hotCueLessonStart"], loop: ["loopLessonStatus", "loopLessonStart"], filter: ["filterLessonStatus", "filterLessonStart"] }[skill];
  if (!config || !ids || runtime.activeSkill !== skill) return;
  const status = document.getElementById(ids[0]);
  const start = document.getElementById(ids[1]);
  if (!controller3d?.host) {
    status.textContent = "当前设备无法显示打碟台模型，请使用支持 WebGL 的浏览器。";
    return;
  }
  start.disabled = true;
  status.textContent = "正在准备训练音乐…";
  try {
    await engine.initialize();
    const loaded = await engine.loadCourseTracks(config.course);
    const track = loaded?.find(item => item.deck === "a" && item.title === config.title);
    if (!track) throw new Error(`内置曲目《${config.title}》不可用`);
    if (runtime.activeSkill !== skill) return;
    runtime.userTracks.a = false;
    runtime.userTracks.b = false;
    $("#deckATitle>span:last-child").textContent = `${track.title} · ${track.style}`;
    const bTrack = loaded.find(item => item.deck === "b");
    $("#deckBTitle>span:last-child").textContent = bTrack ? `${bTrack.title} · ${bTrack.style}` : "等待载入 B";
    $("#practiceDisplayStatus").textContent = `${track.title} · ${skill.toUpperCase()} 练习`;
    syncBpmInputs();
    engine.decks.b?.pause();
    const deck = engine.decks.a;
    deck.pause();
    engine.clearBeatLoop("a");
    deck.alignTo(Math.min(config.offset, Math.max(0, track.duration - 10)));
    deck.setCuePoint();
    const crossfader = $("#crossfader");
    crossfader.value = "-100";
    crossfader.dispatchEvent(new Event("input", { bubbles: true }));
    if (skill === "hot-cue") {
      document.dispatchEvent(new Event("hot-cue-reset"));
      controller3d.host.querySelector('[data-source="mode-hot-cue-a"]')?.click();
      document.dispatchEvent(new CustomEvent("hot-cue-seed", { detail: { deck: "a", positions: [1, Math.min(16, track.duration * .4)] } }));
    } else if (skill === "filter") {
      $("#filterA").value = "0";
      $("#filterA").dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.body.classList.add("audio-ready");
    $("#soundGate").setAttribute("aria-pressed", "true");
    $("#soundGate span").textContent = "声音已启动";
    await engine.toggle("a");
    start.hidden = true;
    if (skill === "hot-cue") $("#hotCueDelete").hidden = false;
    if (skill === "loop") $("#loopControls").hidden = false;
    if (skill === "filter") $("#filterControls").hidden = false;
    status.textContent = config.status;
  } catch (error) {
    status.textContent = `训练音乐未能启动：${error.message || "请重试"}`;
  } finally {
    start.disabled = false;
  }
}

$("#hotCueLessonStart").addEventListener("click", () => startSkillLesson("hot-cue"));
$("#loopLessonStart").addEventListener("click", () => startSkillLesson("loop"));
$("#filterLessonStart").addEventListener("click", () => startSkillLesson("filter"));
$("#hotCueDelete").addEventListener("click", () => {
  const button = $("#hotCueDelete");
  const armed = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(armed));
  button.textContent = armed ? "取消删除" : "删除 Cue 点";
  document.dispatchEvent(new CustomEvent("hot-cue-delete-mode", { detail: { enabled: armed } }));
  $("#hotCueLessonStatus").textContent = armed ? "删除模式：点一个已保存的打击垫即可清除；再点此按钮可取消。" : SKILL_TRACKS["hot-cue"].status;
});
document.addEventListener("hot-cue-action", ({ detail }) => {
  if (!runtime.hotCueLessonActive || detail.deck !== "a") return;
  if (detail.action === "delete" || detail.action === "missing") {
    $("#hotCueDelete").setAttribute("aria-pressed", "false");
    $("#hotCueDelete").textContent = "删除 Cue 点";
    document.dispatchEvent(new CustomEvent("hot-cue-delete-mode", { detail: { enabled: false } }));
  }
  $("#hotCueLessonStatus").textContent = ({
    save: `打击垫 ${detail.pad} 的 Cue 点已保存。继续播放，可在空白打击垫保存另一个点。`,
    trigger: `HOT CUE ${detail.pad} 已触发：跳转后继续播放。按 Deck A 的 CUE 可对比返回并暂停。`,
    delete: `打击垫 ${detail.pad} 的 Cue 点已删除。再次按此垫，可保存当前播放位置。`,
    missing: `打击垫 ${detail.pad} 尚无 Cue 点，可直接按它保存当前位置。`
  })[detail.action];
});
$$('[data-loop-beats]').forEach(button => button.addEventListener('click', () => {
  if (runtime.activeSkill === 'loop' && !engine.setBeatLoop('a', Number(button.dataset.loopBeats))) $("#loopLessonStatus").textContent = "当前音轨长度不足，无法设置此循环。";
}));
$("#loopExit").addEventListener("click", () => {
  if (runtime.activeSkill === "loop" && !engine.clearBeatLoop("a")) $("#loopLessonStatus").textContent = "当前没有循环，可选择 4 拍或 8 拍开始。";
});
engine.addEventListener("beatloop", ({ detail }) => {
  if (runtime.activeSkill !== "loop" || detail.deck !== "a") return;
  $$('[data-loop-beats]').forEach(button => button.setAttribute("aria-pressed", String(detail.active && Number(button.dataset.loopBeats) === detail.beats)));
  $("#loopLessonStatus").textContent = detail.active ? `${detail.beats} 拍正在循环。切换长度或点“退出循环”，听恢复后的走向。` : "已退出循环，歌曲继续正常播放。";
});
$("#skillFilterSlider").addEventListener("input", event => {
  $("#filterA").value = event.target.value;
  $("#filterA").dispatchEvent(new Event("input", { bubbles: true }));
});
$("#filterA").addEventListener("input", event => {
  if (runtime.activeSkill !== "filter") return;
  const value = Number(event.target.value);
  $("#skillFilterSlider").value = String(value);
  const description = value < 0 ? `低通 ${-value}% · 高频减少` : value > 0 ? `高通 ${value}% · 低频减少` : "原声";
  $("#skillFilterValue").textContent = description;
  if (!$("#filterControls").hidden) $("#filterLessonStatus").textContent = value === 0 ? "已回到原声。再向左或向右拖动，比较两种滤波效果。" : `${description}。向中间拖动可恢复原声。`;
});
engine.addEventListener("cue", ({ detail }) => {
  if (!runtime.hotCueLessonActive || detail.deck !== "a") return;
  $("#hotCueLessonStatus").textContent = detail.action === "return"
    ? "CUE 已返回单个定位点并暂停。再次播放后，可继续尝试 HOT CUE。"
    : "CUE 定位点已保存。再次播放后按 CUE，会返回该位置并暂停。";
});

function setTransport(deckId, playing) {
  const button = $(`#play${deckId.toUpperCase()}`);
  button.classList.toggle("is-playing", playing);
  button.setAttribute("aria-pressed", String(playing));
  button.querySelector("span").textContent = playing ? `暂停 ${deckId.toUpperCase()}` : `播放 ${deckId.toUpperCase()}`;
  button.querySelector("path").setAttribute("d", playing ? "M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" : "M8 5v14l11-7L8 5Z");
  if (deckId === "a" && $("#lessonPauseButton")) {
    const lessonPause = $("#lessonPauseButton");
    if (playing) lessonPause.dataset.started = "true";
    lessonPause.disabled = !lessonPause.dataset.started;
    lessonPause.textContent = playing ? "暂停" : lessonPause.dataset.started ? "继续" : "暂停";
  }
}

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

function drawWave(canvas, variant) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#151713";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < width; x += 4) {
    const beat = (x / width) * 16;
    const pulse = Math.pow(Math.max(0, Math.cos(beat * Math.PI)), 7);
    const texture = Math.sin(x * (variant === "a" ? 0.073 : 0.091)) * 0.18 + 0.28;
    const amplitude = (pulse * 0.64 + texture) * height * 0.42;
    ctx.moveTo(x, height / 2 - amplitude);
    ctx.lineTo(x, height / 2 + amplitude);
  }
  ctx.stroke();
  ctx.strokeStyle = "#c9c5b7";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i += 1) {
    const x = i / 8 * width;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
}

async function activateAudio() {
  try {
    await engine.initialize();
    await applyCourseSoundset(runtime.currentCourse);
    document.body.classList.add("audio-ready");
    $("#soundGate").setAttribute("aria-pressed", "true");
    $("#soundGate span").textContent = "声音已启动";
    $("#countStatus").textContent = "准备播放 A";
    $("#proofContext").textContent = engine.context.state;
    $("#proofRate").textContent = `${engine.context.sampleRate} Hz`;
    $("#proofLatency").textContent = engine.context.baseLatency ? `${Math.round(engine.context.baseLatency * 1000)} ms` : "未提供";
    noteActivity();
  } catch (error) {
    showCoach(`${error.message}。请更换最新版浏览器后重试。`);
  }
}

async function deactivateAudio() {
  if (engine.decks.a?.playing) await engine.toggle("a");
  if (engine.decks.b?.playing) await engine.toggle("b");
  if (engine.context?.state === "running") await engine.context.suspend();
  document.body.classList.remove("audio-ready");
  $("#soundGate").setAttribute("aria-pressed", "false");
  $("#soundGate span").textContent = "启动声音";
  $("#countStatus").textContent = "等待启动声音";
  $("#practiceDisplayStatus").textContent = "声音已关闭";
}

$("#soundGate").addEventListener("click", () => {
  if (document.body.classList.contains("audio-ready")) deactivateAudio();
  else activateAudio();
});
$("#playA").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  engine.toggle("a");
  noteActivity();
});
$("#playB").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  await engine.toggle("b");
  noteActivity();
});
$("#syncB").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  if (!engine.decks.a?.playing) {
    showCoach("Deck A 已经停下。先重新播放 A，再点击 SYNC B。");
    $("#playA").focus();
    return;
  }
  await engine.syncB();
  noteActivity();
});

engine.addEventListener("transport", ({ detail }) => {
  setTransport(detail.deck, detail.playing);
  if (runtime.phraseMode && detail.deck === "a") {
    $("#pausePhrase").disabled = false;
    $("#pausePhrase").textContent = detail.playing ? "暂停" : "继续";
    $("#markPhrase").disabled = !detail.playing;
  }
  if (!runtime.phraseMode && detail.deck === "a" && detail.playing && tutorial.step === TUTORIAL_STEPS.PLAY) {
    tutorial.dispatch("PLAY_A", { now: performance.now() });
    $("#countStatus").textContent = "跟着 A 数四拍";
    renderTutorial();
  }
  updateProof();
});

$("#startPhrase").addEventListener("click", async () => {
  if (!engine.decks.a || !engine.decks.b) await activateAudio();
  if (engine.decks.b?.playing) engine.toggle("b");
  if (!engine.decks.a?.playing) await engine.toggle("a");
  engine.decks.a.alignTo(0);
  runtime.phraseCycles = 0;
  runtime.phraseHits = 0;
  runtime.lastPhraseBeat = 0;
  runtime.lastPhraseSuccessCycle = -1;
  $("#markPhrase").disabled = false;
  $("#pausePhrase").disabled = false;
  $("#pausePhrase").textContent = "暂停";
  $("#phraseModeLabel").textContent = "第 1 遍 · 看着学";
  $("#phraseReadout").textContent = "小节 1 · 第 1 拍";
  $$("#phraseBars span").forEach((span, index) => span.classList.toggle("is-current", index === 0));
  $("#phraseFeedback").textContent = "跟着高亮数到 16；下一遍盲听。";
});

$("#pausePhrase").addEventListener("click", async () => {
  if (!engine.decks.a) return;
  await engine.toggle("a");
  const playing = engine.decks.a.playing;
  $("#pausePhrase").textContent = playing ? "暂停" : "继续";
  $("#markPhrase").disabled = !playing;
  $("#phraseFeedback").textContent = playing ? "继续听。" : "已暂停。";
});

function resetPhrasePractice() {
  window.clearTimeout(runtime.phraseButtonTimer);
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.a) engine.decks.a.alignTo(0);
  setTransport("a", false);
  runtime.phraseCycles = 0;
  runtime.phraseHits = 0;
  runtime.lastPhraseBeat = null;
  runtime.lastPhraseSuccessCycle = -1;
  $("#phraseModeLabel").textContent = "第 1 遍 · 看着学";
  $("#phraseReadout").textContent = "等待播放";
  $("#phraseCycles").textContent = "抓对 0";
  $("#phraseFeedback").textContent = "第一遍看提示，第二遍盲听。";
  $("#phraseSuccess").hidden = true;
  $("#pausePhrase").disabled = true;
  $("#pausePhrase").textContent = "暂停";
  $("#markPhrase").disabled = true;
  $("#markPhrase").classList.remove("is-celebrating");
  $("#markPhrase").textContent = "这是下一句第一拍";
  $$("#phraseBars span").forEach((span) => span.classList.remove("is-current"));
  $("#startPhrase").focus();
}

$("#resetPhrase").addEventListener("click", resetPhrasePractice);

$("#markPhrase").addEventListener("click", () => {
  const position = phrasePosition(engine.decks.a?.position() || 0);
  if (runtime.phraseCycles >= 1 && position.isPhraseStart && runtime.lastPhraseSuccessCycle !== runtime.phraseCycles) {
    runtime.phraseHits += 1;
    markCourseCompleted("phrase");
    runtime.lastPhraseSuccessCycle = runtime.phraseCycles;
    $("#phraseFeedback").textContent = `第 ${runtime.phraseHits} 次抓对，继续听。`;
    showCharacterReaction("correct", "抓到第一拍了！");
    $("#phraseSuccessTitle").textContent = `第 ${runtime.phraseHits} 次抓到乐句第一拍`;
    celebratePhrase();
    const state = $('[data-course="phrase"] .course-state');
    if (state) state.textContent = "已完成";
  } else if (position.isPhraseStart && runtime.lastPhraseSuccessCycle === runtime.phraseCycles) {
    $("#phraseFeedback").textContent = "这句已抓到，等下一句。";
  } else {
    const distance = position.beatIndex === 0 ? 0 : 16 - position.beatIndex;
    $("#phraseFeedback").textContent = runtime.phraseCycles < 1 ? "先听完示范。" : `早了，再等 ${distance || 16} 拍。`;
    if (runtime.phraseCycles >= 1) showCharacterReaction("wrong", "早了一点，再听听");
  }
});

function celebratePhrase() {
  const success = $("#phraseSuccess");
  const button = $("#markPhrase");
  window.clearTimeout(runtime.phraseButtonTimer);
  button.classList.remove("is-celebrating");
  void button.offsetWidth;
  button.classList.add("is-celebrating");
  button.textContent = "🎉 抓对了！继续听下一句 🎉";
  runtime.phraseButtonTimer = window.setTimeout(() => {
    button.classList.remove("is-celebrating");
    button.textContent = "这是下一句第一拍";
  }, 1600);
  success.hidden = false;
  success.focus?.({ preventScroll: true });
}

engine.addEventListener("sync", () => {
  setTransport("b", true);
  tutorial.dispatch("SYNC_B");
  $("#countStatus").textContent = tutorial.snapshot().course === "eq" ? "拍点已对齐，先切掉 B 的低频" : "拍点已对齐，可以推动 Crossfader";
  renderTutorial();
  updateProof();
});

function renderCrossfader(value) {
  const zone = value < -0.65 ? "a" : value > 0.65 ? "b" : "mix";
  const label = zone === "a" ? "现在只有 A：朦胧心跳" : zone === "b" ? "现在只有 B：漂浮铃音，A 的心跳已经消失" : "MIX：朦胧心跳 + 漂浮铃音，两首同时播放";
  $("#crossOutput").textContent = label;
  $("#zoneA").classList.toggle("is-current", zone === "a");
  $("#zoneMix").classList.toggle("is-current", zone === "mix");
  $("#zoneB").classList.toggle("is-current", zone === "b");
  return zone;
}

$("#crossfader").addEventListener("input", (event) => {
  const value = Number(event.target.value) / 100;
  engine.setCrossfader(value);
  const zone = renderCrossfader(value);
  noteActivity();
  const transitionStep = runtime.currentCourse === "phrase"
    && MODULE_COURSES.phrase.steps[runtime.moduleIndex]?.action === "transition-demo"
    && runtime.conceptStep === 1;
  if (transitionStep) {
    const percent = Math.round((value + 1) * 50);
    if (value >= .7) {
      const dragStep = $('#moduleStage [data-mix-operation="cross-to-b"]');
      if (advanceModuleConcept(dragStep)) {
        $("#moduleFeedback").textContent = "已经推到 B 侧。现在确认 A 已退出、B 正在独立播放。";
      }
    } else {
      $("#moduleFeedback").textContent = `正在推向 B：${percent}%｜继续向右，超过 85% 才算完成交接。`;
    }
  }
  if ((tutorial.step === TUTORIAL_STEPS.QUICK_MIX || tutorial.step === TUTORIAL_STEPS.INTRO_B) && Math.abs(value) <= 0.15) {
    tutorial.dispatch("HEARD_MIX");
    $("#countStatus").textContent = "MIX：心跳 + 铃音";
    renderTutorial();
  }
  clearTimeout(runtime.completionTimer);
  runtime.completionTimer = null;
  if (!runtime.freeMix && !document.body.classList.contains("practice-open") && tutorial.step === TUTORIAL_STEPS.B_ONLY && zone === "b" && value > 0.92) {
    $("#countStatus").textContent = "B ONLY：只剩漂浮铃音";
    runtime.completionTimer = setTimeout(() => {
      if (!runtime.freeMix && !document.body.classList.contains("practice-open") && Number($("#crossfader").value) > 92) {
        tutorial.dispatch("HEARD_B_ONLY");
        completeTransition();
      }
    }, 1400);
  }
});

function bindRange(id, handler, formatter) {
  const input = $(`#${id}`);
  const output = input.parentElement.querySelector("output");
  input.addEventListener("input", () => {
    const value = Number(input.value);
    handler(value);
    output.textContent = formatter(value);
    checkEqLesson();
    noteActivity();
  });
}

function checkEqLesson() {
  const value = (id) => Number(document.getElementById(id).value);
  if (tutorial.step === TUTORIAL_STEPS.CUT_B_LOW && value("lowB") <= -11) {
    tutorial.dispatch("CUT_B_LOW");
    $("#countStatus").textContent = "B 的底鼓已切除，可以轻轻引入 B";
    renderTutorial();
  } else if (tutorial.step === TUTORIAL_STEPS.SWAP_LOW && value("lowA") <= -11 && value("lowB") >= -1) {
    tutorial.dispatch("SWAPPED_LOW");
    $("#countStatus").textContent = "低频已交给 B：现在只有一个底鼓";
    renderTutorial();
  } else if (tutorial.step === TUTORIAL_STEPS.MOVE_MID && value("midA") <= -8) {
    tutorial.dispatch("MOVED_MID");
    $("#countStatus").textContent = "A 的旋律正在退后";
    renderTutorial();
  } else if (tutorial.step === TUTORIAL_STEPS.CLEAN_HIGH && value("highA") <= -8) {
    tutorial.dispatch("CLEANED_HIGH");
    $("#countStatus").textContent = "A 的亮度已收起，可以完成交接";
    renderTutorial();
  }
}

for (const deckId of ["a", "b"]) {
  const upper = deckId.toUpperCase();
  bindRange(`volume${upper}`, value => engine.setVolume(deckId, value / 100), value => `${value}%`);
  for (const band of ["low", "mid", "high"]) {
    bindRange(`${band}${upper}`, value => engine.setEq(deckId, band, value), value => `${value > 0 ? "+" : ""}${value} dB`);
  }
  bindRange(`filter${upper}`, value => engine.setFilter(deckId, value / 100), value => value === 0 ? "0" : value < 0 ? `LP ${Math.abs(value)}%` : `HP ${value}%`);
  $(`#cue${upper}`).addEventListener("click", async () => {
    if (!engine.decks.a || !engine.decks.b) await activateAudio();
    const result = engine.cueDeck(deckId);
    if (!result) return;
    setTransport(deckId, false);
    $(`#time${upper}`).textContent = formatTime(result.position);
    const bpm = engine.decks[deckId]?.track?.bpm || 120;
    $(`#beat${upper}`).textContent = String(Math.floor(result.position / (60 / bpm)) % 4 + 1);
    $("#practiceDisplayStatus").textContent = result.action === "set"
      ? `Deck ${upper} 已保存 Cue：${formatTime(result.position)}`
      : `Deck ${upper} 已回到 Cue：${formatTime(result.position)}`;
  });
}

function completeTransition() {
  if (runtime.freeMix || document.body.classList.contains("practice-open")) return;
  markCourseCompleted(runtime.currentCourse);
  localStorage.setItem("first-mix-tutorial-completed", "true");
  $("#countStatus").textContent = "第一次转场完成";
  renderTutorial();
  const next = nextCourse(runtime.currentCourse);
  $("#successTitle").textContent = runtime.currentCourse === "final" ? "完整 Mix 完成" : "完成第一次转场";
  $("#successNext").textContent = next ? `继续：${courseNames[next]}` : "回到学习页";
  $("#successSheet").hidden = false;
  $("#closeSuccess").focus();
}

function reset() {
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  for (const deck of Object.values(engine.decks)) {
    deck.alignTo(0);
    deck.cuePoint = 0;
  }
  setTransport("a", false); setTransport("b", false);
  $("#lessonPauseButton").removeAttribute("data-started");
  $("#lessonPauseButton").disabled = true;
  $("#lessonPauseButton").textContent = "暂停";
  clearTimeout(runtime.completionTimer);
  tutorial.reset();
  $("#crossfader").value = -100;
  engine.setCrossfader(-1);
  for (const id of ["lowA", "midA", "highA", "lowB", "midB", "highB"]) {
    const input = document.getElementById(id);
    input.value = 0;
    input.parentElement.querySelector("output").textContent = "0 dB";
    const deckId = id.endsWith("A") ? "a" : "b";
    engine.setEq(deckId, id.slice(0, -1), 0);
  }
  for (const id of ["filterA", "filterB"]) {
    const input = document.getElementById(id);
    input.value = 0;
    input.parentElement.querySelector("output").textContent = "0";
    engine.setFilter(id.endsWith("A") ? "a" : "b", 0);
  }
  renderCrossfader(-1);
  $("#successSheet").hidden = true;
  $("#countStatus").textContent = engine.context ? "准备播放 A" : "等待启动";
  renderTutorial();
  updateProof();
}

$("#resetButton").addEventListener("click", reset);
$("#tryAgain").addEventListener("click", reset);
$("#successNext").addEventListener("click", () => {
  $("#successSheet").hidden = true;
  const next = nextCourse(runtime.currentCourse);
  if (next) startCourse(next);
  else closeCourseScreen();
});
$("#phraseNext").addEventListener("click", () => startCourse("prep"));
$("#closeSuccess").addEventListener("click", () => { $("#successSheet").hidden = true; $("#crossfader").focus(); });
$("#enterFreeMix").addEventListener("click", () => {
  $("#successSheet").hidden = true;
  openPracticeDeck();
  window.setTimeout(() => $("#practiceLoadA").focus({ preventScroll: true }), 350);
});
$("#hintButton").addEventListener("click", () => {
  const step = MODULE_COURSES[runtime.currentCourse]?.steps[runtime.moduleIndex];
  const message = step?.retry || (runtime.phraseMode ? "数到第 16 拍后，在下一拍按下第一拍。" : tutorial.coach());
  showCharacterReaction("hint", message);
});
$("#replayTour").addEventListener("click", startInterfaceTour);
$$("[data-course]").forEach((button) => button.addEventListener("click", (event) => {
  if (suppressCarouselClick) {
    event.preventDefault();
    suppressCarouselClick = false;
    return;
  }
  if (carouselDidDrag) {
    event.preventDefault();
    carouselDidDrag = false;
    return;
  }
  const items = $$(".course-list li");
  const index = items.indexOf(button.closest("li"));
  const onLearningHub = document.body.classList.contains("hub-open") && !document.body.classList.contains("course-open");
  if (onLearningHub && index !== carouselIndex) {
    event.preventDefault();
    renderCourseCarousel(index);
    return;
  }
  startCourse(button.dataset.course);
}));
$("#backToCourses").addEventListener("click", closeCourseScreen);
$(".wordmark").addEventListener("click", async (event) => {
  event.preventDefault();
  closeTechniquesSheet({ immediate: true });
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  setTransport("a", false);
  setTransport("b", false);
  if (document.body.classList.contains("console-focus")) {
    try { screen.orientation?.unlock?.(); } catch { /* optional browser feature */ }
    if (document.fullscreenElement) await document.exitFullscreen?.();
  }
  document.body.classList.remove("hub-open", "course-open", "course-console", "app-course-phrase", "app-course-module", "console-focus", "works-open", "practice-open");
  $("#workspaceBar").hidden = true;
  $("#courseWidget").hidden = true;
  $("#worksLibrary").hidden = true;
  $("#successSheet").hidden = true;
  $("#exitConsole").hidden = true;
  setAppNav("learning");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("#enterConsole").addEventListener("click", enterConsoleMode);
$("#toggleConsole").addEventListener("click", enterConsoleMode);
$("#exitConsole").addEventListener("click", exitConsoleMode);
$("#enterApp").addEventListener("click", () => {
  openUnifiedLearning();
});

$("#basicsTab").addEventListener("click", () => showLearningStage("basics"));
$("#skillsTab").addEventListener("click", () => showLearningStage("skills"));
$$('.skill-link').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const skill = new URL(link.href, window.location.href).searchParams.get('skill');
  openPracticeDeck({ skill });
}));
$$('.skill-lesson a[href*="view=learning"]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openUnifiedLearning('skills');
}));
const techniquesSheet = $("#techniquesSheet");
const techniquesBackdrop = $("#techniquesBackdrop");
let techniquesDrag = null;
let techniquesCloseTimer = null;

function openTechniquesSheet() {
  window.clearTimeout(techniquesCloseTimer);
  techniquesCloseTimer = null;
  document.body.classList.add("techniques-open");
  techniquesSheet.hidden = false;
  techniquesBackdrop.hidden = true;
  $("#stageBasics").classList.remove("is-active");
  $("#stageBasics").setAttribute("aria-selected", "false");
  $("#techniquesEntry").classList.add("is-active");
  $("#techniquesEntry").setAttribute("aria-selected", "true");
  requestAnimationFrame(() => {
    techniquesSheet.classList.add("is-open");
    $(".technique-card.is-unlocked")?.focus({ preventScroll: true });
  });
}

function closeTechniquesSheet({ immediate = false } = {}) {
  window.clearTimeout(techniquesCloseTimer);
  techniquesCloseTimer = null;
  document.body.classList.remove("techniques-open");
  $("#stageBasics").classList.add("is-active");
  $("#stageBasics").setAttribute("aria-selected", "true");
  $("#techniquesEntry").classList.remove("is-active");
  $("#techniquesEntry").setAttribute("aria-selected", "false");
  techniquesSheet.classList.remove("is-open", "is-expanded");
  techniquesBackdrop.classList.remove("is-open");
  const finish = () => {
    techniquesSheet.hidden = true;
    techniquesBackdrop.hidden = true;
  };
  if (immediate) finish();
  else techniquesCloseTimer = window.setTimeout(finish, 420);
}

$("#techniquesEntry").addEventListener("click", openTechniquesSheet);
$("#stageBasics").addEventListener("click", closeTechniquesSheet);
$("#techniquesClose").addEventListener("click", closeTechniquesSheet);
techniquesBackdrop.addEventListener("click", closeTechniquesSheet);
$("#techniquesGrabber").addEventListener("click", () => techniquesSheet.classList.toggle("is-expanded"));
$("#techniquesPractice").addEventListener("click", () => { closeTechniquesSheet(); openPracticeDeck(); });
$(".techniques-grid").addEventListener("click", event => {
  const card = event.target.closest(".technique-card.is-unlocked");
  if (!card) return;
  if (["hot-cue", "loop", "filter"].includes(card.dataset.technique)) {
    openPracticeDeck({ skill: card.dataset.technique });
    return;
  }
  $$(".technique-card.is-unlocked").forEach(item => item.classList.toggle("is-previewing", item === card && !card.classList.contains("is-previewing")));
});
techniquesSheet.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || !event.target.closest(".sheet-grabber")) return;
  techniquesDrag = { id: event.pointerId, y: event.clientY };
  techniquesSheet.setPointerCapture(event.pointerId);
});
techniquesSheet.addEventListener("pointerup", event => {
  if (!techniquesDrag || techniquesDrag.id !== event.pointerId) return;
  const delta = event.clientY - techniquesDrag.y;
  techniquesDrag = null;
  if (delta > 70) closeTechniquesSheet();
  else if (delta < -45) techniquesSheet.classList.add("is-expanded");
  else if (delta > 35) techniquesSheet.classList.remove("is-expanded");
});

$("#navHome").addEventListener("click", () => {
  openUnifiedLearning();
});
$("#navPractice").addEventListener("click", async () => {
  closeTechniquesSheet({ immediate: true });
  openPracticeDeck();
});
$("#navConsole").addEventListener("click", async () => {
  const routeToken = beginRouteTransition("my");
  closePracticeGuide();
  closeTechniquesSheet({ immediate: true });
  clearSkillPracticeState();
  if (document.body.classList.contains("console-focus")) await exitConsoleMode();
  if (engine.decks.a?.playing) engine.decks.a.pause();
  if (engine.decks.b?.playing) engine.decks.b.pause();
  document.body.classList.remove("course-open", "course-console", "app-course-phrase", "app-course-module", "console-focus", "practice-open", "learning-open");
  document.body.classList.add("hub-open", "works-open");
  $(".masthead").hidden = true;
  $("#unifiedLearning").hidden = true;
  $("#workspaceBar").hidden = true;
  $("#courseWidget").hidden = true;
  $("#worksLibrary").hidden = false;
  await openMyView(runtime.myView || "progress");
  setAppNav("works");
  const preview = new URLSearchParams(window.location.search).get("works-preview");
  window.history.replaceState(null, "", preview === "filled" || preview === "empty" ? `./index.html?view=my&works-preview=${preview}` : "./index.html?view=my");
  window.scrollTo({ top: 0, behavior: "smooth" });
  finishRouteTransition(routeToken);
});
$$("[data-my-view]").forEach(button => button.addEventListener("click", () => openMyView(button.dataset.myView)));
$("#myRecordOnce").addEventListener("click", openPracticeDeck);
$("#runWeeklyAi").addEventListener("click", runWeeklyAiCoach);
$("#activityMonthPrevious").addEventListener("click", () => {
  runtime.activityMonthOffset -= 1;
  renderActivityCalendar(readCourseProgress().size);
});
$("#activityMonthNext").addEventListener("click", () => {
  runtime.activityMonthOffset = Math.min(0, runtime.activityMonthOffset + 1);
  renderActivityCalendar(readCourseProgress().size);
});
$("#activityCalendar").addEventListener("click", event => {
  const day = event.target.closest("[data-activity-date]");
  if (!day) return;
  runtime.myActivityDate = day.dataset.activityDate;
  renderActivityCalendar(readCourseProgress().size);
});
let activityScrubPointer = null;
let activityScrubMoved = false;
function previewActivityDay(day) {
  if (!day) return;
  const calendar = $("#activityCalendar");
  runtime.myActivityDate = day.dataset.activityDate;
  calendar.querySelectorAll(".activity-day").forEach(row => {
    const selected = row === day;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-pressed", String(selected));
  });
  shapeActivityBands(day);
}
$("#activityCalendar").addEventListener("pointerdown", event => {
  const day = event.target.closest("[data-activity-date]");
  if (!day) return;
  activityScrubPointer = event.pointerId;
  activityScrubMoved = false;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  previewActivityDay(day);
});
$("#activityCalendar").addEventListener("pointermove", event => {
  if (activityScrubPointer !== event.pointerId) return;
  const day = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-activity-date]");
  if (!day || !event.currentTarget.contains(day)) return;
  activityScrubMoved = activityScrubMoved || day.dataset.activityDate !== runtime.myActivityDate;
  previewActivityDay(day);
});
function finishActivityScrub(event) {
  if (activityScrubPointer !== event.pointerId) return;
  activityScrubPointer = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  renderActivityCalendar(readCourseProgress().size);
}
$("#activityCalendar").addEventListener("pointerup", finishActivityScrub);
$("#activityCalendar").addEventListener("pointercancel", finishActivityScrub);
$("#activityCalendar").addEventListener("pointerover", event => {
  const day = event.target.closest("[data-activity-date]");
  if (day) shapeActivityBands(day);
});
$("#activityCalendar").addEventListener("pointerleave", event => {
  shapeActivityBands(event.currentTarget.querySelector(".activity-day.is-selected") || event.currentTarget.querySelector(".activity-day"));
});
$("#activityCalendar").addEventListener("focusin", event => {
  const day = event.target.closest("[data-activity-date]");
  if (day) shapeActivityBands(day);
});
$("#activityCalendar").addEventListener("focusout", event => {
  if (!event.currentTarget.contains(event.relatedTarget)) shapeActivityBands(event.currentTarget.querySelector(".activity-day.is-selected") || event.currentTarget.querySelector(".activity-day"));
});
$("#closeAiDirection").addEventListener("click", closeAiDirectionModal);
$("#aiDirectionModal").addEventListener("pointerdown", event => {
  if (event.target === $("#aiDirectionModal")) closeAiDirectionModal();
});
window.enableTopSwipeDismiss($("#aiDirectionModal .ai-direction-shell"), closeAiDirectionModal);
window.enableTopSwipeDismiss($("#successSheet .success-inner"), () => $("#closeSuccess").click());
let moduleFinishReopen = null;
function dismissModuleFinish() {
  $("#moduleFinish").hidden = true;
  if (!moduleFinishReopen) {
    moduleFinishReopen = document.createElement("button");
    moduleFinishReopen.type = "button";
    moduleFinishReopen.className = "sheet-swipe-reopen";
    moduleFinishReopen.textContent = "查看完成结果";
    moduleFinishReopen.addEventListener("click", () => {
      $("#moduleFinish").hidden = false;
      moduleFinishReopen.hidden = true;
    });
    document.body.append(moduleFinishReopen);
  }
  moduleFinishReopen.hidden = false;
}
new MutationObserver(() => {
  if (moduleFinishReopen && !$("#moduleFinish").hidden) moduleFinishReopen.hidden = true;
}).observe($("#moduleFinish"), { attributes: true, attributeFilter: ["hidden"] });
new MutationObserver(() => {
  if (moduleFinishReopen && !document.body.classList.contains("course-open")) moduleFinishReopen.hidden = true;
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });
window.enableTopSwipeDismiss($("#moduleFinish .module-finish-panel"), dismissModuleFinish);
window.enableTopSwipeDismiss($("#practiceGuide"), () => closePracticeGuide(), { maxStartY: 90 });
window.enableTopSwipeDismiss(techniquesSheet, () => closeTechniquesSheet(), { maxStartY: 110 });
window.enableTopSwipeDismiss($("#libraryPlayer"), () => $("#libraryPlayerExpand").click(), {
  maxStartY: 100,
  canStart: () => $("#libraryPlayer").classList.contains("is-expanded")
});
$("#successSheet").addEventListener("pointerdown", event => {
  if (event.target === $("#successSheet")) $("#closeSuccess").click();
});
$("#moduleFinish").addEventListener("pointerdown", event => {
  if (event.target === $("#moduleFinish")) dismissModuleFinish();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("ai-direction-open")) closeAiDirectionModal();
});
setupLibraryPlayer();

const PROFILE_CONTROLS = {
  deck: ["playA", "cueA", "playB", "cueB", "syncB"],
  eq: ["lowA", "midA", "highA", "lowB", "midB", "highB", "volumeA", "volumeB"],
  mix: ["crossfader"]
};
Object.entries(PROFILE_CONTROLS).forEach(([group, ids]) => ids.forEach(id => {
  const control = `#${id}`;
  const element = $(control);
  if (!element) return;
  element.addEventListener(element.matches('input[type="range"]') ? "input" : "click", () => recordProfileControl(group));
}));
practiceLayout = setupPracticeLayout();
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("console-focus");
    if (document.body.classList.contains("course-open")) setAppNav("learning");
    $("#exitConsole").hidden = true;
  }
});
$("#skipTour").addEventListener("click", () => finishInterfaceTour(true));
$("#nextTour").addEventListener("click", () => {
  const view = interfaceTour.next();
  if (view.active) renderInterfaceTour();
  else finishInterfaceTour(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#practiceGuide").hidden) closePracticeGuide();
  if (event.key === "Escape" && interfaceTour.active) finishInterfaceTour(true);
});

async function importLocalFile(deckId, file) {
  const upper = deckId.toUpperCase();
  const status = $(`#file${upper}Status`);
  if (!file) return;
  status.textContent = "正在浏览器中读取…";
  try {
    const result = await engine.loadLocalBuffer(deckId, await file.arrayBuffer());
    runtime.userTracks[deckId] = true;
    status.textContent = `${file.name} · ${formatTime(result.duration)} · 估算 ${result.bpm.toFixed(1)} BPM · 仅本地`;
    $(`#bpmInput${upper}`).value = result.bpm.toFixed(1);
    $(`#bpm${upper}`).textContent = result.bpm.toFixed(1);
    setTransport(deckId, false);
    renderTutorial({ preserveCoach: true });
    showCoach(`Deck ${upper} 已完成本地 BPM 估算。先试听；如果拍点不准，修正 BPM 数值后再按 Sync。`);
  } catch (error) {
    status.textContent = `无法读取：${error.message}`;
    showCoach(`Deck ${upper} 导入失败，训练音乐仍然可用。请选择浏览器支持的 MP3、WAV、M4A 或 OGG。`);
  }
}

$("#fileA").addEventListener("change", (event) => importLocalFile("a", event.target.files?.[0]));
$("#fileB").addEventListener("change", (event) => importLocalFile("b", event.target.files?.[0]));
for (const deckId of ["a", "b"]) {
  const upper = deckId.toUpperCase();
  $(`#bpmInput${upper}`).addEventListener("input", (event) => {
    const bpm = Math.max(60, Math.min(200, Number(event.target.value) || 120));
    engine.setDeckTempo(deckId, bpm);
    $(`#bpm${upper}`).textContent = bpm.toFixed(1);
    renderTutorial({ preserveCoach: true });
    $("#countStatus").textContent = `Deck ${upper}：${bpm.toFixed(1)} BPM`;
  });
}
$("#restoreTraining").addEventListener("click", () => {
  engine.restoreTrainingTracks();
  runtime.userTracks.a = false; runtime.userTracks.b = false;
  setTransport("a", false); setTransport("b", false);
  $("#crossfader").value = -100;
  renderCrossfader(-1);
  $("#fileA").value = ""; $("#fileB").value = "";
  $("#fileAStatus").textContent = "选择本地音频";
  $("#fileBStatus").textContent = "选择本地音频";
  $("#bpmInputA").value = "120.0"; $("#bpmInputB").value = "120.0";
  $("#bpmA").textContent = "120"; $("#bpmB").textContent = "120";
  renderTutorial({ preserveCoach: true });
  showCoach("已恢复梦核训练音乐。你可以继续自由尝试，也可以重新开始教程。");
});

function updateProof() {
  if (!engine.context) return;
  const playingA = Boolean(engine.decks.a?.playing);
  const playingB = Boolean(engine.decks.b?.playing);
  const both = playingA && playingB;
  $("#proofDecks").textContent = both ? "同时播放" : playingA || playingB ? "单 Deck" : "已就绪";
  $("#proofContext").textContent = engine.context.state;
}

function drawCourseWaves() {
  $$(".course-wave").forEach((canvas, cardIndex) => {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = cardIndex % 2 ? "#7253b7" : "#4d9725";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const pulse = Math.pow(Math.abs(Math.sin((x / width * 5 + cardIndex) * Math.PI)), 5);
      const y = height / 2 + Math.sin(x * .29 + cardIndex) * (3 + pulse * 10);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

function drawHubWave(now) {
  const canvas = $("#hubWaveCanvas");
  if (!canvas || !document.body.classList.contains("hub-open") || document.body.classList.contains("course-open")) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const waveform = engine.readWaveform();
  let rms = 0;
  if (waveform) {
    for (const value of waveform) rms += Math.pow((value - 128) / 128, 2);
    rms = Math.sqrt(rms / waveform.length);
  }
  const playingA = Boolean(engine.decks.a?.playing);
  const playingB = Boolean(engine.decks.b?.playing);
  const live = playingA || playingB;
  const breath = .55 + Math.sin(now * .0012) * .16;
  const amplitude = live ? Math.min(1.8, .55 + rms * 5.4) : breath;
  const lines = [
    { color: "#79cf43", phase: 0, offset: .43 },
    { color: "#7253b7", phase: 1.9, offset: .58 }
  ];
  lines.forEach((line, lineIndex) => {
    if (live && lineIndex === 0 && !playingA) return;
    if (live && lineIndex === 1 && !playingB) return;
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = live ? .9 : .58;
    for (let x = -10; x <= rect.width + 10; x += 5) {
      const unit = x / rect.width;
      const beatPulse = live ? Math.pow(Math.max(0, Math.cos(unit * Math.PI * 16 - now * .004)), 8) : 0;
      const fabric = Math.sin(unit * Math.PI * 8 + line.phase + now * .00055) * 18;
      const detail = Math.sin(unit * Math.PI * 27 + line.phase) * 5;
      const y = rect.height * line.offset + (fabric + detail + beatPulse * 24) * amplitude;
      if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawHomeWave(now) {
  const canvas = $("#homeWaveCanvas");
  if (!canvas || document.body.classList.contains("hub-open") || document.body.classList.contains("course-open")) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  [
    { color: "#79cf43", phase: 0, offset: .43, width: 4 },
    { color: "#7253b7", phase: 2.1, offset: .59, width: 5 }
  ].forEach((line, lineIndex) => {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.globalAlpha = .7;
    for (let x = -12; x <= rect.width + 12; x += 5) {
      const unit = x / rect.width;
      const breath = .82 + Math.sin(now * .0011 + lineIndex) * .16;
      const fabric = Math.sin(unit * Math.PI * 8 + line.phase + now * .00052) * 18;
      const detail = Math.sin(unit * Math.PI * 25 + line.phase) * 5;
      const y = rect.height * line.offset + (fabric + detail) * breath;
      if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawPracticeScope() {
  if (!document.body.classList.contains("practice-open")) return;
  const canvas = $("#practiceScope");
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(rect.width * ratio)) canvas.width = Math.round(rect.width * ratio);
  if (canvas.height !== Math.round(rect.height * ratio)) canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const data = engine.readWaveform();
  ctx.strokeStyle = "#b6ee70";
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  for (let i = 0; i < 256; i++) {
    const sample = data ? (data[Math.floor(i / 256 * data.length)] - 128) / 128 : 0;
    const x = i / 255 * canvas.width;
    const y = canvas.height * (.5 + sample * .42);
    if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  $("#practiceDisplayStatus").textContent = ["a","b"].filter(id => engine.decks[id]?.playing).map(id => id.toUpperCase()).join(" + ") || "准备播放";
}
$("#practiceLoadA").addEventListener("click", () => $("#fileA").click());
$("#practiceLoadB").addEventListener("click", () => $("#fileB").click());
createTrackLibrary({engine,onLoaded(deck,track,bpm){
  const upper=deck.toUpperCase();
  runtime.userTracks[deck]=false;
  document.getElementById('file'+upper).value='';
  document.querySelector('#deck'+upper+'Title>span:last-child').textContent=track.title+' · '+track.style;
  document.getElementById('bpmInput'+upper).value=bpm.toFixed(1);
  document.getElementById('bpm'+upper).textContent=bpm.toFixed(1);
  setTransport(deck,false);
  document.body.classList.add('audio-ready');
  $('#soundGate').setAttribute('aria-pressed','true');
  $('#soundGate span').textContent='声音已启动';
  $('#practiceDisplayStatus').textContent='Deck '+upper+' 已载入 '+track.title;
  noteActivity();
}});
document.addEventListener('practice-reset',()=>{
  if(!document.body.classList.contains('practice-open'))return;
  clearTimeout(runtime.completionTimer);runtime.completionTimer=null;
  for(const id of ['a','b']){
    const deck=engine.decks[id];if(deck){deck.pause();deck.alignTo(0);deck.cuePoint=0;deck.playbackRate=1;}
    setTransport(id,false);const upper=id.toUpperCase();
    for(const [prefix,value] of [['high',0],['mid',0],['low',0],['filter',0],['volume',80]]){
      const input=document.getElementById(prefix+upper);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
  engine.clearBeatLoop('a');engine.clearBeatLoop('b');
  $$('[data-loop-beats]').forEach(button=>button.setAttribute('aria-pressed','false'));
  $('#crossfader').value=-100;$('#crossfader').dispatchEvent(new Event('input',{bubbles:true}));
  $('#successSheet').hidden=true;
  if(runtime.hotCueLessonActive){
    document.dispatchEvent(new Event('hot-cue-reset'));
    $('#hotCueLessonStart').hidden=false;
    $('#hotCueDelete').hidden=true;
    $('#hotCueDelete').setAttribute('aria-pressed','false');
    $('#hotCueDelete').textContent='删除 Cue 点';
    $('#hotCueLessonStatus').textContent='使用内置曲目《Venus》。播放后，1、2 号打击垫各有一个示范 Cue 点。';
  }
  if(runtime.activeSkill==='loop'){
    $('#loopControls').hidden=true;
    $('#loopLessonStart').hidden=false;
    $('#loopLessonStatus').textContent='播放内置曲目后，点模型上的 LOOP，再点 4 或 8 打击垫；点 OFF 退出。';
  }
  if(runtime.activeSkill==='filter'){
    $('#filterControls').hidden=true;
    $('#filterLessonStart').hidden=false;
    $('#skillFilterSlider').value='0';
    $('#skillFilterValue').textContent='原声';
    $('#filterLessonStatus').textContent='使用内置曲目《EDM at Midnight》。播放后拖动 FILTER，比较声音的变化。';
  }
  document.dispatchEvent(new Event('practice-reset-view'));
});
$$("[data-pad]").forEach(button => button.addEventListener("click", async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!samplerContext) samplerContext = new AudioContextClass({ latencyHint: "interactive" });
  const ctx = samplerContext;
  await ctx.resume();
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.24, t);
  gain.gain.exponentialRampToValueAtTime(.001, t + .29);
  gain.connect(ctx.destination);
  const kind = button.dataset.pad;
  let source;
  if (kind === "hat" || kind === "clap") {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .23), ctx.sampleRate);
    const values = buffer.getChannelData(0);
    for (let i=0;i<values.length;i++) values[i] = Math.random()*2-1;
    source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = kind === "hat" ? 7500 : 1300;
    source.connect(filter); filter.connect(gain);
  } else {
    source = ctx.createOscillator();
    source.frequency.setValueAtTime(kind === "kick" ? 150 : 660, t);
    source.frequency.exponentialRampToValueAtTime(kind === "kick" ? 45 : 330, t + .18);
    source.connect(gain);
    if (kind === "kick") {
      const click = ctx.createOscillator();
      click.frequency.setValueAtTime(850, t);
      click.frequency.exponentialRampToValueAtTime(180, t + .045);
      click.connect(gain);click.start(t);click.stop(t + .05);
      click.onended = () => click.disconnect();
    }
  }
  source.start(t); source.stop(t + .30);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
}));
function tick(now) {
  drawPracticeScope();
  drawHomeWave(now);
  drawHubWave(now);
  const previousStep = tutorial.step;
  tutorial.dispatch("TICK", { now });
  if (tutorial.step !== previousStep) {
    $("#countStatus").textContent = "四拍完成，可以同步 B";
    renderTutorial();
  }
  const snapshot = engine.snapshot();
  if (runtime.phraseMode && snapshot.a?.playing) {
    const phrase = phrasePosition(snapshot.a.position);
    if (runtime.lastPhraseBeat === 15 && phrase.beatIndex === 0) runtime.phraseCycles += 1;
    runtime.lastPhraseBeat = phrase.beatIndex;
    const guidedPass = runtime.phraseCycles < 1;
    $("#phraseModeLabel").textContent = guidedPass ? "第 1 遍 · 看着学" : "第 2 遍起 · 盲听抓句";
    $("#phraseReadout").textContent = guidedPass ? `小节 ${phrase.bar} · 第 ${((phrase.beatIndex % 4) + 1)} 拍` : "凭耳朵判断";
    $("#phraseCycles").textContent = `抓对 ${runtime.phraseHits}`;
    $$("#phraseBars span").forEach((span, index) => span.classList.toggle("is-current", guidedPass && index === phrase.beatIndex));
  }
  for (const deckId of ["a", "b"]) {
    const deck = snapshot[deckId];
    if (!deck) continue;
    const upper = deckId.toUpperCase();
    $(`#time${upper}`).textContent = formatTime(deck.position);
    const beat = Math.floor((deck.position / 0.5) % 8) + 1;
    $(`#beat${upper}`).textContent = beat;
    $(`#playhead${upper}`).style.transform = `translateX(calc(${(deck.position / 8) * 100}% - 1px))`;
    if (deckId === "a" && deck.playing) $$("#countGrid span").forEach((span, index) => span.classList.toggle("is-beat", index === beat - 1));
  }
  requestAnimationFrame(tick);
}

const orphanTextSelector = "h1,h2,h3,h4,p,li,button,a,strong,small,label,figcaption,.module-feedback,.coach-message";
let orphanGuardQueued = false;
function protectChineseOrphans(root = document) {
  const elements = root.matches?.(orphanTextSelector) ? [root] : [...root.querySelectorAll?.(orphanTextSelector) || []];
  for (const element of elements) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || node.nodeValue.includes("\u2060")) continue;
      const protectedText = node.nodeValue.replace(/([\p{Script=Han}])([\p{Script=Han}][，。！？；：、）》】」』”’…]*)\s*$/u, "$1\u2060$2");
      if (protectedText !== node.nodeValue) node.nodeValue = protectedText;
    }
  }
}
function queueOrphanGuard() {
  if (orphanGuardQueued) return;
  orphanGuardQueued = true;
  queueMicrotask(() => { orphanGuardQueued = false; protectChineseOrphans(); });
}
new MutationObserver(queueOrphanGuard).observe(document.body, { childList: true, subtree: true, characterData: true });
protectChineseOrphans();

drawWave($("#waveA"), "a");
drawWave($("#waveB"), "b");
drawCourseWaves();
renderCourseCarousel();
renderTutorial();
requestAnimationFrame(tick);

const requestedView = new URLSearchParams(window.location.search).get('view');
if (requestedView === 'practice') {
  const requestedSkill = new URLSearchParams(window.location.search).get('skill');
  openPracticeDeck({ skill: requestedSkill });
} else if (requestedView === 'my') {
  const worksPreview = new URLSearchParams(window.location.search).get('works-preview');
  if (worksPreview === 'filled' || worksPreview === 'empty' || new URLSearchParams(window.location.search).get('my-view') === 'works') runtime.myView = 'works';
  $('#navConsole').click();
  if (new URLSearchParams(window.location.search).get('preview') === 'ai') {
    window.setTimeout(() => openAiDirectionModal(true), 450);
  }
} else if (requestedView === 'learning') {
  const requestedStage = new URLSearchParams(window.location.search).get('stage');
  openUnifiedLearning(requestedStage);
} else {
  document.documentElement.classList.add('app-ready');
}
