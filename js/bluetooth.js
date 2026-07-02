
// ── BLUETOOTH MODAL ──
function openBtModal() {
  const m = document.getElementById('btModal');
  if (m) { m.classList.remove('h'); lucide.createIcons(); }
}
document.getElementById('btModalClose')?.addEventListener('click', ()=>document.getElementById('btModal')?.classList.add('h'));
document.getElementById('btModal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) e.currentTarget.classList.add('h'); });
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
      if (state.timerState === 'idle' || state.timerState === 'stopped' || state.timerState === 'inspecting') setTimerState('holding');
      break;
    case GAN_ST.GET_SET:
      if (state.timerState === 'holding') setTimerState('ready');
      break;
    case GAN_ST.RUNNING:
      if (state.timerState === 'ready' || state.timerState === 'holding' || state.timerState === 'inspecting') {
        if (state.inspectActive) finishInspection();
        startTimer();
      }
      break;
    case GAN_ST.STOPPED:
      if (state.timerState === 'running') {
        const min = data.getUint8(4), sec = data.getUint8(5), ms = data.getUint16(6, true);
        stopTimer((min * 60 + sec) * 1000 + ms);
      }
      break;
    case GAN_ST.FINISHED:
      if (state.settings.inspection && state.timerState === 'idle') startInspection();
      break;
    case GAN_ST.HANDS_OFF:
    case GAN_ST.IDLE:
      if (state.timerState === 'holding' || state.timerState === 'ready') {
        setTimerState(state.inspectActive ? 'inspecting' : 'idle');
      } else if (state.timerState === 'stopped') {
        setTimerState('idle');
        document.getElementById('timerDisp').textContent = '0.000';
      } else if (state.timerState === 'idle' && state.settings.inspection) {
        startInspection();
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
      if (state.timerState === 'inspecting' || state.timerState === 'holding' || state.timerState === 'ready' || state.timerState === 'running') {
        if (state.inspectActive) finishInspection();
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
  document.getElementById('tb').style.display       = isBattle ? 'none' : '';
  document.getElementById('cubeArea').style.display    = isCube ? 'none' : '';
  document.getElementById('cubeScArea').style.display  = isCube ? '' : 'none';
  document.getElementById('scBleUI').style.display     = isCube ? '' : 'none';
  document.getElementById('mode-battle').classList.toggle('active', isBattle);
  document.getElementById('pg-timer').classList.toggle('cube-mode', isCube);
}

document.querySelectorAll('.ac[data-mode]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.mode==='battle' && typeof bcSetMode==='function') bcSetMode('keys');
    bActivateMode(btn.dataset.mode);
    if(btn.dataset.mode==='battle') btn.blur();
  });
});

document.getElementById('battleCubeBtn').addEventListener('click', ()=>{
  document.querySelectorAll('.ac[data-mode]').forEach(b=>b.classList.remove('on'));
  document.getElementById('battleCubeBtn').classList.add('on');
  document.querySelector('.t-center').style.display = 'none';
  document.querySelector('.t-rp').style.display     = 'none';
  document.getElementById('tb').style.display       = 'none';
  document.getElementById('cubeArea').style.display    = '';
  document.getElementById('cubeScArea').style.display  = 'none';
  document.getElementById('scBleUI').style.display     = 'none';
  document.getElementById('mode-battle').classList.add('active');
  document.getElementById('pg-timer').classList.remove('cube-mode');
  if(typeof bcSetMode==='function') bcSetMode('cubes');
  document.activeElement?.blur();
});

// ── BATTLE STACKMAT BLE (keys mode, one per player) ──
let bgDevices = [null, null];

function bgSetUI(i, connected, name) {
  const btn  = document.getElementById('b' + (i+1) + '-st-btn');
  const disc = document.getElementById('b' + (i+1) + '-st-disc');
  const keyEl = document.getElementById('b' + (i+1) + '-key');
  if (!btn) return;
  if (connected) {
    btn.classList.add('connected');
    btn.title = name || 'Timer connected';
    if (disc) disc.style.display = '';
    if (keyEl) keyEl.textContent = name || 'BT Timer';
  } else {
    btn.classList.remove('connected');
    btn.title = 'Connect Bluetooth Timer';
    if (disc) disc.style.display = 'none';
    if (keyEl) keyEl.textContent = 'Key: ' + bKeys[i];
  }
}

function bgOnEvent(i, event) {
  if (bcMode !== 'keys') return;
  const data = event.target.value;
  if (!validateGanPkt(data)) return;
  const s = data.getUint8(3);
  switch (s) {
    case GAN_ST.HANDS_ON:
      if (bState[i].state === 'idle' || bState[i].state === 'stopped') bSetState(i, 'holding');
      break;
    case GAN_ST.GET_SET:
      if (bState[i].state === 'holding') {
        bSetState(i, 'ready');
        if (bState[0].state === 'ready' && bState[1].state === 'ready') bcCountdown();
      }
      break;
    case GAN_ST.RUNNING:
      if ((bState[i].state === 'ready' || bState[i].state === 'holding') && !bcCountingDown) {
        bState[i].st = Date.now(); bState[i].t = 0;
        document.getElementById(bIds[i] + '-time').textContent = '0.000';
        document.getElementById('battleResult').textContent = '';
        document.getElementById('b1-card').classList.remove('winner');
        document.getElementById('b2-card').classList.remove('winner');
        bSetState(i, 'running');
        if (!bRaf) bRaf = requestAnimationFrame(bTick);
      }
      break;
    case GAN_ST.STOPPED:
      if (bState[i].state === 'running') {
        const min = data.getUint8(4), sec = data.getUint8(5), ms = data.getUint16(6, true);
        bState[i].t = (min * 60 + sec) * 1000 + ms;
        document.getElementById(bIds[i] + '-time').textContent = bFmt(bState[i].t);
        bSetState(i, 'stopped');
        bCheckRoundEnd();
      }
      break;
    case GAN_ST.HANDS_OFF:
    case GAN_ST.IDLE:
      if (bState[i].state === 'holding' || bState[i].state === 'ready') bSetState(i, 'idle');
      else if (bState[i].state === 'stopped') {
        bSetState(i, 'idle');
        document.getElementById(bIds[i] + '-time').textContent = '0.000';
      }
      break;
  }
}

async function bgScan(i) {
  if (!navigator.bluetooth) { alert('Bluetooth is not supported on this device.'); return; }
  if (bgDevices[i]) return;
  const btn = document.getElementById('b' + (i+1) + '-st-btn');
  if (btn) btn.disabled = true;
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [GAN_SVC] }, { namePrefix: 'GAN' }],
      optionalServices: [GAN_SVC]
    });
    bgDevices[i] = device;
    device.addEventListener('gattserverdisconnected', () => {
      bgDevices[i] = null;
      bgSetUI(i, false);
      if (bState[i].state !== 'idle' && bState[i].state !== 'stopped') {
        bSetState(i, 'idle');
        document.getElementById(bIds[i] + '-time').textContent = '0.000';
      } else {
        bSetState(i, 'idle');
      }
    });
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(GAN_SVC);
    const char    = await service.getCharacteristic(GAN_STATE_CHAR);
    char.addEventListener('characteristicvaluechanged', ev => bgOnEvent(i, ev));
    await char.startNotifications();
    bgSetUI(i, true, device.name || 'GAN Timer');
    bSetState(i, 'idle');
  } catch (err) {
    bgDevices[i] = null;
  }
  if (btn) { btn.disabled = false; lucide.createIcons(); }
}

function bgDisconnect(i) {
  try { if (bgDevices[i]?.gatt?.connected) bgDevices[i].gatt.disconnect(); } catch(e) {}
  bgDevices[i] = null;
  bgSetUI(i, false);
  bSetState(i, 'idle');
}

// ── BATTLE MODE TIMERS ──
const bState = [{t:0,st:0,state:'idle'},{t:0,st:0,state:'idle'}];
const bKeys = ['Space','Enter'];
const bIds = ['b1','b2'];
const bHoldMs = 300;
let bHoldTimers = [null,null];
let bRaf = null;
let bScores = [0,0];          // solve wins in current round
let bNames = ['Player 1', 'Player 2'];
let bRoundActive = false;
let bHistory = [[], []];
let bMatchOver = false;
// Format
let bFormat = 'basic';        // 'basic' | 'r3' | 'r5'
let bRoundsNeeded = 0;        // rounds needed to win match (2 or 3)
// Round tracking (rounds mode only)
let bRoundScores = [0, 0];    // rounds won in match
let bCurrentRound = 1;
let bSolvesInRound = 0;
let bRoundBestTime = [Infinity, Infinity];
let bMatchHistory = [];       // [{roundNum, winner, p1Solves, p2Solves, p1Best, p2Best, tiebreak}]

function bFmt(ms){ if (!isFinite(ms)) return 'DNF'; const t=ms/1000; return t<60?t.toFixed(3):`${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`; }

function bSetFormat(fmt) {
  bFormat = fmt;
  bRoundsNeeded = fmt === 'r3' ? 2 : fmt === 'r5' ? 3 : 0;
  document.querySelectorAll('.b-fmt-btn').forEach(b =>
    b.classList.toggle('b-fmt-active', b.dataset.fmt === fmt)
  );
  bNewMatch();
}

function bUpdateMatchInfo() {
  const el = document.getElementById('bMatchInfo');
  if (!el) return;
  if (bFormat === 'basic') { el.textContent = ''; return; }
  const total = bFormat === 'r3' ? 3 : 5;
  el.textContent = `Round ${bCurrentRound} of ${total} · ${bRoundScores[0]}–${bRoundScores[1]}`;
}

function bKeyReady(i) {
  if (bcMode !== 'keys') return;
  if (bMatchOver) return;
  if (!document.getElementById('bRoundModal').classList.contains('h')) return;
  if (bState[i].state === 'idle' || bState[i].state === 'stopped') {
    bSetState(i, 'ready');
    if (bState[0].state === 'ready' && bState[1].state === 'ready') bcCountdown();
  } else if (bState[i].state === 'ready' && !bcCountingDown) {
    bSetState(i, 'idle');
  }
}

function bNewMatch() {
  bScores[0] = 0; bScores[1] = 0;
  bRoundScores[0] = 0; bRoundScores[1] = 0;
  bCurrentRound = 1;
  bSolvesInRound = 0;
  bRoundBestTime = [Infinity, Infinity];
  bMatchHistory = [];
  bHistory[0] = []; bHistory[1] = [];
  bMatchOver = false;
  document.getElementById('b1-score').textContent = '0';
  document.getElementById('b2-score').textContent = '0';
  document.getElementById('b1-card').classList.remove('winner');
  document.getElementById('b2-card').classList.remove('winner');
  const resultEl = document.getElementById('battleResult');
  if (resultEl) { resultEl.textContent = ''; resultEl.style.color = ''; }
  document.getElementById('bNewMatchBtn')?.classList.add('h');
  renderBattleHistory();
  bUpdateMatchInfo();
  if (bState[0].state !== 'idle') bSetState(0, 'idle');
  if (bState[1].state !== 'idle') bSetState(1, 'idle');
}

function bStartEditName(i) {
  const pid = 'b' + (i + 1);
  const txt = document.getElementById(pid + '-name-txt');
  const edit = document.getElementById(pid + '-name-edit');
  const input = document.getElementById(pid + '-name-input');
  if (!txt || !edit || !input) return;
  input.value = bNames[i];
  txt.style.display = 'none';
  edit.style.display = '';
  input.focus(); input.select();
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [edit] });
}

function bConfirmName(i) {
  const pid = 'b' + (i + 1);
  const txt = document.getElementById(pid + '-name-txt');
  const edit = document.getElementById(pid + '-name-edit');
  const input = document.getElementById(pid + '-name-input');
  if (!txt || !edit || !input || edit.style.display === 'none') return;
  const newName = input.value.trim() || ('Player ' + (i + 1));
  bNames[i] = newName;
  txt.textContent = newName;
  txt.style.display = '';
  edit.style.display = 'none';
}

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
  timeEl.style.color = ''; // clear any inline override (e.g. DNF red)
  if(bcMode==='cubes'){
    bcUpdateCard(i);
  } else {
    const hasBt = !!bgDevices[i];
    if(s==='idle'){hintEl.innerHTML = hasBt ? 'Place hands on timer' : '';}
    else if(s==='holding'){hintEl.innerHTML = hasBt ? 'Hold still…' : '';}
    else if(s==='ready'){hintEl.innerHTML = `Waiting for opponent…`;}
    else if(s==='running'){hintEl.innerHTML = hasBt ? 'Solve!' : `Press <strong>${key}</strong> to stop`;}
    else if(s==='stopped'){hintEl.innerHTML=`Waiting for opponent…`;}
    // Update key-mode ready button
    const pid = 'b' + (i + 1);
    const keyReadyBtn = document.getElementById(pid + '-key-ready');
    if (keyReadyBtn) {
      const k = bKeys[i];
      if (s === 'idle' || s === 'stopped') {
        keyReadyBtn.style.display = ''; keyReadyBtn.disabled = false;
        keyReadyBtn.className = 'b-ready-btn b-key-ready-btn';
        keyReadyBtn.innerHTML = `Ready ? <span style="opacity:.55;font-size:.8em;font-weight:600">(${k})</span>`;
      } else if (s === 'ready') {
        keyReadyBtn.style.display = ''; keyReadyBtn.disabled = false;
        keyReadyBtn.className = 'b-ready-btn b-key-ready-btn checked';
        keyReadyBtn.innerHTML = `✓ Ready <span style="opacity:.55;font-size:.8em;font-weight:600">(${k})</span>`;
      } else {
        keyReadyBtn.style.display = 'none';
      }
    }
  }
}

function bCheckRoundEnd(){
  if(bState[0].state!=='stopped'||bState[1].state!=='stopped') return;
  if(bRoundActive||bMatchOver) return;
  bRoundActive=true;
  const resultEl=document.getElementById('battleResult');
  const c1=document.getElementById('b1-card');
  const c2=document.getElementById('b2-card');
  c1.classList.remove('winner'); c2.classList.remove('winner');

  // Track best times for tiebreak
  if(isFinite(bState[0].t)) bRoundBestTime[0]=Math.min(bRoundBestTime[0],bState[0].t);
  if(isFinite(bState[1].t)) bRoundBestTime[1]=Math.min(bRoundBestTime[1],bState[1].t);

  // Individual solve winner
  let solveResult='draw';
  if(bState[0].t<bState[1].t){ bScores[0]++; c1.classList.add('winner'); solveResult='p1'; }
  else if(bState[1].t<bState[0].t){ bScores[1]++; c2.classList.add('winner'); solveResult='p2'; }

  document.getElementById('b1-score').textContent=bScores[0];
  document.getElementById('b2-score').textContent=bScores[1];

  // Record history
  const scramble=state.scrHistory[state.scrIdx]||'';
  const solveNum=bHistory[0].length+1;
  bHistory[0].push({time:bState[0].t,scramble,result:solveResult==='p1'?'won':solveResult==='p2'?'lost':'draw',round:solveNum});
  bHistory[1].push({time:bState[1].t,scramble,result:solveResult==='p2'?'won':solveResult==='p1'?'lost':'draw',round:solveNum});
  renderBattleHistory();

  // ── BASIC MODE: no match structure ──
  if(bFormat==='basic'){
    if(solveResult==='p1') resultEl.textContent=bNames[0]+' wins the round!';
    else if(solveResult==='p2') resultEl.textContent=bNames[1]+' wins the round!';
    else resultEl.textContent="It's a tie!";
    pushScramble(); renderScramble();
    if(bcMode==='cubes') bcInitAllScrambles();
    bSetState(0,'idle'); bSetState(1,'idle');
    bRoundActive=false;
    return;
  }

  // ── ROUNDS MODE ──
  bSolvesInRound++;
  const SOLVE_TARGET=3, MAX_SOLVES=7;
  const roundOver=bScores[0]>=SOLVE_TARGET||bScores[1]>=SOLVE_TARGET||bSolvesInRound>=MAX_SOLVES;

  if(!roundOver){
    // Solve done, round continues
    const lead=bScores[0]>bScores[1]?bNames[0]:bScores[1]>bScores[0]?bNames[1]:null;
    const scoreStr=`${bScores[0]}–${bScores[1]}`;
    if(solveResult==='p1') resultEl.textContent=`${bNames[0]} wins the solve! (${scoreStr})`;
    else if(solveResult==='p2') resultEl.textContent=`${bNames[1]} wins the solve! (${scoreStr})`;
    else resultEl.textContent=`Tied solve! (${scoreStr})`;
    pushScramble(); renderScramble();
    if(bcMode==='cubes') bcInitAllScrambles();
    bSetState(0,'idle'); bSetState(1,'idle');
    bRoundActive=false;
    return;
  }

  // Round is over — determine round winner
  let roundWinner=-1;
  if(bScores[0]>bScores[1]) roundWinner=0;
  else if(bScores[1]>bScores[0]) roundWinner=1;
  else{
    // Tiebreak: best single in the round
    if(bRoundBestTime[0]<bRoundBestTime[1]) roundWinner=0;
    else if(bRoundBestTime[1]<bRoundBestTime[0]) roundWinner=1;
  }
  if(roundWinner>=0) bRoundScores[roundWinner]++;
  if(roundWinner===0) c1.classList.add('winner');
  else if(roundWinner===1) c2.classList.add('winner');

  // Save round to match history
  bMatchHistory.push({
    roundNum: bCurrentRound,
    winner: roundWinner,
    p1Solves: bScores[0], p2Solves: bScores[1],
    p1Best: isFinite(bRoundBestTime[0]) ? bRoundBestTime[0] : null,
    p2Best: isFinite(bRoundBestTime[1]) ? bRoundBestTime[1] : null,
    tiebreak: roundWinner>=0 && bScores[0]===bScores[1] && bSolvesInRound>=MAX_SOLVES,
    p1Times: bHistory[0].map(e => e.time),
    p2Times: bHistory[1].map(e => e.time)
  });

  // Check match end
  if(bRoundScores[0]>=bRoundsNeeded||bRoundScores[1]>=bRoundsNeeded){
    bMatchOver=true;
    bCurrentRound++;
    bShowMatchEndModal();
    bRoundActive=false;
    return;
  }

  // Show round-end modal — continue when player clicks
  const totalRounds=bFormat==='r3'?3:5;
  const note=roundWinner>=0&&bScores[0]===bScores[1]&&bSolvesInRound>=MAX_SOLVES?'Decided by best single':'';
  document.getElementById('brm-round').textContent=`Round ${bCurrentRound} of ${totalRounds}`;
  document.getElementById('brm-winner-name').textContent=roundWinner>=0?bNames[roundWinner]:'Draw';
  document.getElementById('brm-winner-text').textContent=roundWinner>=0?'wins the round!':'';
  document.getElementById('brm-note').textContent=note;
  document.getElementById('brm-p1name').textContent=bNames[0];
  document.getElementById('brm-p2name').textContent=bNames[1];
  document.getElementById('brm-p1score').textContent=bRoundScores[0];
  document.getElementById('brm-p2score').textContent=bRoundScores[1];
  const roundModal = document.getElementById('bRoundModal');
  roundModal.classList.remove('h');
  lucide.createIcons({ nodes: [roundModal] });
  bCurrentRound++;
  bRoundActive=false;
}

function bContinueNextRound(){
  document.getElementById('bRoundModal').classList.add('h');
  bScores[0]=0; bScores[1]=0;
  bSolvesInRound=0;
  bRoundBestTime=[Infinity,Infinity];
  bHistory[0]=[]; bHistory[1]=[];
  renderBattleHistory();
  bUpdateMatchInfo();
  document.getElementById('b1-score').textContent='0';
  document.getElementById('b2-score').textContent='0';
  document.getElementById('b1-card').classList.remove('winner');
  document.getElementById('b2-card').classList.remove('winner');
  const resultEl=document.getElementById('battleResult');
  if(resultEl){resultEl.textContent='';resultEl.style.color='';}
  pushScramble(); renderScramble();
  if(bcMode==='cubes') bcInitAllScrambles();
  bSetState(0,'idle'); bSetState(1,'idle');
}

function bShowMatchEndModal() {
  const w = bRoundScores[0] >= bRoundsNeeded ? 0 : 1;
  document.getElementById('bmm-winner-name').textContent = bNames[w];
  document.getElementById('bmm-winner-text').textContent = 'wins the match!';
  document.getElementById('bmm-p1name').textContent = bNames[0];
  document.getElementById('bmm-p2name').textContent = bNames[1];
  const p1s = document.getElementById('bmm-p1score');
  const p2s = document.getElementById('bmm-p2score');
  p1s.textContent = bRoundScores[0];
  p2s.textContent = bRoundScores[1];
  p1s.style.color = w === 0 ? '#a78bfa' : '#fff';
  p2s.style.color = w === 1 ? '#a78bfa' : '#fff';
  // Build rounds recap
  const recap = document.getElementById('bmm-recap');
  recap.innerHTML = '';
  bMatchHistory.forEach(r => {
    const winnerName = r.winner >= 0 ? bNames[r.winner] : 'Draw';
    const tieNote = r.tiebreak ? ' <span style="font-size:9px;color:var(--dim)">(★ best single)</span>' : '';
    const n = Math.max((r.p1Times||[]).length, (r.p2Times||[]).length);
    let timesHtml = '';
    for (let i = 0; i < n; i++) {
      const t1 = r.p1Times?.[i]; const t2 = r.p2Times?.[i];
      const p1win = t1 !== undefined && t2 !== undefined && t1 < t2;
      const p2win = t1 !== undefined && t2 !== undefined && t2 < t1;
      timesHtml += `<div class="bmm-solve-row">
        <span class="bmm-t ${p1win?'bmm-t-win':''}">${t1!==undefined?bFmt(t1):'—'}</span>
        <span class="bmm-sep">vs</span>
        <span class="bmm-t ${p2win?'bmm-t-win':''}">${t2!==undefined?bFmt(t2):'—'}</span>
      </div>`;
    }
    const p1ScoreCol = r.winner === 0 ? 'color:var(--purple)' : '';
    const p2ScoreCol = r.winner === 1 ? 'color:var(--purple)' : '';
    const row = document.createElement('div');
    row.className = 'bmm-round-row';
    row.innerHTML = `
      <div class="bmm-round-badge">R${r.roundNum}</div>
      <div class="bmm-round-info">
        <div class="bmm-round-winner">${winnerName}${tieNote}</div>
        <div class="bmm-round-score"><span style="${p1ScoreCol}">${r.p1Solves}</span><span style="opacity:.4">–</span><span style="${p2ScoreCol}">${r.p2Solves}</span></div>
      </div>
      <div class="bmm-solve-list">${timesHtml}</div>`;
    recap.appendChild(row);
  });
  const modal = document.getElementById('bMatchModal');
  modal.classList.remove('h');
  lucide.createIcons({ nodes: [modal] });
}

function bShareMatchCard() {
  const logo = new Image();
  logo.src = 'Mascotte/logo.png';
  logo.onload = () => _bDrawMatchCard(logo, 'share');
  logo.onerror = () => _bDrawMatchCard(null, 'share');
}

function bCopyMatchCard(btn) {
  const logo = new Image();
  logo.src = 'Mascotte/logo.png';
  logo.onload = () => _bDrawMatchCard(logo, 'copy', btn);
  logo.onerror = () => _bDrawMatchCard(null, 'copy', btn);
}

function _bDrawMatchCard(logo, mode, btn) {
  const w = bRoundScores[0] > bRoundScores[1] ? 0 : 1;
  const W = 560, PAD = 28;
  const RCOLS = 3, RHGAP = 10, RVGAP = 22;
  const BADGE_H = 20, RHEAD = 50, RSOLVE = 22, RPAD = 12;
  // Group rounds into rows of 3
  const rGroups = [];
  for (let i = 0; i < bMatchHistory.length; i += RCOLS)
    rGroups.push(bMatchHistory.slice(i, i + RCOLS));
  const rGroupH = rGroups.map(g =>
    Math.max(...g.map(r => RHEAD + Math.max((r.p1Times||[]).length,(r.p2Times||[]).length) * RSOLVE + RPAD))
  );
  const totalRoundsH = rGroupH.reduce((s,h) => s + h + RVGAP, 0) - (rGroupH.length > 0 ? RVGAP : 0);
  // 156 = fixed top section; 72 = footer (accounts for reduced gap above + padding below)
  const H = 156 + totalRoundsH + 72;

  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);

  // Clip to rounded card
  ctx.beginPath();
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.save();
  ctx.clip();

  // Background gradient
  ctx.fillStyle = '#231450';
  ctx.fillRect(0, 0, W, H);


  let y = 18;

  // Winner name
  ctx.fillStyle = '#fff';
  ctx.font = '900 28px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bNames[w], W/2, y + 24);
  y += 32;

  // "wins the match!"
  ctx.fillStyle = '#fff';
  ctx.font = '700 18px system-ui,sans-serif';
  ctx.fillText('wins the match!', W/2, y + 16);
  y += 34;

  // Score block
  const scoreY = y;
  const scoreW = 116, BOX_GAP = 20;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  roundRect(ctx, W/2 - scoreW - BOX_GAP/2, scoreY, scoreW, 52, 12);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, W/2 + BOX_GAP/2, scoreY, scoreW, 52, 12);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 9px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bNames[0].toUpperCase(), W/2 - scoreW/2 - BOX_GAP/2, scoreY + 14);
  ctx.fillStyle = w === 0 ? '#a78bfa' : '#fff';
  ctx.font = '900 36px system-ui,sans-serif';
  ctx.fillText(bRoundScores[0], W/2 - scoreW/2 - BOX_GAP/2, scoreY + 46);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '700 18px system-ui,sans-serif';
  ctx.fillText('–', W/2, scoreY + 32);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 9px system-ui,sans-serif';
  ctx.fillText(bNames[1].toUpperCase(), W/2 + scoreW/2 + BOX_GAP/2, scoreY + 14);
  ctx.fillStyle = w === 1 ? '#a78bfa' : '#fff';
  ctx.font = '900 36px system-ui,sans-serif';
  ctx.fillText(bRoundScores[1], W/2 + scoreW/2 + BOX_GAP/2, scoreY + 46);

  y = scoreY + 62;

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 10;

  // Rounds recap — 3 round cards per row
  const availW = W - PAD * 2;
  const cardW = (availW - (RCOLS - 1) * RHGAP) / RCOLS;

  rGroups.forEach((group, gi) => {
    const cardH = rGroupH[gi];
    group.forEach((r, ci) => {
      const cx = PAD + ci * (cardW + RHGAP);
      const cy = y;
      const n = Math.max((r.p1Times||[]).length, (r.p2Times||[]).length);

      // Card — filled + purple contour
      const cardTop = cy + BADGE_H / 2;
      ctx.fillStyle = '#2a1660';
      ctx.beginPath();
      roundRect(ctx, cx, cardTop, cardW, cardH - BADGE_H / 2, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(124,58,237,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, cx, cardTop, cardW, cardH - BADGE_H / 2, 10);
      ctx.stroke();

      // Round badge — centered on the card's top edge, same bg + purple border
      const badgeLabel = `R${r.roundNum}`;
      ctx.font = '700 11px system-ui,sans-serif';
      const bw = ctx.measureText(badgeLabel).width + 16;
      const bx = cx + (cardW - bw) / 2;
      ctx.fillStyle = '#2a1660';
      ctx.beginPath();
      roundRect(ctx, bx, cy, bw, BADGE_H, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(124,58,237,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, bx, cy, bw, BADGE_H, 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(badgeLabel, bx + bw / 2, cy + 14);

      // Winner name (left) + score (right)
      const winnerName = r.winner >= 0 ? bNames[r.winner] : 'Draw';
      ctx.fillStyle = '#fff';
      ctx.font = '800 12px system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(winnerName + (r.tiebreak ? ' ★' : ''), cx + 8, cardTop + 18);

      // Score — winning side in purple
      const scoreX = cx + cardW - 8;
      ctx.font = '700 11px system-ui,sans-serif';
      const dashW = ctx.measureText('–').width;
      const p2tw = ctx.measureText(String(r.p2Solves)).width;
      const p1tw = ctx.measureText(String(r.p1Solves)).width;
      const scoreGap = 3;
      // draw right to left: p2 → dash → p1
      ctx.fillStyle = r.winner === 1 ? '#a78bfa' : 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(r.p2Solves, scoreX, cardTop + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText('–', scoreX - p2tw - scoreGap, cardTop + 18);
      ctx.fillStyle = r.winner === 0 ? '#a78bfa' : 'rgba(255,255,255,0.35)';
      ctx.fillText(r.p1Solves, scoreX - p2tw - scoreGap - dashW - scoreGap, cardTop + 18);

      // Time list box — grey/purple background + border, vertically centered
      const mid = cx + cardW / 2;
      if (n > 0) {
        const boxPadH = 8;
        const boxTop2 = cardTop + 28;
        const boxBot2 = cardTop + cardH - BADGE_H / 2 - 6;
        const boxH2 = boxBot2 - boxTop2;
        const rowsH = (n - 1) * RSOLVE + 14;
        const listStartY = boxTop2 + (boxH2 - rowsH) / 2 + 13;

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        roundRect(ctx, cx + boxPadH, boxTop2, cardW - 2 * boxPadH, boxH2, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(124,58,237,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRect(ctx, cx + boxPadH, boxTop2, cardW - 2 * boxPadH, boxH2, 6);
        ctx.stroke();

        ctx.font = '500 10px system-ui,sans-serif';
        const vsHalf = ctx.measureText('vs').width / 2;
        const tGap = 8;
        for (let i = 0; i < n; i++) {
          const t1 = r.p1Times?.[i]; const t2 = r.p2Times?.[i];
          const p1win = t1 !== undefined && t2 !== undefined && t1 < t2;
          const p2win = t1 !== undefined && t2 !== undefined && t2 < t1;
          const sy = listStartY + i * RSOLVE;

          ctx.textAlign = 'right';
          ctx.fillStyle = p1win ? '#a78bfa' : 'rgba(255,255,255,0.5)';
          ctx.font = (p1win ? '700' : '500') + ' 13px system-ui,sans-serif';
          ctx.fillText(t1 !== undefined ? bFmt(t1) : '—', mid - vsHalf - tGap, sy);

          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.font = '500 10px system-ui,sans-serif';
          ctx.fillText('vs', mid, sy);

          ctx.textAlign = 'left';
          ctx.fillStyle = p2win ? '#a78bfa' : 'rgba(255,255,255,0.5)';
          ctx.font = (p2win ? '700' : '500') + ' 13px system-ui,sans-serif';
          ctx.fillText(t2 !== undefined ? bFmt(t2) : '—', mid + vsHalf + tGap, sy);
        }
      }
    });
    y += cardH + RVGAP;
  });

  // Footer — [logo] strati timer / MATCH [zap]
  y -= 4;
  const LOGO_SIZE = 30;
  const FS = 28, FS_MATCH = 20, GAP = 5;
  const ZAP_SIZE = 20, ZAP_GAP = 7;
  ctx.font = `800 ${FS}px Nunito,system-ui,sans-serif`;
  const stratiW = ctx.measureText('strati').width;
  ctx.font = `300 ${FS}px Nunito,system-ui,sans-serif`;
  const timerW = ctx.measureText('timer').width;
  ctx.font = `300 ${FS}px system-ui,sans-serif`;
  const slashW = ctx.measureText(' / ').width;
  ctx.font = `800 ${FS_MATCH}px system-ui,sans-serif`;
  const matchW = ctx.measureText('MATCH').width;
  const totalW = (logo ? LOGO_SIZE + GAP : 0) + stratiW + GAP + timerW + slashW + matchW + ZAP_GAP + ZAP_SIZE;
  let fx = (W - totalW) / 2;

  if (logo) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, fx, y + 2, LOGO_SIZE, LOGO_SIZE, 7);
    ctx.clip();
    ctx.drawImage(logo, fx, y + 2, LOGO_SIZE, LOGO_SIZE);
    ctx.restore();
    fx += LOGO_SIZE + GAP;
  }

  const textY = y + LOGO_SIZE - 1;
  ctx.font = `800 ${FS}px Nunito,system-ui,sans-serif`;
  ctx.fillStyle = '#7c3aed';
  ctx.textAlign = 'left';
  ctx.fillText('strati', fx, textY);
  fx += stratiW + GAP;

  ctx.font = `300 ${FS}px Nunito,system-ui,sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('timer', fx, textY);
  fx += timerW;

  ctx.font = `300 ${FS}px system-ui,sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText(' / ', fx, textY);
  fx += slashW;

  ctx.font = `800 ${FS_MATCH}px system-ui,sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('MATCH', fx, textY);
  fx += matchW + ZAP_GAP;

  // Zap icon inline after MATCH
  {
    const zapScale = ZAP_SIZE / 24;
    const zapTop = textY - ZAP_SIZE + 4;
    ctx.save();
    ctx.translate(fx, zapTop);
    ctx.scale(zapScale, zapScale);
    ctx.beginPath();
    ctx.moveTo(13, 2); ctx.lineTo(3, 14); ctx.lineTo(12, 14);
    ctx.lineTo(11, 22); ctx.lineTo(21, 10); ctx.lineTo(12, 10);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5 / zapScale;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // Taint check — toDataURL throws on cross-origin images (local logo)
  try { cv.toDataURL('image/png'); } catch(e) { _bDrawMatchCard(null, mode, btn); return; }

  cv.toBlob(async blob => {
    if (mode === 'copy') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
      } catch(e) { alert('Copy not supported in this browser.'); }
      return;
    }
    // download mode
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'strati-battle.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}



function renderBattleHistory() {
  for (let p = 0; p < 2; p++) {
    const list = document.getElementById(`b${p+1}-hist`);
    if (!list) continue;
    list.innerHTML = '';
    // Show newest first
    const entries = bHistory[p].slice().reverse();
    entries.forEach((entry, revIdx) => {
      const origIdx = bHistory[p].length - 1 - revIdx;
      const div = document.createElement('div');
      div.className = `bh-entry bh-${entry.result}`;
      const badge = entry.result === 'won' ? 'WIN' : entry.result === 'lost' ? 'LOSS' : 'DRAW';
      div.innerHTML = `<span class="bh-n">${entry.round}.</span><span class="bh-t">${bFmt(entry.time)}</span><span class="bh-badge">${badge}</span>`;
      div.addEventListener('click', () => openBSolveModal(p, origIdx));
      list.appendChild(div);
    });
  }
}

function openBSolveModal(playerIdx, solveIdx) {
  const entry = bHistory[playerIdx][solveIdx];
  if (!entry) return;
  document.getElementById('bsm-round').textContent = `ROUND ${entry.round} — PLAYER ${playerIdx + 1}`;
  document.getElementById('bsm-time').textContent = bFmt(entry.time);
  document.getElementById('bsm-scr').textContent = entry.scramble || '—';
  const res = entry.result;
  const el = document.getElementById('bsm-result');
  el.textContent = res === 'won' ? 'WIN' : res === 'lost' ? 'LOSS' : 'DRAW';
  el.style.background = res === 'won' ? 'rgba(0,200,83,.2)' : res === 'lost' ? 'rgba(220,38,38,.2)' : 'rgba(255,255,255,.1)';
  el.style.color = res === 'won' ? 'var(--green)' : res === 'lost' ? '#f87171' : 'var(--dim)';
  document.getElementById('bSolveModal').classList.remove('h');
}

document.getElementById('bSolveModalClose').addEventListener('click', () => {
  document.getElementById('bSolveModal').classList.add('h');
});
document.getElementById('bSolveModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('h');
});

document.addEventListener('keydown', e=>{
  if(!document.getElementById('mode-battle').classList.contains('active')) return;
  if(bcMode==='cubes') return;
  const i=bKeys.indexOf(e.code);
  if(i<0||e.repeat) return;
  if(bgDevices[i]) return;
  if(bMatchOver) return;
  if(!document.getElementById('bRoundModal').classList.contains('h')) return;
  // Prevent focused buttons from intercepting the key
  if(document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  if(bState[i].state==='idle'||bState[i].state==='stopped'){
    bSetState(i,'ready');
    if(bState[0].state==='ready'&&bState[1].state==='ready') bcCountdown();
  } else if(bState[i].state==='ready'&&!bcCountingDown){
    bSetState(i,'idle'); // press again to cancel ready
  } else if(bState[i].state==='running'){
    bState[i].t=Date.now()-bState[i].st;
    document.getElementById(bIds[i]+'-time').textContent=bFmt(bState[i].t);
    bSetState(i,'stopped');
    bCheckRoundEnd();
  }
});

// ── BATTLE CUBE MODE ──
let bcMode = 'keys';
let bcConns = [null, null];
let bcSubs = [null, null];
let bcFacelets = [null, null];
let bcWasSolved = [true, true];
let bcCountingDown = false;
let bcEarlyMove = [false, false];
let bcViews = [null, null];
let bcScrMoves = [[], []];
let bcScrIdx = [0, 0];
let bcScrCount = [0, 0];
let bcScrR2Dir = [null, null];
let bcErrSeq = [[], []];
let bcErrDir = [null, null];
let bcScrDone = [false, false];
let bcUCount = [0, 0];
let bcULastFace = [null, null];

function bcInverse(mv) { if (!mv) return ''; if (mv.endsWith("'")) return mv.slice(0,-1); if (mv.endsWith('2')) return mv; return mv+"'"; }
function bcFaceBase(m) { return m.replace(/[2']/g,''); }

function bcInitAllScrambles() {
  const scr = (typeof state !== 'undefined' && state.scrHistory) ? (state.scrHistory[state.scrIdx] || '') : '';
  const moves = scr.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < 2; i++) {
    bcScrMoves[i] = moves;
    bcScrIdx[i] = 0; bcScrCount[i] = 0; bcScrR2Dir[i] = null;
    bcErrSeq[i] = []; bcErrDir[i] = null;
    bcScrDone[i] = false; bcUCount[i] = 0; bcULastFace[i] = null;
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
  if (bcErrSeq[i].length > 0) {
    // Compress consecutive identical moves into X2
    const raw = bcErrSeq[i].slice().reverse();
    const todo = []; let j = 0;
    while (j < raw.length) {
      if (j+1 < raw.length && raw[j] === raw[j+1] && !raw[j].endsWith('2')) { todo.push(raw[j].replace("'",'')+'2'); j+=2; }
      else { todo.push(raw[j]); j++; }
    }
    el.innerHTML = todo.map((m,k) =>
      k === 0
        ? `<span style="background:var(--red,#cc2222);color:#fff;border-radius:6px;padding:2px 8px;font-weight:900">${m}</span>`
        : `<span style="color:rgba(255,255,255,.4)">${m}</span>`
    ).join(' ');
    return;
  }
  el.innerHTML = moves.map((m, j) => {
    if (j < idx) return `<span style="color:rgba(255,255,255,.2)">${m}</span>`;
    if (j === idx) return `<span style="background:var(--purple);color:#fff;border-radius:6px;padding:2px 8px;font-weight:900">${m}</span>`;
    return `<span style="color:#fff">${m}</span>`;
  }).join(' ');
}

function bcOnMove(i, mv) {
  // Move during countdown = DNF
  if (bcCountingDown && bState[i].state === 'ready') {
    if (!bcEarlyMove[i]) {
      bcEarlyMove[i] = true;
      const timeEl = document.getElementById(bIds[i] + '-time');
      if (timeEl) { timeEl.textContent = 'DNF'; timeEl.style.color = 'var(--red)'; }
    }
    return;
  }

  // ×4 on any face triggers ready
  if (bState[i].state === 'idle' && bcScrDone[i]) {
    const face = bcFaceBase(mv);
    if (bcULastFace[i] === face) { bcUCount[i]++; } else { bcUCount[i] = 1; bcULastFace[i] = face; }
    if (bcUCount[i] >= 4) { bcUCount[i] = 0; bcULastFace[i] = null; bcPlayerReady(i); return; }
  } else { bcUCount[i] = 0; bcULastFace[i] = null; }

  if (bcScrDone[i] || bcScrIdx[i] >= bcScrMoves[i].length || bState[i].state !== 'idle') return;

  if (bcErrSeq[i].length > 0) {
    const need = bcErrSeq[i][bcErrSeq[i].length - 1];
    const needBase = bcFaceBase(need), mvBase = bcFaceBase(mv);
    const isPair = bcErrSeq[i].length >= 2 && bcErrSeq[i][bcErrSeq[i].length - 2] === need && !need.endsWith('2');
    if (bcErrDir[i]) {
      if (mv === bcErrDir[i]) {
        bcErrSeq[i].pop(); bcErrDir[i] = null;
        if (bcErrSeq[i].length === 0) { bcScrCount[i] = 0; bcScrR2Dir[i] = null; }
      } else {
        bcErrSeq[i].push(bcInverse(bcErrDir[i])); bcErrDir[i] = null;
        bcErrSeq[i].push(bcInverse(mv));
      }
    } else if (mv === need) {
      bcErrSeq[i].pop();
      if (bcErrSeq[i].length === 0) { bcScrCount[i] = 0; bcScrR2Dir[i] = null; }
    } else if (isPair && mvBase === needBase) {
      bcErrSeq[i].pop(); bcErrDir[i] = mv;
    } else {
      bcErrSeq[i].push(bcInverse(mv));
    }
  } else {
    const cur = bcScrMoves[i][bcScrIdx[i]];
    const isDouble = cur?.endsWith('2');
    const base = bcFaceBase(cur || '');
    const mvBase = bcFaceBase(mv);
    let correct = false;
    if (isDouble) {
      if (bcScrCount[i] === 0) { correct = (mvBase === base); if (correct) bcScrR2Dir[i] = mv; }
      else { correct = (mv === bcScrR2Dir[i]); }
    } else {
      correct = (mv === cur);
    }
    if (correct) {
      bcScrCount[i]++;
      if (bcScrCount[i] >= (isDouble ? 2 : 1)) {
        bcScrCount[i] = 0; bcScrR2Dir[i] = null; bcScrIdx[i]++;
        if (bcScrIdx[i] >= bcScrMoves[i].length) { bcScrDone[i] = true; bcUpdateCard(i); }
      }
    } else {
      if (bcScrCount[i] > 0 && bcScrR2Dir[i]) bcErrSeq[i].push(bcInverse(bcScrR2Dir[i]));
      bcScrCount[i] = 0; bcScrR2Dir[i] = null;
      bcErrSeq[i].push(bcInverse(mv));
    }
  }
  bcUpdateScrHighlight(i);
}

function bcResetGyro(i) { bcViews[i]?.resetGyro(); }

async function bcResetCube(i) {
  const conn = bcConns[i]; if (!conn) return;
  try { if (conn.capabilities?.reset) await conn.sendCommand({type:'REQUEST_RESET'}); } catch(e) {}
  bcFacelets[i] = SC_SOLVED; bcWasSolved[i] = true;
  bcViews[i]?.updateColors(SC_SOLVED);
  bcScrIdx[i] = 0; bcScrCount[i] = 0; bcScrR2Dir[i] = null;
  bcErrSeq[i] = []; bcErrDir[i] = null;
  bcScrDone[i] = false; bcUCount[i] = 0; bcULastFace[i] = null;
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
  const readyBtn = document.getElementById(pid + '-ready-btn');
  if (!connBtn) return;
  const hintEl = document.getElementById(pid + '-hint');
  if (!conn) {
    connBtn.style.display = '';
    connBtn.disabled = false;
    if (connInfo) connInfo.style.display = 'none';
    if (readyBtn) readyBtn.style.display = 'none';
    if (hintEl) hintEl.innerHTML = '';
  } else {
    connBtn.style.display = 'none';
    if (connInfo) connInfo.style.display = 'flex';
    if (cubeNameEl) cubeNameEl.textContent = conn.deviceName || ('Cube ' + (i + 1));
    const st = bState[i].state;
    if (hintEl) {
      if (st === 'stopped') hintEl.innerHTML = 'Waiting for opponent…';
      else if (st === 'idle' && !bcScrDone[i]) hintEl.innerHTML = 'Scrambling…';
      else if (st === 'idle' && bcScrDone[i]) hintEl.innerHTML = 'Tap ready or U4';
      else if (st === 'running') hintEl.innerHTML = 'Solving!';
      else hintEl.innerHTML = '';
    }
    if (readyBtn) {
      readyBtn.style.display = '';
      if (st === 'idle') {
        readyBtn.disabled = !bcScrDone[i];
        readyBtn.className = 'b-ready-btn';
        readyBtn.innerHTML = 'Ready ? <span style="opacity:.55;font-size:.8em;font-weight:600">(U4)</span>';
      } else if (st === 'ready') {
        readyBtn.disabled = true;
        readyBtn.className = 'b-ready-btn checked';
        readyBtn.innerHTML = '✓ Ready';
      } else {
        readyBtn.disabled = true;
        readyBtn.className = 'b-ready-btn';
        readyBtn.innerHTML = st === 'running' ? 'Solving…' : 'Done';
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
  if (connBtn) { connBtn.disabled = true; connBtn.style.opacity = '0.4'; }
  const hintEl = document.getElementById(pid + '-hint');
  if (hintEl) hintEl.innerHTML = 'Connecting…';
  try {
    const conn = await window.SmartCubeLib.connectSmartCube({ deviceSelection: 'filtered', enableAddressSearch: true });
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
    console.error('[bcConnect] failed:', e);
    if (connBtn) { connBtn.disabled = false; connBtn.style.opacity = ''; }
    if (hintEl) hintEl.innerHTML = '';
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
  if (!document.getElementById('bRoundModal').classList.contains('h')) return;
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
  bcEarlyMove[0] = false; bcEarlyMove[1] = false;
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
      bcBeep(880, 0.25, 0.5);
      bcBeep(1100, 0.35, 0.3);
      const now = Date.now();
      let anyRunning = false;
      for (let j = 0; j < 2; j++) {
        if ((bState[j].state === 'ready' || bState[j].state === 'running') && bcEarlyMove[j]) {
          // DNF — moved during countdown
          bState[j].t = Infinity;
          bSetState(j, 'stopped');
          const timeEl = document.getElementById(bIds[j] + '-time');
          if (timeEl) { timeEl.textContent = 'DNF'; timeEl.style.color = 'var(--red)'; }
        } else if (bState[j].state === 'ready') {
          bState[j].st = now; bState[j].t = 0;
          document.getElementById(bIds[j] + '-time').textContent = '0.000';
          document.getElementById('b' + (j + 1) + '-card').classList.remove('winner');
          bSetState(j, 'running');
          anyRunning = true;
        }
      }
      if (anyRunning && !bRaf) bRaf = requestAnimationFrame(bTick);
      bCheckRoundEnd(); // resolve immediately if both DNF
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
  if (inCubes) { bcInitAllScrambles(); bgDisconnect(0); bgDisconnect(1); }
  for (let i = 0; i < 2; i++) {
    const keyEl = document.getElementById('b' + (i + 1) + '-key');
    const cubeUi = document.getElementById('b' + (i + 1) + '-cube-ui');
    const wrap3d = document.getElementById('b' + (i + 1) + '-3d-wrap');
    const scrTxt = document.getElementById('b' + (i + 1) + '-scr-txt');
    const stUi   = document.getElementById('b' + (i + 1) + '-st-ui');
    const connBtn = document.getElementById('b' + (i + 1) + '-conn-btn');
    const connInfo = document.getElementById('b' + (i + 1) + '-conn-info');
    const hintEl2 = document.getElementById('b' + (i + 1) + '-hint');
    const keyReadyBtn2 = document.getElementById('b' + (i + 1) + '-key-ready');
    if (keyEl) keyEl.style.display = inCubes ? 'none' : '';
    if (keyReadyBtn2) keyReadyBtn2.style.display = inCubes ? 'none' : '';
    if (hintEl2) hintEl2.style.display = '';
    if (cubeUi) cubeUi.style.display = inCubes ? '' : 'none';
    if (stUi) stUi.style.display = inCubes ? 'none' : '';
    if (scrTxt) scrTxt.style.display = inCubes ? '' : 'none';
    if (!inCubes) {
      if (connBtn) connBtn.style.display = 'none';
      if (connInfo) connInfo.style.display = 'none';
    }
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
  bHistory = [[], []];
  document.getElementById('b1-score').textContent = '0';
  document.getElementById('b2-score').textContent = '0';
  document.getElementById('battleResult').textContent = '';
  for (let p = 0; p < 2; p++) {
    const list = document.getElementById(`b${p+1}-hist`);
    if (list) list.innerHTML = '';
  }
}

lucide.createIcons();
