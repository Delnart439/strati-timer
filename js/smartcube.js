// ─── SMART CUBE — 3D viewer + BLE ─────────────────────────────────────────────
// Three.js is loaded globally via <script> tag (window.THREE)
// smartcube-web-bluetooth is lazy-loaded via import() on first connect

// ─── CUBE MATH (CubieCube port for applyMove) ────────────────────────────────
const _cF = [
  [8,9,20],[6,18,38],[0,36,47],[2,45,11],
  [29,26,15],[27,44,24],[33,53,42],[35,17,51]
];
const _eF = [
  [5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],
  [23,12],[21,41],[50,39],[48,14]
];

class CubieCube {
  constructor(){ this.ca=[0,1,2,3,4,5,6,7]; this.ea=[0,2,4,6,8,10,12,14,16,18,20,22]; }
  init(ca,ea){ this.ca=ca.slice(); this.ea=ea.slice(); return this; }
  static EM(a,b,p){ for(let e=0;e<12;e++) p.ea[e]=a.ea[b.ea[e]>>1]^(b.ea[e]&1); }
  static CM(a,b,p){
    for(let c=0;c<8;c++){
      const o=((a.ca[b.ca[c]&7]>>3)+(b.ca[c]>>3))%3;
      p.ca[c]=(a.ca[b.ca[c]&7]&7)|(o<<3);
    }
  }
  static Mult(a,b,p){ CubieCube.CM(a,b,p); CubieCube.EM(a,b,p); }
  toFaceCube(){
    const f=[]; for(let i=0;i<54;i++) f[i]=i;
    for(let c=0;c<8;c++){ const j=this.ca[c]&7,o=this.ca[c]>>3; for(let n=0;n<3;n++) f[_cF[c][(n+o)%3]]=_cF[j][n]; }
    for(let e=0;e<12;e++){ const j=this.ea[e]>>1,o=this.ea[e]&1; for(let n=0;n<2;n++) f[_eF[e][(n+o)%2]]=_eF[j][n]; }
    return f.map(v=>'URFDLB'[~~(v/9)]).join('');
  }
  fromFacelet(fs){
    const f=[]; const cx=fs[4]+fs[13]+fs[22]+fs[31]+fs[40]+fs[49];
    for(let i=0;i<54;i++){ f[i]=cx.indexOf(fs[i]); if(f[i]===-1) return -1; }
    let cnt=0; for(let i=0;i<54;i++) cnt+=1<<(f[i]<<2);
    if(cnt!==0x999999) return -1;
    for(let i=0;i<8;i++){
      let o=0; for(o=0;o<3;o++) if(f[_cF[i][o]]===0||f[_cF[i][o]]===3) break;
      const c1=f[_cF[i][(o+1)%3]],c2=f[_cF[i][(o+2)%3]];
      for(let j=0;j<8;j++) if(c1===~~(_cF[j][1]/9)&&c2===~~(_cF[j][2]/9)){ this.ca[i]=j|((o%3)<<3); break; }
    }
    for(let i=0;i<12;i++){
      for(let j=0;j<12;j++){
        if(f[_eF[i][0]]===~~(_eF[j][0]/9)&&f[_eF[i][1]]===~~(_eF[j][1]/9)){ this.ea[i]=j<<1; break; }
        if(f[_eF[i][0]]===~~(_eF[j][1]/9)&&f[_eF[i][1]]===~~(_eF[j][0]/9)){ this.ea[i]=j<<1|1; break; }
      }
    }
    return this;
  }
}
CubieCube.MC = (()=>{
  const mc=[]; for(let i=0;i<18;i++) mc[i]=new CubieCube();
  mc[0].init([3,0,1,2,4,5,6,7],[6,0,2,4,8,10,12,14,16,18,20,22]);
  mc[3].init([20,1,2,8,15,5,6,19],[16,2,4,6,22,10,12,14,8,18,20,0]);
  mc[6].init([9,21,2,3,16,12,6,7],[0,19,4,6,8,17,12,14,3,11,20,22]);
  mc[9].init([0,1,2,3,5,6,7,4],[0,2,4,6,10,12,14,8,16,18,20,22]);
  mc[12].init([0,10,22,3,4,17,13,7],[0,2,20,6,8,10,18,14,16,4,12,22]);
  mc[15].init([0,1,11,23,4,5,18,14],[0,2,4,23,8,10,12,21,16,18,7,15]);
  for(let a=0;a<18;a+=3) for(let p=0;p<2;p++) CubieCube.Mult(mc[a+p],mc[a],mc[a+p+1]);
  return mc;
})();

function scApplyMove(fs, mv) {
  const face=mv[0].toUpperCase(), mod=mv.slice(1).trim();
  const base={U:0,R:3,F:6,D:9,L:12,B:15}[face];
  if(base===undefined) return fs;
  const n=mod==="'"?3:mod==='2'?2:1;
  const cc=new CubieCube(); if(cc.fromFacelet(fs)===-1) return fs;
  const r=new CubieCube(); CubieCube.Mult(CubieCube.MC[base+n-1],cc,r);
  return r.toFaceCube();
}

// ─── STICKER → FACE MAP ──────────────────────────────────────────────────────
const SC_S2F = new Array(54).fill(null);
(function(){
  const d=[
    [2,[[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],0],
    [0,[[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],9],
    [4,[[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],18],
    [3,[[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],27],
    [1,[[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],36],
    [5,[[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]],45],
  ];
  d.forEach(([fi,pos,off])=>pos.forEach((p,i)=>{ if(p) SC_S2F[off+i]={key:`${p[0]},${p[1]},${p[2]}`,fi}; }));
})();

const SC_FACE_MOVES = {
  R:{axis:'x',layer: 1,angle:-Math.PI/2},
  L:{axis:'x',layer:-1,angle:+Math.PI/2},
  U:{axis:'y',layer: 1,angle:-Math.PI/2},
  D:{axis:'y',layer:-1,angle:+Math.PI/2},
  F:{axis:'z',layer: 1,angle:-Math.PI/2},
  B:{axis:'z',layer:-1,angle:+Math.PI/2},
};
const SC_COLORS = {U:0xFFFFFF,R:0xEE2222,F:0x009B48,D:0xFFD500,L:0xFF5800,B:0x0046AD};
const SC_INNER  = 0x111111;
const SC_SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ─── SCENE STATE ─────────────────────────────────────────────────────────────
let scScene, scCamera, scRenderer, scRafId, scRenderActive=false;
let scCubies={}, scCamTheta=0.55, scCamPhi=1.0;
const SC_CAM_DIST = 6.5;

// ─── ANIMATION STATE ─────────────────────────────────────────────────────────
const scMoveQueue=[];
let scQueueRunning=false, scCurrentFacelets=SC_SOLVED;

// ─── BLE STATE ───────────────────────────────────────────────────────────────
let scConn=null, scSub=null;

// ─── SCENE INIT ──────────────────────────────────────────────────────────────
function scInitScene(container) {
  if(scScene) return;
  const T = window.THREE;
  if(!T){ console.error('Three.js not loaded'); return; }

  const W=container.clientWidth||300, H=container.clientHeight||300;
  scRenderer = new T.WebGLRenderer({antialias:true, alpha:true});
  scRenderer.setSize(W,H);
  scRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  container.appendChild(scRenderer.domElement);

  scScene  = new T.Scene();
  scCamera = new T.PerspectiveCamera(50,W/H,0.1,100);
  scPosCamera();

  scScene.add(new T.AmbientLight(0xffffff,0.75));
  const dl=new T.DirectionalLight(0xffffff,1.0); dl.position.set(4,8,6); scScene.add(dl);
  const dl2=new T.DirectionalLight(0xffffff,0.35); dl2.position.set(-3,-4,-3); scScene.add(dl2);
  const dl3=new T.DirectionalLight(0xffffff,0.2); dl3.position.set(0,-5,4); scScene.add(dl3);

  scBuildCubies();
  scAddOrbit(scRenderer.domElement);
  scStartRender();
}

function scPosCamera(){
  if(!scCamera) return;
  scCamera.position.set(
    SC_CAM_DIST*Math.sin(scCamPhi)*Math.sin(scCamTheta),
    SC_CAM_DIST*Math.cos(scCamPhi),
    SC_CAM_DIST*Math.sin(scCamPhi)*Math.cos(scCamTheta)
  );
  scCamera.lookAt(0,0,0);
}

function scStartRender(){
  if(scRenderActive||!scRenderer) return;
  scRenderActive=true;
  (function loop(){ if(!scRenderActive) return; scRafId=requestAnimationFrame(loop); scRenderer.render(scScene,scCamera); })();
}
function scStopRender(){ scRenderActive=false; if(scRafId){cancelAnimationFrame(scRafId);scRafId=null;} }

// ─── CUBIES ──────────────────────────────────────────────────────────────────
function scMakeRoundedSticker(size, r) {
  const T=window.THREE, s=size/2;
  const shape=new T.Shape();
  shape.moveTo(-s+r,-s); shape.lineTo(s-r,-s); shape.quadraticCurveTo(s,-s,s,-s+r);
  shape.lineTo(s,s-r);   shape.quadraticCurveTo(s,s,s-r,s);
  shape.lineTo(-s+r,s);  shape.quadraticCurveTo(-s,s,-s,s-r);
  shape.lineTo(-s,-s+r); shape.quadraticCurveTo(-s,-s,-s+r,-s);
  shape.closePath();
  return new T.ShapeGeometry(shape);
}

function scBuildCubies(){
  const T=window.THREE;
  const OFF=0.473;
  const sGeo=scMakeRoundedSticker(0.82,0.09);
  // order matches SC_FI_DIRS: +x,-x,+y,-y,+z,-z
  const FACE=[
    {p:[OFF,0,0],   r:[0,Math.PI/2,0]},
    {p:[-OFF,0,0],  r:[0,-Math.PI/2,0]},
    {p:[0,OFF,0],   r:[-Math.PI/2,0,0]},
    {p:[0,-OFF,0],  r:[Math.PI/2,0,0]},
    {p:[0,0,OFF],   r:[0,0,0]},
    {p:[0,0,-OFF],  r:[0,Math.PI,0]},
  ];
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
    if(x===0&&y===0&&z===0) continue;
    const body=new T.Mesh(
      new T.BoxGeometry(0.94,0.94,0.94),
      new T.MeshPhongMaterial({color:0x1c1c1c,shininess:12})
    );
    body.position.set(x,y,z); scScene.add(body);
    const stickers=FACE.map(({p,r})=>{
      const mat=new T.MeshPhongMaterial({color:SC_INNER,shininess:110});
      const s=new T.Mesh(sGeo,mat);
      s.position.set(...p); s.rotation.set(...r); body.add(s);
      return mat;
    });
    body.userData.stickers=stickers;
    scCubies[`${x},${y},${z}`]=body;
  }
  scUpdateColors(SC_SOLVED);
}

// ─── COLOR UPDATE ─────────────────────────────────────────────────────────────
const SC_FI_DIRS = (()=>{ const T=window.THREE||{}; return [
  new (T.Vector3||Object)(1,0,0), new (T.Vector3||Object)(-1,0,0),
  new (T.Vector3||Object)(0,1,0), new (T.Vector3||Object)(0,-1,0),
  new (T.Vector3||Object)(0,0,1), new (T.Vector3||Object)(0,0,-1),
]; })();

function scGetLocalFi(mesh, globalFi){
  const T=window.THREE;
  const gv=SC_FI_DIRS[globalFi].clone().applyQuaternion(mesh.quaternion.clone().invert());
  let best=0,bestD=-Infinity;
  for(let j=0;j<6;j++){ const d=SC_FI_DIRS[j].dot(gv); if(d>bestD){bestD=d;best=j;} }
  return best;
}

function scUpdateColors(facelets){
  if(!scScene) return;
  for(let i=0;i<54;i++){
    const sf=SC_S2F[i]; if(!sf) continue;
    const c=scCubies[sf.key]; if(!c) continue;
    const fi=scGetLocalFi(c,sf.fi);
    (c.userData.stickers||c.material)[fi].color.setHex(SC_COLORS[facelets[i]]??SC_INNER);
  }
}

// ─── ORBIT ───────────────────────────────────────────────────────────────────
function scAddOrbit(canvas){
  let dn=false,px=0,py=0;
  canvas.addEventListener('mousedown',e=>{dn=true;px=e.clientX;py=e.clientY;});
  canvas.addEventListener('mousemove',e=>{
    if(!dn) return;
    scCamTheta-=(e.clientX-px)*0.011;
    scCamPhi=Math.max(0.1,Math.min(Math.PI-0.1,scCamPhi+(e.clientY-py)*0.011));
    px=e.clientX;py=e.clientY;scPosCamera();
  });
  window.addEventListener('mouseup',()=>dn=false);
  canvas.addEventListener('touchstart',e=>{const t=e.touches[0];dn=true;px=t.clientX;py=t.clientY;},{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(!dn) return; const t=e.touches[0];
    scCamTheta-=(t.clientX-px)*0.013;
    scCamPhi=Math.max(0.1,Math.min(Math.PI-0.1,scCamPhi+(t.clientY-py)*0.013));
    px=t.clientX;py=t.clientY;scPosCamera();e.preventDefault();
  },{passive:false});
  window.addEventListener('touchend',()=>dn=false);
}

// ─── MOVE ANIMATION ──────────────────────────────────────────────────────────
function scEnqueue(mv){
  scCurrentFacelets=scApplyMove(scCurrentFacelets,mv);
  scMoveQueue.push(mv);
  if(!scQueueRunning) scProcessQueue();
}

function scProcessQueue(){
  if(!scMoveQueue.length){ scQueueRunning=false; scUpdateColors(scCurrentFacelets); return; }
  scQueueRunning=true;
  const mv=scMoveQueue.shift();
  scPerformMove(mv,scMoveQueue.length>5,scProcessQueue);
}

function scPerformMove(mv,instant,done){
  const face=mv[0].toUpperCase(),mod=mv.slice(1).trim();
  const def=SC_FACE_MOVES[face]; if(!def){done();return;}
  const mult=mod==="'"?-1:mod==='2'?2:1, target=def.angle*mult;
  const {axis,layer}=def;

  const pd=[];
  for(const key in scCubies){
    const m=scCubies[key],coord=axis==='x'?m.position.x:axis==='y'?m.position.y:m.position.z;
    if(Math.abs(coord-layer)<0.15) pd.push({mesh:m,key});
  }
  if(!pd.length){done();return;}

  const T=window.THREE;
  const pivot=new T.Group(); scScene.add(pivot);
  pd.forEach(({mesh})=>{scScene.remove(mesh);pivot.add(mesh);});

  const setR=a=>{ if(axis==='x')pivot.rotation.x=a; else if(axis==='y')pivot.rotation.y=a; else pivot.rotation.z=a; };
  const finish=()=>{
    setR(target); pivot.updateMatrixWorld(true); scDetach(pivot,pd); done();
  };
  if(instant){finish();return;}

  const dur=Math.abs(mult)===2?175:125,t0=performance.now();
  (function fr(now){
    const t=Math.min(1,(now-t0)/dur),e=t<0.5?2*t*t:-1+(4-2*t)*t;
    setR(target*e); if(t<1) requestAnimationFrame(fr); else finish();
  })(performance.now());
}

function scDetach(pivot,pd){
  const T=window.THREE;
  const wt=pd.map(({mesh})=>{const p=new T.Vector3(),q=new T.Quaternion();mesh.getWorldPosition(p);mesh.getWorldQuaternion(q);return{p,q};});
  pd.forEach(({mesh,key},i)=>{
    pivot.remove(mesh);scScene.add(mesh);
    mesh.position.copy(wt[i].p);mesh.quaternion.copy(wt[i].q);
    mesh.position.x=Math.round(mesh.position.x);
    mesh.position.y=Math.round(mesh.position.y);
    mesh.position.z=Math.round(mesh.position.z);
    const nk=`${mesh.position.x},${mesh.position.y},${mesh.position.z}`;
    delete scCubies[key];scCubies[nk]=mesh;
  });
  scScene.remove(pivot);
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function scSetStatus(t){ const el=document.getElementById('scStatus');if(el)el.textContent=t; }
function scSetBattery(t){ const el=document.getElementById('scBattery');if(el)el.textContent=t; }
function scSetDevice(t){ const el=document.getElementById('scDevice');if(el)el.textContent=t; }

function scSetConnUI(on){
  const c=document.getElementById('scConnBtn'),d=document.getElementById('scDisconnBtn'),r=document.getElementById('scResetBtn');
  if(c)c.style.display=on?'none':'flex';
  if(d)d.style.display=on?'':'none';
  if(r)r.style.display=on?'':'none';
}

// ─── BLE CONNECTION ──────────────────────────────────────────────────────────
async function scConnect(){
  if(!navigator?.bluetooth){
    scSetStatus('Bluetooth not available — use Chrome or Edge over HTTPS');
    return;
  }

  const lib = window.SmartCubeLib;
  if(!lib?.connectSmartCube){
    scSetStatus('Cube library not loaded — reload the page');
    return;
  }

  const btn=document.getElementById('scConnBtn');
  const origHTML=btn?.innerHTML??'';
  if(btn){btn.disabled=true;btn.innerHTML='<span style="display:inline-block;animation:spin 1s linear infinite">⟳</span> Searching…';}

  scSetStatus('Opening Bluetooth picker…');
  try{
    scConn = await lib.connectSmartCube({
      deviceSelection:'filtered',
      enableAddressSearch:true,
      onStatus:(msg)=>scSetStatus(msg),
    });

    scSetConnUI(true);
    scSetStatus('Connected — '+scConn.deviceName);
    scSetDevice(scConn.protocol.name);

    // Reset cube to solved, then sync real state
    scCurrentFacelets=SC_SOLVED;
    scMoveQueue.length=0;
    scUpdateColors(SC_SOLVED);

    scSub=scConn.events$.subscribe({
      next(ev){
        switch(ev.type){
          case 'MOVE':    scEnqueue(ev.move); break;
          case 'FACELETS': scCurrentFacelets=ev.facelets; if(!scQueueRunning)scUpdateColors(scCurrentFacelets); break;
          case 'BATTERY':  scSetBattery('Battery: '+ev.batteryLevel+'%'); break;
          case 'HARDWARE': if(ev.hardwareName)scSetDevice(scConn.protocol.name+' · '+ev.hardwareName); break;
          case 'DISCONNECT': scHandleDisconn(); break;
        }
      },
      error(){ scHandleDisconn(); }
    });

    if(scConn.capabilities.facelets) scConn.sendCommand({type:'REQUEST_FACELETS'}).catch(()=>{});
    if(scConn.capabilities.battery)  scConn.sendCommand({type:'REQUEST_BATTERY'}).catch(()=>{});
    if(scConn.capabilities.hardware) scConn.sendCommand({type:'REQUEST_HARDWARE'}).catch(()=>{});

  }catch(err){
    const msg=err?.message??'';
    if(err?.name==='AbortError'||msg.includes('cancel')||msg.includes('chosen')||msg.includes('No device'))
      scSetStatus('No cube selected');
    else{ scSetStatus('Connection failed — '+msg); console.error(err); }
    scSetConnUI(false);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML=origHTML;}
  }
}

function scHandleDisconn(){
  scSub?.unsubscribe?.(); scSub=null; scConn=null;
  scSetStatus(''); scSetBattery(''); scSetDevice(''); scSetConnUI(false);
}

async function scDisconnect(){ try{await scConn?.disconnect();}catch(e){} scHandleDisconn(); }

async function scReset(){
  if(!scConn||!scConn.capabilities.reset) return;
  try{await scConn.sendCommand({type:'REQUEST_RESET'});}catch(e){}
  scCurrentFacelets=SC_SOLVED; scMoveQueue.length=0; scUpdateColors(SC_SOLVED);
}

// ─── INIT & WIRING ───────────────────────────────────────────────────────────

// Init 3D scene as soon as the script loads (Three.js already loaded via <script>)
(function(){
  const wrap=document.getElementById('sc3dWrap');
  if(wrap&&window.THREE) scInitScene(wrap);
})();

document.getElementById('scConnBtn')?.addEventListener('click', scConnect);
document.getElementById('scDisconnBtn')?.addEventListener('click', scDisconnect);
document.getElementById('scResetBtn')?.addEventListener('click', scReset);

// Resize + restart render when cube mode is activated
document.querySelector('.ac[data-mode="cube"]')?.addEventListener('click',()=>{
  const wrap=document.getElementById('sc3dWrap');
  if(!scScene&&wrap&&window.THREE) scInitScene(wrap);
  if(scRenderer&&wrap){
    const W=wrap.clientWidth||300,H=wrap.clientHeight||300;
    scRenderer.setSize(W,H);
    if(scCamera){scCamera.aspect=W/H;scCamera.updateProjectionMatrix();}
  }
  scStartRender();
});
document.querySelectorAll('.ac[data-mode]').forEach(btn=>{
  btn.addEventListener('click',()=>{ if(btn.dataset.mode!=='cube') scStopRender(); });
});

// Rebuild FI_DIRS now that THREE is available
(function(){
  const T=window.THREE; if(!T) return;
  SC_FI_DIRS[0]=new T.Vector3(1,0,0); SC_FI_DIRS[1]=new T.Vector3(-1,0,0);
  SC_FI_DIRS[2]=new T.Vector3(0,1,0); SC_FI_DIRS[3]=new T.Vector3(0,-1,0);
  SC_FI_DIRS[4]=new T.Vector3(0,0,1); SC_FI_DIRS[5]=new T.Vector3(0,0,-1);
})();
