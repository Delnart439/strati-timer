
// ── BLUETOOTH DROPDOWN ──
const btDropdown = document.getElementById('btDropdown');
document.getElementById('btBtn').addEventListener('click', e=>{
  e.stopPropagation();
  const open = btDropdown.style.display !== 'none';
  btDropdown.style.display = open ? 'none' : '';
  if (!open) lucide.createIcons();
});
document.addEventListener('click', e=>{
  if (!document.getElementById('btBtnWrap').contains(e.target)) btDropdown.style.display = 'none';
});
const helpModal = document.getElementById('helpModal');
document.getElementById('helpBtn').addEventListener('click', ()=>{ helpModal.classList.remove('h'); lucide.createIcons(); });
document.getElementById('helpModalClose').addEventListener('click', ()=>helpModal.classList.add('h'));
helpModal.addEventListener('click', e=>{ if(e.target===helpModal) helpModal.classList.add('h'); });

// ── GAN SMART TIMER BLE ──
const GAN_SVC = '0000fff0-0000-1000-8000-00805f9b34fb';
const GAN_STATE_CHAR = '0000fff5-0000-1000-8000-00805f9b34fb';
const GAN_ST = { DISCONNECT:0, GET_SET:1, HANDS_OFF:2, RUNNING:3, STOPPED:4, IDLE:5, HANDS_ON:6, FINISHED:7 };
let ganDevice = null;

function crc16ccit(buff) {
  const dv = new DataView(buff);
  let crc = 0xFFFF;
  for (let i = 0; i < dv.byteLength; i++) {
    crc ^= dv.getUint8(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc;
}

function validateGanPkt(data) {
  if (!data || data.byteLength < 4 || data.getUint8(0) !== 0xFE) return false;
  try {
    const pktCRC = data.getUint16(data.byteLength - 2, true);
    const calcCRC = crc16ccit(data.buffer.slice(data.byteOffset + 2, data.byteOffset + data.byteLength - 2));
    return pktCRC === calcCRC;
  } catch { return false; }
}

function setGanUI(connected, name) {
  ganConnected = connected;
  const dot = document.getElementById('btDot');
  const statusEl = document.getElementById('btStatus');
  const scanBtn = document.getElementById('btScanBtn');
  const disconnBtn = document.getElementById('btDisconnBtn');
  if (dot) dot.style.display = connected ? '' : 'none';
  if (connected) {
    if (statusEl) statusEl.innerHTML = `<div style="color:var(--green);font-weight:700;font-size:14px">● Connected</div><div style="font-size:12px;color:var(--dim);margin-top:4px">${name}</div>`;
    if (scanBtn) scanBtn.style.display = 'none';
    if (disconnBtn) { disconnBtn.style.display = 'flex'; }
  } else {
    if (statusEl) statusEl.textContent = 'Press scan to search for nearby Bluetooth timers.';
    if (scanBtn) scanBtn.style.display = '';
    if (disconnBtn) disconnBtn.style.display = 'none';
  }
}

function onGanEvent(event) {
  const data = event.target.value;
  if (!validateGanPkt(data)) return;
  const s = data.getUint8(3);
  switch (s) {
    case GAN_ST.HANDS_ON:
      if (state.timerState === 'idle' || state.timerState === 'stopped') setTimerState('holding');
      break;
    case GAN_ST.GET_SET:
      if (state.timerState === 'holding') setTimerState('ready');
      break;
    case GAN_ST.RUNNING:
      if (state.timerState === 'ready' || state.timerState === 'holding') startTimer();
      break;
    case GAN_ST.STOPPED:
      if (state.timerState === 'running') {
        const min = data.getUint8(4), sec = data.getUint8(5), ms = data.getUint16(6, true);
        stopTimer((min * 60 + sec) * 1000 + ms);
      }
      break;
    case GAN_ST.HANDS_OFF:
    case GAN_ST.IDLE:
      if (state.timerState === 'holding' || state.timerState === 'ready') setTimerState('idle');
      else if (state.timerState === 'stopped') {
        setTimerState('idle');
        document.getElementById('timerDisp').textContent = '0.000';
      }
      break;
  }
}

document.getElementById('btScanBtn').addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    document.getElementById('btUnsupported').style.display = 'block';
    return;
  }
  const statusEl = document.getElementById('btStatus');
  const scanBtn = document.getElementById('btScanBtn');
  scanBtn.disabled = true;
  scanBtn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px"></i> Searching…';
  lucide.createIcons();
  statusEl.innerHTML = '<span style="color:var(--purple)">Scanning…</span> Select your Bluetooth timer from the browser dialog.';
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [GAN_SVC] }, { namePrefix: 'GAN' }],
      optionalServices: [GAN_SVC]
    });
    ganDevice = device;
    statusEl.innerHTML = '<span style="color:var(--purple)">Connecting…</span>';
    device.addEventListener('gattserverdisconnected', () => {
      ganDevice = null;
      setGanUI(false);
      if (state.timerState === 'holding' || state.timerState === 'ready' || state.timerState === 'running') {
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        setTimerState('idle');
        document.getElementById('timerDisp').textContent = '0.000';
      }
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(GAN_SVC);
    const char = await service.getCharacteristic(GAN_STATE_CHAR);
    char.addEventListener('characteristicvaluechanged', onGanEvent);
    await char.startNotifications();
    setGanUI(true, device.name || 'GAN Timer');
  } catch (err) {
    statusEl.textContent = err.name === 'NotFoundError' ? 'No device selected.' : `Error: ${err.message}`;
  }
  scanBtn.disabled = false;
  scanBtn.innerHTML = '<i data-lucide="scan-line" style="width:16px;height:16px"></i> Scan for devices';
  lucide.createIcons();
});

document.getElementById('btDisconnBtn').addEventListener('click', () => {
  if (ganDevice && ganDevice.gatt.connected) ganDevice.gatt.disconnect();
  ganDevice = null;
  setGanUI(false);
});

// ── LEFT ACTION BUTTONS (timer mode switcher) ──
function bActivateMode(mode) {
  document.querySelectorAll('.ac[data-mode]').forEach(b=>b.classList.toggle('on', b.dataset.mode===mode));
  const miniBtn = document.getElementById('battleCubeBtn');
  miniBtn.classList.remove('on');
  miniBtn.style.display = mode === 'battle' ? '' : 'none';
  const isBattle = mode === 'battle';
  const isCube   = mode === 'cube';
  document.querySelector('.t-center').style.display = isBattle ? 'none' : '';
  document.querySelector('.t-rp').style.display     = isBattle ? 'none' : '';
  document.getElementById('cubeArea').style.display    = isCube ? 'none' : '';
  document.getElementById('cubeScArea').style.display  = isCube ? '' : 'none';
  document.getElementById('mode-battle').classList.toggle('active', isBattle);
  document.getElementById('pg-timer').classList.toggle('cube-mode', isCube);
}

document.querySelectorAll('.ac[data-mode]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.mode==='battle' && typeof bcSetMode==='function') bcSetMode('keys');
    bActivateMode(btn.dataset.mode);
  });
});

document.getElementById('battleCubeBtn').addEventListener('click', ()=>{
  document.querySelectorAll('.ac[data-mode]').forEach(b=>b.classList.remove('on'));
  document.getElementById('battleCubeBtn').classList.add('on');
  document.querySelector('.t-center').style.display = 'none';
  document.querySelector('.t-rp').style.display     = 'none';
  document.getElementById('cubeArea').style.display    = '';
  document.getElementById('cubeScArea').style.display  = 'none';
  document.getElementById('mode-battle').classList.add('active');
  document.getElementById('pg-timer').classList.remove('cube-mode');
  if(typeof bcSetMode==='function') bcSetMode('cubes');
});

// ── BATTLE MODE TIMERS ──
const bState = [{t:0,st:0,state:'idle'},{t:0,st:0,state:'idle'}];
const bKeys = ['Space','Enter'];
const bIds = ['b1','b2'];
const bHoldMs = 300;
let bHoldTimers = [null,null];
let bRaf = null;
let bScores = [0,0];
let bRoundActive = false;

function bFmt(ms){ const t=ms/1000; return t<60?t.toFixed(3):`${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`; }

function bTick(){
  bIds.forEach((id,i)=>{
    if(bState[i].state==='running'){
      document.getElementById(id+'-time').textContent=bFmt(Date.now()-bState[i].st);
    }
  });
  bRaf=requestAnimationFrame(bTick);
}

function bSetState(i,s){
  bState[i].state=s;
  const timeEl=document.getElementById(bIds[i]+'-time');
  const hintEl=document.getElementById(bIds[i]+'-hint');
  const key=bKeys[i];
  timeEl.className='battle-time '+s;
  if(bcMode==='cubes'){
    if(s==='idle')hintEl.textContent=bcConns[i]?'Scramble your cube, then tap Ready':'Connect your cube to play';
    else if(s==='ready'){hintEl.textContent='Waiting for opponent…';}
    else if(s==='running')hintEl.textContent='Solve!';
    else if(s==='stopped')hintEl.textContent='Waiting for opponent…';
    bcUpdateCard(i);
  } else {
    if(s==='idle'){hintEl.innerHTML=`Hold <strong>${key}</strong> to ready`;}
    else if(s==='holding'){hintEl.innerHTML=`Keep holding <strong>${key}</strong>…`;}
    else if(s==='ready'){hintEl.innerHTML=`Release <strong>${key}</strong> to start!`;}
    else if(s==='running'){hintEl.innerHTML=`Press <strong>${key}</strong> to stop`;}
    else if(s==='stopped'){hintEl.innerHTML=`Waiting for opponent…`;}
  }
}

function bCheckRoundEnd(){
  if(bState[0].state!=='stopped'||bState[1].state!=='stopped') return;
  if(bRoundActive) return;
  bRoundActive=true;
  const resultEl=document.getElementById('battleResult');
  const c1=document.getElementById('b1-card');
  const c2=document.getElementById('b2-card');
  c1.classList.remove('winner'); c2.classList.remove('winner');
  if(bState[0].t<bState[1].t){
    bScores[0]++; resultEl.textContent='Player 1 wins the round!'; c1.classList.add('winner');
  } else if(bState[1].t<bState[0].t){
    bScores[1]++; resultEl.textContent='Player 2 wins the round!'; c2.classList.add('winner');
  } else {
    resultEl.textContent="It's a tie!";
  }
  document.getElementById('b1-score').textContent=bScores[0];
  document.getElementById('b2-score').textContent=bScores[1];
  // New scramble immediately
  pushScramble(); renderScramble();
  if (bcMode === 'cubes') bcInitAllScrambles();
  // Reset both to idle (keep times visible)
  bSetState(0,'idle'); bSetState(1,'idle');
  bRoundActive=false;
}

document.addEventListener('keydown', e=>{
  if(!document.getElementById('mode-battle').classList.contains('active')) return;
  if(bcMode==='cubes') return;
  const i=bKeys.indexOf(e.code);
  if(i<0||e.repeat) return;
  if(bState[i].state==='idle'){
    bSetState(i,'holding');
    bHoldTimers[i]=setTimeout(()=>{ bSetState(i,'ready'); },bHoldMs);
  } else if(bState[i].state==='running'){
    bState[i].t=Date.now()-bState[i].st;
    document.getElementById(bIds[i]+'-time').textContent=bFmt(bState[i].t);
    bSetState(i,'stopped');
    bCheckRoundEnd();
  }
});

document.addEventListener('keyup', e=>{
  if(!document.getElementById('mode-battle').classList.contains('active')) return;
  if(bcMode==='cubes') return;
  const i=bKeys.indexOf(e.code);
  if(i<0) return;
  if(bState[i].state==='holding'){
    clearTimeout(bHoldTimers[i]);
    bSetState(i,'idle');
  } else if(bState[i].state==='ready'){
    bState[i].st=Date.now(); bState[i].t=0;
    document.getElementById(bIds[i]+'-time').textContent='0.000';
    document.getElementById('battleResult').textContent='';
    document.getElementById('b1-card').classList.remove('winner');
    document.getElementById('b2-card').classList.remove('winner');
    bSetState(i,'running');
    if(!bRaf) bRaf=requestAnimationFrame(bTick);
  }
});

// ── BATTLE CUBE MODE ──
let bcMode = 'keys';
let bcConns = [null, null];
let bcSubs = [null, null];
let bcFacelets = [null, null];
let bcWasSolved = [true, true];
let bcCountingDown = false;
let bcViews = [null, null];
let bcScrMoves = [[], []];
let bcScrIdx = [0, 0];
let bcScrCount = [0, 0];
let bcScrDone = [false, false];
let bcUCount = [0, 0];

function bcInitAllScrambles() {
  const scr = (typeof state !== 'undefined' && state.scrHistory) ? (state.scrHistory[state.scrIdx] || '') : '';
  const moves = scr.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < 2; i++) {
    bcScrMoves[i] = moves;
    bcScrIdx[i] = 0; bcScrCount[i] = 0; bcScrDone[i] = false; bcUCount[i] = 0;
    bcUpdateScrHighlight(i);
    bcUpdateCard(i);
  }
}

function bcUpdateScrHighlight(i) {
  const el = document.getElementById('b' + (i + 1) + '-scr-txt');
  if (!el || el.style.display === 'none') return;
  const moves = bcScrMoves[i];
  const idx = bcScrIdx[i];
  if (!moves.length) { el.innerHTML = ''; return; }
  if (bcScrDone[i]) {
    el.innerHTML = '<span style="color:var(--green);font-weight:800;letter-spacing:.02em">Scramble done!</span>';
    return;
  }
  el.innerHTML = moves.map((m, j) => {
    if (j < idx) return `<span style="color:rgba(255,255,255,.2)">${m}</span>`;
    if (j === idx) return `<span style="background:var(--purple);color:#fff;border-radius:6px;padding:2px 8px;font-weight:900">${m}</span>`;
    return `<span style="color:#fff">${m}</span>`;
  }).join(' ');
}

function bcOnMove(i, mv) {
  // U×4 triggers ready
  if (bState[i].state === 'idle' && bcScrDone[i]) {
    if (mv[0] === 'U') { bcUCount[i]++; if (bcUCount[i] >= 4) { bcUCount[i] = 0; bcPlayerReady(i); return; } }
    else bcUCount[i] = 0;
  } else { bcUCount[i] = 0; }

  if (bcScrDone[i] || bcScrIdx[i] >= bcScrMoves[i].length || bState[i].state !== 'idle') return;
  const expected = bcScrMoves[i][bcScrIdx[i]];
  if (mv[0] === expected[0]) {
    const isDouble = expected.endsWith('2');
    bcScrCount[i]++;
    if (bcScrCount[i] >= (isDouble ? 2 : 1)) {
      bcScrCount[i] = 0;
      bcScrIdx[i]++;
      if (bcScrIdx[i] >= bcScrMoves[i].length) {
        bcScrDone[i] = true;
        bcUpdateCard(i);
      }
    }
  } else {
    bcScrCount[i] = 0;
  }
  bcUpdateScrHighlight(i);
}

function bcResetGyro(i) { bcViews[i]?.resetGyro(); }

async function bcResetCube(i) {
  const conn = bcConns[i]; if (!conn) return;
  try { if (conn.capabilities?.reset) await conn.sendCommand({type:'REQUEST_RESET'}); } catch(e) {}
  bcFacelets[i] = SC_SOLVED; bcWasSolved[i] = true;
  bcViews[i]?.updateColors(SC_SOLVED);
  bcScrIdx[i] = 0; bcScrCount[i] = 0; bcScrDone[i] = false; bcUCount[i] = 0;
  bcUpdateScrHighlight(i);
  bcUpdateCard(i);
}

function createBattleCubeView(container) {
  const T = window.THREE;
  const SIZE = 180;
  let camTheta = 0, camPhi = 1.3;
  const CAM_DIST = 6.5;
  let scene, camera, renderer, cubeGroup, cubies = {};
  let rafId = null, active = false;
  let lastGyroQ = null, gyroOffset = null;
  let dn = false, px = 0, py = 0;

  function posCamera() {
    camera.position.set(
      CAM_DIST * Math.sin(camPhi) * Math.sin(camTheta),
      CAM_DIST * Math.cos(camPhi),
      CAM_DIST * Math.sin(camPhi) * Math.cos(camTheta)
    );
    camera.lookAt(0, 0, 0);
  }

  function makeRoundedSticker(size, r) {
    const s = size / 2;
    const shape = new T.Shape();
    shape.moveTo(-s+r,-s); shape.lineTo(s-r,-s); shape.quadraticCurveTo(s,-s,s,-s+r);
    shape.lineTo(s,s-r);   shape.quadraticCurveTo(s,s,s-r,s);
    shape.lineTo(-s+r,s);  shape.quadraticCurveTo(-s,s,-s,s-r);
    shape.lineTo(-s,-s+r); shape.quadraticCurveTo(-s,-s,-s+r,-s);
    shape.closePath();
    return new T.ShapeGeometry(shape);
  }

  function buildCubies() {
    cubeGroup = new T.Group(); scene.add(cubeGroup);
    const OFF = 0.473;
    const sGeo = makeRoundedSticker(0.82, 0.09);
    const FACE = [
      {p:[OFF,0,0],  r:[0,Math.PI/2,0]},  {p:[-OFF,0,0], r:[0,-Math.PI/2,0]},
      {p:[0,OFF,0],  r:[-Math.PI/2,0,0]}, {p:[0,-OFF,0], r:[Math.PI/2,0,0]},
      {p:[0,0,OFF],  r:[0,0,0]},           {p:[0,0,-OFF], r:[0,Math.PI,0]},
    ];
    for (let x=-1;x<=1;x++) for (let y=-1;y<=1;y++) for (let z=-1;z<=1;z++) {
      if (x===0&&y===0&&z===0) continue;
      const body = new T.Mesh(
        new T.BoxGeometry(0.94,0.94,0.94),
        new T.MeshPhongMaterial({color:0x1c1c1c,shininess:12})
      );
      body.position.set(x,y,z); cubeGroup.add(body);
      const stickers = FACE.map(({p,r}) => {
        const mat = new T.MeshBasicMaterial({color:SC_INNER});
        const s = new T.Mesh(sGeo,mat);
        s.position.set(...p); s.rotation.set(...r); body.add(s);
        return mat;
      });
      body.userData.stickers = stickers;
      cubies[`${x},${y},${z}`] = body;
    }
    updateColors(SC_SOLVED);
  }

  function getLocalFi(mesh, globalFi) {
    const gv = SC_FI_DIRS[globalFi].clone().applyQuaternion(mesh.quaternion.clone().invert());
    let best = 0, bestD = -Infinity;
    for (let j=0;j<6;j++) { const d=SC_FI_DIRS[j].dot(gv); if(d>bestD){bestD=d;best=j;} }
    return best;
  }

  function updateColors(facelets) {
    if (!scene) return;
    for (let i=0;i<54;i++) {
      const sf = SC_S2F[i]; if (!sf) continue;
      const c = cubies[sf.key]; if (!c) continue;
      const fi = getLocalFi(c, sf.fi);
      (c.userData.stickers||c.material)[fi].color.setHex(SC_COLORS[facelets[i]]??SC_INNER);
    }
  }

  function updateGyro(q) {
    if (!cubeGroup) return;
    if (!lastGyroQ) lastGyroQ = new T.Quaternion();
    lastGyroQ.set(q.x, q.z, -q.y, q.w);
    if (!gyroOffset) {
      gyroOffset = new T.Quaternion().copy(lastGyroQ).invert();
    } else {
      cubeGroup.quaternion.copy(new T.Quaternion().copy(gyroOffset).multiply(lastGyroQ));
    }
  }

  // Init
  renderer = new T.WebGLRenderer({antialias:true, alpha:true});
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(50, 1, 0.1, 100);
  posCamera();
  scene.add(new T.AmbientLight(0xffffff, 0.75));
  const dl=new T.DirectionalLight(0xffffff,1.0); dl.position.set(4,8,6); scene.add(dl);
  const dl2=new T.DirectionalLight(0xffffff,0.35); dl2.position.set(-3,-4,-3); scene.add(dl2);
  const dl3=new T.DirectionalLight(0xffffff,0.2); dl3.position.set(0,-5,4); scene.add(dl3);
  buildCubies();

  // Orbit
  const cv = renderer.domElement;
  cv.addEventListener('mousedown', e=>{dn=true;px=e.clientX;py=e.clientY;});
  cv.addEventListener('mousemove', e=>{
    if(!dn) return;
    camTheta -= (e.clientX-px)*0.011; camPhi = Math.max(0.1,Math.min(Math.PI-0.1,camPhi+(e.clientY-py)*0.011));
    px=e.clientX;py=e.clientY;posCamera();
  });
  window.addEventListener('mouseup', ()=>dn=false);

  active = true;
  (function loop(){ if(!active) return; rafId=requestAnimationFrame(loop); renderer.render(scene,camera); })();

  return {
    updateColors,
    updateGyro,
    resetGyro() {
      if (!cubeGroup) return;
      if (lastGyroQ) gyroOffset = new T.Quaternion().copy(lastGyroQ).invert();
      else gyroOffset = new T.Quaternion();
      cubeGroup.quaternion.identity();
    },
    destroy() {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      try { renderer.dispose(); } catch(e) {}
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}

function bcUpdateCard(i) {
  const pid = 'b' + (i + 1);
  const conn = bcConns[i];
  const connBtn = document.getElementById(pid + '-conn-btn');
  const connInfo = document.getElementById(pid + '-conn-info');
  const cubeNameEl = document.getElementById(pid + '-cube-name');
  const actionsEl = document.getElementById(pid + '-cube-actions');
  const readyBtn = document.getElementById(pid + '-ready-btn');
  if (!connBtn) return;
  if (!conn) {
    connBtn.style.display = '';
    connBtn.disabled = false;
    connBtn.textContent = 'Connect Cube';
    if (connInfo) connInfo.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    if (readyBtn) readyBtn.style.display = 'none';
  } else {
    connBtn.style.display = 'none';
    if (connInfo) connInfo.style.display = '';
    if (actionsEl) actionsEl.style.display = '';
    if (cubeNameEl) cubeNameEl.textContent = conn.deviceName || ('Cube ' + (i + 1));
    if (readyBtn) {
      readyBtn.style.display = '';
      const st = bState[i].state;
      if (st === 'idle') {
        readyBtn.disabled = !bcScrDone[i];
        readyBtn.className = 'b-ready-btn';
        readyBtn.textContent = bcScrDone[i] ? 'Ready' : 'Scramble first…';
      } else if (st === 'ready') {
        readyBtn.disabled = true;
        readyBtn.className = 'b-ready-btn checked';
        readyBtn.textContent = '✓ Ready';
      } else {
        readyBtn.disabled = true;
        readyBtn.className = 'b-ready-btn';
        readyBtn.textContent = st === 'running' ? 'Solving…' : 'Done';
      }
    }
  }
}

async function bcConnect(i) {
  const pid = 'b' + (i + 1);
  const connBtn = document.getElementById(pid + '-conn-btn');
  if (!window.SmartCubeLib?.connectSmartCube) {
    alert('Smart cube library not available.');
    return;
  }
  if (connBtn) { connBtn.disabled = true; connBtn.textContent = 'Connecting…'; }
  try {
    const conn = await window.SmartCubeLib.connectSmartCube({ deviceSelection: 'filtered', deviceType: 'auto' });
    bcConns[i] = conn;
    bcFacelets[i] = null;
    bcWasSolved[i] = true;
    bcSubs[i] = conn.events$.subscribe({
      next: ev => {
        if (ev.type === 'MOVE') bcOnMove(i, ev.move);
        else if (ev.type === 'FACELETS') { bcOnFacelets(i, ev.facelets); bcViews[i]?.updateColors(ev.facelets); }
        else if (ev.type === 'SOLVED') bcOnSolved(i);
        else if (ev.type === 'GYRO') bcViews[i]?.updateGyro(ev.quaternion);
      },
      error: () => bcHandleDisconn(i),
      complete: () => bcHandleDisconn(i)
    });
    if (conn.capabilities?.facelets) conn.sendCommand({ type: 'REQUEST_FACELETS' }).catch(() => {});
    // Init scramble tracking for this player
    bcScrMoves[i] = bcScrMoves[i].length ? bcScrMoves[i] : (()=>{
      const scr = (typeof state !== 'undefined' && state.scrHistory) ? (state.scrHistory[state.scrIdx] || '') : '';
      return scr.trim().split(/\s+/).filter(Boolean);
    })();
    bcScrIdx[i] = 0; bcScrCount[i] = 0; bcScrDone[i] = false;
    bcUpdateScrHighlight(i);
    bcUpdateCard(i);
    bSetState(i, 'idle');
  } catch (e) {
    if (connBtn) { connBtn.disabled = false; connBtn.textContent = 'Connect Cube'; }
  }
}

async function bcDisconnect(i) {
  try { await bcConns[i]?.disconnect?.(); } catch (e) {}
  bcHandleDisconn(i);
}

function bcHandleDisconn(i) {
  try { bcSubs[i]?.unsubscribe?.(); } catch (e) {}
  bcConns[i] = null; bcSubs[i] = null; bcFacelets[i] = null; bcWasSolved[i] = true;
  bcViews[i]?.updateColors(SC_SOLVED); // reset to solved but keep view visible
  if (bState[i].state !== 'idle') bSetState(i, 'idle');
  else bcUpdateCard(i);
}

function bcOnFacelets(i, facelets) {
  bcFacelets[i] = facelets;
  const isSolved = scIsSolved(facelets);
  if (isSolved && !bcWasSolved[i] && bState[i].state === 'running') bcOnSolved(i);
  bcWasSolved[i] = isSolved;
}

function bcOnSolved(i) {
  if (bState[i].state !== 'running') return;
  bState[i].t = Date.now() - bState[i].st;
  document.getElementById(bIds[i] + '-time').textContent = bFmt(bState[i].t);
  bSetState(i, 'stopped');
  bCheckRoundEnd();
}

function bcPlayerReady(i) {
  if (bcMode !== 'cubes' || !bcConns[i] || bState[i].state !== 'idle' || !bcScrDone[i]) return;
  bSetState(i, 'ready');
  if (bState[0].state === 'ready' && bState[1].state === 'ready') bcCountdown();
}

let bcAudioCtx = null;
function bcBeep(freq, dur, vol = 0.35) {
  try {
    if (!bcAudioCtx || bcAudioCtx.state === 'closed') bcAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (bcAudioCtx.state === 'suspended') bcAudioCtx.resume();
    const osc = bcAudioCtx.createOscillator();
    const gain = bcAudioCtx.createGain();
    osc.connect(gain); gain.connect(bcAudioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, bcAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, bcAudioCtx.currentTime + dur);
    osc.start(); osc.stop(bcAudioCtx.currentTime + dur);
  } catch(e) {}
}

function bcCountdown() {
  if (bcCountingDown) return;
  bcCountingDown = true;
  const resultEl = document.getElementById('battleResult');
  resultEl.style.fontSize = '3em';
  let n = 3;
  resultEl.textContent = n;
  bcBeep(440, 0.12);
  const tick = () => {
    n--;
    if (n > 0) {
      resultEl.textContent = n;
      bcBeep(440, 0.12);
      setTimeout(tick, 800);
    } else {
      resultEl.textContent = 'GO!';
      bcBeep(880, 0.3);
      if (bState[0].state === 'ready' && bState[1].state === 'ready') {
        const now = Date.now();
        for (let j = 0; j < 2; j++) {
          bState[j].st = now; bState[j].t = 0;
          document.getElementById(bIds[j] + '-time').textContent = '0.000';
          document.getElementById('b' + (j + 1) + '-card').classList.remove('winner');
          bSetState(j, 'running');
        }
        if (!bRaf) bRaf = requestAnimationFrame(bTick);
      }
      bcCountingDown = false;
      resultEl.style.fontSize = '';
      setTimeout(() => { if (resultEl.textContent === 'GO!') resultEl.textContent = ''; }, 700);
    }
  };
  setTimeout(tick, 800);
}

function bcSetMode(mode) {
  bcMode = mode;
  const inCubes = mode === 'cubes';
  const bScrTxt = document.getElementById('battleScrTxt');
  const bNet = document.getElementById('battleCubeNet');
  if (bScrTxt) bScrTxt.style.display = inCubes ? 'none' : '';
  if (bNet) bNet.style.display = inCubes ? 'none' : 'block';
  if (inCubes) bcInitAllScrambles();
  for (let i = 0; i < 2; i++) {
    const keyEl = document.getElementById('b' + (i + 1) + '-key');
    const cubeUi = document.getElementById('b' + (i + 1) + '-cube-ui');
    const wrap3d = document.getElementById('b' + (i + 1) + '-3d-wrap');
    const scrTxt = document.getElementById('b' + (i + 1) + '-scr-txt');
    if (keyEl) keyEl.style.display = inCubes ? 'none' : '';
    if (cubeUi) cubeUi.style.display = inCubes ? '' : 'none';
    if (scrTxt) scrTxt.style.display = inCubes ? '' : 'none';
    if (inCubes && wrap3d) {
      wrap3d.style.display = '';
      if (!bcViews[i]) bcViews[i] = createBattleCubeView(wrap3d);
    } else if (!inCubes && wrap3d) {
      bcViews[i]?.destroy(); bcViews[i] = null;
      wrap3d.style.display = 'none';
    }
    bSetState(i, 'idle');
  }
  bScores = [0, 0];
  document.getElementById('b1-score').textContent = '0';
  document.getElementById('b2-score').textContent = '0';
  document.getElementById('battleResult').textContent = '';
}

lucide.createIcons();
