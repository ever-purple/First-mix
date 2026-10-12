import { AudioEngine } from '../audio-engine.js';
import { createController } from '../controller-3d.js?v=20261012-course07-independent-eq';
import { saveWork } from '../works-store.js';

const $ = selector => document.querySelector(selector);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const engine = new AudioEngine();
const START_A = 220;
const SHORT_START_B = 30;
const LONG_START_B = 0;
const BPM_A = 72;
const BPM_B = 70;
const GUIDED_BEAT_MS = 60000 / BPM_A;

let ready = false;
let sessionStart = 0;
let recordingStart = 0;
let recording = false;
let sessionEvents = [];
let mixResult = null;
let mixUrl = '';
let savedWorkId = null;
let meterFrame = 0;
let peakMax = 0;
let energySamples = [];
let bAudibleEntry = null;
let mode = 'guided-short';
let activeStartB = SHORT_START_B;
let guided = null;
let guidedSynced = false;
let guidedResetting = false;
let longGuideElapsed = 0;
let longGuideResumedAt = 0;
let longGuidePhase = -1;
const LONG_GUIDE_NAMES = ['推向 B','居中','LOW A↓B↑','推到 B'];

const state = { lowA:0, lowB:0, midA:0, midB:0, highA:0, highB:0, volumeA:.8, volumeB:.8, cross:-1 };

function installTrackNames() {
  try {
    const a = new DataTransfer(); a.items.add(new File([''], '具島直子 · まどろみ'));
    const b = new DataTransfer(); b.items.add(new File([''], '邓丽君 · 我只在乎你'));
    $('#fileA').files = a.files; $('#fileB').files = b.files;
  } catch { /* the 3D display falls back to Deck A/B */ }
}

installTrackNames();
const controller = createController(engine);
if (!controller) $('#deckStage').insertAdjacentHTML('afterbegin', '<p style="padding:24px;text-align:center">当前浏览器无法显示 3D 打碟机，请开启硬件加速后重试。</p>');
controller?.host.querySelectorAll('[data-source="loadA"],[data-source="loadB"]').forEach(button => {
  button.disabled=true;
  button.hidden=true;
  button.style.display='none';
});
const courseDisplay=controller?.host.querySelector('.model-display-flat');
if(courseDisplay){
  courseDisplay.id='modelParametersPanel';
  courseDisplay.insertAdjacentHTML('beforeend','<div class="course-view-controls"><label>角度<input id="viewAngle" type="range" min="45" max="82" value="70" aria-label="调整模型角度"></label><label>大小<input id="viewSize" type="range" min="0.75" max="1" step="0.01" value="1" aria-label="调整模型大小"></label></div>');
}

function timeText(seconds = 0) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}.${Math.floor((safe % 1) * 10)}`;
}

function snapshot() {
  const a = engine.decks.a;
  const b = engine.decks.b;
  return {
    aPos:a?.position() ?? 0, bPos:b?.position() ?? 0,
    aPlaying:Boolean(a?.playing), bPlaying:Boolean(b?.playing),
    cueA:a?.cuePoint ?? 0, cueB:b?.cuePoint ?? 0,
    rateA:a?.playbackRate ?? 1, rateB:b?.playbackRate ?? 1,
    ...state
  };
}

function log(type, detail = {}) {
  const now = performance.now();
  const item = { type, detail, stamp:now, sessionTime:sessionStart ? (now-sessionStart)/1000 : 0, recordTime:recordingStart ? (now-recordingStart)/1000 : null, state:snapshot() };
  sessionEvents.push(item);
  if (recording && !bAudibleEntry && item.state.bPlaying && item.state.cross > -.85) bAudibleEntry = item;
  return item;
}

function updateTransport(deck, playing) {
  const button = $(`#play${deck.toUpperCase()}`);
  button.setAttribute('aria-pressed', String(playing));
  button.textContent = `${playing ? '暂停' : '播放'} ${deck.toUpperCase()}`;
}

function bindControls() {
  $('#playA').onclick = async () => {
    try {
      if(mode==='score-long'&&!recording&&!mixResult)await startRecording();
      await engine.toggle('a');
    } catch(error) {
      $('#challengeStatus').textContent=`无法开始录制：${error.message}`;
      $('#recordHint').textContent='录制未启动，请检查浏览器录音支持后重试 PLAY A';
    }
  };
  $('#playB').onclick = () => engine.toggle('b');
  $('#cueA').onclick = () => engine.cueDeck('a');
  $('#cueB').onclick = () => engine.cueDeck('b');
  $('#syncB').onclick = () => engine.syncB();
  ['A','B'].forEach(label => {
    const id = label.toLowerCase();
    $(`#bpmInput${label}`).oninput = event => { engine.setTrackBpm(id, Number(event.target.value)); log('bpm', { deck:id, value:Number(event.target.value) }); };
    $(`#volume${label}`).oninput = event => { const value=Number(event.target.value)/100; state[`volume${label}`]=value; engine.setVolume(id,value); };
    ['low','mid','high'].forEach(band => {
      $(`#${band}${label}`).oninput = event => { const value=Number(event.target.value); state[`${band}${label}`]=value; engine.setEq(id,band,value); };
    });
    $(`#filter${label}`).oninput = event => engine.setFilter(id, Number(event.target.value)/100);
  });
  $('#crossfader').oninput = event => { state.cross=Number(event.target.value)/100; engine.setCrossfader(state.cross); };
  $('#restoreTraining').onclick = event => event.preventDefault();

  engine.addEventListener('transport', event => {
    updateTransport(event.detail.deck, event.detail.playing);
    log('transport', event.detail);
    handleGuidedTransport(event.detail);
    handleLongGuideTransport(event.detail);
  });
  engine.addEventListener('cue', event => log('cue', event.detail));
  engine.addEventListener('sync', event => { log('sync', event.detail); handleGuidedSync(); });
  engine.addEventListener('control', event => log('control', event.detail));
  engine.addEventListener('crossfader', event => { state.cross=event.detail.value; log('crossfader', event.detail); });

  controller?.host.querySelectorAll('.model-jog').forEach((jog,index) => jog.addEventListener('pointerup', () => log('jog', { deck:index ? 'b' : 'a' })));
}

bindControls();

async function loadTrack(deck, url, bpm, start) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`歌曲载入失败：${url}`);
  await engine.loadLocalBuffer(deck, await response.arrayBuffer());
  engine.setTrackBpm(deck, bpm);
  engine.decks[deck].alignTo(start);
  engine.decks[deck].cuePoint = start;
}

async function setupEngine() {
  if (ready) { await engine.context?.resume(); return; }
  $('#challengeStatus').textContent = '正在载入真实歌曲…';
  await engine.initialize();
  await Promise.all([
    loadTrack('a','../assets/tracks/course-06-a-madoromi.mp3',BPM_A,START_A),
    loadTrack('b','../assets/tracks/course-06-b1-wo-zhi-zai-hu-ni.mp3',BPM_B,activeStartB)
  ]);
  resetControls(false);
  ready = true;
  sessionStart = performance.now();
  $('#recordMix').disabled = false;
  $('#challengeStatus').textContent = '16 拍引导准备';
  monitorMeter();
}

function resetControls(clearEvents = true) {
  ['a','b'].forEach((id,index) => {
    const deck = engine.decks[id];
    if (deck?.playing) deck.pause();
    if (deck) { deck.alignTo(index ? activeStartB : START_A); deck.cuePoint=index ? activeStartB : START_A; deck.playbackRate=1; }
    updateTransport(id,false);
  });
  Object.assign(state,{lowA:0,lowB:0,midA:0,midB:0,highA:0,highB:0,volumeA:.8,volumeB:.8,cross:-1});
  ['low','mid','high'].forEach(band => ['A','B'].forEach(label => { const input=$(`#${band}${label}`);input.value=0;engine.setEq(label.toLowerCase(),band,0); }));
  state.lowB=-12;$('#lowB').value=-12;engine.setEq('b','low',-12);
  ['A','B'].forEach(label => { $(`#volume${label}`).value=80; engine.setVolume(label.toLowerCase(),.8); $(`#filter${label}`).value=0; engine.setFilter(label.toLowerCase(),0); });
  $('#crossfader').value=-100;engine.setCrossfader(-1);
  $('#bpmInputA').value=BPM_A;$('#bpmInputB').value=BPM_B;engine.setTrackBpm('a',BPM_A);engine.setTrackBpm('b',BPM_B);
  if (clearEvents) { sessionEvents=[];sessionStart=performance.now(); }
  recordingStart=0;recording=false;bAudibleEntry=null;peakMax=0;energySamples=[];
  $('#recordTime').classList.remove('live');$('#recordTime span').textContent='00:00.0';
  $('#recordMix').classList.add('hidden');$('#recordMix').disabled=false;
  $('#stopMix').classList.add('hidden');$('#submitMix').classList.add('hidden');$('#listenMix').classList.add('hidden');
  $('#recordHint').textContent='32 拍引导 · 按 PLAY A 自动录制';$('#recordHint').classList.remove('hidden');
  $('#challengeStatus').textContent=mode==='guided-short'?'16 拍引导准备':'32 拍挑战准备';
}

function monitorMeter() {
  if (meterFrame) cancelAnimationFrame(meterFrame);
  const draw = () => {
    if (recording && engine.analyser) {
      const data=engine.readWaveform();let peak=0,sum=0;
      for(const sample of data){const value=(sample-128)/128;peak=Math.max(peak,Math.abs(value));sum+=value*value;}
      peakMax=Math.max(peakMax,peak);
      const rms=Math.sqrt(sum/data.length);energySamples.push(rms>0?20*Math.log10(rms):-60);
    }
    if (recordingStart) $('#recordTime span').textContent=timeText((performance.now()-recordingStart)/1000);
    syncLongGuide();
    meterFrame=requestAnimationFrame(draw);
  };
  draw();
}

function setGuidedMessage(title, copy) {
  $('#guidedTitle').textContent=title;
  $('#guidedCopy').textContent=copy;
}

function paintGuidedBeat(beat=0) {
  [...$('#guidedBeats').children].forEach((cell,index)=>{
    cell.classList.toggle('past',index+1<beat);
    cell.classList.toggle('on',index+1===beat);
  });
}

function buildGuidedBeats() {
  $('#guidedBeats').innerHTML=Array.from({length:16},(_,index)=>`<i class="${index%4===0?'phase':''}">${index+1}</i>`).join('');
}

function stopGuidedDecks() {
  guidedResetting=true;
  ['a','b'].forEach(id=>{if(engine.decks[id]?.playing)engine.decks[id].pause();updateTransport(id,false);});
  guidedResetting=false;
}

function failGuided(title,copy) {
  if(guided?.raf)cancelAnimationFrame(guided.raf);
  stopGuidedDecks();
  guided=null;
  $('#guidedLowSwap').classList.add('hidden');
  setGuidedMessage(title,copy);
  $('#retryGuided').classList.remove('hidden');
  $('#challengeStatus').textContent='16 拍·重做';
}

function completeGuided() {
  if(guided?.raf)cancelAnimationFrame(guided.raf);
  stopGuidedDecks();
  guided=null;
  activeStartB=LONG_START_B;
  resetControls(true);
  $('#guidedLowSwap').classList.add('hidden');
  $('#challengeStatus').textContent='16 拍完成';
  $('#shortCompleteOverlay').classList.remove('hidden');
}

function tickGuided() {
  if(!guided||mode!=='guided-short')return;
  const beat=Math.floor((performance.now()-guided.startedAt)/GUIDED_BEAT_MS)+1;
  paintGuidedBeat(Math.min(beat,16));
  const lowReady=state.lowA<=-9&&state.lowB>=-3;
  const swapButton=$('#guidedLowSwap');
  swapButton.classList.toggle('hidden',beat<9||beat>16);
  swapButton.classList.toggle('done',lowReady);
  swapButton.disabled=lowReady;
  swapButton.textContent=lowReady?'LOW 已交换 ✓':'一键交换 LOW';
  if(beat<=8){
    setGuidedMessage(`第 ${beat} 拍：${guided.bStarted?'推 Crossfader 到中央':'按 PLAY B'}`,guided.bStarted?'B LOW 保持 −12，第 8 拍前把推子送到中央 0。':'尽量在第 1 拍启动 B。');
  }else if(!guided.checkedEntry){
    guided.checkedEntry=true;
    if(!guided.bStarted||guided.entryBeat>2||state.lowB>-9||Math.abs(state.cross)>.38){failGuided('第 1–8 拍没有完成','重做时：第 1 拍按 PLAY B，B LOW 保持 −12，推子在第 8 拍前到中央。');return;}
  }else if(beat<=12){
    setGuidedMessage('A LOW 降到 −12，B LOW 升到 0','可以手动调节，也可以点“交换 LOW”。第 16 拍前完成即可。');
  }else if(beat<=16){
    setGuidedMessage(lowReady?'LOW 已交换；推子到 B 端':'A LOW 降到 −12，B LOW 升到 0；推子到 B','第 16 拍前完成 LOW 交换，并将 Crossfader 推到 B 端（＋100）。');
  }else{
    if(state.lowA>-9||state.lowB<-3){failGuided('LOW 交换还没完成','A LOW 要降到 −12，B LOW 要升到 0；下次可点“交换 LOW”按钮。');return;}
    if(state.cross<.8){failGuided('LOW 已交换，横推杆还没到 B','最后还要把 Crossfader 完整推到 B 端（＋100）。');return;}
    completeGuided();return;
  }
  guided.raf=requestAnimationFrame(tickGuided);
}

function beginGuidedTimeline() {
  guided={startedAt:performance.now(),bStarted:false,entryBeat:null,checkedEntry:false,raf:0};
  $('#retryGuided').classList.add('hidden');
  $('#challengeStatus').textContent='16 拍引导中';
  tickGuided();
}

function handleGuidedSync() {
  if(mode!=='guided-short'||guidedResetting)return;
  guidedSynced=true;
  setGuidedMessage('第二步：按 PLAY A','A 开始后拍尺会走动；第 1 拍再按 PLAY B。');
}

function handleGuidedTransport(detail) {
  if(mode!=='guided-short'||guidedResetting)return;
  if(detail.deck==='a'&&detail.playing&&!guided){
    if(!guidedSynced){engine.toggle('a');setGuidedMessage('先按 SYNC B','SYNC 只负责对齐，完成后再按 PLAY A。');return;}
    beginGuidedTimeline();
  }
  if(detail.deck==='b'&&detail.playing&&guided&&!guided.bStarted){
    guided.bStarted=true;
    guided.entryBeat=Math.floor((performance.now()-guided.startedAt)/GUIDED_BEAT_MS)+1;
  }
}

function resetGuided() {
  mode='guided-short';activeStartB=SHORT_START_B;guidedSynced=false;
  if(guided?.raf)cancelAnimationFrame(guided.raf);guided=null;
  resetControls(true);buildGuidedBeats();paintGuidedBeat(0);
  $('#guidedLowSwap').classList.add('hidden');
  $('#retryGuided').classList.add('hidden');
  $('#guidedDock').classList.remove('hidden');$('#challengeDock').classList.add('hidden');
  setGuidedMessage('第一步：按 SYNC B','B 只对齐速度，不会自动播放。');
}

function resetLongGuide() {
  longGuideElapsed=0;longGuideResumedAt=0;longGuidePhase=-1;
  $('#longGuide').querySelectorAll('li').forEach(item=>{
    item.classList.remove('active','done');
    item.removeAttribute('aria-current');
  });
}

function syncLongGuide() {
  if(mode!=='score-long'||!recording||(!longGuideResumedAt&&!longGuideElapsed))return;
  const elapsed=longGuideElapsed+(longGuideResumedAt?performance.now()-longGuideResumedAt:0);
  const beat=Math.floor(elapsed/GUIDED_BEAT_MS)+1;
  const phase=beat>32?4:Math.floor((beat-1)/8);
  if(phase===longGuidePhase)return;
  longGuidePhase=phase;
  $('#longGuide').querySelectorAll('li').forEach((item,index)=>{
    item.classList.toggle('active',index===phase);
    item.classList.toggle('done',index<phase);
    if(index===phase)item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
  });
  $('#recordHint').textContent=phase===4?'32 拍已走完，可结束并保存':`${phase*8+1}–${phase*8+8} 拍 · ${LONG_GUIDE_NAMES[phase]}`;
}

function handleLongGuideTransport(detail) {
  if(mode!=='score-long'||!recording||detail.deck!=='b'||longGuidePhase===4)return;
  if(detail.playing){
    if(!longGuideResumedAt)longGuideResumedAt=performance.now();
  }else if(longGuideResumedAt){
    longGuideElapsed+=performance.now()-longGuideResumedAt;
    longGuideResumedAt=0;
  }
  syncLongGuide();
}

function beginLongChallenge() {
  mode='score-long';activeStartB=LONG_START_B;mixResult=null;savedWorkId=null;
  $('#shortCompleteOverlay').classList.add('hidden');
  $('#guidedDock').classList.add('hidden');$('#challengeDock').classList.remove('hidden');
  resetControls(true);
  resetLongGuide();
  $('#challengeStatus').textContent='按 PLAY A 自动开始录制';
}

async function startRecording() {
  if(mode!=='score-long')return;
  await setupEngine();
  if (recording||mixResult) return;
  mixResult=null;bAudibleEntry=null;peakMax=0;energySamples=[];
  await engine.startRecording();
  recording=true;recordingStart=performance.now();
  log('record-start');
  $('#recordTime').classList.add('live');
  $('#recordHint').textContent='录制中 · 按 PLAY B 开始 32 拍引导';
  $('#recordMix').classList.add('hidden');$('#stopMix').classList.remove('hidden');
  $('#challengeStatus').textContent='独立录制中';
  if(engine.decks.b.playing)handleLongGuideTransport({deck:'b',playing:true});
}

async function stopRecording() {
  if (!recording) return;
  log('record-stop');
  mixResult=await engine.stopRecording();
  recording=false;
  if(engine.decks.a.playing)await engine.toggle('a');
  if(engine.decks.b.playing)await engine.toggle('b');
  if(mixUrl)URL.revokeObjectURL(mixUrl);
  mixUrl=URL.createObjectURL(mixResult.blob);$('#mixPlayback').src=mixUrl;
  const duration=Math.max(1,mixResult.duration||0);
  const createdAt=Date.now();
  const stamp=new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(createdAt)).replace(/[\/:]/g,'-').replace(/\s/g,'_');
  try {
    const id=crypto.randomUUID?.()||`course-07-${createdAt}`;
    await saveWork({id,title:`07 转场练习_${stamp}`,createdAt,duration,type:mixResult.type,bpm:BPM_A,sourceKind:'training-or-mixed',aiEligible:false,analysis:null,blob:mixResult.blob});
    savedWorkId=id;
    let activity=[];
    try {const stored=JSON.parse(localStorage.getItem('first-mix-activity-log-v1')||'[]');if(Array.isArray(stored))activity=stored;}catch{/* keep the recorded work even if the activity log is invalid */}
    activity.unshift({id:crypto.randomUUID?.()||`activity-${createdAt}`,type:'work',title:'保存了 07 转场作品',detail:`${Math.floor(duration/60)}分${Math.round(duration%60)}秒 · 本机作品记录`,createdAt});
    try{localStorage.setItem('first-mix-activity-log-v1',JSON.stringify(activity.slice(0,500)));}catch{/* the audio work is already saved */}
    $('#recordHint').textContent='已自动保存到「我的作品」';
    $('#challengeStatus').textContent='作品已自动保存，可回听或评分';
  } catch(error) {
    savedWorkId=null;
    $('#recordHint').textContent='本机保存失败，请在评分后下载录音';
    $('#challengeStatus').textContent=`作品未保存：${error.message}`;
  }
  $('#recordTime').classList.remove('live');$('#stopMix').classList.add('hidden');
  $('#recordTime span').textContent=timeText(duration);recordingStart=0;
  $('#recordHint').classList.remove('hidden');
  $('#submitMix').classList.remove('hidden');$('#listenMix').classList.remove('hidden');
}

function firstEvent(type,predicate=()=>true){return sessionEvents.find(item=>item.type===type&&predicate(item));}
function lastEvent(type,predicate=()=>true){return [...sessionEvents].reverse().find(item=>item.type===type&&predicate(item));}
function scoreBand(value, bands){for(const [limit,score] of bands)if(value<=limit)return score;return 0;}
function phaseError(stateAtEntry){
  if(!stateAtEntry)return 1;
  const phaseA=(stateAtEntry.aPos*BPM_A/60)%1,phaseB=(stateAtEntry.bPos*BPM_B/60)%1;
  const diff=Math.abs(phaseA-phaseB);return Math.min(diff,1-diff);
}
function energyVariation(){
  if(energySamples.length<8)return 20;
  const sorted=[...energySamples].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.1)],high=sorted[Math.floor(sorted.length*.9)];
  return high-low;
}

function evaluateMix() {
  const duration=mixResult?.duration||0;
  const cueA=lastEvent('cue',item=>item.detail.deck==='a'&&item.detail.action==='set');
  const cueB=lastEvent('cue',item=>item.detail.deck==='b'&&item.detail.action==='set');
  const recordStart=firstEvent('record-start');
  const aStart=firstEvent('transport',item=>item.recordTime!=null&&item.detail.deck==='a'&&item.detail.playing);
  let entry=bAudibleEntry;
  if(!entry)entry=firstEvent('crossfader',item=>item.recordTime!=null&&item.state.bPlaying&&item.state.cross>-.85);
  const crossEnd=firstEvent('crossfader',item=>item.recordTime!=null&&item.state.cross>=.8);
  const lastCross=lastEvent('crossfader',item=>item.recordTime!=null)||recordStart;
  const endState=lastCross?.state||snapshot();
  const aSolo=entry?.recordTime??duration;
  const transitionDuration=entry&&crossEnd?Math.max(0,crossEnd.recordTime-entry.recordTime):duration;
  const bSolo=crossEnd?Math.max(0,duration-crossEnd.recordTime):0;
  const tempoA=BPM_A*(entry?.state.rateA||1),tempoB=BPM_B*(entry?.state.rateB||1);
  const tempoDiff=Math.abs(tempoA-tempoB);
  const phase=phaseError(entry?.state);
  const peakDb=peakMax>0?20*Math.log10(peakMax):-60;
  const variation=energyVariation();
  const crossEvents=sessionEvents.filter(item=>item.type==='crossfader'&&item.recordTime!=null);
  let reversals=0;for(let i=2;i<crossEvents.length;i++){const d1=crossEvents[i-1].state.cross-crossEvents[i-2].state.cross,d2=crossEvents[i].state.cross-crossEvents[i-1].state.cross;if(d1>.04&&d2<-.04)reversals++;}
  const cueScore=(cueA?5:0)+(cueB?5:0)+(aStart&&recordStart&&Math.abs((aStart.recordTime||0))<6?5:0)+(aSolo>=10&&aSolo<=32?5:0);
  const tempoScore=scoreBand(tempoDiff,[[.25,8],[.75,6],[1.5,3]])+scoreBand(phase,[[.08,12],[.16,9],[.25,6],[.4,3]]);
  const levelScore=((entry?.state.lowB??12)<=-9?6:(entry?.state.lowB??12)<=-6?3:0)+(endState.lowA<=-9?4:endState.lowA<=-6?2:0)+(endState.lowB>=-3?4:endState.lowB>=-6?2:0)+(peakDb<=-1?6:peakDb<=0?3:0);
  const transitionScore=((recordStart?.state.cross??0)<=-.8?4:0)+(crossEnd?5:0)+(transitionDuration>=18&&transitionDuration<=34?6:transitionDuration<=40?3:0)+(reversals<=1?5:reversals<=3?2:0)+(entry&&entry.state.lowB<=-9&&endState.lowA<=-9&&endState.lowB>=-3?5:2);
  const structureScore=(duration>=50&&duration<=72?5:duration>=40&&duration<=82?3:0)+(aSolo>=12&&aSolo<=30?4:aSolo>=8?2:0)+(bSolo>=12?3:bSolo>=7?1:0)+(variation<=16?3:variation<=22?1:0);
  const rows=[['Cue 与乐句',cueScore,20],['速度与贴拍',tempoScore,20],['音量与低频',levelScore,20],['32 拍长混控制',transitionScore,25],['整体结构与听感',structureScore,15]];
  const total=rows.reduce((sum,row)=>sum+row[1],0);
  const evidence=[
    `B1 可听进入：${entry?timeText(entry.recordTime):'未检测到'}；A 单独段约 ${aSolo.toFixed(1)} 秒。`,
    `进入时拍点误差：${entry?phase.toFixed(2)+' 拍':'无数据'}；两轨速度差 ${tempoDiff.toFixed(2)} BPM。`,
    `峰值 ${peakDb.toFixed(1)} dBFS；交接能量跨度约 ${variation.toFixed(1)} dB。`,
    `Crossfader 交接耗时 ${transitionDuration.toFixed(1)} 秒；方向反复 ${reversals} 次；B 单独段 ${bSolo.toFixed(1)} 秒。`
  ];
  return {total,rows,evidence,duration,peakDb,entry,crossEnd};
}

function renderScore(result) {
  localStorage.setItem('first-mix-course-07-complete','true');
  $('#scoreTotal').textContent=result.total;
  $('#scoreTitle').textContent=result.total>=80?'完成独立挑战':result.total>=60?'转场成立，还能更稳':'先修正一个关键问题';
  const weakest=[...result.rows].sort((a,b)=>a[1]/a[2]-b[1]/b[2])[0];
  const strongest=[...result.rows].sort((a,b)=>b[1]/b[2]-a[1]/a[2])[0];
  $('#scoreSummary').textContent=`完整录音 ${timeText(result.duration)}。最高项：${strongest[0]}；优先改进：${weakest[0]}。${savedWorkId?'已自动保存到「我的作品」。':'本机保存失败，请下载录音。'}`;
  $('#scoreList').innerHTML=result.rows.map(([name,value,max])=>`<div class="score-row"><span>${name}</span><span class="score-bar"><i style="width:${value/max*100}%"></i></span><strong>${value}/${max}</strong></div>`).join('');
  $('#scoreEvidence').innerHTML=`<p><strong>表现最好：</strong>${strongest[0]} ${strongest[1]}/${strongest[2]}。</p><p><strong>优先改进：</strong>${weakest[0]} ${weakest[1]}/${weakest[2]}。点击回听作品时，对照下方证据定位。</p>${result.evidence.map(item=>`<p>${item}</p>`).join('')}`;
  $('#scoreOverlay').classList.remove('hidden');
  $('#saveMix').textContent=savedWorkId?'查看我的作品':'下载录音';
  $('#challengeStatus').textContent=`AI 评分 ${result.total} / 100`;
}

async function submitScore() {
  if(!mixResult)return;
  $('#submitMix').disabled=true;$('#challengeStatus').textContent='AI 正在评判…';
  await new Promise(resolve=>setTimeout(resolve,500));
  renderScore(evaluateMix());
  $('#submitMix').disabled=false;
}

function retry() {
  $('#scoreOverlay').classList.add('hidden');$('#mixPlayback').pause();mixResult=null;savedWorkId=null;resetControls(true);resetLongGuide();
}

function saveMix() {
  if(savedWorkId){window.location.href='../index.html?view=my&my-view=works';return;}
  if(!mixUrl)return;
  const link=document.createElement('a');link.href=mixUrl;link.download=`FIRST-MIX-07-${new Date().toISOString().slice(0,10)}.webm`;link.click();
}

const keyGuideSteps=[
  ['PLAY','开始或暂停当前 Deck。录制时何时播放 A、B 由你决定。'],
  ['CUE','暂停时保存当前位置；播放时返回已保存位置。'],
  ['SYNC B','让 B 的播放速度跟随 A；拍点仍需用唱盘检查与微调。'],
  ['唱盘','水平拖动：向右推进、向左回拉，修正瞬时拍点或寻找 Cue。'],
  ['音量 / GAIN','机身中央两侧的纵向推杆控制每首歌进入混音器的强度。'],
  ['LOW / MID / HIGH','左右拖动旋钮调节。LOW 管底鼓和贝斯；MID 管人声主体；HIGH 管明亮细节。16 拍练习中，先将 B LOW 降至 −12；交接时将 A LOW 降至 −12、B LOW 升至 0，也可点“一键交换 LOW”。'],
  ['CROSSFADER','中央横推杆：左侧听 A，右侧听 B，中间同时听两首。'],
  ['电平与波形','右侧参数面板显示曲名、BPM、播放时间和波形，帮助确认位置。'],
  ['视角','拖动机身空白处调整角度；右侧参数面板可调倾角与大小。']
];
let keyGuideIndex=0;
function renderKeyGuide(){
  const [title,copy]=keyGuideSteps[keyGuideIndex];
  $('#guideProgress').textContent=`${keyGuideIndex+1} / ${keyGuideSteps.length}`;
  $('#guideTitle').textContent=title;$('#guideCopy').textContent=copy;
  $('#guidePrevious').disabled=keyGuideIndex===0;
  $('#guideNext').textContent=keyGuideIndex===keyGuideSteps.length-1?'完成':'下一步';
}
function setKeyGuideOpen(open){
  $('#controlGuide').hidden=!open;
  $('#guideToggle').setAttribute('aria-expanded',String(open));
  if(open)renderKeyGuide();
}
$('#guideToggle').onclick=()=>setKeyGuideOpen($('#controlGuide').hidden);
$('#guideClose').onclick=()=>setKeyGuideOpen(false);
$('#guidePrevious').onclick=()=>{keyGuideIndex=Math.max(0,keyGuideIndex-1);renderKeyGuide();};
$('#guideNext').onclick=()=>{if(keyGuideIndex===keyGuideSteps.length-1)setKeyGuideOpen(false);else{keyGuideIndex++;renderKeyGuide();}};
document.addEventListener('keydown',event=>{if(event.key==='Escape')setKeyGuideOpen(false);});
if($('#viewAngle'))$('#viewAngle').oninput=event=>controller?.setView({tilt:Number(event.target.value)});
if($('#viewSize'))$('#viewSize').oninput=event=>controller?.setView({zoom:Number(event.target.value)});
$('#resetCourse07').onclick=()=>window.location.reload();
function updateOrientationHint(){
  const mobile=window.matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('landscape-fallback',mobile&&window.innerHeight>window.innerWidth&&$('#challengeOverlay').classList.contains('hidden'));
}
async function preferLandscape(){
  if(!window.matchMedia('(pointer: coarse)').matches)return;
  const lock=screen.orientation?.lock;
  if(typeof lock==='function'){
    let enteredFullscreen=false;
    try{
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
        await document.documentElement.requestFullscreen();
        enteredFullscreen=true;
      }
      await lock.call(screen.orientation,'landscape');
    }catch{
      if(enteredFullscreen&&document.fullscreenElement){try{await document.exitFullscreen();}catch{/* keep the page usable */}}
    }
  }
  updateOrientationHint();
}
const landscapePreferenceKey='first-mix-landscape-default';
const landscapeSessionKey='first-mix-landscape-session';
function readLandscapePreference(){
  try{return localStorage.getItem(landscapePreferenceKey)==='landscape'?'landscape':sessionStorage.getItem(landscapeSessionKey);}
  catch{return null;}
}
function saveLandscapePreference(choice,always){
  try{
    sessionStorage.setItem(landscapeSessionKey,choice);
    if(choice==='landscape'&&always)localStorage.setItem(landscapePreferenceKey,'landscape');
  }catch{/* The current choice still works when storage is unavailable. */}
}
const askingLandscape=window.matchMedia('(pointer: coarse)').matches&&innerHeight>innerWidth&&!readLandscapePreference();
$('#challengeOrientationAsk').hidden=!askingLandscape;
$('#challengeOrientationRemember').hidden=!askingLandscape;
$('#startChallengePortrait').hidden=!askingLandscape;
$('#startChallenge').textContent=askingLandscape?'横屏开始':'进入打碟台';
async function launchChallenge(wantsLandscape){
  if(askingLandscape)saveLandscapePreference(wantsLandscape?'landscape':'portrait',wantsLandscape&&$('#rememberChallengeLandscape').checked);
  const primary=$('#startChallenge'),portrait=$('#startChallengePortrait');
  primary.disabled=true;portrait.disabled=true;primary.textContent='正在载入真实歌曲…';
  const landscapeAttempt=wantsLandscape?preferLandscape():Promise.resolve();
  try{await setupEngine();resetGuided();$('#challengeOverlay').classList.add('hidden');await landscapeAttempt;updateOrientationHint();}
  catch(error){
    $('#challengeStatus').textContent='歌曲载入失败';
    primary.disabled=false;portrait.disabled=false;primary.textContent=askingLandscape?'重新载入':'进入打碟台';
    const message=document.createElement('p');message.style.color='#b53951';message.textContent=error.message;
    primary.parentNode.before(message);
  }
}
$('#startChallenge').onclick=()=>launchChallenge(askingLandscape||readLandscapePreference()==='landscape');
$('#startChallengePortrait').onclick=()=>launchChallenge(false);
$('#guidedLowSwap').onclick=()=>{
  if(mode!=='guided-short'||!guided)return;
  [['#lowA',-12],['#lowB',0]].forEach(([selector,value])=>{
    const input=$(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const button=$('#guidedLowSwap');button.disabled=true;button.classList.add('done');button.textContent='LOW 已交换 ✓';
  setGuidedMessage('LOW 已交换；把横推杆推到 B 端','A LOW 已降至 −12，B LOW 已升至 0。');
};
$('#retryGuided').onclick=resetGuided;
$('#repeatShort').onclick=()=>{$('#shortCompleteOverlay').classList.add('hidden');resetGuided();};
$('#startLongChallenge').onclick=beginLongChallenge;
$('#recordMix').onclick=startRecording;
$('#stopMix').onclick=stopRecording;
$('#listenMix').onclick=()=>$('#mixPlayback').play();
$('#submitMix').onclick=submitScore;
$('#closeScore').onclick=()=>$('#scoreOverlay').classList.add('hidden');
$('#retryChallenge').onclick=retry;
$('#saveMix').onclick=saveMix;
window.addEventListener('resize',updateOrientationHint);
window.addEventListener('orientationchange',updateOrientationHint);
window.addEventListener('pagehide',()=>{if(meterFrame)cancelAnimationFrame(meterFrame);if(mixUrl)URL.revokeObjectURL(mixUrl);try{screen.orientation?.unlock?.();}catch{/* optional browser feature */}});
