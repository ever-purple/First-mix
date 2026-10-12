// Fullscreen/orientation APIs are enhancements; layout switching works without them.
export function setupPracticeLayout(){
  const body=document.body,button=document.getElementById('practiceLandscape');
  let stage=null,placements=[],requestedFullscreen=false,waitingForLandscape=false;
  const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement||null;
  const requestNativeFullscreen=()=>{
    const root=document.documentElement;
    const request=root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen;
    return request?Promise.resolve(request.call(root)):Promise.reject(new Error('Fullscreen API unavailable'));
  };
  const exitNativeFullscreen=async()=>{
    const exitFullscreen=document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen;
    if(!exitFullscreen)return;
    for(let attempt=0;attempt<2&&fullscreenElement();attempt+=1){
      await Promise.resolve(exitFullscreen.call(document)).catch(()=>{});
      await new Promise(resolve=>setTimeout(resolve,60));
    }
  };
  function resize(){
    const active=body.classList.contains('practice-landscape');
    const portrait=innerHeight>innerWidth;
    // Never rotate page pixels. The OS may rotate the viewport; when it cannot,
    // responsive layout keeps controls upright and usable in the available pane.
    body.classList.remove('practice-rotated');
    body.classList.toggle('practice-wide',(active&&innerWidth>innerHeight)||innerWidth>=900);
    body.style.setProperty('--practice-height',innerHeight+'px');
    if(active){
      button.querySelector('span').textContent=portrait?'请横置':'退出横屏';
      button.setAttribute('aria-label',portrait?'请将手机横置以进入横屏打碟模式':'退出横屏打碟模式');
    }
    document.dispatchEvent(new Event('practice-layout-change'));
  }
  async function exit(){
    if(!stage&&!waitingForLandscape&&!fullscreenElement()&&!requestedFullscreen)return;
    waitingForLandscape=false;
    body.classList.remove('practice-landscape','practice-rotated');
    placements.forEach(({node,marker})=>marker.replaceWith(node));placements=[];stage?.remove();stage=null;
    button.querySelector('span').textContent='横屏';button.setAttribute('aria-label','进入横屏打碟模式');button.setAttribute('aria-pressed','false');
    try{screen.orientation?.unlock?.();}catch{}
    // Restore browser/system bars in the same tap. Mobile browsers can remove
    // the landscape stage before native fullscreen has completely closed.
    await exitNativeFullscreen();
    requestedFullscreen=false;resize();
  }
  function enter(){
    if(stage)return;
    waitingForLandscape=false;
    stage=document.createElement('div');stage.className='practice-stage';body.append(stage);
    for(const node of [document.querySelector('main'),document.querySelector('.app-tabbar')]){
      const marker=document.createComment('practice layout position');node.before(marker);placements.push({node,marker});stage.append(node);
    }
    body.classList.add('practice-landscape');button.querySelector('span').textContent='退出横屏';button.setAttribute('aria-label','退出横屏打碟模式');button.setAttribute('aria-pressed','true');
    document.querySelector('main').scrollTop=0;resize();
    if(!fullscreenElement()){
      requestedFullscreen=true;
      requestNativeFullscreen().then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{requestedFullscreen=false;});
    }
  }
  function requestLandscape(){
    if(innerWidth>innerHeight){enter();return;}
    waitingForLandscape=true;
    button.querySelector('span').textContent='请横置';
    button.setAttribute('aria-label','请将手机横置以进入横屏打碟模式');
    button.setAttribute('aria-pressed','false');
    if(!fullscreenElement()){
      requestedFullscreen=true;
      requestNativeFullscreen().then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{requestedFullscreen=false;});
    }
  }
  button.addEventListener('click',()=>{if(stage||waitingForLandscape||fullscreenElement())exit();else requestLandscape();});
  window.addEventListener('resize',()=>{if(waitingForLandscape&&innerWidth>innerHeight){enter();return;}resize();});
  const onFullscreenChange=()=>{if(requestedFullscreen&&!fullscreenElement()&&stage)exit();else resize();};
  document.addEventListener('fullscreenchange',onFullscreenChange);
  document.addEventListener('webkitfullscreenchange',onFullscreenChange);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&stage)exit();});
  new MutationObserver(()=>{if(stage&&!body.classList.contains('practice-open'))exit();}).observe(body,{attributes:true,attributeFilter:['class']});
  resize();
  return {enter,exit,requestLandscape};
}
