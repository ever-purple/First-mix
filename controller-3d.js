import * as THREE from './node_modules/three/build/three.module.js';
import { hardwareTypeface, hardwareTextGeometry } from './hardware-type.js';
import { analyzePractice, getAiStatus } from './ai-client.js';

// A real-time, fixed-camera model. Native controls are projected onto its surface
// so the same instrument also works with keyboard and assistive technology.
export function createController(engine) {
  const host = document.createElement('section');
  host.className = 'controller-3d'; host.setAttribute('aria-label', '白色双唱盘打碟机');
  document.querySelector('#mixer').before(host);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); }
  catch { host.remove(); return null; }
  document.body.classList.add('has-controller-3d');
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio||1,2),3));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.className='model-canvas-3d';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','打碟机模型，拖动空白处调角度，滚轮或双指缩放，Shift 拖动或双指移动可查看放大后的边缘，方向键也可调整');host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(33,1,.1,100);
  camera.position.set(0,15.8,7.2); camera.lookAt(0,.48,-1.05);
  const hemisphere=new THREE.HemisphereLight(0xffffff,0x80776e,1.8);scene.add(hemisphere);
  const light=new THREE.DirectionalLight(0xfff6e8,2.8); light.position.set(-4,9,4);
  light.castShadow=true; light.shadow.mapSize.set(2048,2048);
  Object.assign(light.shadow.camera,{left:-8,right:8,top:8,bottom:-8});
  light.shadow.bias=-.001; scene.add(light);
  const grainCanvas=document.createElement('canvas');grainCanvas.width=256;grainCanvas.height=256;const grainContext=grainCanvas.getContext('2d');grainContext.fillStyle='#b9b9b9';grainContext.fillRect(0,0,256,256);for(let y=0;y<256;y+=2){const lightness=145+Math.round(Math.sin(y*.61)*18+Math.random()*12);grainContext.fillStyle=`rgb(${lightness},${lightness},${lightness})`;grainContext.fillRect(0,y,256,1);}const brushedMap=new THREE.CanvasTexture(grainCanvas);brushedMap.wrapS=brushedMap.wrapT=THREE.RepeatWrapping;brushedMap.repeat.set(1.2,3.4);
  // A studio reflection field gives metal broad, readable highlights at phone sizes.
  const studioCanvas=document.createElement('canvas');studioCanvas.width=1024;studioCanvas.height=512;
  const studio=studioCanvas.getContext('2d');const studioGradient=studio.createLinearGradient(0,0,0,512);
  studioGradient.addColorStop(0,'#c3cad4');studioGradient.addColorStop(.42,'#f4f3ec');studioGradient.addColorStop(.53,'#555b65');studioGradient.addColorStop(1,'#242830');studio.fillStyle=studioGradient;studio.fillRect(0,0,1024,512);
  [[70,20,140,270],[430,40,230,160],[840,0,90,320]].forEach(([x,y,w,h])=>{studio.fillStyle='#fffdf7';studio.fillRect(x,y,w,h);});
  const environment=new THREE.CanvasTexture(studioCanvas);environment.mapping=THREE.EquirectangularReflectionMapping;environment.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);const environmentTarget=pmrem.fromEquirectangular(environment);scene.environment=environmentTarget.texture;pmrem.dispose();environment.dispose();
  const white=new THREE.MeshStandardMaterial({color:0xd8d7d2,roughness:.48,metalness:.34,roughnessMap:brushedMap});
  const faceplate=new THREE.MeshStandardMaterial({color:0xe3e1dc,roughness:.4,metalness:.48,roughnessMap:brushedMap});
  const metal=new THREE.MeshStandardMaterial({color:0xb7b5b2,roughness:.2,metalness:.94,roughnessMap:brushedMap});
  const dark=new THREE.MeshStandardMaterial({color:0x29282c,roughness:.58,metalness:.18});
  const platterSurface=new THREE.MeshStandardMaterial({color:0x77767a,roughness:.25,metalness:.9,roughnessMap:brushedMap});
  const padMaterial=new THREE.MeshStandardMaterial({color:0x36363a,roughness:.72,metalness:.12});
  const amber=new THREE.MeshStandardMaterial({color:0xffb23f,emissive:0xff8a18,emissiveIntensity:.72,roughness:.42});
  let usesCEnvironment;
  function syncControllerPalette(){
    const next=document.body.classList.contains('practice-open');
    if(next===usesCEnvironment)return;
    usesCEnvironment=next;
    hemisphere.color.setHex(next?0xf8ffff:0xffffff);
    hemisphere.groundColor.setHex(next?0x7d708d:0x80776e);
    light.color.setHex(next?0xf9fbff:0xfff6e8);
    white.color.setHex(next?0xd9dadd:0xd8d7d2);
    faceplate.color.setHex(next?0xe4e5e6:0xe3e1dc);
    metal.color.setHex(next?0xbebdc2:0xb7b5b2);
    dark.color.setHex(next?0x29272e:0x29282c);
  }
  syncControllerPalette();
  function box(w,h,d,x,y,z,mat=white){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  function cylinder(r,h,x,y,z,mat=white){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,96),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  // DDJ-FLX4-W top-view footprint: 482 mm wide by 272.8 mm deep.
  const outline=new THREE.Shape(); const d=7.1,w=d*482/272.8,r=.28;
  outline.moveTo(-w/2+r,-d/2); outline.lineTo(w/2-r,-d/2);outline.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);outline.lineTo(w/2,d/2-r);outline.quadraticCurveTo(w/2,d/2,w/2-r,d/2);outline.lineTo(-w/2+r,d/2);outline.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);outline.lineTo(-w/2,-d/2+r);outline.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  const shell=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.55,bevelEnabled:true,bevelSegments:6,steps:1,bevelSize:.10,bevelThickness:.08}),white);
  shell.rotation.x=-Math.PI/2;shell.position.set(0,-.16,-.65);shell.castShadow=true;shell.receiveShadow=true;scene.add(shell);
  box(w-.3,.28,6.84,0,-.23,-.65,dark);
  box(w-.22,.10,6.9,0,-.03,-.65,metal);
  box(w-.28,.06,6.86,0,.48,-.65,faceplate);
  box(w-.38,.17,.10,0,.10,2.86,metal);
  [[-w/2+.45,-3.7],[w/2-.45,-3.7],[-w/2+.45,2.45],[w/2-.45,2.45]].forEach(([x,z])=>{cylinder(.065,.022,x,.527,z,metal);box(.08,.006,.018,x,.54,z,dark);});
  [-w/2+1,w/2-1].forEach(x=>{const socket=cylinder(.10,.03,x,-.13,2.81,dark);socket.rotation.x=Math.PI/2;});
  const displayPanel=document.createElement('section');displayPanel.className='model-display-flat';displayPanel.setAttribute('aria-label','双通道电子屏：波形、BPM、时间与播放状态');
  const displayDecks=['a','b'].map(id=>{
    const panel=document.createElement('div');panel.className='display-deck display-deck-'+id;
    panel.innerHTML=`<header><strong>DECK ${id.toUpperCase()}</strong><span class="display-state">待播放</span></header><div class="display-track">训练音轨 ${id.toUpperCase()}</div><div class="display-numbers"><label><input data-bpm type="number" min="60" max="200" step="0.1" value="120.0" aria-label="Deck ${id.toUpperCase()} BPM"><small>BPM</small></label><time>00:00</time></div><canvas class="model-display-canvas" aria-hidden="true"></canvas><div class="display-footer"><span data-beat>第 1 拍</span><span data-remaining>--:--</span></div><details class="display-adjust"><summary>EQ / VOL <span data-level>80%</span></summary><div class="display-adjust-fields"></div></details>`;
    displayPanel.append(panel);return {id,panel,canvas:panel.querySelector('canvas')};
  });
  displayPanel.querySelectorAll('.display-adjust').forEach(details=>{
    details.addEventListener('toggle',()=>{
      if(!details.open)return;
      requestAnimationFrame(()=>{
        const deck=details.closest('.display-deck');
        displayPanel.scrollTo({top:Math.max(0,deck.offsetTop-6),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      });
    });
  });
  host.insertBefore(displayPanel,renderer.domElement);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({opacity:.26}));floor.rotation.x=-Math.PI/2;floor.position.y=-.62;floor.receiveShadow=true;scene.add(floor);
  [-w/2+1.3,w/2-1.3].forEach(x=>[-2.7,1.7].forEach(z=>cylinder(.3,.28,x,-.46,z,dark)));
  [-1.62,1.62].forEach(x=>box(.012,.008,6.0,x,.521,-.55,metal));
  const anchors=[];const wheels=[];let recentControl=null,recentControlUntil=0;
  const dragPoint=event=>document.body.classList.contains('practice-rotated')?{x:event.clientY,y:-event.clientX}:{x:event.clientX,y:event.clientY};
  // Relative travel prevents a press from jumping to an absolute track position.
  // Longer travel, quantized steps and a center detent provide controlled resistance.
  function dampedControl(input,{vertical=false,travel=280,step=1,detent=null}={}){
    input.step=String(step);input.style.touchAction='none';let drag=null;
    input.addEventListener('pointerdown',event=>{
      if(event.button!==0||input.disabled)return;event.preventDefault();input.focus({preventScroll:true});
      drag={point:dragPoint(event),value:Number(input.value)};recentControl=input;recentControlUntil=performance.now()+1800;input.setPointerCapture(event.pointerId);
    });
    input.addEventListener('pointermove',event=>{
      if(!drag||!input.hasPointerCapture(event.pointerId))return;
      const p=dragPoint(event),distance=vertical?drag.point.y-p.y:p.x-drag.point.x;
      if(Math.abs(distance)<3)return;
      const min=Number(input.min),max=Number(input.max),gain=event.shiftKey?.2:1;
      let value=drag.value+distance/travel*(max-min)*gain;
      if(detent!==null&&Math.abs(value-detent)<(max-min)*.018)value=detent;
      value=Math.max(min,Math.min(max,Math.round(value/step)*step));
      recentControlUntil=performance.now()+1800;if(Number(input.value)!==value){input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}
    });
    const release=()=>{drag=null;};input.addEventListener('pointerup',release);input.addEventListener('pointercancel',release);input.addEventListener('lostpointercapture',release);
  }
  function dampedNumberControl(input,{step=1,pixelsPerStep=10}={}){
    input.style.touchAction='pan-y';let drag=null;
    input.addEventListener('pointerdown',event=>{
      if(event.button!==0||input.disabled)return;
      drag={x:event.clientX,value:Number(input.value),moved:false,pointerId:event.pointerId};
      input.setPointerCapture(event.pointerId);input.focus({preventScroll:true});
    });
    input.addEventListener('pointermove',event=>{
      if(!drag||!input.hasPointerCapture(event.pointerId))return;
      const distance=event.clientX-drag.x;
      if(!drag.moved&&Math.abs(distance)<6)return;
      drag.moved=true;event.preventDefault();
      const min=Number(input.min),max=Number(input.max),gain=event.shiftKey?.25:1;
      const steps=Math.trunc(distance/(pixelsPerStep/gain));
      const precision=String(step).includes('.')?String(step).split('.')[1].length:0;
      const value=Math.max(min,Math.min(max,drag.value+steps*step));
      const next=value.toFixed(precision);
      if(input.value!==next){input.value=next;input.dispatchEvent(new Event('change',{bubbles:true}));}
    });
    const release=event=>{
      if(!drag)return;
      if(drag.moved){event?.preventDefault?.();input.blur();}
      drag=null;
    };
    input.addEventListener('pointerup',release);input.addEventListener('pointercancel',release);input.addEventListener('lostpointercapture',release);
  }
  function anchor(el,x,y,z,w=.8,d=.55){host.append(el);anchors.push({el,p:new THREE.Vector3(x,y,z),w,d});return el;}
  // Vector outlines sit on the faceplate and follow the hardware's perspective.
  function label(text,x,z,size=12,y=.524,color='#20242a',maxWidth=Infinity){
    const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);scene.add(mesh);let current=text,font;
    const render=()=>{if(!font)return;mesh.geometry.dispose();mesh.geometry=current?hardwareTextGeometry(font,current,Math.max(6,size)*.0156):new THREE.BufferGeometry();if(current&&Number.isFinite(maxWidth)){mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox,width=bounds.max.x-bounds.min.x;if(width>maxWidth)mesh.geometry.scale(maxWidth/width,1,1);}mesh.userData.label=current;};
    hardwareTypeface.then(data=>{font=data;render();host.dataset.hardwareType='vector';}).catch(()=>{host.dataset.hardwareType='unavailable';});
    return {set textContent(value){if(value!==current){current=value;render();}},get textContent(){return current;},set visible(value){mesh.visible=Boolean(value);}};
  }
  function button(text,x,z,action,sourceId='',pad=false){
    const key=pad?box(1.08,.12,.59,x,.60,z,padMaterial):cylinder(.27,.13,x,.60,z,white);
    if(pad)box(1.14,.018,.65,x,.532,z,metal);
    const transport=/^(play|cue)[AB]$/.test(sourceId);
    label(sourceId.startsWith('load')&&document.body.classList.contains('course-07')?'':transport&&text==='PLAY/PAUSE'?'PLAY':text,x,transport?z:z+(pad?0:.46),12,transport?.685:pad?.667:.524,pad?'#f1f1ed':'#20242a',transport?.46:pad?.94:1.18);
    const el=document.createElement('button');el.className='model-button hardware-hit'+(pad?' hardware-pad':'');el.setAttribute('aria-label',text);el.title=text;if(sourceId)el.dataset.source=sourceId;
    el.onclick=action;el.onpointerdown=()=>key.position.y=.56;el.onpointerup=el.onpointerleave=()=>key.position.y=.60;return anchor(el,x,.66,z,pad?1.15:.76,pad?.68:.68);
  }
  function modeButton(text,x,z,action){
    const keyMaterial=padMaterial.clone(),key=box(.68,.08,.25,x,.59,z,keyMaterial);
    label(text,x,z,12,.645,'#ffffff',.64);
    const el=document.createElement('button');el.className='model-button hardware-hit hardware-mode';el.type='button';el.setAttribute('aria-label',text);el.title=text;
    el.setModeActive=active=>{keyMaterial.color.setHex(active?0x7952ca:0x36363a);keyMaterial.emissive.setHex(active?0x3b1d7d:0x000000);keyMaterial.emissiveIntensity=active?.65:0;};
    el.onclick=action;el.onpointerdown=()=>key.position.y=.55;el.onpointerup=el.onpointerleave=()=>key.position.y=.59;
    return anchor(el,x,.67,z,.72,.34);
  }
  function performancePad(deckId,index,x,z,action){
    const keyMaterial=padMaterial.clone(),key=box(.68,.10,.38,x,.59,z,keyMaterial);box(.72,.014,.42,x,.526,z,metal);
    const el=document.createElement('button');el.className='model-button hardware-hit hardware-pad';el.type='button';el.setAttribute('aria-label',`Deck ${deckId} 打击垫 ${index+1}`);el.title=`Deck ${deckId} · Pad ${index+1}`;el.dataset.source=`pad-${deckId.toLowerCase()}-${index+1}`;
    el.setHotCueStored=(stored,active)=>{
      keyMaterial.color.setHex(stored&&active?0x7952ca:0x36363a);
      keyMaterial.emissive.setHex(stored&&active?0x3b1d7d:0x000000);
      keyMaterial.emissiveIntensity=stored&&active ? .55 : 0;
      el.classList.toggle('has-hot-cue',Boolean(stored&&active));
      if(active)el.setAttribute('aria-label',`Deck ${deckId} HOT CUE ${index+1}${stored?'，已保存':''}`);
    };
    el.setLoopActive=active=>{
      if(active){keyMaterial.color.setHex(0xbaff2e);keyMaterial.emissive.setHex(0x557a14);keyMaterial.emissiveIntensity=.55;}
      else if(el.classList.contains('has-loop')&&!el.classList.contains('has-hot-cue')){keyMaterial.color.setHex(0x36363a);keyMaterial.emissive.setHex(0x000000);keyMaterial.emissiveIntensity=0;}
      el.classList.toggle('has-loop',Boolean(active));
      el.setAttribute('aria-pressed',String(Boolean(active)));
    };
    el.onclick=action;el.onpointerdown=()=>key.position.y=.55;el.onpointerup=el.onpointerleave=()=>key.position.y=.59;
    return anchor(el,x,.66,z,.73,.45);
  }
  function range(id,x,z,vertical=false){const original=document.getElementById(id);const el=document.createElement('input');el.type='range';el.min=original.min;el.max=original.max;el.value=original.value;el.className='model-slider'+(vertical?' vertical':'');el.setAttribute('aria-label',original.closest('label')?.firstChild.textContent||'A / B 转场');
    el.dataset.source=id;
    const cap=box(vertical?.43:.26,.20,vertical?.25:.44,x,.64,z,white);const capLine=box(vertical?.32:.028,.009,vertical?.025:.32,x,.745,z,dark);box(vertical?.065:1.75,.014,vertical?1.35:.065,x,.531,z,dark);
    for(let n=0;n<=6;n++){const offset=-.65+n*.216;box(vertical?.14:.018,.008,vertical?.014:.12,vertical?x+.20:x+offset,.535,vertical?z+offset:z+.16,metal);}
    const update=()=>{const f=(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min));if(vertical)cap.position.z=capLine.position.z=z+.6-f*1.2;else cap.position.x=capLine.position.x=x-.85+f*1.7;el.setAttribute('aria-valuetext',id.startsWith('bpmInput')?`${Number(el.value).toFixed(1)} BPM`:vertical?el.value+'%':`A ${Math.round((1-f)*100)} / B ${Math.round(f*100)}`);};update();
    original.addEventListener('input',()=>{el.value=original.value;update();});
    el.oninput=()=>{original.value=el.value;original.dispatchEvent(new Event('input',{bubbles:true}));};dampedControl(el,{vertical,travel:vertical?220:300,detent:vertical?null:0});anchor(el,x,.8,z,vertical?.55:1.95,vertical?1.6:.65);return el;
  }
  function ring(radius,thickness,x,y,z,material=metal){const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,thickness,10,128),material);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
  const radialCanvas=document.createElement('canvas');radialCanvas.width=512;radialCanvas.height=512;const radial=radialCanvas.getContext('2d');
  radial.fillStyle='#c4c8cc';radial.fillRect(0,0,512,512);
  for(let n=0;n<720;n++){const angle=n*Math.PI/360;const shade=Math.round(168+Math.cos(angle*2+.7)*45+Math.cos(angle*6)*10);radial.strokeStyle=`rgb(${shade},${shade+2},${shade+5})`;radial.beginPath();radial.moveTo(256,256);radial.lineTo(256+Math.cos(angle)*363,256+Math.sin(angle)*363);radial.stroke();}
  for(let radius=12;radius<256;radius+=3){radial.strokeStyle='rgba(255,255,255,.11)';radial.beginPath();radial.arc(256,256,radius,0,Math.PI*2);radial.stroke();}
  const radialTexture=new THREE.CanvasTexture(radialCanvas);radialTexture.colorSpace=THREE.SRGBColorSpace;radialTexture.anisotropy=8;
  const jogFace=new THREE.MeshStandardMaterial({map:radialTexture,color:0xe4e6e7,metalness:.8,roughness:.32});
  ['A','B'].forEach((id,i)=>{const x=i?3.85:-3.85;
    cylinder(1.52,.10,x,.57,-.70,dark);cylinder(1.46,.28,x,.75,-.70,metal);ring(1.43,.035,x,.89,-.70);
    const top=cylinder(1.31,.045,x,.91,-.70,jogFace);wheels.push({top,id:id.toLowerCase()});
    ring(1.32,.022,x,.934,-.70,dark);ring(.47,.018,x,.945,-.70,metal);cylinder(.43,.025,x,.946,-.70,platterSurface);
    for(let n=0;n<24;n++){const angle=n*Math.PI/12;const grip=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),platterSurface);grip.scale.set(1,.7,.48);grip.position.set(x+Math.sin(angle)*1.435,.755,-.70+Math.cos(angle)*1.435);grip.rotation.y=angle;scene.add(grip);}
    label('DECK '+id,x,-3.80,15);label(id,x,-.70,16,.968,'#f1f2f3');
    const jog=document.createElement('div');jog.className='model-jog';jog.dataset.source='jog'+id;jog.setAttribute('aria-label','拖动唱盘 '+id);let last=0;
    jog.onpointerdown=e=>{last=dragPoint(e).x;jog.setPointerCapture(e.pointerId);};
    jog.onpointermove=e=>{if(!jog.hasPointerCapture(e.pointerId))return;const next=dragPoint(e).x,delta=next-last;last=next;top.rotation.y+=delta*.012;const deck=engine.decks[id.toLowerCase()];if(deck)deck.alignTo(Math.max(0,deck.position()+delta*(e.shiftKey?.0015:.006)));};anchor(jog,x,.98,-.70,2.9,2.9);
    const play=button('PLAY/PAUSE',x-.72,1.15,()=>document.getElementById('play'+id).click(),'play'+id);
    const playLamp=cylinder(.08,.02,x-.72,.68,1.15,amber.clone());
    const syncPlay=()=>{const playing=document.getElementById('play'+id).getAttribute('aria-pressed')==='true';play.setAttribute('aria-label',(playing?'暂停 ':'播放 ')+id);play.setAttribute('aria-pressed',String(playing));playLamp.material.emissiveIntensity=playing?1.4:.05;};syncPlay();
    new MutationObserver(syncPlay).observe(document.getElementById('play'+id),{attributes:true,attributeFilter:['aria-pressed']});
    button('CUE',x+.63,1.15,()=>document.getElementById('cue'+id).click(),'cue'+id);
    const deckId=id.toLowerCase(),hotCues=Array(8).fill(null),modes=['HOT CUE','PAD FX1','BEAT JUMP','LOOP','SAMPLER'],padButtons=[],padLegends=[];let padMode='SAMPLER',deleteHotCueArmed=false;
    const updateHotCuePads=()=>padButtons.forEach((pad,k)=>{
      pad.setHotCueStored(hotCues[k]!==null,padMode==='HOT CUE');
      pad.setLoopActive(padMode==='LOOP'&&k<2&&engine.decks[deckId]?.beatLoop?.beats===[4,8][k]);
    });
    const modeKeys=modes.map((name,j)=>modeButton(name,x+(j-2)*.72,1.66,()=>{
      padMode=name;modeKeys.forEach((key,k)=>{key.setAttribute('aria-pressed',String(k===j));key.setModeActive(k===j);});
      padButtons.forEach((pad,k)=>{pad.setAttribute('aria-label',name==='LOOP'?`Deck ${id} ${['4 拍循环','8 拍循环','退出循环'][k]||'未分配'}`:`Deck ${id} ${name} 打击垫 ${k+1}`);pad.dataset.loopInactive=String(name==='LOOP'&&k>2);pad.disabled=name==='LOOP'&&k>2;if(padLegends[k])padLegends[k].hidden=name!=='LOOP';});
      updateHotCuePads();
      status.textContent=`Deck ${id} · ${name} 模式`;
    }));
    modeKeys.forEach((key,j)=>{key.dataset.source=`mode-${modes[j].toLowerCase().replace(/\s+/g,'-')}-${deckId}`;key.setAttribute('aria-pressed',String(j===4));key.setModeActive(j===4);});
    for(let padIndex=0;padIndex<8;padIndex++){
      const px=x+(padIndex%4-1.5)*.78,pz=2.12+Math.floor(padIndex/4)*.47;
      const legend=padIndex<3?document.createElement('span'):null;
      if(legend){legend.className='model-pad-label';legend.textContent=['4','8','OFF'][padIndex];legend.hidden=true;legend.setAttribute('aria-hidden','true');anchor(legend,px,.67,pz,.73,.45);}
      padLegends.push(legend);
      padButtons.push(performancePad(id,padIndex,px,pz,event=>{
        if(padMode==='HOT CUE'){
          const deck=engine.decks[deckId];if(!deck){status.textContent='先播放或载入音乐，再使用 HOT CUE';return;}
          let action;
          if(deleteHotCueArmed||event.shiftKey){
            action=hotCues[padIndex]===null?'missing':'delete';
            hotCues[padIndex]=null;
            status.textContent=action==='delete'?`Deck ${id} · Hot Cue ${padIndex+1} 已删除`:`Deck ${id} · 此打击垫没有 Cue 点`;
            deleteHotCueArmed=false;
          }
          else if(hotCues[padIndex]===null){hotCues[padIndex]=deck.position();status.textContent=`Deck ${id} · Hot Cue ${padIndex+1} 已保存`;action='save';}
          else{deck.alignTo(hotCues[padIndex]);status.textContent=`Deck ${id} · 触发 Hot Cue ${padIndex+1}`;action='trigger';}
          updateHotCuePads();
          document.dispatchEvent(new CustomEvent('hot-cue-action',{detail:{deck:deckId,pad:padIndex+1,action,playing:deck.playing,position:hotCues[padIndex]}}));
        }else if(padMode==='LOOP'){
          if(padIndex>2)return;
          const beats=[4,8,null][padIndex];
          const region=beats?engine.setBeatLoop(deckId,beats):engine.clearBeatLoop(deckId);
          status.textContent=beats?(region?`Deck ${id} · ${beats} 拍循环`:'当前音轨长度不足，无法循环'):`Deck ${id} · 已退出循环`;
        }else if(padMode==='BEAT JUMP'){
          const deck=engine.decks[deckId];if(!deck){status.textContent='先播放或载入音乐，再使用 BEAT JUMP';return;}
          const beats=[-16,-8,-4,-1,1,4,8,16][padIndex];deck.alignTo(Math.max(0,deck.position()+beats*60/(deck.track.bpm||120)));
          status.textContent=`Deck ${id} · ${beats>0?'+':''}${beats} 拍`;
        }else if(padMode==='PAD FX1'){
          const deck=engine.decks[deckId];if(!deck){status.textContent='先播放或载入音乐，再使用 PAD FX1';return;}
          const filter=[-.8,-.6,-.4,-.2,.2,.4,.6,.8][padIndex];engine.setFilter(deckId,filter);
          window.setTimeout(()=>engine.setFilter(deckId,0),750);
          status.textContent=`Deck ${id} · PAD FX1 · ${filter<0?'低通':'高通'}效果`;
        }else{
          const sample=['kick','clap','hat','tone'][padIndex%4];document.querySelector(`[data-pad="${sample}"]`)?.click();
          status.textContent=`Deck ${id} · ${padMode} · Pad ${padIndex+1}`;
        }
      }));
    }
    document.addEventListener('hot-cue-reset',()=>{hotCues.fill(null);deleteHotCueArmed=false;updateHotCuePads();});
    engine.addEventListener('beatloop',event=>{if(event.detail.deck===deckId)updateHotCuePads();});
    document.addEventListener('hot-cue-delete-mode',event=>{if(deckId==='a')deleteHotCueArmed=Boolean(event.detail?.enabled);});
    document.addEventListener('hot-cue-seed',event=>{
      if(event.detail?.deck!==deckId)return;
      const duration=engine.decks[deckId]?.track?.duration||0;
      hotCues.fill(null);
      event.detail.positions?.slice(0,hotCues.length).forEach((position,index)=>{
        if(Number.isFinite(position)&&position>=0&&position<duration)hotCues[index]=position;
      });
      updateHotCuePads();
    });
    const tempoX=i?5.67:-5.67;label('TEMPO',tempoX,-2.17,10);range('bpmInput'+id,tempoX,-.72,true);
    [['high','高频'],['mid','中频'],['low','低频']].forEach(([band,name],n)=>{
      const z=-2.60+n*.91,kx=i?.78:-.78;
      cylinder(.23,.08,kx,.55,z,metal);cylinder(.175,.30,kx,.73,z,white);const mark=box(.035,.014,.13,kx,.89,z-.045,dark);
      label(band.toUpperCase(),kx,z+.40,12);
      const input=document.createElement('input');input.type='range';input.min=-12;input.max=12;input.value=document.getElementById(band+id).value;input.className='model-knob';input.dataset.source=band+id;input.setAttribute('aria-label',id+' '+name);
      const horizontalKnob=document.body.classList.contains('course-07');
      const source=document.getElementById(band+id);source.step='.5';const sync=()=>{input.value=source.value;const v=Number(input.value);mark.position.x=kx+Math.sin(v/12*2.2)*.08;mark.position.z=z-Math.cos(v/12*2.2)*.08;input.setAttribute('aria-valuetext',name+' '+v+' dB');input.title=name+' '+v+' dB · '+(horizontalKnob?'左右':'上下')+'拖动，Shift 细调，双击归零';};dampedControl(input,{vertical:!horizontalKnob,travel:260,step:.5,detent:0});source.addEventListener('input',sync);sync();input.oninput=()=>{source.value=input.value;source.dispatchEvent(new Event('input',{bubbles:true}));};input.ondblclick=()=>{input.value=0;input.oninput();};anchor(input,kx,.8,z,.7,.78);
    });
    {
      const z=-3.43,kx=i?.78:-.78,source=document.getElementById('filter'+id);
      cylinder(.23,.08,kx,.55,z,metal);cylinder(.175,.30,kx,.73,z,white);const mark=box(.035,.014,.13,kx,.89,z-.045,dark);
      label('FILTER',kx,z+.40,10);
      const input=document.createElement('input');input.type='range';input.min='-100';input.max='100';input.step='1';input.value=source.value;input.className='model-knob';input.dataset.source='filter'+id;input.setAttribute('aria-label','Deck '+id+' 滤波旋钮');
      const sync=()=>{input.value=source.value;const value=Number(input.value);mark.position.x=kx+Math.sin(value/100*2.2)*.08;mark.position.z=z-Math.cos(value/100*2.2)*.08;input.setAttribute('aria-valuetext',value<0?`低通 ${-value}%`:value>0?`高通 ${value}%`:'原声');input.title='滤波 · 左右拖动，双击回到原声';};
      dampedControl(input,{vertical:false,travel:260,step:1,detent:0});source.addEventListener('input',sync);sync();input.oninput=()=>{source.value=input.value;source.dispatchEvent(new Event('input',{bubbles:true}));};input.ondblclick=()=>{input.value='0';input.oninput();};anchor(input,kx,.8,z,.7,.78);
    }
    range('volume'+id,i?.78:-.78,.95,true);
    const load=button('LOAD',x,-3.20,()=>{if(document.body.classList.contains('practice-open'))document.dispatchEvent(new CustomEvent('practice-track-request',{detail:{deck:id.toLowerCase()}}));else document.getElementById('file'+id).click();},'load'+id);load.setAttribute('aria-label','载入音乐到 Deck '+id);
  });
  button('BEAT SYNC',5.35,-3.20,()=>document.getElementById('syncB').click(),'syncB');label('A  MIX  B',0,1.98,12);range('crossfader',0,2.36);
  const status=document.createElement('p');status.className='model-help';status.textContent='拖动唱盘 · 拨动推杆 · 点击打击垫';host.append(status);
  const coach=document.createElement('aside');coach.className='model-coach';coach.setAttribute('aria-live','polite');
  const coachLabel=document.createElement('span');coachLabel.textContent='教练提示';
  const coachCopy=document.createElement('strong');coachCopy.textContent='先播放 Deck A，熟悉它的主节拍。';
  const coachClose=document.createElement('button');coachClose.type='button';coachClose.textContent='关闭';coachClose.setAttribute('aria-label','关闭教练提示');coachClose.onclick=()=>document.getElementById('coachToggle')?.click();
  coach.append(coachLabel,coachCopy,coachClose);host.append(coach);
  const aiScore=document.createElement('section');aiScore.className='model-ai-score';aiScore.setAttribute('aria-live','polite');
  aiScore.innerHTML='<header><span title="实时读取 BPM、推子和 EQ 参数；Qwen 在关键阶段给出解释">实时技术分</span><strong><b data-ai-total>--</b><small> / 100</small></strong></header><div class="ai-score-metrics"><span data-ai-metric="beat"><i></i><b>节拍</b><em>--</em></span><span data-ai-metric="handoff"><i></i><b>衔接</b><em>--</em></span><span data-ai-metric="clarity"><i></i><b>清晰度</b><em>--</em></span></div><p data-ai-summary>播放 A 后开始实时测量。</p>';
  host.append(aiScore);
  const scoreLabel=aiScore.querySelector('header span');
  let aiConnected=false,aiPending=false,aiResult=null,lastAiSignature='',lastAiRequestAt=-Infinity;
  getAiStatus().then(status=>{
    aiConnected=Boolean(status.configured);
    coachLabel.textContent=aiConnected?'AI 教练已连接':'本地提示 · AI 未连接';
    scoreLabel.textContent=aiConnected?'实时技术分 · 等待 AI':'实时技术分';
  }).catch(()=>{coachLabel.textContent='本地提示 · AI 未连接';});
  [
    ['deck-a','Deck A'],
    ['transport-a','Play / Cue'],
    ['mixer','Mixer'],
    ['crossfader','Crossfader'],
    ['deck-b','Deck B'],
    ['play-a','Play A'],
    ['pause-a','Play A'],
    ['set-cue-a','Cue A'],
    ['cue-a','Cue A'],
    ['replay-a','Play A'],
    ['play-b','Play B'],
    ['sync-b','Sync B'],
    ['low-swap','低频交换'],
    ['cross-to-b','Crossfader'],
    ['finish-b','Deck B']
  ].forEach(([name,labelText])=>{
    const spot=document.createElement('button');
    spot.type='button';
    spot.className='model-zone-spotlight zone-'+name;
    spot.setAttribute('aria-label','认识 '+labelText);
    spot.dataset.label=labelText;
    spot.onclick=()=>document.querySelector(`#moduleStage [data-zone="${name}"]:not(:disabled)`)?.click();
    host.append(spot);
  });
  const deckTools=document.createElement('section');deckTools.className='model-parameters';deckTools.setAttribute('aria-labelledby','modelParametersTitle');
  deckTools.innerHTML='<h2 id="modelParametersTitle" class="visually-hidden">机身设置</h2><output class="mix-balance" aria-label="转场比例">A 100 / B 0</output><button type="button" class="practice-reset" aria-label="重置打碟台">重置</button>';
  deckTools.querySelector('.practice-reset').onclick=()=>document.dispatchEvent(new Event('practice-reset'));
  const parameterFields=[];
  ['A','B'].forEach(id=>{
    const panel=displayDecks.find(deck=>deck.id===id.toLowerCase()).panel,group=panel.querySelector('.display-adjust-fields');
    const bpm=panel.querySelector('[data-bpm]'),bpmSource=document.getElementById('bpmInput'+id);bpm.dataset.parameter='bpmInput'+id;
    bpm.onchange=()=>{const value=Number(bpm.value);bpmSource.value=String(Number.isFinite(value)?Math.max(60,Math.min(200,value)):Number(bpmSource.value));bpmSource.dispatchEvent(new Event('input',{bubbles:true}));bpm.value=Number(bpmSource.value).toFixed(1);};
    dampedNumberControl(bpm,{step:.1,pixelsPerStep:9});
    [['high','HIGH','dB'],['mid','MID','dB'],['low','LOW','dB'],['volume','VOL','%']].forEach(([prefix,name,unit])=>{
      const source=document.getElementById(prefix+id);const row=document.createElement('label');row.className='parameter-field';
      const label=document.createElement('span');label.textContent=name;
      const control=document.createElement('span');control.className='parameter-value';
      const input=document.createElement('input');input.type='number';input.min=source.min;input.max=source.max;input.step=prefix==='volume'?'1':'.5';input.value=source.value;input.setAttribute('aria-label','Deck '+id+' '+name);input.dataset.parameter=prefix+id;
      const units=document.createElement('small');units.textContent=unit;
      input.onchange=()=>{const value=Number(input.value);input.value=String(Number.isFinite(value)?Math.max(Number(source.min),Math.min(Number(source.max),value)):Number(source.value));source.value=input.value;source.dispatchEvent(new Event('input',{bubbles:true}));};
      dampedNumberControl(input,{step:prefix==='volume'?1:.5,pixelsPerStep:prefix==='volume'?8:12});
      parameterFields.push({input,source});control.append(input,units);row.append(label,control);group.append(row);
    });
    const cue=document.createElement('p');cue.className='parameter-cue';cue.innerHTML='CUE <output data-cue="'+id.toLowerCase()+'">00:00</output>';group.append(cue);
  });
  const crossSource=document.getElementById('crossfader');
  const course07=document.body.classList.contains('course-07');
  const viewAdjustable=()=>document.body.classList.contains('practice-open')||course07;
  const maxViewZoom=100,minViewZoom=.4,defaultModelZoom=course07?1:1.12;
  const minViewTilt=course07?45:48,maxViewTilt=course07?82:80,maxViewAzimuth=course07?30:14;
  let modelTilt=70,modelAzimuth=0,modelZoom=defaultModelZoom,modelPanX=0,modelPanZ=0,viewDistance=20;
  const viewControl=document.createElement('label');viewControl.className='model-view-control';viewControl.innerHTML='<span>机身倾角</span>';
  const tiltInput=document.createElement('input');tiltInput.type='range';tiltInput.min=String(minViewTilt);tiltInput.max=String(maxViewTilt);tiltInput.step='1';tiltInput.value=String(modelTilt);tiltInput.setAttribute('aria-label','调整打碟机前后倾斜角度');
  const tiltOutput=document.createElement('output');tiltOutput.textContent=modelTilt+'°';
  tiltInput.oninput=()=>{modelTilt=Number(tiltInput.value);tiltOutput.textContent=modelTilt+'°';resize();};
  viewControl.append(tiltInput,tiltOutput);deckTools.insertBefore(viewControl,deckTools.querySelector('.practice-reset'));
  const resetStatus=document.createElement('p');resetStatus.className='parameter-status visually-hidden';resetStatus.setAttribute('role','status');resetStatus.textContent='数值与机身控件实时同步';deckTools.append(resetStatus);host.insertBefore(deckTools,coach);
  document.addEventListener('practice-reset-view',()=>{modelTilt=70;modelAzimuth=0;modelZoom=defaultModelZoom;modelPanX=0;modelPanZ=0;tiltInput.value='70';tiltOutput.textContent='70°';parameterFields.forEach(({input,source})=>input.value=source.value);syncParameters();updateCoach();drawScreen();resetStatus.textContent='已重置，音乐和作品已保留';resize();});
  function syncParameters(){parameterFields.forEach(({input,source})=>{if(document.activeElement!==input&&input.value!==source.value)input.value=source.value;});const b=(Number(crossSource.value)+100)/2;let readout=`A ${Math.round(100-b)} / B ${Math.round(b)}`;if(recentControl&&performance.now()<recentControlUntil&&recentControl.dataset.source!=='crossfader'){const id=recentControl.dataset.source,band=id.slice(0,-1).toUpperCase();readout=`${id.slice(-1)} ${band==='VOLUME'?'VOL':band} ${recentControl.value}${band==='VOLUME'?'%':' dB'}`;}deckTools.querySelector('.mix-balance').textContent=readout;displayPanel.querySelectorAll('[data-cue]').forEach(output=>output.textContent=timeText(engine.decks[output.dataset.cue]?.cuePoint||0));displayDecks.forEach(({id,panel})=>{panel.querySelector('[data-level]').textContent=document.getElementById('volume'+id.toUpperCase()).value+'%';});}
  function updateCamera(){
    const angle=THREE.MathUtils.degToRad(modelTilt),azimuth=THREE.MathUtils.degToRad(modelAzimuth);let distance=20;
    camera.zoom=1;camera.updateProjectionMatrix();
    for(let pass=0;pass<3;pass++){
      camera.position.set(Math.sin(azimuth)*Math.cos(angle)*distance,.4+Math.sin(angle)*distance,-.65+Math.cos(azimuth)*Math.cos(angle)*distance);camera.lookAt(0,.4,-.65);camera.updateMatrixWorld();
      let extent=0;for(const x of [-w/2-.15,w/2+.15])for(const y of [-.4,1.05])for(const z of [-4.35,3.05]){const point=new THREE.Vector3(x,y,z).project(camera);extent=Math.max(extent,Math.abs(point.x),Math.abs(point.y));}
      if(pass<2)distance*=extent/(course07?0.97:0.93);
    }
    viewDistance=distance;
    camera.zoom=modelZoom;camera.updateProjectionMatrix();
    camera.position.set(modelPanX+Math.sin(azimuth)*Math.cos(angle)*distance,.4+Math.sin(angle)*distance,modelPanZ-.65+Math.cos(azimuth)*Math.cos(angle)*distance);camera.lookAt(modelPanX,.4,modelPanZ-.65);camera.updateMatrixWorld();
  }
  function positionAnchors(width,height){
    const canvasLeft=renderer.domElement.offsetLeft,canvasTop=renderer.domElement.offsetTop;
    anchors.forEach(({el,p,w,d})=>{const v=p.clone().project(camera),a=new THREE.Vector3(p.x-w/2,p.y,p.z-d/2).project(camera),b=new THREE.Vector3(p.x+w/2,p.y,p.z+d/2).project(camera);
      const pad=el.classList.contains('hardware-pad'),minimum=pad?10:24;
      el.style.left=Math.round(canvasLeft+(v.x+1)*width/2)+'px';el.style.top=Math.round(canvasTop+(1-v.y)*height/2)+'px';el.style.width=Math.max(minimum,Math.abs(b.x-a.x)*width/2)+'px';el.style.height=Math.max(minimum,Math.abs(b.y-a.y)*height/2)+'px';
      el.style.visibility=Math.abs(v.x)>1.1||Math.abs(v.y)>1.1?'hidden':'visible';
    });
  }
  function resize(){
    const hostWidth=host.clientWidth;if(!hostWidth)return;
    const wide=document.body.classList.contains('practice-wide')&&document.body.classList.contains('practice-open');
    const landscapeMode=document.body.classList.contains('practice-landscape');
    const stageHeight=document.body.classList.contains('practice-rotated')?innerWidth:innerHeight;
    let width=hostWidth;
    if(course07&&window.innerWidth>=600){
      const sideWidth=Math.min(244,Math.max(180,Math.round(hostWidth*.26)));
      host.style.setProperty('--course07-side-width',sideWidth+'px');
      width=Math.max(240,hostWidth-sideWidth-16);
    }
    if(wide){
      if(landscapeMode){
        const sideWidth=Math.max(stageHeight<=560?236:260,Math.round((hostWidth-16)*.24));
        width=Math.max(280,Math.round(hostWidth-16-sideWidth));
      }else width=Math.round((hostWidth-20)*.64);
    }
    const clearance=landscapeMode?(stageHeight<=430?126:stageHeight>700?230:140):230;
    let height=Math.round(wide?Math.max(170,Math.min(width*.62,stageHeight-clearance)):width*.62);
    if(course07){
      const stageTop=host.getBoundingClientRect().top;
      height=Math.max(90,Math.min(height,Math.floor(window.innerHeight-stageTop-14)));
      host.style.setProperty('--course07-canvas-height',height+'px');
    }
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio||1,2),3));renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();updateCamera();
    positionAnchors(width,height);host.style.setProperty('--model-scale',width/1100);host.style.setProperty('--model-width',width+'px');
  }
  const viewPointers=new Map();let viewDrag=null,pinch=null;
  const panUnit=()=>2*viewDistance*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/(modelZoom*Math.max(1,renderer.domElement.clientHeight));
  const panFromDelta=(dx,dy,startX,startZ,unit)=>{
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    const upPlane=Math.max(.15,up.x*up.x+up.z*up.z);
    modelPanX=startX-dx*unit*right.x+dy*unit*up.x/upPlane;
    modelPanZ=startZ-dx*unit*right.z+dy*unit*up.z/upPlane;
  };
  const redrawView=()=>{
    tiltInput.value=String(Math.round(modelTilt));tiltOutput.textContent=Math.round(modelTilt)+'°';
    updateCamera();positionAnchors(renderer.domElement.clientWidth,renderer.domElement.clientHeight);renderer.render(scene,camera);
  };
  const viewTarget=course07?host:renderer.domElement;
  viewTarget.addEventListener('pointerdown',event=>{
    if(!viewAdjustable()||event.button!==0)return;
    if(course07&&event.target.closest('.model-deck-tools,.model-display-flat,.hardware-hit,.model-jog,.model-slider,.model-knob,button,input,summary'))return;
    viewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    viewTarget.setPointerCapture(event.pointerId);
    if(viewPointers.size===1){viewDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,tilt:modelTilt,azimuth:modelAzimuth,panX:modelPanX,panZ:modelPanZ,unit:panUnit()};pinch=null;}
    else if(viewPointers.size===2){const [first,second]=[...viewPointers.values()];pinch={distance:Math.hypot(first.x-second.x,first.y-second.y),zoom:modelZoom,x:(first.x+second.x)/2,y:(first.y+second.y)/2,panX:modelPanX,panZ:modelPanZ,unit:panUnit()};viewDrag=null;}
  });
  viewTarget.addEventListener('pointermove',event=>{
    if(!viewPointers.has(event.pointerId))return;
    viewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(viewPointers.size>=2&&pinch){const [first,second]=[...viewPointers.values()];const distance=Math.hypot(first.x-second.x,first.y-second.y);modelZoom=THREE.MathUtils.clamp(pinch.zoom*distance/Math.max(1,pinch.distance),minViewZoom,maxViewZoom);panFromDelta((first.x+second.x)/2-pinch.x,(first.y+second.y)/2-pinch.y,pinch.panX,pinch.panZ,pinch.unit);redrawView();return;}
    if(!viewDrag||viewDrag.pointerId!==event.pointerId)return;
    if(event.shiftKey&&event.pointerType==='mouse')panFromDelta(event.clientX-viewDrag.x,event.clientY-viewDrag.y,viewDrag.panX,viewDrag.panZ,viewDrag.unit);
    else{modelAzimuth=THREE.MathUtils.clamp(viewDrag.azimuth+(event.clientX-viewDrag.x)*(course07?.18:.06),-maxViewAzimuth,maxViewAzimuth);modelTilt=THREE.MathUtils.clamp(viewDrag.tilt-(event.clientY-viewDrag.y)*(course07?.42:.18),minViewTilt,maxViewTilt);}
    redrawView();
  });
  const endViewDrag=event=>{
    viewPointers.delete(event.pointerId);pinch=null;
    if(viewPointers.size===1){const [pointerId,point]=[...viewPointers.entries()][0];viewDrag={pointerId,x:point.x,y:point.y,tilt:modelTilt,azimuth:modelAzimuth,panX:modelPanX,panZ:modelPanZ,unit:panUnit()};}
    else viewDrag=null;
  };
  viewTarget.addEventListener('pointerup',endViewDrag);
  viewTarget.addEventListener('pointercancel',endViewDrag);
  viewTarget.addEventListener('lostpointercapture',endViewDrag);
  host.addEventListener('wheel',event=>{
    if(!viewAdjustable())return;
    const bounds=renderer.domElement.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return;
    event.preventDefault();modelZoom=THREE.MathUtils.clamp(modelZoom*Math.exp(-event.deltaY*.0015),minViewZoom,maxViewZoom);redrawView();
  },{passive:false});
  renderer.domElement.addEventListener('keydown',event=>{
    if(!viewAdjustable())return;
    if(event.key==='Home'){modelAzimuth=0;modelTilt=70;modelZoom=defaultModelZoom;modelPanX=0;modelPanZ=0;}
    else if(event.shiftKey&&event.key==='ArrowLeft')modelPanX-=panUnit()*60;
    else if(event.shiftKey&&event.key==='ArrowRight')modelPanX+=panUnit()*60;
    else if(event.shiftKey&&event.key==='ArrowUp')modelPanZ-=panUnit()*60;
    else if(event.shiftKey&&event.key==='ArrowDown')modelPanZ+=panUnit()*60;
    else if(event.key==='ArrowLeft')modelAzimuth=THREE.MathUtils.clamp(modelAzimuth-3,-maxViewAzimuth,maxViewAzimuth);
    else if(event.key==='ArrowRight')modelAzimuth=THREE.MathUtils.clamp(modelAzimuth+3,-maxViewAzimuth,maxViewAzimuth);
    else if(event.key==='ArrowUp')modelTilt=THREE.MathUtils.clamp(modelTilt+5,minViewTilt,maxViewTilt);
    else if(event.key==='ArrowDown')modelTilt=THREE.MathUtils.clamp(modelTilt-5,minViewTilt,maxViewTilt);
    else if(event.key==='+'||event.key==='=')modelZoom=THREE.MathUtils.clamp(modelZoom+.05,minViewZoom,maxViewZoom);
    else if(event.key==='-')modelZoom=THREE.MathUtils.clamp(modelZoom-.05,minViewZoom,maxViewZoom);
    else return;
    event.preventDefault();redrawView();
  });
  new ResizeObserver(resize).observe(host);new ResizeObserver(resize).observe(displayPanel);window.addEventListener('resize',resize);document.addEventListener('practice-layout-change',resize);resize();
  const setText=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  const timeText=seconds=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
  function drawScreen(){
    displayDecks.forEach(({id,panel,canvas},i)=>{
      const deck=engine.decks[id],pos=deck?.position()||0,baseBpm=deck?.track?.bpm||Number(document.getElementById('bpmInput'+id.toUpperCase()).value)||120,bpm=baseBpm*(deck?.playbackRate||1);
      const buffer=deck?.track?.buffer,samples=buffer?.getChannelData(0),duration=buffer?.duration||0;
      const bpmField=panel.querySelector('[data-bpm]');if(document.activeElement!==bpmField)bpmField.value=bpm.toFixed(1);setText(panel.querySelector('time'),timeText(pos));
      setText(panel.querySelector('.display-state'),deck?.playing?'播放中':'待播放');panel.classList.toggle('is-playing',Boolean(deck?.playing));
      const filename=document.getElementById('file'+id.toUpperCase()).files?.[0]?.name||document.querySelector('#deck'+id.toUpperCase()+'Title>span:last-child')?.textContent||'训练音轨 '+id.toUpperCase();setText(panel.querySelector('.display-track'),filename);panel.querySelector('.display-track').title=filename;
      setText(panel.querySelector('[data-beat]'),'第 '+(Math.floor(pos*baseBpm/60)%4+1)+' 拍');setText(panel.querySelector('[data-remaining]'),duration?'−'+timeText(Math.max(0,duration-pos)):'--:--');
      const W=canvas.clientWidth,H=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,3);if(!W||!H)return;
      if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
      const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const practice=document.body.classList.contains('practice-open');const color=practice?(i?'#513886':'#7952cf'):(i?'#cbb0ff':'#bde883');
      ctx.strokeStyle=practice?'#ded5e9':'#303b45';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
      const windowSeconds=60/baseBpm*8,start=pos-windowSeconds/2;
      for(let beat=Math.floor(start*baseBpm/60);beat<Math.ceil((start+windowSeconds)*baseBpm/60);beat++){const x=(beat*60/baseBpm-start)/windowSeconds*W;ctx.fillStyle=practice?(beat%4===0?'#c5b4dd':'#ece7f3'):(beat%4===0?'#54616d':'#29343e');ctx.fillRect(Math.round(x),0,1,H);}
      if(samples?.length){ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.beginPath();for(let x=0;x<W;x+=2){let peak=0;for(let n=0;n<12;n++){const seconds=start+(x+n/6)/W*windowSeconds;const index=((Math.floor(seconds*buffer.sampleRate)%samples.length)+samples.length)%samples.length;peak=Math.max(peak,Math.abs(samples[index]));}const amplitude=Math.min(H*.45,peak*H*.63);ctx.moveTo(x,H/2-amplitude);ctx.lineTo(x,H/2+amplitude);}ctx.stroke();}
      ctx.fillStyle=practice?'#7952cf':'#ffffff';ctx.fillRect(Math.round(W/2),0,1,H);
    });
  }
  function syncTutorialState(){const practice=document.body.classList.contains('practice-open');host.querySelectorAll('[data-source]').forEach(control=>{const source=document.getElementById(control.dataset.source);control.classList.toggle('is-next',Boolean(!practice&&source?.classList.contains('is-next')));control.disabled=control.dataset.loopInactive==='true'||Boolean(source?.disabled)||Boolean(course07&&/^load[AB]$/.test(control.dataset.source));});}
  function requestAiCoach(metrics,signature){
    aiPending=true;lastAiSignature=signature;lastAiRequestAt=performance.now();
    coachLabel.textContent='Qwen 正在观察';scoreLabel.textContent='实时技术分 · AI 分析中';
    analyzePractice(metrics).then(result=>{
      aiResult={...result,signature,receivedAt:performance.now()};
      coachLabel.textContent=`AI 教练 · ${result.model||'Qwen'}`;scoreLabel.textContent='AI 练习评分';
    }).catch(error=>{
      aiResult=null;
      if(error.code==='ai_not_configured'){aiConnected=false;coachLabel.textContent='本地提示 · AI 未连接';scoreLabel.textContent='实时技术分';}
      else {coachLabel.textContent='Qwen 暂时离线';scoreLabel.textContent='实时技术分';}
    }).finally(()=>{aiPending=false;});
  }
  function updateCoach(){
    const a=engine.decks.a,b=engine.decks.b,rawCross=Number(document.getElementById('crossfader').value),cross=(rawCross+100)/2;
    const baseA=Number(document.getElementById('bpmInputA').value)||120,baseB=Number(document.getElementById('bpmInputB').value)||120;
    const bpmA=baseA*(a?.playbackRate||1),bpmB=baseB*(b?.playbackRate||1),bpmDiff=Math.abs(bpmA-bpmB);
    const lowA=Number(document.getElementById('lowA').value),lowB=Number(document.getElementById('lowB').value),volumeA=Number(document.getElementById('volumeA').value),volumeB=Number(document.getElementById('volumeB').value),active=Boolean(a?.playing||b?.playing||rawCross>-96);
    let copy='先播放 Deck A，熟悉它的主节拍。';
    if(a?.playing&&!b?.playing)copy='A 已运行。试听 B，再用 Sync 对齐两首歌。';
    else if(a?.playing&&b?.playing&&bpmDiff>.6)copy=`两首歌相差 ${bpmDiff.toFixed(1)} BPM，先让速度更接近。`;
    else if(a?.playing&&b?.playing&&cross<32&&lowB>-6)copy='接入 B 前先降低 B 的 LOW，避免两组低频叠在一起。';
    else if(a?.playing&&b?.playing&&cross<72)copy='节拍已接近，交换 LOW 后再稳定地把推子移向 B。';
    else if(b?.playing&&cross>=72&&lowA>-6)copy='B 已接住；把 A 的 LOW 降下去，收尾会更干净。';
    else if(b?.playing&&cross>=86)copy='交接完成。保持 B 音量稳定，可以结束录制。';
    const clampScore=value=>Math.max(0,Math.min(100,Math.round(value))),beat=clampScore(100-bpmDiff*14),handoff=clampScore(a?.playing?(b?.playing?42+cross*.58:30):0);
    let idealLowError;if(cross<35)idealLowError=Math.abs(lowA)+Math.abs(lowB+12);else if(cross>65)idealLowError=Math.abs(lowA+12)+Math.abs(lowB);else idealLowError=Math.min(Math.abs(lowA+12)+Math.abs(lowB),Math.abs(lowA)+Math.abs(lowB+12));
    const clarity=clampScore(100-idealLowError*3.2-Math.abs(volumeA-volumeB)*1.2),total=clampScore(beat*.36+handoff*.34+clarity*.30);
    const signature=[a?.playing?1:0,b?.playing?1:0,Math.round(bpmDiff*2),Math.round(cross/20),Math.round((lowA+12)/4),Math.round((lowB+12)/4)].join(':');
    const now=performance.now(),useAi=Boolean(aiResult&&aiResult.signature===signature&&now-aiResult.receivedAt<18000);
    const values=useAi?{beat:aiResult.beat,handoff:aiResult.handoff,clarity:aiResult.clarity}:{beat,handoff,clarity};
    const shownTotal=useAi?aiResult.total:total;
    if(!useAi)coachCopy.textContent=copy;else coachCopy.textContent=aiResult.coach;
    aiScore.classList.toggle('is-active',active);aiScore.querySelector('[data-ai-total]').textContent=active?String(shownTotal):'--';
    Object.entries(values).forEach(([key,value])=>{const metric=aiScore.querySelector(`[data-ai-metric="${key}"]`);metric.style.setProperty('--score',active?value:0);metric.querySelector('em').textContent=active?String(value):'--';});
    let summary='播放 A 后开始实时测量。';
    if(active){const weakest=Object.entries({beat,handoff,clarity}).sort((x,y)=>x[1]-y[1])[0][0];summary=weakest==='beat'?'优先缩小两首歌的 BPM 差距。':weakest==='handoff'?'让 B 进入后，再平稳完成 Crossfader 交接。':'一次只保留一组主低频，声音会更清晰。';if(total>=90&&cross>=86)summary='节拍、衔接和低频交接都很稳定。';}
    aiScore.querySelector('[data-ai-summary]').textContent=useAi?aiResult.summary:summary;
    if(active&&aiConnected&&!aiPending&&signature!==lastAiSignature&&now-lastAiRequestAt>=7000){
      requestAiCoach({playingA:Boolean(a?.playing),playingB:Boolean(b?.playing),bpmA,bpmB,bpmDifference:bpmDiff,crossfaderToB:cross,lowA,lowB,volumeA,volumeB,localBeat:beat,localHandoff:handoff,localClarity:clarity,localTotal:total},signature);
    }
  }
  let before=performance.now(),lastScreen=0;renderer.setAnimationLoop(now=>{const dt=Math.min((now-before)/1000,.05);before=now;if(!document.body.classList.contains('course-console')&&!document.body.classList.contains('practice-open')&&!host.classList.contains('force-active'))return;syncControllerPalette();wheels.forEach(({top,id})=>{if(engine.decks[id]?.playing)top.rotation.y-=dt*1.5;});if(now-lastScreen>66){drawScreen();syncTutorialState();syncParameters();updateCoach();lastScreen=now;}renderer.render(scene,camera);});
  return {host,renderer,setView({tilt,zoom}={}){if(Number.isFinite(tilt))modelTilt=THREE.MathUtils.clamp(tilt,minViewTilt,maxViewTilt);if(Number.isFinite(zoom))modelZoom=THREE.MathUtils.clamp(zoom,minViewZoom,maxViewZoom);redrawView();}};
}
