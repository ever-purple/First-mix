import { AudioEngine } from '../audio-engine.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const tracks = { a: $('#trackA'), b1: $('#trackB1') };
const trackInfo = {
  a: { name: '具島直子《まどろみ》', bpm: 72, start: 220 },
  b1: { name: '邓丽君《我只在乎你》', bpm: 70, start: 0 }
};
const pairStarts = {
  clip1: { a: 220, b: 30 },
  clip2: { a: 220, b: 0 }
};
const targetBpm = 72;
const beatMs = 60000 / targetBpm;
const stepTitles = [
  ['听', '先听两种结局', '同一套动作，有的组合能继续走，有的很快就会挤在一起。'],
  ['低', '为什么进入前先收 B LOW', '来回切换两种状态，比较底鼓的轮廓是否清晰。'],
  ['测', '把两个片段放在一起量', '每段都在开始不舒服的那一拍停下；结果会同时保留。'],
  ['选', '让自己的数字给答案', '系统只检查选择是否和你的测量一致。'],
  ['看', '把长度翻译成动作', '比较两种转场什么时候到中央、什么时候换低频。'],
  ['收', '把判断方法带走', '以后遇到陌生歌曲：先量共存上限，再决定长度。']
];

const state = {
  step: 0,
  heardOutcome: { stable: false, conflict: false },
  heardLow: { both: false, one: false },
  measured: { clip1: null, clip2: null },
  choices: { clip1: null, clip2: null },
  practicePassed: { long: false, short: false },
  practiceRetries: { long: 0, short: 0 }
};

let audioContext;
let master;
let lowMonitor;
let graph = {};
let activeDemo = null;
let measure = null;
let demoRaf = 0;
let mediaToken = 0;

const practiceEngine = new AudioEngine();
let practiceLoadedKind = null;
let practiceLoading = null;
let practiceSynced = false;
let practice = null;

function feedback(title, text) {
  $('#feedbackTitle').textContent = title;
  $('#feedbackText').textContent = text;
}

function setPrimary(label, disabled = false) {
  $('#primaryAction').textContent = label;
  $('#primaryAction').disabled = disabled;
}

function initAudio() {
  if (audioContext) {
    audioContext.resume();
    return;
  }
  audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  master = audioContext.createGain();
  lowMonitor = audioContext.createBiquadFilter();
  const limiter = audioContext.createDynamicsCompressor();
  master.gain.value = .7;
  lowMonitor.type = 'allpass';
  lowMonitor.frequency.value = 240;
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 16;
  limiter.attack.value = .003;
  limiter.release.value = .12;
  master.connect(lowMonitor).connect(limiter).connect(audioContext.destination);
  Object.entries(tracks).forEach(([id, audio]) => {
    const source = audioContext.createMediaElementSource(audio);
    const low = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 170;
    source.connect(low).connect(gain).connect(master);
    graph[id] = { low, gain };
  });
}

function setLow(id, db) {
  if (!graph[id]) return;
  graph[id].low.gain.setTargetAtTime(clamp(db, -18, 6), audioContext.currentTime, .02);
}

function setMix(bId, position = 0) {
  const normalized = clamp((position + 1) / 2, 0, 1);
  graph.a.gain.gain.setTargetAtTime(Math.cos(normalized * Math.PI / 2), audioContext.currentTime, .02);
  graph[bId].gain.gain.setTargetAtTime(Math.sin(normalized * Math.PI / 2), audioContext.currentTime, .02);
  Object.keys(graph).filter(id => id !== 'a' && id !== bId).forEach(id => graph[id].gain.gain.setTargetAtTime(0, audioContext.currentTime, .02));
}

async function seek(audio, seconds) {
  if (audio.readyState < 1 || !Number.isFinite(audio.duration)) {
    audio.load();
    await new Promise(resolve => audio.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  audio.currentTime = Math.min(seconds, Math.max(0, audio.duration - 1));
}

function stopMedia() {
  mediaToken += 1;
  Object.values(tracks).forEach(audio => {
    audio.pause();
    audio.loop = false;
  });
  if (activeDemo?.timer) clearTimeout(activeDemo.timer);
  if (measure?.raf) cancelAnimationFrame(measure.raf);
  if (demoRaf) cancelAnimationFrame(demoRaf);
  activeDemo = null;
  measure = null;
  demoRaf = 0;
  if (lowMonitor) lowMonitor.type = 'allpass';
  $$('[data-method]').forEach(button => {
    button.textContent = '播放动作';
    button.classList.remove('playing');
  });
  $$('.method-section .timeline>div').forEach(item => item.classList.remove('active'));
  $$('.method-section .beat-ruler i').forEach(item => item.classList.remove('past', 'on'));
}

async function preparePair(pairId, lowB = -12, position = 0) {
  initAudio();
  stopMedia();
  const token = mediaToken;
  const bId = 'b1';
  const b = tracks[bId];
  await Promise.all([seek(tracks.a, pairStarts[pairId].a), seek(b, pairStarts[pairId].b)]);
  if (token !== mediaToken) return false;
  tracks.a.playbackRate = 1;
  b.playbackRate = targetBpm / trackInfo[bId].bpm;
  setLow('a', 0);
  setLow(bId, lowB);
  setMix(bId, position);
  await Promise.all([tracks.a.play(), b.play()]);
  return token === mediaToken;
}

function beatCells(length, id = '') {
  return `<div class="beat-ruler ${length > 16 ? 'long' : ''}" ${id ? `id="${id}"` : ''}>${Array.from({ length }, (_, index) => `<i class="${index % 4 === 0 ? 'phase' : ''}">${index + 1}</i>`).join('')}</div>`;
}

function paintBeat(ruler, beat, total) {
  if (!ruler) return;
  [...ruler.querySelectorAll('i')].forEach((cell, index) => {
    cell.classList.toggle('past', index + 1 < beat);
    cell.classList.toggle('on', index + 1 === clamp(beat, 1, total));
  });
}

async function playOutcome(kind) {
  const pairId = kind === 'stable' ? 'clip2' : 'clip1';
  if (!await preparePair(pairId, -12, 0)) return;
  const button = $(`[data-outcome="${kind}"]`);
  $$('.outcome-button').forEach(item => {
    item.classList.remove('playing');
    const itemKind = item.dataset.outcome;
    item.querySelector('span').textContent = state.heardOutcome[itemKind] ? '已听过 · 可重听' : '播放 8 秒';
  });
  button.classList.add('playing');
  button.querySelector('span').textContent = '正在播放';
  const started = performance.now();
  activeDemo = { timer: setTimeout(() => {
    stopMedia();
    state.heardOutcome[kind] = true;
    button.classList.remove('playing');
    button.classList.add('heard');
    button.querySelector('span').textContent = '已听过 · 可重听';
    const done = Object.values(state.heardOutcome).every(Boolean);
    setPrimary('听懂差别，继续', !done);
    feedback(done ? '两种结局都听到了' : '再听另一种结局', done ? '先不用解释原因。下一步只听低频。' : '注意共同播放到后面，声音是否还清楚。');
  }, 7500) };
  const meter = button.querySelector('.outcome-meter i');
  const tick = () => {
    if (!activeDemo) return;
    meter.style.width = `${clamp((performance.now() - started) / 7500 * 100, 0, 100)}%`;
    demoRaf = requestAnimationFrame(tick);
  };
  tick();
}

async function playLowState(mode) {
  const alreadyPlaying = activeDemo?.type === 'low';
  if (!alreadyPlaying) {
    if (!await preparePair('clip2', mode === 'both' ? 3 : -18, 0)) return;
    lowMonitor.type = 'lowpass';
    lowMonitor.frequency.setTargetAtTime(240, audioContext.currentTime, .02);
    lowMonitor.Q.setTargetAtTime(.72, audioContext.currentTime, .02);
    activeDemo = { type: 'low' };
  } else {
    setLow('b1', mode === 'both' ? 3 : -18);
  }
  state.heardLow[mode] = true;
  $$('.low-toggle button').forEach(button => button.classList.toggle('active', button.dataset.lowMode === mode));
  $('#lowReadout').innerHTML = mode === 'both'
    ? '<strong>两路低频同时输出</strong><span>底鼓轮廓容易模糊</span>'
    : '<strong>B LOW 收到 −12 dB</strong><span>底鼓轮廓更清晰</span>';
  const done = Object.values(state.heardLow).every(Boolean);
  setPrimary('记住这条规则', !done);
  feedback(mode === 'both' ? '现在是两路低频叠加' : '现在 B 的低频已收起', done ? '再切换两次，比较底鼓轮廓是否更清晰。' : '再点另一个状态，只比较底鼓的清晰度。');
}

function measurementLabel(value) {
  if (value === null || value === undefined || value === '') return '未测量';
  return value === '16+' ? '16＋拍' : `${value} 拍`;
}

async function startMeasurement(pairId) {
  if (!await preparePair(pairId, -12, 0)) return;
  const startedAt = audioContext.currentTime;
  measure = { pairId, startedAt, beat: 1, raf: 0 };
  $$('[data-measure-start]').forEach(button => button.disabled = true);
  $(`#measureStart-${pairId}`).hidden = true;
  $(`#measureStop-${pairId}`).hidden = false;
  const result = $(`#measureResult-${pairId}`);
  result.classList.remove('shown');
  result.textContent = '正在听…';
  setPrimary('先完成两次测量', true);
  const ruler = $(`#measureBeats-${pairId}`);
  const tick = () => {
    if (!measure) return;
    const elapsed = audioContext.currentTime - startedAt;
    const beat = Math.floor(elapsed / (60 / targetBpm)) + 1;
    measure.beat = clamp(beat, 1, 16);
    paintBeat(ruler, measure.beat, 16);
    $(`#measureNow-${pairId}`).textContent = `第 ${measure.beat} 拍`;
    if (beat > 16) {
      finishMeasurement('16+');
      return;
    }
    measure.raf = requestAnimationFrame(tick);
  };
  tick();
  feedback('两首已经一起开始', '别算“标准答案”。只要你自己开始觉得不舒服，就按下紫色按钮。');
}

function finishMeasurement(value = null) {
  if (!measure) return;
  const pairId = measure.pairId;
  const reading = value || measure.beat;
  state.measured[pairId] = reading;
  stopMedia();
  $$('[data-measure-start]').forEach(button => button.disabled = false);
  $(`#measureStop-${pairId}`).hidden = true;
  const start = $(`#measureStart-${pairId}`);
  start.hidden = false;
  start.textContent = '重新测一次';
  const result = $(`#measureResult-${pairId}`);
  result.textContent = measurementLabel(reading);
  result.classList.add('shown');
  const complete = Boolean(state.measured.clip1 && state.measured.clip2);
  setPrimary('用两个数字选择长度', !complete);
  feedback(`这个片段量到 ${measurementLabel(reading)}`, complete ? '两次结果都保留下来了。现在用这两个数字选择转场长度。' : '结果已保留。继续量下面的片段 2。');
}

function recommendation(value) {
  if (value === '16+' || Number(value) >= 12) return ['long'];
  return ['short'];
}

function choiceIsConsistent(id) {
  return state.choices[id] && recommendation(state.measured[id]).includes(state.choices[id]);
}

function chooseLength(button) {
  const [id, kind] = button.dataset.choice.split(':');
  state.choices[id] = kind;
  $$(`[data-choice^="${id}:"]`).forEach(item => item.classList.toggle('chosen', item === button));
  const consistent = choiceIsConsistent(id);
  const result = button.closest('.reading-row').querySelector('.choice-result');
  result.textContent = consistent ? '和你的测量一致' : `你量到 ${measurementLabel(state.measured[id])}，再按这个数字选一次`;
  result.classList.toggle('ok', consistent);
  const allDone = ['clip1', 'clip2'].every(key => choiceIsConsistent(key));
  setPrimary('查看本课结论', !allDone);
  feedback(consistent ? '推理是连起来的' : '数字和选择没有对上', consistent ? '这里不判歌曲的固定答案，只看你有没有使用刚才量出的数字。' : '少于 12 拍选 16 拍；12 拍及以上选 32 拍。');
}

function methodTimeline(kind) {
  const data = kind === 'short'
    ? [['1–8', '共存', '推子到中央'], ['9–12', '换低频', 'A 收、B 开'], ['13–16', '交出去', '推到 B']]
    : [['1–8', '进入', '轻推向 B'], ['9–16', '共存', '推子到中央'], ['17–24', '换低频', 'A 收、B 开'], ['25–32', '交出去', '推到 B']];
  return `<div class="timeline ${kind}">${data.map(([beats, label, copy]) => `<div><b>${beats}</b><strong>${label}</strong><span>${copy}</span></div>`).join('')}</div>`;
}

async function playMethodDemo(kind) {
  if (activeDemo?.type === 'method' && activeDemo.kind === kind) {
    stopMedia();
    feedback('演示已停止', '可以播放另一种转场，比较换低频的拍位。');
    return;
  }
  const pairId = kind === 'short' ? 'clip1' : 'clip2';
  const bId = 'b1';
  const total = kind === 'short' ? 16 : 32;
  if (!await preparePair(pairId, -12, -1)) return;
  const token = mediaToken;
  const startedAt = audioContext.currentTime;
  const ruler = $(`#demoBeats-${kind}`);
  const timeline = $(`#timeline-${kind} .timeline`);
  activeDemo = { type: 'method', kind };
  const button = $(`[data-method="${kind}"]`);
  button.textContent = '停止播放';
  button.classList.add('playing');
  const tick = () => {
    if (token !== mediaToken || activeDemo?.type !== 'method' || activeDemo.kind !== kind) return;
    const beat = Math.floor((audioContext.currentTime - startedAt) / (60 / targetBpm)) + 1;
    paintBeat(ruler, beat, total);
    const boundaries = kind === 'short' ? [8, 12, 16] : [8, 16, 24, 32];
    const phaseIndex = boundaries.findIndex(end => beat <= end);
    [...timeline.children].forEach((item, index) => item.classList.toggle('active', index === Math.max(0, phaseIndex)));
    if (kind === 'short') {
      if (beat <= 8) setMix(bId, -1 + beat / 8);
      else if (beat <= 12) { setLow('a', -12); setLow(bId, 0); }
      else setMix(bId, (beat - 12) / 4);
    } else {
      if (beat <= 8) setMix(bId, -1 + beat / 16);
      else if (beat <= 16) setMix(bId, -0.5 + (beat - 8) / 16);
      else if (beat <= 24) { setLow('a', -12); setLow(bId, 0); }
      else setMix(bId, (beat - 24) / 8);
    }
    if (beat > total) {
      stopMedia();
      feedback('动作走完了', kind === 'short' ? '短接在第 9 拍就开始换低频。' : '长混到第 17 拍才开始换低频。');
      return;
    }
    demoRaf = requestAnimationFrame(tick);
  };
  tick();
  feedback(kind === 'short' ? '正在看 16 拍短接' : '正在看 32 拍长混', '拍位卡会跟着播放亮起，重点看“换低频”出现在哪一拍。');
}

function practiceConfig(kind) {
  if (kind === 'long') return {
    bId: 'b1', pairId: 'clip2', total: 32, label: 'B1', title: '片段 2｜A 3:40 ＋ B1 0:00',
    phases: [
      { start: 1, end: 8, label: '启动 B1，LOW 保持 −12，推子轻推向 B', targets: 'B LOW −12 · 推子约 −50', validate: s => practice.bStarted && practice.entryBeat <= 2 && s.lowB <= -9 && s.cross >= -.9 && s.cross <= -.15 },
      { start: 9, end: 16, label: '让两首共存，把推子送到中央', targets: '推子 0', validate: s => Math.abs(s.cross) <= .38 },
      { start: 17, end: 24, label: '收 A LOW，同时恢复 B1 LOW', targets: 'A LOW −12 · B LOW 0', validate: s => s.lowA <= -9 && s.lowB >= -2.5 },
      { start: 25, end: 32, label: '把声音重心完整交给 B1', targets: '推子 +100', validate: s => s.cross >= .8 }
    ]
  };
  return {
    bId: 'b1', pairId: 'clip1', total: 16, label: 'B1', title: '片段 1｜A 3:40 ＋ B1 0:30',
    phases: [
      { start: 1, end: 8, label: '启动 B1，LOW 保持 −12，推子到中央', targets: 'B LOW −12 · 推子 0', validate: s => practice.bStarted && practice.entryBeat <= 2 && s.lowB <= -9 && Math.abs(s.cross) <= .38 },
      { start: 9, end: 12, label: '立即交换低频：收 A、恢复 B1', targets: 'A LOW −12 · B LOW 0', validate: s => s.lowA <= -9 && s.lowB >= -2.5 },
      { start: 13, end: 16, label: '把声音重心完整交给 B1', targets: '推子 +100', validate: s => s.cross >= .8 }
    ]
  };
}

async function loadPracticeTrack(deck, id) {
  const response = await fetch(tracks[id].getAttribute('src'));
  if (!response.ok) throw new Error(`歌曲载入失败：${trackInfo[id].name}`);
  await practiceEngine.loadLocalBuffer(deck, await response.arrayBuffer());
  practiceEngine.setTrackBpm(deck, trackInfo[id].bpm);
  practiceEngine.decks[deck].alignTo(trackInfo[id].start);
  practiceEngine.decks[deck].cuePoint = trackInfo[id].start;
}

async function setupPractice(kind) {
  if (practiceLoadedKind === kind) {
    await practiceEngine.context?.resume();
    resetPracticeEngine(kind);
    return;
  }
  if (practiceLoading) await practiceLoading;
  practiceLoading = (async () => {
    await practiceEngine.initialize();
    await loadPracticeTrack('a', 'a');
    await loadPracticeTrack('b', 'b1');
    practiceLoadedKind = kind;
    resetPracticeEngine(kind);
  })();
  try { await practiceLoading; } finally { practiceLoading = null; }
}

function updateTransport(deck, playing) {
  const button = $(`#play${deck.toUpperCase()}`);
  button.setAttribute('aria-pressed', String(playing));
  button.textContent = `${playing ? '暂停' : '播放'} ${deck.toUpperCase()}`;
  const flatButton = $(`#flatPlay${deck.toUpperCase()}`);
  if (flatButton) {
    flatButton.textContent = playing ? 'PAUSE' : 'PLAY';
    flatButton.classList.toggle('active', playing);
    flatButton.closest('.flat-deck')?.classList.toggle('playing', playing);
  }
}

function resetPracticeEngine(kind) {
  const config = practiceConfig(kind);
  const starts = pairStarts[config.pairId];
  ['a', 'b'].forEach(id => {
    const deck = practiceEngine.decks[id];
    if (deck?.playing) deck.pause();
    deck.alignTo(starts[id]);
    deck.cuePoint = starts[id];
    deck.playbackRate = 1;
    updateTransport(id, false);
  });
  const values = { lowA: 0, lowB: -12, midA: 0, midB: 0, highA: 0, highB: 0, volumeA: 80, volumeB: 80, crossfader: -100, filterA: 0, filterB: 0 };
  Object.entries(values).forEach(([id, value]) => { const input = $(`#${id}`); if (input) input.value = value; });
  practiceEngine.setVolume('a', .8); practiceEngine.setVolume('b', .8);
  practiceEngine.setEq('a', 'low', 0); practiceEngine.setEq('b', 'low', -12);
  practiceEngine.setEq('a', 'mid', 0); practiceEngine.setEq('b', 'mid', 0);
  practiceEngine.setEq('a', 'high', 0); practiceEngine.setEq('b', 'high', 0);
  practiceEngine.setFilter('a', 0); practiceEngine.setFilter('b', 0);
  practiceEngine.setCrossfader(-1);
  practiceEngine.setTrackBpm('a', trackInfo.a.bpm);
  practiceEngine.setTrackBpm('b', trackInfo[config.bId].bpm);
}

function highlightPracticeControls(ids = []) {
  $$('.hidden-controls .is-next').forEach(control => control.classList.remove('is-next'));
  $$('.flat-console .is-next').forEach(control => control.classList.remove('is-next'));
  ids.forEach(id => $(`#${id}`)?.classList.add('is-next'));
  const flatTargets = { syncB: '#flatSyncB', playA: '#flatPlayA', playB: '#flatPlayB', crossfader: '#flatCrossfader', lowA: '#flatLowA', lowB: '#flatLowB' };
  ids.forEach(id => $(flatTargets[id])?.closest('.flat-control,button')?.classList.add('is-next'));
}

function snapshotPractice() {
  return {
    lowA: Number($('#lowA').value),
    lowB: Number($('#lowB').value),
    cross: Number($('#crossfader').value) / 100
  };
}

function currentPracticeReadout() {
  const value = snapshotPractice();
  return `现在：A LOW ${value.lowA} · B LOW ${value.lowB} · 推子 ${Math.round(value.cross * 100)}`;
}

function practicePhaseInstruction(phase, beat) {
  if (practice.phaseIndex === 0 && !practice.bStarted) {
    return { title: `第 ${beat} 拍：按 PLAY B`, copy: `请在第 1 拍附近启动 ${practice.config.label}；按下后马上开始移动 Crossfader。` };
  }
  if (practice.phaseIndex === 0) {
    return practice.kind === 'long'
      ? { title: `第 ${beat} 拍：慢慢推 Crossfader`, copy: '从 A 端（−100）推到 −50；B LOW 保持 −12，不要动。' }
      : { title: `第 ${beat} 拍：慢慢推 Crossfader`, copy: '从 A 端（−100）推到正中央 0；B LOW 保持 −12，不要动。' };
  }
  if (practice.kind === 'long' && practice.phaseIndex === 1) return { title: `第 ${beat} 拍：继续推到中央`, copy: '把 Crossfader 从 −50 继续推到正中央 0。' };
  if ((practice.kind === 'long' && practice.phaseIndex === 2) || (practice.kind === 'short' && practice.phaseIndex === 1)) {
    return { title: `第 ${beat} 拍：交换 LOW`, copy: '把 A LOW 拉到 −12，同时把 B LOW 推回 0。' };
  }
  return { title: `第 ${beat} 拍：把声音交给 B`, copy: '把 Crossfader 从中央推到 B 端（＋100）。' };
}

function practiceRetryHint(phase) {
  if (phase.start === 1 && (!practice.bStarted || practice.entryBeat > 2)) return `${practice.config.label} 要在第 1 拍附近按 PLAY B。重做时看到第 1 拍亮起就按。`;
  if (phase.start === 1) {
    return practice.kind === 'long'
      ? 'PLAY B 后，要在第 1–8 拍把 Crossfader 从 −100 慢慢推到 −50；B LOW 保持 −12。'
      : 'PLAY B 后，要在第 1–8 拍把 Crossfader 从 −100 慢慢推到中央 0；B LOW 保持 −12。';
  }
  if (practice.kind === 'long' && practice.phaseIndex === 1) return '第 9–16 拍继续把 Crossfader 推到正中央 0。';
  if ((practice.kind === 'long' && practice.phaseIndex === 2) || (practice.kind === 'short' && practice.phaseIndex === 1)) return '这一段要同时完成：A LOW 到 −12，B LOW 回到 0。';
  return '最后一段要把 Crossfader 完整推到 B 端（＋100）。';
}

function pausePracticeForRetry(phase) {
  ['a', 'b'].forEach(id => { if (practiceEngine.decks[id]?.playing) practiceEngine.decks[id].pause(); updateTransport(id, false); });
  practice.paused = true;
  state.practiceRetries[practice.kind] += 1;
  const hint = practiceRetryHint(phase);
  $('#practice3dStatus').innerHTML = `<strong>这段先停一下</strong><span>${hint}</span>`;
  setPrimary(`重新开始第 ${phase.start}–${phase.end} 拍`, false);
  feedback('这段没有达标，照提示重做', `${hint} ${currentPracticeReadout()}。`);
}

async function resumePracticePhase() {
  if (!practice?.paused) return;
  const phase = practice.config.phases[practice.phaseIndex];
  const positions = practice.phasePositions;
  practice.resuming = true;
  ['a', 'b'].forEach(id => {
    const deck = practiceEngine.decks[id];
    if (deck.playing) deck.pause();
    deck.alignTo(positions[id]);
  });
  if (phase.start === 1) {
    practice.bStarted = false;
    practice.entryBeat = null;
    await practiceEngine.toggle('a');
  } else {
    await practiceEngine.toggle('a');
    await practiceEngine.toggle('b');
  }
  practice.resuming = false;
  practice.paused = false;
  practice.phaseStartedAt = performance.now();
  setPrimary('这一段进行中', true);
  tickPractice();
}

function practiceControlHints(phaseIndex, kind) {
  if (phaseIndex === 0) return practice?.bStarted ? ['crossfader'] : ['playB'];
  if ((kind === 'long' && phaseIndex === 1)) return ['crossfader'];
  if ((kind === 'long' && phaseIndex === 2) || (kind === 'short' && phaseIndex === 1)) return ['lowA', 'lowB'];
  return ['crossfader'];
}

function beginPractice(kind) {
  const config = practiceConfig(kind);
  practice = {
    kind, config, phaseIndex: 0, phaseStartedAt: performance.now(),
    phasePositions: { a: practiceEngine.decks.a.position(), b: practiceEngine.decks.b.position() },
    bStarted: false, entryBeat: null, paused: false, resuming: false, raf: 0
  };
  setPrimary('第 1 段进行中', true);
  tickPractice();
}

function completePractice() {
  const kind = practice.kind;
  if (practice.raf) cancelAnimationFrame(practice.raf);
  ['a', 'b'].forEach(id => { if (practiceEngine.decks[id]?.playing) practiceEngine.decks[id].pause(); updateTransport(id, false); });
  practice = null;
  state.practicePassed[kind] = true;
  highlightPracticeControls([]);
  setPrimary(kind === 'long' ? '再做一次 16 拍短接' : '总结这套方法', false);
  $('#practice3dStatus').innerHTML = `<strong>${kind === 'long' ? '32 拍长混' : '16 拍短接'}完成</strong><span>所有拍段都达到目标。</span>`;
  feedback('动作完成', state.practiceRetries[kind] ? `你在需要的拍段就地重做了 ${state.practiceRetries[kind]} 次，最后全部完成。` : '每一段都按目标完成。');
}

function tickPractice() {
  if (!practice || practice.paused) return;
  const phase = practice.config.phases[practice.phaseIndex];
  const localBeat = Math.floor((performance.now() - practice.phaseStartedAt) / beatMs);
  const beat = phase.start + localBeat;
  paintBeat($('#practiceBeats'), Math.min(beat, phase.end), practice.config.total);
  const instruction = practicePhaseInstruction(phase, Math.min(beat, phase.end));
  $('#practice3dStatus').innerHTML = `<strong>${instruction.title}</strong><span>${instruction.copy}</span><small>${currentPracticeReadout()} · 本段目标：${phase.targets}</small>`;
  highlightPracticeControls(practiceControlHints(practice.phaseIndex, practice.kind));
  if (beat > phase.end) {
    const snapshot = snapshotPractice();
    if (!phase.validate(snapshot)) {
      pausePracticeForRetry(phase);
      return;
    }
    if (practice.phaseIndex === practice.config.phases.length - 1) {
      completePractice();
      return;
    }
    practice.phaseIndex += 1;
    practice.phaseStartedAt = performance.now();
    practice.phasePositions = { a: practiceEngine.decks.a.position(), b: practiceEngine.decks.b.position() };
    setPrimary(`第 ${practice.config.phases[practice.phaseIndex].start}–${practice.config.phases[practice.phaseIndex].end} 拍进行中`, true);
  }
  practice.raf = requestAnimationFrame(tickPractice);
}

function bindPracticeControls() {
  $('#playA').onclick = () => practiceEngine.toggle('a');
  $('#playB').onclick = () => practiceEngine.toggle('b');
  $('#cueA').onclick = () => practiceEngine.cueDeck('a');
  $('#cueB').onclick = () => practiceEngine.cueDeck('b');
  $('#syncB').onclick = () => practiceEngine.syncB();
  ['A', 'B'].forEach(label => {
    const id = label.toLowerCase();
    $(`#bpmInput${label}`).oninput = event => practiceEngine.setTrackBpm(id, Number(event.target.value));
    $(`#volume${label}`).oninput = event => practiceEngine.setVolume(id, Number(event.target.value) / 100);
    ['low', 'mid', 'high'].forEach(band => $(`#${band}${label}`).oninput = event => practiceEngine.setEq(id, band, Number(event.target.value)));
    $(`#filter${label}`).oninput = event => practiceEngine.setFilter(id, Number(event.target.value) / 100);
  });
  $('#crossfader').oninput = event => practiceEngine.setCrossfader(Number(event.target.value) / 100);
  practiceEngine.addEventListener('transport', event => {
    updateTransport(event.detail.deck, event.detail.playing);
    if (!practiceLoadedKind || practice?.resuming) return;
    const practiceStep = state.step === 6 || state.step === 7;
    if (!practiceStep) return;
    if (event.detail.deck === 'a' && event.detail.playing && !practice) {
      if (!practiceSynced) {
        practiceEngine.toggle('a');
        feedback('先按 SYNC B', 'SYNC 只负责对齐，不会再自动播放 B。');
      } else beginPractice(state.step === 6 ? 'long' : 'short');
    }
    if (event.detail.deck === 'b' && event.detail.playing && practice && !practice.bStarted) {
      const phase = practice.config.phases[practice.phaseIndex];
      practice.bStarted = true;
      practice.entryBeat = phase.start + Math.floor((performance.now() - practice.phaseStartedAt) / beatMs);
      highlightPracticeControls(['crossfader']);
      feedback('PLAY B 已完成，现在移动 Crossfader', practice.kind === 'long' ? '第 1–8 拍从 −100 慢慢推到 −50；B LOW 保持 −12。' : '第 1–8 拍从 −100 慢慢推到中央 0；B LOW 保持 −12。');
    }
  });
  practiceEngine.addEventListener('sync', () => {
    if (state.step !== 6 && state.step !== 7) return;
    practiceSynced = true;
    highlightPracticeControls(['playA']);
    if ($('#practice3dStatus')) $('#practice3dStatus').innerHTML = '<strong>第二步：按 PLAY A</strong><span>拍尺开始后，第 1 拍再按 PLAY B。</span>';
    setPrimary('在平面台上按 PLAY A', true);
    feedback('SYNC 完成，B 仍然停着', '现在按 PLAY A 开始拍尺；第 1 拍再按 PLAY B。');
  });
}

bindPracticeControls();

function stopPractice() {
  if (practice?.raf) cancelAnimationFrame(practice.raf);
  practice = null;
  if (practiceEngine.decks.a) ['a', 'b'].forEach(id => {
    if (practiceEngine.decks[id].playing) practiceEngine.decks[id].pause();
    updateTransport(id, false);
  });
}

function updateHeader() {
  const group = [0, 0, 1, 2, 3, 4][state.step];
  $$('#progress span').forEach((item, index) => {
    item.classList.toggle('done', index < group);
    item.classList.toggle('current', index === group);
  });
  $('#stepBadge').textContent = `${String(state.step + 1).padStart(2, '0')} / 06`;
  $('#instructionIcon').textContent = stepTitles[state.step][0];
  $('#instructionTitle').textContent = stepTitles[state.step][1];
  $('#instructionCopy').textContent = stepTitles[state.step][2];
}

function renderOutcomes() {
  $('#stage').innerHTML = `<div class="outcome-list">
    <button class="outcome-button ${state.heardOutcome.conflict ? 'heard' : ''}" data-outcome="conflict"><b>片段 1</b><strong>很快开始挤在一起</strong><span>${state.heardOutcome.conflict ? '已听过 · 可重听' : '播放 8 秒'}</span><i class="outcome-meter"><i></i></i></button>
    <button class="outcome-button ${state.heardOutcome.stable ? 'heard' : ''}" data-outcome="stable"><b>片段 2</b><strong>一起走得更久，仍然稳定</strong><span>${state.heardOutcome.stable ? '已听过 · 可重听' : '播放 8 秒'}</span><i class="outcome-meter"><i></i></i></button>
  </div>`;
  $$('[data-outcome]').forEach(button => button.onclick = () => playOutcome(button.dataset.outcome));
  $('#secondaryAction').hidden = false;
  $('#secondaryAction').textContent = '跳过试听';
  const done = Object.values(state.heardOutcome).every(Boolean);
  setPrimary('听懂差别，继续', !done);
  feedback('不需要说出原因', '先把两种结局都听一遍。后面会把这种感觉变成数字。');
}

function renderLowRule() {
  $('#stage').innerHTML = `<div class="low-listen"><div class="low-pulse" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="low-toggle"><button data-low-mode="both">A、B LOW 同开</button><button data-low-mode="one">B LOW 收至 −12 dB</button></div><div id="lowReadout"><strong>先点左边，再点右边</strong><span>来回切换，比较底鼓轮廓是否清晰。</span></div></div><p class="hard-rule">B 进入前先收低频，避免两路低频叠加。</p>`;
  $$('.low-toggle button').forEach(button => button.onclick = () => playLowState(button.dataset.lowMode));
  setPrimary('记住这条规则', !Object.values(state.heardLow).every(Boolean));
  feedback('先比较两种低频状态', '建议戴耳机。先点左边，再点右边，来回切换两次。');
}

function renderMeasureBoth() {
  const panel = (pairId, label) => {
    const current = state.measured[pairId];
    return `<section class="measure-pair"><div class="measure-head"><span>${label}</span><b id="measureNow-${pairId}">${current ? measurementLabel(current) : '第 1 拍'}</b></div>${beatCells(16, `measureBeats-${pairId}`)}<div class="measure-action"><button id="measureStart-${pairId}" data-measure-start="${pairId}">${current ? '重新测一次' : '开始共同播放'}</button><button id="measureStop-${pairId}" hidden>到这里，开始不舒服</button><output id="measureResult-${pairId}" class="${current ? 'shown' : ''}">${current ? measurementLabel(current) : '等待测量'}</output></div></section>`;
  };
  $('#stage').innerHTML = `<div class="measure-pairs">${panel('clip1', '片段 1')}${panel('clip2', '片段 2')}</div><p class="measure-note">没有标准答案；走满 16 拍仍舒服，会自动记作 16＋。</p>`;
  $$('[data-measure-start]').forEach(button => button.onclick = () => startMeasurement(button.dataset.measureStart));
  ['clip1', 'clip2'].forEach(pairId => $(`#measureStop-${pairId}`).onclick = () => finishMeasurement());
  const complete = Boolean(state.measured.clip1 && state.measured.clip2);
  setPrimary('用两个数字选择长度', !complete);
  feedback(complete ? '两次结果已经保留' : '从任意一个片段开始', '一觉得两首不该继续在一起，就按“到这里，开始不舒服”。');
}

function renderChoice() {
  const row = id => `<div class="reading-row"><div class="reading-value"><span>${id === 'clip1' ? '片段 1' : '片段 2'}</span><strong>${measurementLabel(state.measured[id])}</strong></div><div class="length-choice"><button data-choice="${id}:short" class="${state.choices[id] === 'short' ? 'chosen' : ''}"><b>16 拍</b><span>短交接</span></button><button data-choice="${id}:long" class="${state.choices[id] === 'long' ? 'chosen' : ''}"><b>32 拍</b><span>长混合</span></button></div><small class="choice-result ${choiceIsConsistent(id) ? 'ok' : ''}">${choiceIsConsistent(id) ? '和你的测量一致' : '等待选择'}</small></div>`;
  $('#stage').innerHTML = `<div class="mapping-rule"><strong>你量到的数字</strong><span>少于 12 拍 → 16 拍短交接</span><span>12 拍及以上 → 32 拍长混合</span><small>以开始觉得不舒服的那一拍为准</small></div><div class="reading-list">${row('clip1')}${row('clip2')}</div>`;
  $$('[data-choice]').forEach(button => button.onclick = () => chooseLength(button));
  setPrimary('查看两种操作方法', !['clip1', 'clip2'].every(choiceIsConsistent));
  feedback('按自己的数字选', '不是记住某个进歌位置的固定答案。只要选择和自己的测量一致，就算通过。');
}

function renderMethods() {
  $('#stage').innerHTML = `<div class="formula"><strong>转场总长 ≈ 共存上限 × 2</strong><span>前半段两首一起走；后半段换低频、交出重心。</span></div><section class="method-section"><header><h3>16 拍短交接</h3><button data-method="short">播放动作</button></header>${beatCells(16, 'demoBeats-short')}<div id="timeline-short">${methodTimeline('short')}</div></section><section class="method-section"><header><h3>32 拍长混合</h3><button data-method="long">播放动作</button></header>${beatCells(32, 'demoBeats-long')}<div id="timeline-long">${methodTimeline('long')}</div></section>`;
  $$('[data-method]').forEach(button => button.onclick = () => playMethodDemo(button.dataset.method));
  setPrimary('记住动作，查看总结', false);
  feedback('只记一个差别', '短接第 9 拍换低频；长混第 17 拍换低频。');
}

function flatConsoleMarkup(config) {
  const deck = (id, track, low) => `<section class="flat-deck" data-deck="${id.toLowerCase()}">
    <header><strong>DECK ${id}</strong><small>${track}</small></header>
    <div class="flat-platter" aria-hidden="true"><i></i></div>
    <button class="flat-play" id="flatPlay${id}" type="button" disabled>PLAY</button>
    <label class="flat-control flat-low"><span>LOW</span><output id="flatLowValue${id}">${low} dB</output><input id="flatLow${id}" type="range" min="-12" max="0" step="1" value="${low}" disabled aria-label="Deck ${id} 低频"></label>
  </section>`;
  return `<div class="flat-console" aria-label="平面双 Deck 练习台">
    ${deck('A', 'まどろみ', 0)}
    <div class="flat-mixer-center"><strong>MIXER</strong><button id="flatSyncB" class="flat-sync" type="button" disabled>SYNC B</button><span>A</span><i></i><span>B</span></div>
    ${deck('B', '我只在乎你', -12)}
    <label class="flat-control flat-cross"><span>A</span><strong>CROSSFADER</strong><span>B</span><input id="flatCrossfader" type="range" min="-100" max="100" step="1" value="-100" disabled aria-label="Crossfader"></label>
  </div>`;
}

function paintFlatValue(sourceId) {
  if (sourceId !== 'lowA' && sourceId !== 'lowB') return;
  const label = sourceId.endsWith('A') ? 'A' : 'B';
  const output = $(`#flatLowValue${label}`);
  if (output) output.textContent = `${Number($(`#flatLow${label}`).value)} dB`;
}

function bindFlatConsole() {
  const clickThrough = { flatPlayA: 'playA', flatPlayB: 'playB', flatSyncB: 'syncB' };
  Object.entries(clickThrough).forEach(([flatId, sourceId]) => {
    const control = $(`#${flatId}`);
    if (control) control.onclick = () => $(`#${sourceId}`).click();
  });
  [['flatLowA', 'lowA'], ['flatLowB', 'lowB'], ['flatCrossfader', 'crossfader']].forEach(([flatId, sourceId]) => {
    const flat = $(`#${flatId}`);
    const source = $(`#${sourceId}`);
    if (!flat || !source) return;
    flat.value = source.value;
    flat.oninput = () => {
      source.value = flat.value;
      source.dispatchEvent(new Event('input', { bubbles: true }));
      paintFlatValue(sourceId);
    };
  });
  paintFlatValue('lowA');
  paintFlatValue('lowB');
}

function setFlatConsoleEnabled(enabled) {
  ['flatPlayA', 'flatPlayB', 'flatSyncB', 'flatLowA', 'flatLowB', 'flatCrossfader'].forEach(id => {
    const control = $(`#${id}`);
    if (control) control.disabled = !enabled;
  });
}

async function renderPractice(kind) {
  const config = practiceConfig(kind);
  $('#stage').innerHTML = `<div class="practice-heading"><div><span>${kind === 'long' ? '32 拍长混合' : '16 拍短交接'}</span><strong>${config.title}</strong></div><small>每一段达标后才继续</small></div>${beatCells(config.total, 'practiceBeats')}${flatConsoleMarkup(config)}<div class="practice-3d-status" id="practice3dStatus"><strong>正在载入真实歌曲</strong><span>请稍候…</span></div>`;
  bindFlatConsole();
  practiceSynced = false;
  setPrimary('正在载入平面练习台', true);
  feedback('准备真实歌曲', 'SYNC 只对齐；PLAY B 才会真正启动 B。');
  try {
    await setupPractice(kind);
    if ((kind === 'long' && state.step !== 6) || (kind === 'short' && state.step !== 7)) return;
    bindFlatConsole();
    setFlatConsoleEnabled(true);
    highlightPracticeControls(['syncB']);
    $('#practice3dStatus').innerHTML = '<strong>第一步：按 SYNC B</strong><span>B 会对齐，但保持停止。</span>';
    setPrimary('先按平面台上的 SYNC B', true);
    feedback('先按 SYNC B', '对齐后，再按 PLAY A；拍尺亮起的第 1 拍按 PLAY B。');
  } catch (error) {
    $('#practice3dStatus').innerHTML = `<strong>歌曲载入失败</strong><span>${error.message}</span>`;
    setPrimary('重新载入', false);
    feedback('无法进入实操', '检查本地服务后点击重新载入。');
  }
}

function renderSummary() {
  const clip1Kind = state.choices.clip1 === 'long' ? '32 拍长混合' : '16 拍短交接';
  const clip2Kind = state.choices.clip2 === 'long' ? '32 拍长混合' : '16 拍短交接';
  $('#stage').innerHTML = `<div class="takeaway"><strong>先量共存上限，再决定长度</strong><p class="takeaway-definition">共存上限：两首歌同时播放时，在开始觉得挤、乱或不舒服之前，最多能一起播放多少拍。</p><ol><li>两首一起放，听到开始不舒服的那一拍。</li><li>少于 12 拍用 16 拍短交接。</li><li>12 拍及以上用 32 拍长混合。</li></ol></div><div class="own-results"><div><span>片段 1</span><strong>${measurementLabel(state.measured.clip1)}</strong><small>${clip1Kind}</small></div><div><span>片段 2</span><strong>${measurementLabel(state.measured.clip2)}</strong><small>${clip2Kind}</small></div></div>`;
  setPrimary('完成 06，进入 07', false);
  feedback('你带走的是判断方法', '07 会先在横屏打碟台引导 16 拍短接，再让你独立完成 32 拍长混。');
}

const renderers = [renderOutcomes, renderLowRule, renderMeasureBoth, renderChoice, renderMethods, renderSummary];

function setStep(next) {
  stopMedia();
  stopPractice();
  state.step = clamp(next, 0, 5);
  $('#secondaryAction').hidden = true;
  updateHeader();
  renderers[state.step]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetState() {
  state.heardOutcome = { stable: false, conflict: false };
  state.heardLow = { both: false, one: false };
  state.measured = { clip1: null, clip2: null };
  state.choices = { clip1: null, clip2: null };
  state.practicePassed = { long: false, short: false };
  state.practiceRetries = { long: 0, short: 0 };
}

$('#primaryAction').onclick = async () => {
  if (practice?.paused) {
    await resumePracticePhase();
    return;
  }
  if (state.step === 5) {
    const payload = { measured: state.measured, choices: state.choices, retries: state.practiceRetries, completedAt: new Date().toISOString() };
    localStorage.setItem('first-mix-course06-result', JSON.stringify(payload));
    localStorage.setItem('first-mix-course-06-complete', 'true');
    $('#resultFacts').innerHTML = `<span>片段 1：${measurementLabel(state.measured.clip1)} → ${state.choices.clip1 === 'long' ? '32 拍' : '16 拍'}</span><span>片段 2：${measurementLabel(state.measured.clip2)} → ${state.choices.clip2 === 'long' ? '32 拍' : '16 拍'}</span><span>已掌握长度判断方法</span>`;
    $('#resultOverlay').classList.remove('hidden');
    return;
  }
  setStep(state.step + 1);
};

$('#secondaryAction').onclick = () => {
  if (state.step !== 0) return;
  stopMedia();
  state.heardOutcome = { stable: true, conflict: true };
  setStep(1);
};

$('#startCourse').onclick = () => {
  $('#introOverlay').classList.add('hidden');
  $('#bubble').hidden = false;
  setStep(0);
};

$('#resetCourse').onclick = () => {
  stopMedia(); stopPractice(); resetState();
  $('#resultOverlay').classList.add('hidden');
  $('#introOverlay').classList.remove('hidden');
  $('#bubble').hidden = true;
  setStep(0);
};

$('#repeatCourse').onclick = () => {
  stopMedia(); stopPractice(); resetState();
  $('#resultOverlay').classList.add('hidden');
  $('#introOverlay').classList.add('hidden');
  $('#bubble').hidden = false;
  setStep(0);
};

$('#goCourse07').onclick = () => { location.href = 'course-07-playable.html'; };
window.addEventListener('pagehide', () => { stopMedia(); stopPractice(); });
setStep(0);
window.FirstMixProgressNavigation.bind({ go: setStep, map: [0, 2, 3, 4, 5] });
