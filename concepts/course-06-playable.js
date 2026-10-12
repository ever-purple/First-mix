import { AudioEngine } from '../audio-engine.js';
import { createController } from '../controller-3d.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const tracks = { a: $('#trackA'), b1: $('#trackB1'), b2: $('#trackB2') };
const starts = { a: 34, b1: 30, b2: 38 };
const bpm = { a: 72, b1: 70, b2: 77 };
const targetBpm = 72;
const beatMs = 60000 / targetBpm;
const titles = [
  ['听', '先听三首歌', '先记住 A，再分别听 B1 与 B2 的主线、律动和空间。'],
  ['听', '比较 A＋B1 与 A＋B2', '用相同响度和长度，听出冲突和可共存的区别。'],
  ['短', '看懂 16 拍短交接', '冲突多时，缩短两条主线同时出现的时间。'],
  ['长', '看懂 32 拍长混合', '能共存时，多留一段共同播放，再交换低频。'],
  ['练', '跟随引导完成 A＋B2', '每 8 拍完成一个阶段，系统只开放当前任务。'],
  ['收', '回听并带走两套流程', '06 练长混合；07 再独立完成 A＋B1 短交接。']
];

let step = 0;
let audioContext;
let master;
let limiter;
let graph = {};
let answer = { b1: null, b2: null };
let practice = null;
let practiceSynced = false;
let audition = null;
let pairTimers = [];
const auditionLength = 60;
const heard = { a: false, b1: false, b2: false };
const heardPairs = { b1: false, b2: false };
const auditionOffsets = { a: 0, b1: 0, b2: 0 };
const practiceEngine = new AudioEngine();
let practiceController = null;
let practiceEngineReady = false;

function installPracticeTrackNames() {
  try {
    const a = new DataTransfer(); a.items.add(new File([''], '具島直子 · まどろみ'));
    const b = new DataTransfer(); b.items.add(new File([''], '葛谷葉子 · All Night'));
    $('#fileA').files = a.files; $('#fileB').files = b.files;
  } catch { /* 3D 屏幕会退回 Deck A / B */ }
}

installPracticeTrackNames();
practiceController = createController(practiceEngine);
practiceController?.host.classList.add('force-active');

function updatePracticeTransport(deck, playing) {
  const button = $(`#play${deck.toUpperCase()}`);
  button.setAttribute('aria-pressed', String(playing));
  button.textContent = `${playing ? '暂停' : '播放'} ${deck.toUpperCase()}`;
}

function bindPracticeController() {
  $('#playA').onclick = () => practiceEngine.toggle('a');
  $('#playB').onclick = () => practiceEngine.toggle('b');
  $('#cueA').onclick = () => practiceEngine.cueDeck('a');
  $('#cueB').onclick = () => practiceEngine.cueDeck('b');
  $('#syncB').onclick = () => practiceEngine.syncB();
  ['A','B'].forEach(label => {
    const id = label.toLowerCase();
    $(`#bpmInput${label}`).oninput = event => practiceEngine.setTrackBpm(id, Number(event.target.value));
    $(`#volume${label}`).oninput = event => practiceEngine.setVolume(id, Number(event.target.value) / 100);
    ['low','mid','high'].forEach(band => $(`#${band}${label}`).oninput = event => practiceEngine.setEq(id, band, Number(event.target.value)));
    $(`#filter${label}`).oninput = event => practiceEngine.setFilter(id, Number(event.target.value) / 100);
  });
  $('#crossfader').oninput = event => practiceEngine.setCrossfader(Number(event.target.value) / 100);
  practiceEngine.addEventListener('transport', event => {
    updatePracticeTransport(event.detail.deck, event.detail.playing);
    if (step === 4 && event.detail.deck === 'a' && event.detail.playing && !practice) {
      if (!practiceSynced) {
        practiceEngine.toggle('a');
        feedback('先按 SYNC B', '先在3D机上完成对速，再按 PLAY A 开始32拍。');
      } else beginPracticeClock();
    }
    if (event.detail.deck === 'b' && event.detail.playing && practice && !practice.bStarted) {
      practice.bStarted = true;
      practice.entryBeat = Math.floor((performance.now() - practice.start) / beatMs) + 1;
    }
  });
  practiceEngine.addEventListener('sync', () => {
    if (step !== 4 || practice) return;
    practiceSynced = true;
    highlightPracticeControls(['playA']);
    $('#primaryAction').textContent = '在 3D 机上按 PLAY A';
    feedback('SYNC B 已完成', '现在在3D机左侧按 PLAY A，32拍练习会从这里开始计数。');
  });
}

bindPracticeController();

function formatTime(seconds) {
  const safe = Math.max(0, Math.min(auditionLength, seconds));
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function resetAuditionUI(clearProgress = false) {
  $$('.audition-track').forEach(row => {
    const id = row.dataset.audition;
    row.querySelector('button').classList.remove('playing');
    row.querySelector('button').setAttribute('aria-label', `播放 ${id.toUpperCase()} 判断片段`);
    if (clearProgress) auditionOffsets[id] = 0;
    const percent = clamp(auditionOffsets[id] / auditionLength * 100, 0, 100);
    row.querySelector('.audition-progress i').style.width = `${percent}%`;
    row.querySelector('.audition-progress').setAttribute('aria-valuenow', String(Math.round(percent)));
    row.querySelector('.audition-time').textContent = `${formatTime(auditionOffsets[id])} / 1:00`;
  });
}

function unlockAfterListening() {
  if (step !== 0) return;
  const count = Object.values(heard).filter(Boolean).length;
  Object.entries(heard).forEach(([id,value]) => $(`#heard-${id}`)?.classList.toggle('heard', value));
  feedback(count === 3 ? '三首都已经听过' : '继续自由试听', count === 3 ? '现在可以比较两组真实重叠，听它们能不能长时间共存。' : '不设时长限制；听到足够判断时就进入下一步。');
}

function paintAudition() {
  if (!audition) return;
  const { id, audio, origin } = audition;
  const elapsed = Math.max(0, audio.currentTime - origin);
  auditionOffsets[id] = elapsed;
  const row = $(`.audition-track[data-audition="${id}"]`);
  const percent = clamp(elapsed / auditionLength * 100, 0, 100);
  row.querySelector('.audition-progress i').style.width = `${percent}%`;
  row.querySelector('.audition-progress').setAttribute('aria-valuenow', String(Math.round(percent)));
  row.querySelector('.audition-time').textContent = `${formatTime(elapsed)} / 1:00`;
  if (elapsed >= 6 && !heard[id]) {
    heard[id] = true;
    row.classList.add('heard');
    unlockAfterListening();
  }
  if (elapsed >= auditionLength || audio.ended) {
    auditionOffsets[id] = auditionLength;
    audio.pause();
    row.querySelector('button').classList.remove('playing');
    audition = null;
    return;
  }
  audition.raf = requestAnimationFrame(paintAudition);
}

async function toggleAudition(id) {
  if (audition?.id === id && !tracks[id].paused) {
    tracks[id].pause();
    if (audition.raf) cancelAnimationFrame(audition.raf);
    audition = null;
    resetAuditionUI();
    return;
  }
  stopAll();
  const audio = tracks[id];
  if (audioContext) {
    await audioContext.resume();
    Object.entries(graph).forEach(([key, nodes]) => {
      nodes.gain.gain.setTargetAtTime(key === id ? .9 : 0, audioContext.currentTime, .015);
      nodes.low.gain.setTargetAtTime(0, audioContext.currentTime, .015);
    });
  } else audio.volume = .9;
  const offset = auditionOffsets[id] >= auditionLength ? 0 : auditionOffsets[id];
  await seekAudio(audio, starts[id] + offset);
  audio.playbackRate = 1;
  audition = { id, audio, origin: starts[id], raf: 0 };
  const button = $(`.audition-track[data-audition="${id}"] button`);
  button.classList.add('playing');
  button.setAttribute('aria-label', `暂停 ${id.toUpperCase()} 判断片段`);
  feedback('正在单独试听', id === 'a' ? '先记住 A 的主线、节奏和能量。' : id === 'b1' ? '听 B1 的人声、主旋律与留白。' : '听 B2 的器乐空间、律动与和声。');
  await audio.play();
  if (audio.currentTime < starts[id] - .5) audition.origin = audio.currentTime - offset;
  paintAudition();
}

function feedback(title, text) {
  $('#feedbackTitle').textContent = title;
  $('#feedbackText').textContent = text;
}

function stopAll() {
  Object.values(tracks).forEach(audio => { audio.pause(); audio.loop = false; });
  if (practice?.raf) cancelAnimationFrame(practice.raf);
  if (audition?.raf) cancelAnimationFrame(audition.raf);
  pairTimers.forEach(clearTimeout);
  pairTimers = [];
  practice = null;
  audition = null;
  resetAuditionUI();
  if (practiceEngineReady) ['a','b'].forEach(id => { if (practiceEngine.decks[id]?.playing) practiceEngine.decks[id].pause(); });
}

function initAudio() {
  if (audioContext) { audioContext.resume(); return; }
  audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  master = audioContext.createGain();
  limiter = audioContext.createDynamicsCompressor();
  master.gain.value = .72;
  limiter.threshold.value = -1.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 16;
  limiter.attack.value = .003;
  limiter.release.value = .12;
  master.connect(limiter).connect(audioContext.destination);
  Object.entries(tracks).forEach(([id, audio]) => {
    const source = audioContext.createMediaElementSource(audio);
    const low = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 160;
    source.connect(low).connect(gain).connect(master);
    graph[id] = { source, low, gain };
  });
}

function setLow(id, db) {
  if (!graph[id]) return;
  graph[id].low.gain.setTargetAtTime(clamp(db, -18, 6), audioContext.currentTime, .02);
}

function setCross(value, bId = 'b2') {
  if (!graph.a || !graph[bId]) return;
  const position = clamp((value + 1) / 2, 0, 1);
  graph.a.gain.gain.setTargetAtTime(Math.cos(position * Math.PI / 2), audioContext.currentTime, .025);
  graph[bId].gain.gain.setTargetAtTime(Math.sin(position * Math.PI / 2), audioContext.currentTime, .025);
  const other = bId === 'b1' ? 'b2' : 'b1';
  graph[other].gain.gain.setTargetAtTime(0, audioContext.currentTime, .02);
}

async function seekAudio(audio, time) {
  if (audio.readyState < 1 || !Number.isFinite(audio.duration)) {
    audio.load();
    await new Promise(resolve => audio.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  audio.currentTime = Math.min(time, Math.max(0, audio.duration - 1));
}

async function loadPracticeTrack(deck, url, bpmValue, start) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`歌曲载入失败：${url}`);
  await practiceEngine.loadLocalBuffer(deck, await response.arrayBuffer());
  practiceEngine.setTrackBpm(deck, bpmValue);
  practiceEngine.decks[deck].alignTo(start);
  practiceEngine.decks[deck].cuePoint = start;
}

async function setupPracticeEngine() {
  if (practiceEngineReady) { await practiceEngine.context?.resume(); return; }
  $('#practice3dStatus').textContent = '正在载入 A 与 B2…';
  await practiceEngine.initialize();
  await Promise.all([
    loadPracticeTrack('a', '../assets/tracks/course-06-a-madoromi.mp3', 72, starts.a),
    loadPracticeTrack('b', '../assets/tracks/course-06-b2-all-night.mp3', 77, starts.b2)
  ]);
  practiceEngineReady = true;
  resetPracticeEngine();
  $('#practice3dStatus').textContent = 'A 与 B2 已载入，可以开始';
}

function resetPracticeEngine() {
  ['a','b'].forEach((id,index) => {
    const deck = practiceEngine.decks[id];
    if (deck?.playing) deck.pause();
    if (deck) { const start = index ? starts.b2 : starts.a; deck.alignTo(start); deck.cuePoint = start; deck.playbackRate = 1; }
    updatePracticeTransport(id, false);
  });
  const values = { lowA:0, lowB:-12, midA:0, midB:0, highA:0, highB:0, volumeA:80, volumeB:80, crossfader:-100, filterA:0, filterB:0 };
  Object.entries(values).forEach(([id,value]) => { const input=$(`#${id}`); if(input) input.value=value; });
  ['a','b'].forEach((id,index) => { practiceEngine.setVolume(id,.8); practiceEngine.setEq(id,'low',index?-12:0); practiceEngine.setEq(id,'mid',0); practiceEngine.setEq(id,'high',0); practiceEngine.setFilter(id,0); });
  practiceEngine.setCrossfader(-1); practiceEngine.setTrackBpm('a',72); practiceEngine.setTrackBpm('b',77);
}

function highlightPracticeControls(ids = []) {
  $$('.hidden-controls .is-next').forEach(control => control.classList.remove('is-next'));
  ids.forEach(id => $(`#${id}`)?.classList.add('is-next'));
}

async function playPair(id) {
  initAudio();
  stopAll();
  const b = tracks[id];
  await Promise.all([seekAudio(tracks.a, starts.a), seekAudio(b, starts[id])]);
  tracks.a.playbackRate = 1;
  b.playbackRate = targetBpm / bpm[id];
  setLow('a', 0); setLow(id, id === 'b1' ? -3 : -6); setCross(0, id);
  feedback(id === 'b1' ? '听主线是否抢位置' : '听律动能否持续共存', id === 'b1' ? '注意两条旋律同时出现时，注意力是否被拉向两个方向。' : '注意鼓组与和声叠放后，是否仍然稳定、自然。');
  await Promise.all([tracks.a.play(), b.play()]);
  const button = $(`[data-play="${id}"]`);
  button.textContent = '正在试听 30 秒';
  pairTimers.push(window.setTimeout(() => {
    heardPairs[id] = true;
    button.textContent = '重新试听重叠';
    $$(`[data-choice^="${id}:"]`).forEach(choice => choice.disabled = false);
    feedback('这组已经听过', '现在根据实际听感选择短交接或长混合。');
  }, 8000));
  pairTimers.push(window.setTimeout(() => { tracks.a.pause(); b.pause(); button.textContent = '重新试听重叠'; }, 30000));
}

async function playTransitionDemo(kind) {
  initAudio(); stopAll();
  const id = kind === 'short' ? 'b1' : 'b2';
  const b = tracks[id];
  await Promise.all([seekAudio(tracks.a, starts.a), seekAudio(b, starts[id])]);
  tracks.a.playbackRate = 1; b.playbackRate = targetBpm / bpm[id];
  setLow('a', 0); setLow(id, -12); setCross(-1, id);
  await Promise.all([tracks.a.play(), b.play()]);
  const totalBeats = kind === 'short' ? 16 : 32;
  const exchangeBeat = kind === 'short' ? 8 : 16;
  const finishBeat = kind === 'short' ? 16 : 32;
  feedback(kind === 'short' ? '正在听 16 拍短接成品' : '正在听 32 拍长混成品', '不用记流程，只听两首同时存在的时间和声音重心变化。');
  pairTimers.push(setTimeout(() => setCross(0, id), 4 * beatMs));
  pairTimers.push(setTimeout(() => { setLow('a', -12); setLow(id, 0); }, exchangeBeat * beatMs));
  pairTimers.push(setTimeout(() => setCross(1, id), finishBeat * beatMs));
  pairTimers.push(setTimeout(() => { tracks.a.pause(); b.pause(); feedback('成品试听结束', kind === 'short' ? '主线冲突时，重叠更短。' : '能够共存时，声音重心可以更慢地移动。'); }, (totalBeats + 6) * beatMs));
}

function updateHeader() {
  $$('#progress span').forEach((item, index) => {
    item.classList.toggle('done', index < step);
    item.classList.toggle('current', index === step);
  });
  $('#stepBadge').textContent = `${String(step + 1).padStart(2, '0')} / 06`;
  $('#instructionIcon').textContent = titles[step][0];
  $('#instructionTitle').textContent = titles[step][1];
  $('#instructionCopy').textContent = titles[step][2];
}

function renderDecision() {
  $('#stage').innerHTML = `<h3>直接播放上方三首歌</h3><p class="stage-copy">可以暂停、继续或重听。觉得已经听出差别，就直接进入真实重叠比较。</p><div class="listen-check"><span id="heard-a">A</span><span id="heard-b1">B1</span><span id="heard-b2">B2</span></div>`;
  $('#primaryAction').textContent = '比较真实重叠';
  $('#primaryAction').disabled = false;
  feedback('先听，再按自己的判断继续', '不设试听时长限制；三首歌可随时播放、暂停和继续。');
}

function renderCompare() {
  $('#stage').innerHTML = `<h3>同一个 A，换一首 B，关系就会变化</h3><p class="stage-copy">分别试听真实重叠片段，再选择接法。答案按钮不会提前发光。</p><div class="song-pairs">
    <article class="song-card" id="cardB1"><strong>A＋B1《我只在乎你》</strong><p>先听主线、和声与安全重叠空间。</p><div class="song-actions"><button data-play="b1">试听 30 秒重叠</button></div><div class="choice-row"><button data-choice="b1:short">16 拍短交接</button><button data-choice="b1:long">32 拍长混合</button></div></article>
    <article class="song-card" id="cardB2"><strong>A＋B2《All Night》</strong><p>先听器乐空间、律动与和声。</p><div class="song-actions"><button data-play="b2">试听 30 秒重叠</button></div><div class="choice-row"><button data-choice="b2:short">16 拍短交接</button><button data-choice="b2:long">32 拍长混合</button></div></article>
  </div>`;
  $$('[data-play]').forEach(button => button.onclick = () => playPair(button.dataset.play));
  $$('[data-choice]').forEach(button => button.onclick = () => choose(button));
  $('#primaryAction').textContent = '看 16 拍流程';
  $('#primaryAction').disabled = !(answer.b1 === 'short' && answer.b2 === 'long');
  feedback('必须先听两组重叠', '每组听到完整的主线与律动后，选择按钮才会开放。');
}

function choose(button) {
  const [id, value] = button.dataset.choice.split(':');
  answer[id] = value;
  $$(`[data-choice^="${id}:"]`).forEach(item => item.classList.toggle('chosen', item === button));
  const correct = (id === 'b1' && value === 'short') || (id === 'b2' && value === 'long');
  if (!correct) {
    feedback('再听一次关键片段', id === 'b1' ? 'A＋B1 的主线同时出现，而且没有完整 32 拍安全空间。' : 'A＋B2 有完整器乐空间，律动和和声可以持续共存。');
  } else {
    feedback(id === 'b1' ? 'B1：16 拍' : 'B2：32 拍', id === 'b1' ? '主线冲突时快速错开。' : '能够共存时慢慢交换低频与声音重心。');
  }
  $('#cardB1').classList.toggle('selected', answer.b1 === 'short');
  $('#cardB2').classList.toggle('selected', answer.b2 === 'long');
  $('#primaryAction').disabled = !(answer.b1 === 'short' && answer.b2 === 'long');
}

function methodCards(kind) {
  const short = [
    ['准备 B', 'Cue 放在主线前，Sync、GAIN 完成，B LOW≤−12 dB。'],
    ['1–8 拍', 'B 收低频进入，Crossfader 向中央。'],
    ['9–12 拍', '收 A LOW，让 A 的主线退出。'],
    ['13–16 拍', '恢复 B LOW，推到 B；B 主线再出现。']
  ];
  const long = [
    ['准备 32 拍', '找到完整乐句，Sync、GAIN 完成，B LOW≤−12 dB。'],
    ['1–8 拍', 'B 收低频进入，推子轻推向 B。'],
    ['9–16 拍', '两首共存，Crossfader 到中央。'],
    ['17–24 拍', 'A LOW 降低，同时 B LOW 恢复。'],
    ['25–32 拍', '推到 B，A 在乐句边界退出。']
  ];
  const items = kind === 'short' ? short : long;
  return `<div class="method-grid" style="grid-template-columns:repeat(${items.length},1fr)">${items.map((item, index) => `<article class="method-card"><span>${index + 1}</span><strong>${item[0]}</strong><p>${item[1]}</p></article>`).join('')}</div>`;
}

function renderShort() {
  $('#stage').innerHTML = `<h3>实听 A＋B1 的 16 拍短接</h3><div class="demo-listen"><div><strong>主线冲突时缩短重叠</strong><p>点击后只听成品，不背操作顺序。</p></div><button id="demoShort">播放短接</button></div><div class="beat-ruler">${Array.from({length:16},(_,i)=>`<i class="${i%4===0?'phase':''}">${i+1}</i>`).join('')}</div>`;
  $('#demoShort').onclick = () => playTransitionDemo('short');
  $('#primaryAction').textContent = '听 32 拍长混';
  $('#primaryAction').disabled = false;
  feedback('先听结果', '注意 A 和 B1 同时出现的时间比较短。');
}

function renderLong() {
  $('#stage').innerHTML = `<h3>实听 A＋B2 的 32 拍长混</h3><div class="demo-listen"><div><strong>能共存时延长重叠</strong><p>点击后听声音重心缓慢从 A 移到 B2。</p></div><button id="demoLong">播放长混</button></div><div class="beat-ruler long">${Array.from({length:32},(_,i)=>`<i class="${i%4===0?'phase':''}">${i+1}</i>`).join('')}</div>`;
  $('#demoLong').onclick = () => playTransitionDemo('long');
  $('#primaryAction').textContent = '进入 3D 实操';
  $('#primaryAction').disabled = false;
  feedback('只比较听感', '长混的共同播放更久，变化更慢；下一步直接上3D设备操作。');
}

function renderPractice() {
  $('#stage').innerHTML = `<h3>A《まどろみ》＋B2《All Night》3D 实操</h3><div class="beat-ruler long" id="practiceBeats">${Array.from({length:32},(_,i)=>`<i class="${i%4===0?'phase':''}">${i+1}</i>`).join('')}</div><div class="practice-3d" id="practice3dMount"></div><p class="practice-3d-status" id="practice3dStatus">正在载入真实歌曲…</p>`;
  if (practiceController) $('#practice3dMount').append(practiceController.host);
  $('#primaryAction').textContent = '正在载入 3D 设备';
  $('#primaryAction').disabled = true;
  practiceSynced = false;
  setupPracticeEngine().then(() => {
    if (step !== 4) return;
    resetPracticeEngine();
    highlightPracticeControls(['syncB']);
    $('#primaryAction').textContent = '先在 3D 机上按 SYNC B';
    feedback('第一步：按 SYNC B', '直接操作3D打碟机。完成后系统会告诉你下一项。');
  }).catch(error => {
    $('#practice3dStatus').textContent = '3D 歌曲载入失败';
    feedback('无法载入3D实操', error.message);
  });
}

async function startPractice() {
  if (!practiceEngineReady) return;
  resetPracticeEngine();
  practiceSynced = false;
  highlightPracticeControls(['syncB']);
  $('#primaryAction').disabled = true;
  $('#primaryAction').textContent = '先在 3D 机上按 SYNC B';
  $('#practice3dStatus').textContent = '等待 SYNC B';
  feedback('重新开始实操', '先按 SYNC B，再按 PLAY A。');
}

function beginPracticeClock() {
  practice = { start: performance.now(), bStarted: false, entryBeat: null, at8: null, at16: null, at24: null, raf: 0 };
  $('#primaryAction').disabled = true;
  $('#primaryAction').textContent = '练习进行中';
  highlightPracticeControls(['playB']);
  $('#practice3dStatus').textContent = '第 1 拍按 PLAY B';
  feedback('看拍子启动 B2', '第 1 格亮起时，在3D机右侧按 PLAY B。');
  tickPractice();
}

function snapshotPractice() {
  return { lowA: Number($('#lowA').value), lowB: Number($('#lowB').value), cross: Number($('#crossfader').value) / 100 };
}

function tickPractice() {
  if (!practice) return;
  const elapsed = performance.now() - practice.start;
  const beat = Math.floor(elapsed / beatMs) + 1;
  $$('#practiceBeats i').forEach((cell, index) => cell.classList.toggle('on', index + 1 === clamp(beat, 1, 32)));
  const stage = beat <= 8 ? 1 : beat <= 16 ? 2 : beat <= 24 ? 3 : 4;
  const labels = ['第 1–8 拍｜启动 B2，B2 LOW 保持 −12 dB，推子轻推向 B', '第 9–16 拍｜两首共存，把推子推到中央', '第 17–24 拍｜A LOW 降到 −12 dB，B2 LOW 恢复到 0', '第 25–32 拍｜把 Crossfader 推到 B2'];
  $('#practice3dStatus').textContent = labels[stage - 1];
  highlightPracticeControls(stage === 1 ? ['playB','crossfader'] : stage === 2 ? ['crossfader'] : stage === 3 ? ['lowA','lowB'] : ['crossfader']);
  feedback(`当前：${labels[stage - 1].split('｜')[0]}`, labels[stage - 1].split('｜')[1]);
  if (beat >= 8 && !practice.at8) practice.at8 = snapshotPractice();
  if (beat >= 16 && !practice.at16) practice.at16 = snapshotPractice();
  if (beat >= 24 && !practice.at24) practice.at24 = snapshotPractice();
  if (elapsed >= 32 * beatMs) { finishPractice(); return; }
  practice.raf = requestAnimationFrame(tickPractice);
}

function finishPractice() {
  const result = snapshotPractice();
  const failures = [];
  if (!practice.bStarted || practice.entryBeat > 2) failures.push('B2 没有在开始的第 1 拍附近进入');
  if (!practice.at8 || practice.at8.lowB > -9 || practice.at8.cross < -.9 || practice.at8.cross > -.15) failures.push('第 1–8 拍应保持 B2 低频收起，并把推子轻推向 B');
  if (!practice.at16 || Math.abs(practice.at16.cross) > .38) failures.push('第 16 拍 Crossfader 应接近中央');
  if (!practice.at24 || practice.at24.lowA > -9 || practice.at24.lowB < -2.5) failures.push('第 17–24 拍需要完成 LOW 交换');
  if (result.cross < .8) failures.push('第 32 拍需要把声音重心交给 B2');
  ['a','b'].forEach(id => { if (practiceEngine.decks[id]?.playing) practiceEngine.decks[id].pause(); });
  practice = null;
  highlightPracticeControls([]);
  $('#primaryAction').disabled = false;
  if (failures.length) {
    $('#primaryAction').textContent = '重做这 32 拍';
    feedback('还差一个关键阶段', failures[0]);
  } else {
    $('#primaryAction').textContent = '回听与总结';
    $('#primaryAction').dataset.passed = 'true';
    feedback('32 拍长混合完成', 'B2 收低频进入、共同播放、LOW 交换和 A 退出都按顺序完成。');
  }
}

function renderReview() {
  $('#stage').innerHTML = `<h3>你已经用听感做出选择，并在3D机上完成实操</h3><div class="song-pairs"><article class="song-card selected"><strong>A＋B1｜16 拍短交接</strong><p>主线同时出现会互相争抢，减少重叠。</p></article><article class="song-card selected"><strong>A＋B2｜32 拍长混合</strong><p>器乐空间可以共存，允许更慢地移动声音重心。</p></article></div>`;
  $('#primaryAction').textContent = '完成 06';
  $('#primaryAction').disabled = false;
  feedback('下一课不再提示步骤', '07 会使用 3D 打碟机；你独立完成 A＋B1，提交后再由 AI 评分。');
}

function setStep(next) {
  stopAll(); step = clamp(next, 0, 5); updateHeader();
  delete $('#primaryAction').dataset.passed;
  [renderDecision, renderCompare, renderShort, renderLong, renderPractice, renderReview][step]();
}

$('#primaryAction').onclick = () => {
  if (step === 4) {
    if ($('#primaryAction').dataset.passed === 'true') setStep(5); else startPractice();
    return;
  }
  if (step === 5) { $('#resultOverlay').classList.remove('hidden'); return; }
  setStep(step + 1);
};
$('#startCourse').onclick = () => { $('#introOverlay').classList.add('hidden'); $('#bubble').hidden = false; setStep(0); };
$('#resetCourse').onclick = () => {
  stopAll(); answer = { b1:null, b2:null };
  Object.keys(heard).forEach(key => { heard[key] = false; });
  Object.keys(heardPairs).forEach(key => { heardPairs[key] = false; });
  Object.keys(auditionOffsets).forEach(key => { auditionOffsets[key] = 0; });
  resetAuditionUI(true);
  $$('.audition-track').forEach(row => row.classList.remove('heard'));
  $('#resultOverlay').classList.add('hidden'); $('#introOverlay').classList.remove('hidden'); $('#bubble').hidden = true; setStep(0);
};
$('#repeatCourse').onclick = () => {
  stopAll(); answer = { b1:null, b2:null };
  Object.keys(heardPairs).forEach(key => { heardPairs[key] = false; });
  $('#resultOverlay').classList.add('hidden'); $('#introOverlay').classList.add('hidden'); $('#bubble').hidden = false; setStep(0);
};
$('#goCourse07').onclick = () => { location.href = 'course-07-playable.html'; };
$$('.audition-track button').forEach(button => button.onclick = () => toggleAudition(button.closest('.audition-track').dataset.audition));
window.addEventListener('pagehide', stopAll);
setStep(0);
