// ─── SOLVE REPLAY ─────────────────────────────────────────────────────────────
// Depends on globals from smartcube.js: THREE, SC_COLORS, SC_INNER, SC_S2F,
// SC_FI_DIRS, SC_FACE_MOVES, scApplyMove, scMakeRoundedSticker

let rpScene=null,rpCamera=null,rpRenderer=null,rpGroup=null;
let rpCubies={},rpRafId=null,rpRendering=false;
let rpFacelets='',rpMoves=[],rpStates=[],rpIdx=0;
let rpPlaying=false,rpSpeed=1,rpAnimating=false,rpGyroEnabled=false;

// ── Facelets permutation tables for whole-cube rotations ─────────────────────
let RP_ROT_PERMS=null;
// Unit vectors for each face index (R,L,U,D,F,B = 0..5)
const RP_FI_VECS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function rpGetPerms(){
  if(RP_ROT_PERMS) return RP_ROT_PERMS;
  // Key includes both cubie position AND face direction so corners/edges don't collide
  const posToIdx={};
  for(let i=0;i<54;i++){const s=SC_S2F[i];if(s)posToIdx[`${s.key}_${s.fi}`]=i;}

  function transformFi(fn,fi){
    const [fdx,fdy,fdz]=RP_FI_VECS[fi];
    const [nx,ny,nz]=fn(fdx,fdy,fdz);
    let best=fi,bestD=-Infinity;
    for(let j=0;j<6;j++){
      const [vx,vy,vz]=RP_FI_VECS[j];
      const d=vx*nx+vy*ny+vz*nz;
      if(d>bestD){bestD=d;best=j;}
    }
    return best;
  }

  function make(fn){
    const p=new Array(54).fill(-1);
    for(let i=0;i<54;i++){
      const s=SC_S2F[i];if(!s){p[i]=i;continue;}
      const [x,y,z]=s.key.split(',').map(Number);
      const [nx,ny,nz]=fn(x,y,z);
      const newFi=transformFi(fn,s.fi);
      p[i]=posToIdx[`${Math.round(nx)},${Math.round(ny)},${Math.round(nz)}_${newFi}`]??i;
    }
    return p;
  }

  // y CW from top: (x,y,z)→(z,y,-x)
  // x CW from right: (x,y,z)→(x,-z,y)
  // z CW from front: (x,y,z)→(-y,x,z)
  RP_ROT_PERMS={
    'y' :make((x,y,z)=>[ z, y,-x]),
    "y'":make((x,y,z)=>[-z, y, x]),
    'y2':make((x,y,z)=>[-x, y,-z]),
    'x' :make((x,y,z)=>[ x,-z, y]),
    "x'":make((x,y,z)=>[ x, z,-y]),
    'x2':make((x,y,z)=>[ x,-y,-z]),
    'z' :make((x,y,z)=>[-y, x, z]),
    "z'":make((x,y,z)=>[ y,-x, z]),
    'z2':make((x,y,z)=>[-x,-y, z]),
  };
  return RP_ROT_PERMS;
}

function rpApplyMove(fl,mv){
  const perms=rpGetPerms();
  const perm=perms[mv];
  if(perm){
    const r=new Array(54);
    for(let i=0;i<54;i++) r[perm[i]]=fl[i];
    return r.join('');
  }
  return scApplyMove(fl,mv);
}

// ── Scene ────────────────────────────────────────────────────────────────────
function rpInit(){
  if(rpScene) return;
  const T=window.THREE; if(!T) return;
  const wrap=document.getElementById('mo-rp-canvas'); if(!wrap) return;
  const W=wrap.clientWidth||300,H=wrap.clientHeight||190;
  rpRenderer=new T.WebGLRenderer({antialias:true,alpha:true});
  rpRenderer.setSize(W,H);
  rpRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  wrap.appendChild(rpRenderer.domElement);
  rpScene=new T.Scene();
  rpCamera=new T.PerspectiveCamera(55,W/H,0.1,100);
  rpCamera.position.set(-2.2,2.8,6.5); rpCamera.lookAt(1.2,0,0);
  rpScene.add(new T.AmbientLight(0xffffff,0.8));
  const dl=new T.DirectionalLight(0xffffff,1.0); dl.position.set(4,8,6); rpScene.add(dl);
  const dl2=new T.DirectionalLight(0xffffff,0.3); dl2.position.set(-3,-4,-3); rpScene.add(dl2);
  rpBuildCubies();
}

function rpBuildCubies(){
  const T=window.THREE; if(!T) return;
  if(rpGroup){
    rpScene.remove(rpGroup);
    // dispose children
    rpGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose?.();});
  }
  rpGroup=new T.Group(); rpScene.add(rpGroup);
  rpCubies={};
  const OFF=0.473;
  const sGeo=scMakeRoundedSticker(0.82,0.09);
  const FACE=[
    {p:[OFF,0,0],r:[0,Math.PI/2,0]},{p:[-OFF,0,0],r:[0,-Math.PI/2,0]},
    {p:[0,OFF,0],r:[-Math.PI/2,0,0]},{p:[0,-OFF,0],r:[Math.PI/2,0,0]},
    {p:[0,0,OFF],r:[0,0,0]},{p:[0,0,-OFF],r:[0,Math.PI,0]},
  ];
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
    if(!x&&!y&&!z) continue;
    const body=new T.Mesh(new T.BoxGeometry(0.94,0.94,0.94),
      new T.MeshPhongMaterial({color:0x1c1c1c,shininess:12}));
    body.position.set(x,y,z); rpGroup.add(body);
    const stickers=FACE.map(({p,r})=>{
      const mat=new T.MeshBasicMaterial({color:SC_INNER});
      const s=new T.Mesh(sGeo,mat);
      s.position.set(...p); s.rotation.set(...r); body.add(s);
      return mat;
    });
    body.userData.stickers=stickers;
    rpCubies[`${x},${y},${z}`]=body;
  }
}

function rpGetLocalFi(mesh,gi){
  const T=window.THREE;
  const gv=SC_FI_DIRS[gi].clone().applyQuaternion(mesh.quaternion.clone().invert());
  let best=0,bestD=-Infinity;
  for(let j=0;j<6;j++){const d=SC_FI_DIRS[j].dot(gv);if(d>bestD){bestD=d;best=j;}}
  return best;
}

function rpUpdateColors(facelets){
  if(!rpScene) return;
  for(let i=0;i<54;i++){
    const sf=SC_S2F[i]; if(!sf) continue;
    const c=rpCubies[sf.key]; if(!c) continue;
    const fi=rpGetLocalFi(c,sf.fi);
    c.userData.stickers[fi].color.setHex(SC_COLORS[facelets[i]]??SC_INNER);
  }
}

function rpDetach(pivot,pd){
  const T=window.THREE;
  const gInvQ=rpGroup.quaternion.clone().invert();
  const lt=pd.map(({mesh})=>{
    const wp=new T.Vector3(),wq=new T.Quaternion();
    mesh.getWorldPosition(wp); mesh.getWorldQuaternion(wq);
    rpGroup.worldToLocal(wp);
    return{p:wp,q:gInvQ.clone().multiply(wq)};
  });
  const ups=pd.map(({mesh,key},i)=>{
    pivot.remove(mesh); rpGroup.add(mesh);
    mesh.position.copy(lt[i].p); mesh.quaternion.copy(lt[i].q);
    mesh.position.x=Math.round(mesh.position.x);
    mesh.position.y=Math.round(mesh.position.y);
    mesh.position.z=Math.round(mesh.position.z);
    return{mesh,oldKey:key,newKey:`${mesh.position.x},${mesh.position.y},${mesh.position.z}`};
  });
  ups.forEach(({oldKey})=>delete rpCubies[oldKey]);
  ups.forEach(({mesh,newKey})=>rpCubies[newKey]=mesh);
  rpGroup.remove(pivot);
}

// ── Move animation ───────────────────────────────────────────────────────────
const RP_CR={'y':{a:'y',m:1},"y'":{a:'y',m:-1},'y2':{a:'y',m:2},
             'x':{a:'x',m:1},"x'":{a:'x',m:-1},'x2':{a:'x',m:2},
             'z':{a:'z',m:1},"z'":{a:'z',m:-1},'z2':{a:'z',m:2}};

function rpPerformMove(mv,instant,done){
  const T=window.THREE; if(!T){done();return;}
  const cr=RP_CR[mv];
  if(cr){
    const{a,m}=cr,angle=(Math.PI/2)*m;
    const pd=Object.entries(rpCubies).map(([k,mesh])=>({mesh,key:k}));
    if(!pd.length){done();return;}
    const pivot=new T.Group(); rpGroup.add(pivot);
    pd.forEach(({mesh})=>{rpGroup.remove(mesh);pivot.add(mesh);});
    const setR=ang=>{if(a==='x')pivot.rotation.x=ang;else if(a==='y')pivot.rotation.y=ang;else pivot.rotation.z=ang;};
    const finish=()=>{setR(angle);pivot.updateMatrixWorld(true);rpDetach(pivot,pd);done();};
    if(instant){finish();return;}
    const dur=(Math.abs(m)===2?200:150)/rpSpeed,t0=performance.now();
    (function fr(now){const t=Math.min(1,(now-t0)/dur),e=t<.5?2*t*t:-1+(4-2*t)*t;setR(angle*e);if(t<1)requestAnimationFrame(fr);else finish();})(performance.now());
    return;
  }
  const face=mv[0].toUpperCase(),mod=mv.slice(1).trim();
  const def=SC_FACE_MOVES[face]; if(!def){done();return;}
  const mult=mod==="'"?-1:mod==='2'?2:1,target=def.angle*mult;
  const{axis,layer}=def;
  const pd=[];
  for(const key in rpCubies){
    const mesh=rpCubies[key];
    const coord=axis==='x'?mesh.position.x:axis==='y'?mesh.position.y:mesh.position.z;
    if(Math.abs(coord-layer)<0.15) pd.push({mesh,key});
  }
  if(!pd.length){done();return;}
  const pivot=new T.Group(); rpGroup.add(pivot);
  pd.forEach(({mesh})=>{rpGroup.remove(mesh);pivot.add(mesh);});
  const setR=a=>{if(axis==='x')pivot.rotation.x=a;else if(axis==='y')pivot.rotation.y=a;else pivot.rotation.z=a;};
  const finish=()=>{setR(target);pivot.updateMatrixWorld(true);rpDetach(pivot,pd);done();};
  if(instant){finish();return;}
  const dur=(Math.abs(mult)===2?175:125)/rpSpeed,t0=performance.now();
  (function fr(now){const t=Math.min(1,(now-t0)/dur),e=t<.5?2*t*t:-1+(4-2*t)*t;setR(target*e);if(t<1)requestAnimationFrame(fr);else finish();})(performance.now());
}

// ── Render loop ──────────────────────────────────────────────────────────────
function rpStartRender(){
  if(rpRendering||!rpRenderer) return;
  rpRendering=true;
  (function loop(){
    if(!rpRendering) return;
    rpRafId=requestAnimationFrame(loop);
    if(rpGyroEnabled&&rpGroup&&window.scCubeGroup) rpGroup.quaternion.copy(window.scCubeGroup.quaternion);
    rpRenderer.render(rpScene,rpCamera);
  })();
}
function rpStopRender(){
  rpRendering=false;
  if(rpRafId){cancelAnimationFrame(rpRafId);rpRafId=null;}
}

// ── State navigation ─────────────────────────────────────────────────────────
// Jump to move index (instant, rebuilds cube)
function rpGoTo(idx,cb){
  idx=Math.max(0,Math.min(idx,rpMoves.length));
  rpAnimating=true;
  rpBuildCubies();
  let i=0;
  function next(){
    if(i>=idx){
      rpUpdateColors(rpStates[idx]);
      rpIdx=idx; rpAnimating=false; rpUpdateUI();
      if(cb)cb(); return;
    }
    rpPerformMove(rpMoves[i++],true,next);
  }
  next();
}

// Advance delta steps (with animation if forward, instant rebuild if backward)
function rpStepAnim(delta,cb){
  if(rpAnimating){if(cb)cb();return;}
  const target=Math.max(0,Math.min(rpIdx+delta,rpMoves.length));
  if(target===rpIdx){if(cb)cb();return;}
  if(target<rpIdx){rpGoTo(target,cb);return;}
  rpAnimating=true;
  let i=rpIdx;
  function fwd(){
    if(i>=target){rpIdx=i;rpAnimating=false;rpUpdateUI();if(cb)cb();return;}
    rpPerformMove(rpMoves[i],false,()=>{
      i++;
      if(rpStates[i]) rpUpdateColors(rpStates[i]);
      rpUpdateUI(); fwd();
    });
  }
  fwd();
}

function rpPlayNext(){
  if(!rpPlaying||rpIdx>=rpMoves.length){rpPlaying=false;rpUpdateUI();return;}
  rpStepAnim(1,rpPlayNext);
}
function rpPlay(){
  if(rpIdx>=rpMoves.length){rpGoTo(0,()=>{rpPlaying=true;rpUpdateUI();rpPlayNext();});return;}
  rpPlaying=true; rpUpdateUI(); rpPlayNext();
}
function rpPause(){rpPlaying=false;rpUpdateUI();}

// ── UI ───────────────────────────────────────────────────────────────────────
function rpUpdateUI(){
  const count=document.getElementById('mo-rp-count');
  const playBtn=document.getElementById('mo-rp-play');
  const prog=document.getElementById('mo-rp-prog');
  const n=rpMoves.length;
  if(count) count.textContent=`${rpIdx} / ${n}`;
  if(playBtn) playBtn.textContent=rpPlaying?'⏸':'▶';
  if(prog){prog.max=n;prog.value=rpIdx;}
}


// ── Public entry point ───────────────────────────────────────────────────────
let rpShowingNet=false;

function rpSetView(showNet){
  rpShowingNet=showNet;
  const canvas=document.getElementById('mo-rp-canvas');
  const net=document.getElementById('mo-net');
  const icoNet=document.getElementById('mo-rp-ico-net');
  const ico3d=document.getElementById('mo-rp-ico-3d');
  if(canvas) canvas.style.display=showNet?'none':'';
  if(net) net.style.display=showNet?'':'none';
  if(icoNet) icoNet.style.display=showNet?'none':'';
  if(ico3d) ico3d.style.display=showNet?'':'none';
  if(!showNet) rpStartRender(); else rpStopRender();
}

function rpOpen(solve){
  const bar=document.getElementById('mo-rp-bar');
  const tog=document.getElementById('mo-rp-toggle');
  const canvas=document.getElementById('mo-rp-canvas');
  const net=document.getElementById('mo-net');
  if(!solve||!solve.moves||solve.moves.length===0){
    if(bar) bar.style.display='none';
    if(tog) tog.style.display='none';
    if(canvas) canvas.style.display='none';
    if(net) net.style.display='';
    rpPause(); rpStopRender();
    return;
  }
  if(bar) bar.style.display='';
  if(tog) tog.style.display='';
  rpShowingNet=false;
  rpSetView(false);
  rpInit();
  // Pre-compute facelets at every move index
  const startFl=solve.startFl||SC_SOLVED;
  rpMoves=solve.moves;
  rpStates=[startFl];
  let fl=startFl;
  for(const mv of rpMoves){fl=rpApplyMove(fl,mv);rpStates.push(fl);}
  rpPause();
  rpGoTo(0);
  rpStartRender();
}

function rpClose(){
  rpPause();
  rpStopRender();
  rpGyroEnabled=false;
  const btn=document.getElementById('mo-rp-gyro');
  if(btn) btn.style.opacity='.4';
  if(rpGroup) rpGroup.quaternion.identity();
}

// ── Controls ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('mo-rp-play')?.addEventListener('click',()=>{
    if(rpPlaying) rpPause(); else rpPlay();
  });
  document.getElementById('mo-rp-bk')?.addEventListener('click',()=>{rpPause();rpStepAnim(-1);});
  document.getElementById('mo-rp-fwd')?.addEventListener('click',()=>{rpPause();rpStepAnim(1);});
  document.getElementById('mo-rp-speed')?.addEventListener('change',e=>{rpSpeed=+e.target.value;});
  document.getElementById('mo-rp-prog')?.addEventListener('input',e=>{
    rpPause();
    if(!rpAnimating) rpGoTo(+e.target.value);
  });
  document.getElementById('mo-rp-toggle')?.addEventListener('click',()=>{
    rpSetView(!rpShowingNet);
  });
  document.getElementById('mo-rp-gyro')?.addEventListener('click',()=>{
    rpGyroEnabled=!rpGyroEnabled;
    const btn=document.getElementById('mo-rp-gyro');
    if(btn) btn.style.opacity=rpGyroEnabled?'1':'.4';
    if(!rpGyroEnabled&&rpGroup) rpGroup.quaternion.identity();
  });
});
