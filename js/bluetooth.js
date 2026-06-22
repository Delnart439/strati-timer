
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
  document.getElementById('battleCubeBtn').classList.remove('on');
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

function bcUpdateCard(i) {
  const pid = 'b' + (i + 1);
  const conn = bcConns[i];
  const connBtn = document.getElementById(pid + '-conn-btn');
  const connInfo = document.getElementById(pid + '-conn-info');
  const cubeNameEl = document.getElementById(pid + '-cube-name');
  const readyBtn = document.getElementById(pid + '-ready-btn');
  if (!connBtn) return;
  if (!conn) {
    connBtn.style.display = '';
    connBtn.disabled = false;
    connBtn.textContent = 'Connect Cube';
    if (connInfo) connInfo.style.display = 'none';
    if (readyBtn) readyBtn.style.display = 'none';
  } else {
    connBtn.style.display = 'none';
    if (connInfo) connInfo.style.display = '';
    if (cubeNameEl) cubeNameEl.textContent = conn.deviceName || ('Cube ' + (i + 1));
    if (readyBtn) {
      readyBtn.style.display = '';
      const st = bState[i].state;
      if (st === 'idle') {
        const isSolved = bcFacelets[i] ? scIsSolved(bcFacelets[i]) : true;
        readyBtn.disabled = isSolved;
        readyBtn.className = 'b-ready-btn';
        readyBtn.textContent = isSolved ? 'Scramble first…' : 'Ready';
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
        if (ev.type === 'FACELETS') bcOnFacelets(i, ev.facelets);
        else if (ev.type === 'SOLVED') bcOnSolved(i);
      },
      error: () => bcHandleDisconn(i),
      complete: () => bcHandleDisconn(i)
    });
    if (conn.capabilities?.facelets) conn.sendCommand({ type: 'REQUEST_FACELETS' }).catch(() => {});
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
  if (bState[i].state !== 'idle') bSetState(i, 'idle');
  else bcUpdateCard(i);
}

function bcOnFacelets(i, facelets) {
  bcFacelets[i] = facelets;
  const isSolved = scIsSolved(facelets);
  if (isSolved && !bcWasSolved[i] && bState[i].state === 'running') bcOnSolved(i);
  bcWasSolved[i] = isSolved;
  if (bState[i].state === 'idle') {
    const readyBtn = document.getElementById('b' + (i + 1) + '-ready-btn');
    if (readyBtn && readyBtn.style.display !== 'none') {
      readyBtn.disabled = isSolved;
      readyBtn.textContent = isSolved ? 'Scramble first…' : 'Ready';
    }
  }
}

function bcOnSolved(i) {
  if (bState[i].state !== 'running') return;
  bState[i].t = Date.now() - bState[i].st;
  document.getElementById(bIds[i] + '-time').textContent = bFmt(bState[i].t);
  bSetState(i, 'stopped');
  bCheckRoundEnd();
}

function bcPlayerReady(i) {
  if (bcMode !== 'cubes' || !bcConns[i] || bState[i].state !== 'idle') return;
  const isSolved = bcFacelets[i] ? scIsSolved(bcFacelets[i]) : true;
  if (isSolved) return;
  bSetState(i, 'ready');
  if (bState[0].state === 'ready' && bState[1].state === 'ready') bcCountdown();
}

function bcCountdown() {
  if (bcCountingDown) return;
  bcCountingDown = true;
  const resultEl = document.getElementById('battleResult');
  resultEl.style.fontSize = '3em';
  let n = 3;
  resultEl.textContent = n;
  const tick = () => {
    n--;
    if (n > 0) {
      resultEl.textContent = n;
      setTimeout(tick, 800);
    } else {
      resultEl.textContent = 'GO!';
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
  document.getElementById('b-mode-keys').classList.toggle('on', mode === 'keys');
  document.getElementById('b-mode-cubes').classList.toggle('on', mode === 'cubes');
  const inCubes = mode === 'cubes';
  for (let i = 0; i < 2; i++) {
    const keyEl = document.getElementById('b' + (i + 1) + '-key');
    const cubeUi = document.getElementById('b' + (i + 1) + '-cube-ui');
    if (keyEl) keyEl.style.display = inCubes ? 'none' : '';
    if (cubeUi) cubeUi.style.display = inCubes ? '' : 'none';
    bSetState(i, 'idle');
  }
  bScores = [0, 0];
  document.getElementById('b1-score').textContent = '0';
  document.getElementById('b2-score').textContent = '0';
  document.getElementById('battleResult').textContent = '';
}

document.getElementById('b-mode-keys').addEventListener('click', () => bcSetMode('keys'));
document.getElementById('b-mode-cubes').addEventListener('click', () => bcSetMode('cubes'));

lucide.createIcons();
