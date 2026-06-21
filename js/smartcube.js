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
const SC_COLORS = {U:0xFFFFFF,R:0xCC1111,F:0x00A040,D:0xFFE000,L:0xFF8000,B:0x0044BB};
const SC_INNER  = 0x111111;
const SC_SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ─── SCENE STATE ─────────────────────────────────────────────────────────────
let scScene, scCamera, scRenderer, scRafId, scRenderActive=false;
let scCubeGroup=null;
let scCubies={}, scCamTheta=0, scCamPhi=1.3;
const SC_CAM_DIST = 6.5;

// ─── ANIMATION STATE ─────────────────────────────────────────────────────────
const scMoveQueue=[];
let scQueueRunning=false, scCurrentFacelets=SC_SOLVED;

// ─── BLE STATE ───────────────────────────────────────────────────────────────
let scConn=null, scSub=null;
let scLastGyroQ=null, scGyroOffset=null, scGyroAppliedQ=null, scLastMoveQ=null, scWCAOrientation=null;

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
  scCubeGroup=new T.Group(); scScene.add(scCubeGroup);
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
    body.position.set(x,y,z); scCubeGroup.add(body);
    const stickers=FACE.map(({p,r})=>{
      const mat=new T.MeshBasicMaterial({color:SC_INNER});
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

// ─── SCRAMBLE TRACKING & AUTO TIMER ─────────────────────────────────────────
let scPhase='idle'; // idle | scrambling | ready | solving
let scScrambleMoves=[], scScrambleIdx=0, scMoveCount=0;
let scErrSeq=[]; // stack of correction moves needed (pop = next to do)
let scR2Dir=null; // direction locked in for the first event of a '2' scramble move
let scErrDir=null; // direction locked in for the first event of a '2' correction move
let scSolveMoves=0; // move count for the current solve
let scMoveLog=[]; // all moves recorded during the current solve
let scStartFl=null; // facelets at the very start of the solve (before first move)
let scLastCenters=null; // center stickers after last fromMove=true tick (for rotation detection)
let scCfopTimes={cross:null,crossMI:null,crossFc:null,f2lPairs:[],f2lNextStart:null,f2l:null,f2lMI:null,oll:null,ollStart:null,ollMI:null,pll:null,pllStart:null,ollCase:null,pllCase:null};
let scPairFirst=[null,null,null,null]; // first-detection timestamp per slot (immutable once set)
let scCfopFace=null; // SC_CFOP_DATA entry for the detected cross face

// CFOP detection — cross is detected on whichever of the 6 faces it was solved on.
// Each entry: fc=cross face color, cx=[[crossSticker,adjSticker]×4],
// f2l=side bands for first-two-layers, fr=full face range, oll_r/oll_c=OLL face.
const SC_FI_TO_COLOR=['R','L','U','D','F','B'];
const SC_CFOP_DATA=[
  {fc:'U',cx:[[1,46],[3,37],[5,10],[7,19]],
   f2l:[{idx:[9,10,11,12,13,14],col:'R'},{idx:[18,19,20,21,22,23],col:'F'},{idx:[36,37,38,39,40,41],col:'L'},{idx:[45,46,47,48,49,50],col:'B'}],
   fr:[0,8],oll_r:[27,35],oll_c:'D',
   pairs:[[[8,'U'],[9,'R'],[20,'F'],[12,'R'],[23,'F']],[[2,'U'],[11,'R'],[45,'B'],[14,'R'],[48,'B']],[[6,'U'],[18,'F'],[38,'L'],[21,'F'],[41,'L']],[[0,'U'],[36,'L'],[47,'B'],[39,'L'],[50,'B']]]},
  {fc:'D',cx:[[28,25],[30,43],[32,16],[34,52]],
   f2l:[{idx:[12,13,14,15,16,17],col:'R'},{idx:[21,22,23,24,25,26],col:'F'},{idx:[39,40,41,42,43,44],col:'L'},{idx:[48,49,50,51,52,53],col:'B'}],
   fr:[27,35],oll_r:[0,8],oll_c:'U',
   pairs:[[[29,'D'],[15,'R'],[26,'F'],[12,'R'],[23,'F']],[[35,'D'],[17,'R'],[51,'B'],[14,'R'],[48,'B']],[[27,'D'],[24,'F'],[44,'L'],[21,'F'],[41,'L']],[[33,'D'],[42,'L'],[53,'B'],[39,'L'],[50,'B']]]},
  {fc:'F',cx:[[19,7],[21,41],[23,12],[25,28]],
   f2l:[{idx:[3,4,5,6,7,8],col:'U'},{idx:[9,10,12,13,15,16],col:'R'},{idx:[27,28,29,30,31,32],col:'D'},{idx:[37,38,40,41,43,44],col:'L'}],
   fr:[18,26],oll_r:[45,53],oll_c:'B',
   pairs:[[[20,'F'],[8,'U'],[9,'R'],[5,'U'],[10,'R']],[[18,'F'],[6,'U'],[38,'L'],[3,'U'],[37,'L']],[[26,'F'],[29,'D'],[15,'R'],[32,'D'],[16,'R']],[[24,'F'],[27,'D'],[44,'L'],[30,'D'],[43,'L']]]},
  {fc:'B',cx:[[46,1],[48,14],[50,39],[52,34]],
   f2l:[{idx:[0,1,2,3,4,5],col:'U'},{idx:[10,11,13,14,16,17],col:'R'},{idx:[30,31,32,33,34,35],col:'D'},{idx:[36,37,39,40,42,43],col:'L'}],
   fr:[45,53],oll_r:[18,26],oll_c:'F',
   pairs:[[[45,'B'],[2,'U'],[11,'R'],[5,'U'],[10,'R']],[[47,'B'],[0,'U'],[36,'L'],[3,'U'],[37,'L']],[[51,'B'],[35,'D'],[17,'R'],[32,'D'],[16,'R']],[[53,'B'],[33,'D'],[42,'L'],[30,'D'],[43,'L']]]},
  {fc:'R',cx:[[10,5],[12,23],[14,48],[16,32]],
   f2l:[{idx:[1,2,4,5,7,8],col:'U'},{idx:[19,20,22,23,25,26],col:'F'},{idx:[28,29,31,32,34,35],col:'D'},{idx:[45,46,48,49,51,52],col:'B'}],
   fr:[9,17],oll_r:[36,44],oll_c:'L',
   pairs:[[[9,'R'],[8,'U'],[20,'F'],[7,'U'],[19,'F']],[[11,'R'],[2,'U'],[45,'B'],[1,'U'],[46,'B']],[[15,'R'],[29,'D'],[26,'F'],[28,'D'],[25,'F']],[[17,'R'],[35,'D'],[51,'B'],[34,'D'],[52,'B']]]},
  {fc:'L',cx:[[37,3],[39,50],[41,21],[43,30]],
   f2l:[{idx:[0,1,3,4,6,7],col:'U'},{idx:[18,19,21,22,24,25],col:'F'},{idx:[27,28,30,31,33,34],col:'D'},{idx:[46,47,49,50,52,53],col:'B'}],
   fr:[36,44],oll_r:[9,17],oll_c:'R',
   pairs:[[[38,'L'],[6,'U'],[18,'F'],[7,'U'],[19,'F']],[[36,'L'],[0,'U'],[47,'B'],[1,'U'],[46,'B']],[[44,'L'],[27,'D'],[24,'F'],[28,'D'],[25,'F']],[[42,'L'],[33,'D'],[53,'B'],[34,'D'],[52,'B']]]},
];
function scCheckCross(fl){
  for(const fd of SC_CFOP_DATA){
    if(fd.cx.every(([fi,ai])=>fl[fi]===fd.fc&&fl[ai]===SC_FI_TO_COLOR[SC_S2F[ai].fi]))
      return fd;
  }
  return null;
}
function scCheckF2L(fl,fd){
  for(let i=fd.fr[0];i<=fd.fr[1];i++) if(fl[i]!==fd.fc) return false;
  for(const {idx,col} of fd.f2l) for(const i of idx) if(fl[i]!==col) return false;
  return true;
}
function scCheckOLL(fl,fd){
  for(let i=fd.oll_r[0];i<=fd.oll_r[1];i++) if(fl[i]!==fd.oll_c) return false;
  return true;
}

function scUpdateCfopBar(){
  const bar=document.getElementById('cfopBar'), lbl=document.getElementById('cfopLabels');
  if(!bar||!lbl) return;
  const {cross,f2lPairs,f2l,oll,pll,ollStart,pllStart}=scCfopTimes; if(pll==null) return;
  const c=cross??0, o=oll??pll, p=pll;
  const f2lEnd=f2lPairs.length===4?f2lPairs[3].t:(f2l??o);
  const os=ollStart??f2lEnd, ps=pllStart??o;
  const fmt=ms=>(ms/1000).toFixed(2)+'s';
  const mkSeg=(ms,col,tip)=>{
    if(ms<=0) return '';
    const w=(ms/p*100).toFixed(1);
    return tip
      ?`<div class="cfop-recog" style="width:${w}%;background:${col}"><span class="cfop-tip">${tip}</span></div>`
      :`<div style="width:${w}%;background:${col}"></div>`;
  };
  let barHtml=mkSeg(c,'#FFFFFF','');
  if(f2lPairs.length===4){
    let prev=c;
    f2lPairs.forEach(pair=>{
      const recog=pair.start!=null?pair.start-prev:0;
      barHtml+=mkSeg(recog,'rgba(59,158,255,.28)',recog>0?fmt(recog):'');
      barHtml+=mkSeg(pair.t-(pair.start??prev),'#3B9EFF','');
      prev=pair.t;
    });
  } else {
    barHtml+=mkSeg(f2lEnd-c,'#3B9EFF','');
  }
  const ollRecog=os-f2lEnd, pllRecog=ps-o;
  barHtml+=mkSeg(ollRecog,'rgba(255,215,0,.30)',ollRecog>0?fmt(ollRecog):'');
  barHtml+=mkSeg(o-os,'#FFD700','');
  barHtml+=mkSeg(pllRecog,'rgba(255,128,0,.30)',pllRecog>0?fmt(pllRecog):'');
  barHtml+=mkSeg(p-ps,'#FF8000','');
  bar.innerHTML=barHtml;
  lbl.style.gridTemplateColumns='1fr 1fr 1fr 1fr';
  lbl.innerHTML=[
    {name:'Cross',col:'#FFFFFF',total:c},
    {name:'F2L',  col:'#3B9EFF',total:f2lEnd-c},
    {name:'OLL',  col:'#FFD700',total:o-f2lEnd},
    {name:'PLL',  col:'#FF8000',total:p-o},
  ].map(s=>`<div style="font-size:11px;font-weight:700;color:${s.col}">${s.name}<br><span style="color:#fff;font-weight:800;font-size:15px">${fmt(s.total)}</span></div>`).join('');
}
let scAutoRaf=null, scAutoStart=0;

function scInverse(mv){
  if(!mv) return '';
  if(mv.endsWith("'")) return mv.slice(0,-1);
  if(mv.endsWith('2')) return mv;
  return mv+"'";
}

// Base face letter without modifiers, e.g. "R" from "R'", "R2", "Rw"
function scFaceBase(m){ return m.replace(/[2']/g,''); }

function scInCubeMode(){ return document.getElementById('pg-timer')?.classList.contains('cube-mode'); }

function scInitScramble(){
  if(!scInCubeMode()||!scConn) return;
  if(scAutoRaf){ cancelAnimationFrame(scAutoRaf); scAutoRaf=null; }
  const el=document.getElementById('scrTxt'); if(!el) return;
  scScrambleMoves=el.textContent.trim().split(/\s+/).filter(Boolean);
  scScrambleIdx=0; scMoveCount=0; scErrSeq=[]; scR2Dir=null; scErrDir=null;
  scPhase=scScrambleMoves.length?'scrambling':'idle';
  scHighlight();
}

function scHighlight(){
  const el=document.getElementById('scrTxt'); if(!el||!scScrambleMoves.length||!scConn) return;
  if(scPhase==='ready'){
    el.innerHTML='<span style="color:var(--green);font-weight:800;letter-spacing:.04em">Scramble done — start solving!</span>';
    return;
  }
  if(scErrSeq.length>0){
    // Hide scramble, show only the correction sequence
    const raw=scErrSeq.slice().reverse(); // first move to do is first in array
    // Compress consecutive identical moves (D D or D' D') into D2
    const todo=[]; let j=0;
    while(j<raw.length){
      if(j+1<raw.length&&raw[j]===raw[j+1]&&!raw[j].endsWith('2')){
        todo.push(raw[j].replace("'",'')+'2'); j+=2;
      } else { todo.push(raw[j]); j++; }
    }
    el.innerHTML=todo.map((m,i)=>
      i===0
        ? `<span style="background:var(--purple);color:#fff;border-radius:6px;padding:2px 8px;font-weight:900">${m}</span>`
        : `<span style="color:rgba(255,255,255,.45)">${m}</span>`
    ).join(' ');
    return;
  }
  el.innerHTML=scScrambleMoves.map((m,i)=>{
    if(i<scScrambleIdx) return `<span style="color:rgba(255,255,255,.2)">${m}</span>`;
    if(i===scScrambleIdx)
      return `<span style="background:var(--purple);color:#fff;border-radius:6px;padding:2px 8px;font-weight:900">${m}</span>`;
    return `<span style="color:#fff">${m}</span>`;
  }).join(' ');
}

function scClearHighlight(){
  if(scAutoRaf){ cancelAnimationFrame(scAutoRaf); scAutoRaf=null; } scAutoStart=0;
  scPhase='idle'; scScrambleMoves=[]; scScrambleIdx=0;
  if(typeof renderScramble==='function') renderScramble();
}

// OLL/PLL case detection (D cross only — cross on D, OLL/PLL on U face)
function scDetectOLL(fl) {
  if (!scCfopFace || scCfopFace.fc !== 'D') return null;
  const uc = fl[4];
  const top = [0,1,2,3,4,5,6,7,8].map(i => fl[i]===uc ? 1 : 0);
  // sides order: [B=[47,46,45], R=[11,10,9], F=[18,19,20], L=[36,37,38]]
  let s = [[47,46,45],[11,10,9],[18,19,20],[36,37,38]].map(ix=>ix.map(i=>fl[i]===uc?1:0));
  const rv = a => [a[2],a[1],a[0]];
  // rotT and rotS both rotate U' (CCW) so they stay consistent
  const rotT = t => [t[6],t[3],t[0],t[7],t[4],t[1],t[8],t[5],t[2]];
  const rotS = s => [rv(s[3]), s[0], rv(s[1]), s[2]];
  let ct=top, cs=s;
  for (let r=0; r<4; r++) {
    for (const o of OLL) {
      if (o.top.every((v,i)=>v===ct[i]) && o.sides.every((strip,si)=>strip.every((v,j)=>v===cs[si][j])))
        return o.id;
    }
    ct=rotT(ct); cs=rotS(cs);
  }
  return null;
}

function scDetectPLL(fl) {
  if (!scCfopFace || scCfopFace.fc !== 'D') return null;
  const L2P = {R:'R',F:'G',B:'B',L:'O',U:'W',D:'N'};
  // sides order: [F=[18,19,20], R=[9,10,11], B=[45,46,47], L=[38,37,36]]
  let cs = [[18,19,20],[9,10,11],[45,46,47],[38,37,36]].map(ix=>ix.map(i=>L2P[fl[i]]||'?'));
  const rv = a => [a[2],a[1],a[0]];
  const rotS = s => [rv(s[1]), s[2], rv(s[3]), s[0]];
  for (let r=0; r<4; r++) {
    for (const p of PLL) {
      if (p.sides.every((strip,si)=>strip.every((v,j)=>v===cs[si][j])))
        return p.id;
    }
    cs=rotS(cs);
  }
  return null;
}

function scDetectCubeRotation(oc,nc){
  // oc/nc = [U,R,F,D,L,B] center stickers at positions [4,13,22,31,40,49]
  const [ou,or_,of_,od,ol,ob]=oc,[nu,nr,nf,nd,nl,nb]=nc;
  // y: U/D unchanged; new F=old L, new R=old F, new B=old R, new L=old B
  if(nu===ou&&nd===od){
    if(nf===ol&&nr===of_&&nb===or_&&nl===ob) return 'y';
    if(nf===or_&&nl===of_&&nb===ol&&nr===ob) return "y'";
    if(nf===ob&&nr===ol&&nb===of_&&nl===or_) return 'y2';
  }
  // x: R/L unchanged; new U=old B, new F=old U, new D=old F, new B=old D
  if(nr===or_&&nl===ol){
    if(nu===ob&&nf===ou&&nd===of_&&nb===od) return 'x';
    if(nu===of_&&nf===od&&nd===ob&&nb===ou) return "x'";
    if(nu===od&&nf===ob&&nd===ou&&nb===of_) return 'x2';
  }
  // z: F/B unchanged; new U=old R, new R=old D, new D=old L, new L=old U
  if(nf===of_&&nb===ob){
    if(nu===or_&&nr===od&&nd===ol&&nl===ou) return 'z';
    if(nu===ol&&nr===ou&&nd===or_&&nl===od) return "z'";
    if(nu===od&&nr===ol&&nd===ou&&nl===or_) return 'z2';
  }
  return null;
}

function scDetectGyroRotation(){
  if(!scCubeGroup) return null;
  const T=window.THREE; if(!T) return null;
  const baseQ=scLastMoveQ||(new T.Quaternion()); // identity = white-top/green-front baseline
  // delta = inv(base) * currentQ = rotation since last face move (or since solve start)
  const inv=new T.Quaternion().copy(baseQ).invert();
  const rel=new T.Quaternion().copy(inv).multiply(scCubeGroup.quaternion);
  // Skip unless cube is nearly fully turned: |w|>0.71 means angle < ~89.5° (not a full quarter-turn yet)
  if(Math.abs(rel.w)>0.71) return null;
  const s=Math.SQRT2/2;
  const ROTS=[
    ['y',  0,s,0,s],["y'",0,-s,0,s],['y2',0,1,0,0],
    ['x',  s,0,0,s],["x'",-s,0,0,s],['x2',1,0,0,0],
    ['z',  0,0,s,s],["z'",0,0,-s,s],['z2',0,0,1,0],
  ];
  let best=null,bestDot=0.9,bestR=null;
  for(const[mv,rx,ry,rz,rw] of ROTS){
    const dot=Math.abs(rel.x*rx+rel.y*ry+rel.z*rz+rel.w*rw);
    if(dot>bestDot){bestDot=dot;best=mv;bestR=[rx,ry,rz,rw];}
  }
  if(!best) return null;
  // Snap idealQ = baseQ * ideal-rel-Q so the next detection starts from a perfect 90° baseline
  const [rx,ry,rz,rw]=bestR;
  const idealQ=new T.Quaternion(rx,ry,rz,rw).premultiply(baseQ);
  return {rot:best,idealQ};
}

// Update the WCA orientation tracker when a whole-cube rotation is injected
function scApplyWCARotation(rot){
  const o=scWCAOrientation;
  switch(rot){
    case'y':  scWCAOrientation={U:o.U,R:o.F,F:o.L,D:o.D,L:o.B,B:o.R};break;
    case"y'": scWCAOrientation={U:o.U,R:o.B,F:o.R,D:o.D,L:o.F,B:o.L};break;
    case'y2': scWCAOrientation={U:o.U,R:o.L,F:o.B,D:o.D,L:o.R,B:o.F};break;
    case'x':  scWCAOrientation={U:o.B,R:o.R,F:o.U,D:o.F,L:o.L,B:o.D};break;
    case"x'": scWCAOrientation={U:o.F,R:o.R,F:o.D,D:o.B,L:o.L,B:o.U};break;
    case'x2': scWCAOrientation={U:o.D,R:o.R,F:o.B,D:o.U,L:o.L,B:o.F};break;
    case'z':  scWCAOrientation={U:o.R,R:o.D,F:o.F,D:o.L,L:o.U,B:o.B};break;
    case"z'": scWCAOrientation={U:o.L,R:o.U,F:o.F,D:o.R,L:o.D,B:o.B};break;
    case'z2': scWCAOrientation={U:o.D,R:o.L,F:o.F,D:o.U,L:o.R,B:o.B};break;
  }
}

// Convert a cube-body-frame face move to WCA world frame using accumulated orientation.
// After a y CW rotation the cube body's 'F' layer is at WCA 'R', so 'F' → 'R'.
function scBodyToWCA(mv){
  if(!scWCAOrientation) return mv;
  const face=mv[0].toUpperCase(), suffix=mv.slice(1);
  for(const[wcaFace,bodyFace] of Object.entries(scWCAOrientation)){
    if(bodyFace===face) return wcaFace+suffix;
  }
  return mv;
}

function scCfopTick(fl, fromMove=false){
  if(scPhase!=='solving') return;
  const e=scAutoStart>0?Math.round(performance.now()-scAutoStart):0;
  if(fromMove){
    // Cube rotation detection: face moves don't change centers; center change = whole-cube rotation
    const CP=[4,13,22,31,40,49],curC=CP.map(i=>fl[i]);
    if(scLastCenters){
      const rot=scDetectCubeRotation(scLastCenters,curC);
      if(rot){
        const ins=scMoveLog.length-1;
        scMoveLog.splice(ins,0,rot);
        const bump=v=>(v!=null&&v>ins)?v+1:v;
        scCfopTimes.crossMI=bump(scCfopTimes.crossMI);
        scCfopTimes.f2lMI=bump(scCfopTimes.f2lMI);
        scCfopTimes.ollMI=bump(scCfopTimes.ollMI);
        scCfopTimes.f2lPairs.forEach(p=>{p.mi=bump(p.mi);});
        scPairFirst.forEach(p=>{if(p)p.mi=bump(p.mi);});
      }
    }
    scLastCenters=curC;
    const curSolved=scPairFirst.filter(p=>p!==null).length;
    if(scCfopTimes.cross!==null&&curSolved<4&&scCfopTimes.f2lNextStart===null) scCfopTimes.f2lNextStart=e;
    if(scCfopTimes.f2l!==null&&scCfopTimes.oll===null&&scCfopTimes.ollStart===null) scCfopTimes.ollStart=e;
    if(scCfopTimes.oll!==null&&scCfopTimes.pll===null&&scCfopTimes.pllStart===null) scCfopTimes.pllStart=e;
  }
  // Cross
  if(scCfopTimes.cross===null){
    const fd=scCheckCross(fl);
    if(fd){
      scCfopTimes.cross=e;scCfopTimes.crossMI=scMoveLog.length;scCfopTimes.crossFc=fd.fc;scCfopFace=fd;scPairFirst=[null,null,null,null];
      for(let pi=0;pi<4;pi++){
        if(fd.pairs[pi].every(([si,c])=>fl[si]===c)){
          scPairFirst[pi]={t:e,start:null,mi:scMoveLog.length,colors:[fd.pairs[pi][1][1],fd.pairs[pi][2][1]]};
        }
      }
      // Handle xcross (all 4 pre-solved at cross detection)
      if(scPairFirst.every(p=>p!==null)){
        scCfopTimes.f2lPairs=scPairFirst.slice().sort((a,b)=>a.t-b.t);
        scCfopTimes.f2l=e;scCfopTimes.f2lMI=scMoveLog.length;scCfopTimes.ollCase=scDetectOLL(fl);
      }
    }
  }
  // F2L pairs — record first detection per slot (immutable); complete only when all 4 simultaneously in slots
  if(scCfopFace&&scCfopTimes.f2l===null){
    const fd=scCfopFace;
    let solvedNow=0;
    for(let pi=0;pi<4;pi++){
      const ok=fd.pairs[pi].every(([si,c])=>fl[si]===c);
      if(ok){
        if(scPairFirst[pi]===null){
          scPairFirst[pi]={t:e,start:scCfopTimes.f2lNextStart,mi:scMoveLog.length,colors:[fd.pairs[pi][1][1],fd.pairs[pi][2][1]]};
          scCfopTimes.f2lNextStart=null;
        }
        solvedNow++;
      }
      // scPairFirst[pi] is NOT cleared when a piece temporarily leaves its slot
    }
    if(solvedNow===4){
      scCfopTimes.f2lPairs=scPairFirst.slice().sort((a,b)=>a.t-b.t);
      scCfopTimes.f2l=e;scCfopTimes.f2lMI=scMoveLog.length;scCfopTimes.ollCase=scDetectOLL(fl);
    }
  }
  // Retry OLL/PLL case detection on each tick until matched (handles BLE state desync at detection time)
  if(scCfopFace&&scCfopTimes.f2l!==null&&scCfopTimes.oll===null&&scCfopTimes.ollCase===null) scCfopTimes.ollCase=scDetectOLL(fl);
  if(scCfopFace&&scCfopTimes.oll!==null&&scCfopTimes.pll===null&&scCfopTimes.pllCase===null&&scCfopTimes.pllStart===null) scCfopTimes.pllCase=scDetectPLL(fl);
  // OLL
  if(scCfopFace&&scCfopTimes.f2l!==null&&scCfopTimes.oll===null&&fl!==SC_SOLVED&&scCheckOLL(fl,scCfopFace)){scCfopTimes.oll=e;scCfopTimes.ollMI=scMoveLog.length;if(!scCfopTimes.pllCase)scCfopTimes.pllCase=scDetectPLL(fl);}
  if(fl===SC_SOLVED){
    if(scCfopTimes.cross===null){scCfopTimes.cross=e;scCfopTimes.crossMI=scMoveLog.length;}
    while(scCfopTimes.f2lPairs.length<4)
      scCfopTimes.f2lPairs.push({t:e,start:scCfopTimes.f2lNextStart,mi:scMoveLog.length,colors:null});
    scCfopTimes.f2lNextStart=null;
    if(scCfopTimes.f2l===null){scCfopTimes.f2l=e;scCfopTimes.f2lMI=scMoveLog.length;}
    if(scCfopTimes.oll===null){scCfopTimes.oll=e;scCfopTimes.ollMI=scMoveLog.length;}
    scCfopTimes.pll=e;
    scUpdateCfopBar();
    scAutoTimerStop();scPhase='idle';
    scInitScramble();
  }
}

function scAutoTimerStart(){
  if(scAutoStart>0) return;
  scAutoStart=performance.now();
  const el=document.getElementById('timerDisp'); if(el) el.className='running';
  (function tick(){
    if(scAutoStart===0) return;
    const t=(performance.now()-scAutoStart)/1000;
    const d=document.getElementById('timerDisp');
    if(d) d.textContent=t<60?t.toFixed(3):`${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`;
    scAutoRaf=requestAnimationFrame(tick);
  })();
}

function scAutoTimerStop(){
  if(scAutoStart===0) return;
  const ms=Math.round(performance.now()-scAutoStart);
  scAutoStart=0;
  if(scAutoRaf){ cancelAnimationFrame(scAutoRaf); scAutoRaf=null; }
  const tEl=document.getElementById('s-turns'), pEl=document.getElementById('s-tps');
  if(tEl) tEl.textContent=scSolveMoves;
  if(pEl) pEl.textContent=ms>0?(scSolveMoves/(ms/1000)).toFixed(2):'–';
  scPendingSolveData={cfop:{...scCfopTimes},moves:[...scMoveLog],startFl:scStartFl};
  stopTimer(ms);
  scPendingSolveData=null;
}

// ─── MOVE ANIMATION ──────────────────────────────────────────────────────────
function scEnqueue(mv){
  const prevFl=scCurrentFacelets;
  scCurrentFacelets=scApplyMove(scCurrentFacelets,mv);

  if(scInCubeMode()){
    if(scPhase==='scrambling'){
      if(scErrSeq.length>0){
        // error recovery: next needed correction is at the top of the stack
        const need=scErrSeq[scErrSeq.length-1];
        const needBase=scFaceBase(need), mvBase=scFaceBase(mv);
        const isPair=scErrSeq.length>=2&&scErrSeq[scErrSeq.length-2]===need&&!need.endsWith('2');
        if(scErrDir){
          // already locked into a direction for a paired correction (U2 either way)
          if(mv===scErrDir){
            scErrSeq.pop(); scErrDir=null;
            if(scErrSeq.length===0){ scMoveCount=0; scR2Dir=null; }
          } else {
            scErrSeq.push(scInverse(scErrDir)); scErrDir=null; // undo locked first half
            scErrSeq.push(scInverse(mv));
          }
        } else if(mv===need){
          scErrSeq.pop();
          if(scErrSeq.length===0){ scMoveCount=0; scR2Dir=null; }
        } else if(isPair&&mvBase===needBase){
          // same face, opposite direction — accept as first half of a 180° correction
          scErrSeq.pop(); scErrDir=mv;
        } else {
          scErrSeq.push(scInverse(mv));
        }
        scHighlight();
      } else {
        const cur=scScrambleMoves[scScrambleIdx];
        const isDouble=cur?.endsWith('2');
        const base=scFaceBase(cur||'');
        const mvBase=scFaceBase(mv);
        let correct=false;
        if(isDouble){
          if(scMoveCount===0){
            // accept R or R' for R2 — any direction on the right face
            correct=(mvBase===base);
            if(correct) scR2Dir=mv; // lock in direction for 2nd event
          } else {
            // 2nd event must match the locked direction
            correct=(mv===scR2Dir);
          }
        } else {
          correct=(mv===cur);
        }
        if(correct){
          scMoveCount++;
          if(scMoveCount>=(isDouble?2:1)){
            scMoveCount=0; scR2Dir=null; scScrambleIdx++;
            if(scScrambleIdx>=scScrambleMoves.length){ scPhase='ready'; scHighlight(); }
            else scHighlight();
          }
        } else {
          // wrong move — push correction for any partial R2 progress, then for the wrong move
          if(scMoveCount>0&&scR2Dir) scErrSeq.push(scInverse(scR2Dir)); // undo locked R2 first half (done last)
          scMoveCount=0; scR2Dir=null;
          scErrSeq.push(scInverse(mv)); // undo wrong move (done first, on top)
          scHighlight();
        }
      }
    } else if(scPhase==='ready'){
      scPhase='solving'; scSolveMoves=0; scMoveLog=[];
      scStartFl=prevFl; scLastCenters=null; scLastMoveQ=null;
      scWCAOrientation={U:'U',R:'R',F:'F',D:'D',L:'L',B:'B'};
      scCfopTimes={cross:null,crossMI:null,crossFc:null,f2lPairs:[],f2lNextStart:null,f2l:null,f2lMI:null,oll:null,ollStart:null,ollMI:null,pll:null,pllStart:null,ollCase:null,pllCase:null};
      scPairFirst=[null,null,null,null]; scCfopFace=null;
      const el=document.getElementById('scrTxt'); if(el) el.textContent=scScrambleMoves.join(' ');
      scAutoTimerStart();
      if(scCurrentFacelets===SC_SOLVED){ scAutoTimerStop(); scPhase='idle'; scInitScramble(); }
      else {
        const gr=scDetectGyroRotation();
        if(gr){scMoveLog.push(gr.rot);scApplyWCARotation(gr.rot);scLastMoveQ=gr.idealQ;}
        else if(scCubeGroup) scLastMoveQ=scCubeGroup.quaternion.clone();
        scSolveMoves++; scMoveLog.push(scBodyToWCA(mv)); scCfopTick(scCurrentFacelets, true);
      }
    } else if(scPhase==='solving'){
      const gr=scDetectGyroRotation();
      if(gr){scMoveLog.push(gr.rot);scApplyWCARotation(gr.rot);scLastMoveQ=gr.idealQ;}
      else if(scCubeGroup) scLastMoveQ=scCubeGroup.quaternion.clone();
      scSolveMoves++;
      scMoveLog.push(scBodyToWCA(mv));
      scCfopTick(scCurrentFacelets, true);
    }
  }

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
  const T=window.THREE;
  // Whole-cube rotation moves (x/y/z)
  const CR={'y':{a:'y',m:1},"y'":{a:'y',m:-1},'y2':{a:'y',m:2},'x':{a:'x',m:1},"x'":{a:'x',m:-1},'x2':{a:'x',m:2},'z':{a:'z',m:1},"z'":{a:'z',m:-1},'z2':{a:'z',m:2}};
  if(CR[mv]&&scCubeGroup){
    const{a,m}=CR[mv],angle=(Math.PI/2)*m;
    const pd=Object.entries(scCubies).map(([k,mesh])=>({mesh,key:k}));
    if(!pd.length){done();return;}
    const pivot=new T.Group();scCubeGroup.add(pivot);
    pd.forEach(({mesh})=>{scCubeGroup.remove(mesh);pivot.add(mesh);});
    const setR=ang=>{if(a==='x')pivot.rotation.x=ang;else if(a==='y')pivot.rotation.y=ang;else pivot.rotation.z=ang;};
    const finish=()=>{setR(angle);pivot.updateMatrixWorld(true);scDetach(pivot,pd);done();};
    if(instant){finish();return;}
    const dur=Math.abs(m)===2?200:150,t0=performance.now();
    (function fr(now){const t=Math.min(1,(now-t0)/dur),e=t<0.5?2*t*t:-1+(4-2*t)*t;setR(angle*e);if(t<1)requestAnimationFrame(fr);else finish();})(performance.now());
    return;
  }
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

  const pivot=new T.Group(); scCubeGroup.add(pivot);
  pd.forEach(({mesh})=>{scCubeGroup.remove(mesh);pivot.add(mesh);});

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
  // Compute each mesh's transform in scCubeGroup-local space.
  // Using group-local space (not world) means integer position snapping
  // is unaffected by the gyro quaternion applied to scCubeGroup.
  const groupInvQ=scCubeGroup.quaternion.clone().invert();
  const lt=pd.map(({mesh})=>{
    const wp=new T.Vector3(),wq=new T.Quaternion();
    mesh.getWorldPosition(wp); mesh.getWorldQuaternion(wq);
    scCubeGroup.worldToLocal(wp);
    return{p:wp, q:groupInvQ.clone().multiply(wq)};
  });
  const updates=pd.map(({mesh,key},i)=>{
    pivot.remove(mesh); scCubeGroup.add(mesh);
    mesh.position.copy(lt[i].p); mesh.quaternion.copy(lt[i].q);
    mesh.position.x=Math.round(mesh.position.x);
    mesh.position.y=Math.round(mesh.position.y);
    mesh.position.z=Math.round(mesh.position.z);
    return{mesh,oldKey:key,newKey:`${mesh.position.x},${mesh.position.y},${mesh.position.z}`};
  });
  // Two-phase: delete all old keys first, then write new keys.
  // Single-pass delete+write causes collisions when one piece's new key
  // matches another's old key, evicting the wrong entry from scCubies.
  updates.forEach(({oldKey})=>delete scCubies[oldKey]);
  updates.forEach(({mesh,newKey})=>scCubies[newKey]=mesh);
  scCubeGroup.remove(pivot);
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function scSetStatus(t){ const el=document.getElementById('scStatus');if(el)el.textContent=t; }
function scSetBattery(t){ const el=document.getElementById('scBattery');if(el)el.textContent=t; }
function scSetDevice(t){ const el=document.getElementById('scDevice');if(el)el.textContent=t; }

function scSetConnUI(on){
  const c=document.getElementById('scConnBtn'),d=document.getElementById('scDisconnBtn');
  if(c)c.style.display=on?'none':'flex';
  if(d)d.style.display=on?'':'none';
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
    scSetDevice('');
    setTimeout(scInitScramble,100);

    // Reset cube to solved, then sync real state
    scCurrentFacelets=SC_SOLVED;
    scMoveQueue.length=0;
    scUpdateColors(SC_SOLVED);

    scSub=scConn.events$.subscribe({
      next(ev){
        switch(ev.type){
          case 'MOVE':    scEnqueue(ev.move); break;
          case 'FACELETS': scCurrentFacelets=ev.facelets; if(!scQueueRunning)scUpdateColors(scCurrentFacelets); scCfopTick(scCurrentFacelets); break;
          case 'BATTERY':  scSetBattery(ev.batteryLevel+'%'); break;
          case 'HARDWARE': if(ev.hardwareName)scSetStatus('Connected — '+ev.hardwareName); break;
          case 'GYRO': if(scCubeGroup){ const T=window.THREE; if(!scLastGyroQ) scLastGyroQ=new T.Quaternion(); const q=ev.quaternion; scLastGyroQ.set(q.x,q.y,q.z,q.w); if(!scGyroOffset){ scGyroOffset=new T.Quaternion().copy(scLastGyroQ).invert(); if(!scGyroAppliedQ) scGyroAppliedQ=new T.Quaternion(); scCubeGroup.quaternion.identity(); scGyroAppliedQ.identity(); } else { const tQ=new T.Quaternion().copy(scGyroOffset).multiply(scLastGyroQ); if(!scGyroAppliedQ) scGyroAppliedQ=new T.Quaternion(); const ang=2*Math.acos(Math.min(1,Math.abs(scGyroAppliedQ.dot(tQ)))); if(ang>0.15){ scCubeGroup.quaternion.copy(tQ); scGyroAppliedQ.copy(tQ); } } } break;
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
  if(scAutoRaf){ cancelAnimationFrame(scAutoRaf); scAutoRaf=null; } scAutoStart=0;
  scPhase='idle'; scErrSeq=[]; scMoveCount=0; scErrDir=null;
  if(typeof renderScramble==='function') renderScramble(); // restore plain text
  scSetStatus(''); scSetBattery(''); scSetDevice(''); scSetConnUI(false);
}

async function scDisconnect(){ try{await scConn?.disconnect();}catch(e){} scHandleDisconn(); }

async function scReset(){
  // Stop any running auto-timer
  if(scAutoRaf){ cancelAnimationFrame(scAutoRaf); scAutoRaf=null; } scAutoStart=0;
  // Reset virtual cube
  scCurrentFacelets=SC_SOLVED; scMoveQueue.length=0; scQueueRunning=false;
  scUpdateColors(SC_SOLVED);
  // Generate a new scramble and re-init tracking
  scErrSeq=[]; scMoveCount=0; scErrDir=null;
  scPhase='idle';
  if(typeof pushScramble==='function') pushScramble();
  if(typeof renderScramble==='function') renderScramble();
  scInitScramble();
  // Try physical cube reset if supported
  if(scConn?.capabilities?.reset) try{await scConn.sendCommand({type:'REQUEST_RESET'});}catch(e){}
}

// ─── INIT & WIRING ───────────────────────────────────────────────────────────

// Init 3D scene as soon as the script loads (Three.js already loaded via <script>)
(function(){
  const wrap=document.getElementById('sc3dWrap');
  if(wrap&&window.THREE) scInitScene(wrap);
})();

function scResetGyro(){
  const T=window.THREE; if(!T||!scCubeGroup) return;
  if(!scGyroOffset) scGyroOffset=new T.Quaternion();
  if(!scGyroAppliedQ) scGyroAppliedQ=new T.Quaternion();
  if(scLastGyroQ) scGyroOffset.copy(scLastGyroQ).invert();
  else scGyroOffset.identity();
  scCubeGroup.quaternion.identity();
  scGyroAppliedQ.identity();
}

document.getElementById('scConnBtn')?.addEventListener('click', scConnect);
document.getElementById('scDisconnBtn')?.addEventListener('click', scDisconnect);
document.getElementById('scResetBtn')?.addEventListener('click', scReset);
document.getElementById('scGyroBtn')?.addEventListener('click', scResetGyro);

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
  setTimeout(scInitScramble,50);
});
document.querySelectorAll('.ac[data-mode]').forEach(btn=>{
  btn.addEventListener('click',()=>{ if(btn.dataset.mode!=='cube'){ scStopRender(); scClearHighlight(); } });
});

// Rebuild FI_DIRS now that THREE is available
(function(){
  const T=window.THREE; if(!T) return;
  SC_FI_DIRS[0]=new T.Vector3(1,0,0); SC_FI_DIRS[1]=new T.Vector3(-1,0,0);
  SC_FI_DIRS[2]=new T.Vector3(0,1,0); SC_FI_DIRS[3]=new T.Vector3(0,-1,0);
  SC_FI_DIRS[4]=new T.Vector3(0,0,1); SC_FI_DIRS[5]=new T.Vector3(0,0,-1);
})();
