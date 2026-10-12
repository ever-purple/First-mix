import { AudioEngine } from './audio-engine.js';

export function uniqueLibraryTracks(manifest, deckId) {
  const byFile = new Map();
  for (const track of manifest) {
    if (track.deck !== deckId || !track.file) continue;
    const existing = byFile.get(track.file);
    if (existing) {
      if (!existing.courses.includes(track.course)) existing.courses.push(track.course);
      if (track.version === '完整版') existing.version = track.version;
    } else {
      byFile.set(track.file, { ...track, courses: [track.course] });
    }
  }
  return [...byFile.values()];
}

// Use the lesson's own audio, preferring its full local file where available.
export function createTrackLibrary({engine,onLoaded}) {
  const dialog=document.createElement('dialog');
  dialog.className='track-library';dialog.setAttribute('aria-labelledby','trackLibraryTitle');
  dialog.innerHTML=`<header class="track-library-header"><h2 id="trackLibraryTitle">载入音乐</h2><button type="button" data-close aria-label="关闭音乐选择"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="track-library-body"><button type="button" class="track-local">从设备选择音乐<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5M5 16v4h14v-4"/></svg></button><h3>课程音乐</h3><p class="track-library-status" role="status">正在读取…</p><div class="track-library-list"></div></div>`;
  document.body.append(dialog);
  let deckId='a',tracks=null,loading=false,previewButton=null;
  const preview=new Audio();preview.preload='none';preview.volume=.65;
  const status=dialog.querySelector('.track-library-status');
  const list=dialog.querySelector('.track-library-list');
  const close=dialog.querySelector('[data-close]');
  const local=dialog.querySelector('.track-local');
  const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z"/></svg>';
  const stopIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>';
  function stopPreview(){preview.pause();preview.removeAttribute('src');preview.load();if(previewButton){previewButton.innerHTML=playIcon;previewButton.setAttribute('aria-pressed','false');}previewButton=null;}
  function setBusy(value){loading=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('button').forEach(button=>button.disabled=value);}
  function closeLibrary(){if(!loading)dialog.close();}
  close.addEventListener('click',closeLibrary);
  dialog.addEventListener('close',stopPreview);
  dialog.addEventListener('cancel',event=>{if(loading)event.preventDefault();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeLibrary();});
  local.addEventListener('click',()=>{closeLibrary();document.getElementById('file'+deckId.toUpperCase()).click();});
  preview.addEventListener('ended',stopPreview);
  async function renderTracks(){
    list.replaceChildren();status.textContent='正在读取课程音乐…';
    try {
      tracks=await AudioEngine.trackManifest();
      const available=uniqueLibraryTracks(tracks,deckId);
      if(!available.length){status.textContent='当前唱盘暂无课程音乐，可从设备选择音乐。';return;}
      status.textContent='Deck '+deckId.toUpperCase()+' 的课程音乐 · 可先试听';
      available.forEach(track=>{
        const row=document.createElement('article');row.className='track-library-row';
        const info=document.createElement('div');info.className='track-library-info';
        const title=document.createElement('strong');title.textContent=track.title;
        const meta=document.createElement('span');const courses=track.courses.map(course=>course==='intro'?'入门试听':'课程 '+course.replace(/^c/,'')).join('、');
        meta.textContent=`${courses} · ${track.version || '课程音源'}${Number.isFinite(track.bpm)?' · '+track.bpm+' BPM':''}`;
        info.append(title,meta);
        const listen=document.createElement('button');listen.type='button';listen.className='track-preview';listen.setAttribute('aria-label','试听 '+track.title);listen.setAttribute('aria-pressed','false');listen.innerHTML=playIcon;
        listen.addEventListener('click',async()=>{
          const wasPlaying=previewButton===listen;stopPreview();if(wasPlaying)return;
          previewButton=listen;listen.innerHTML=stopIcon;listen.setAttribute('aria-pressed','true');preview.src='./'+track.file;
          try {await preview.play();status.textContent='正在试听：'+track.title;}catch{stopPreview();status.textContent='暂时无法试听，请重试或直接载入。';}
        });
        const load=document.createElement('button');load.type='button';load.className='track-load';load.textContent='载入';load.setAttribute('aria-label','载入 '+track.title);load.dataset.track=track.file;
        load.addEventListener('click',async()=>{
          stopPreview();setBusy(true);status.textContent='正在载入 '+track.title+'…';const target=deckId;
          try {
            const response=await fetch('./'+track.file);if(!response.ok)throw new Error('曲目文件暂时不可用');
            const info=await engine.loadLocalBuffer(target,await response.arrayBuffer());
            const bpm=Number.isFinite(track.bpm)?track.bpm:info.bpm;engine.setTrackBpm(target,bpm);onLoaded(target,track,bpm);
            setBusy(false);dialog.close();
          } catch {setBusy(false);status.textContent='载入失败，请重试或从设备选择音乐。';}
        });
        row.append(info,listen,load);list.append(row);
      });
    }catch{
      status.textContent='课程音乐暂时无法读取。';const retry=document.createElement('button');retry.type='button';retry.className='track-local';retry.textContent='重新读取';retry.onclick=renderTracks;list.append(retry);
    }
  }
  document.addEventListener('practice-track-request',event=>{
    if(!document.body.classList.contains('practice-open')||loading)return;
    deckId=event.detail.deck==='b'?'b':'a';dialog.querySelector('h2').textContent='载入到 Deck '+deckId.toUpperCase();
    stopPreview();if(!dialog.open)dialog.showModal();renderTracks();
  });
}
