
// ── BLUETOOTH MODAL ──
const btModal = document.getElementById('btModal');
document.getElementById('btBtn').addEventListener('click', ()=>{
  btModal.classList.remove('h');
  if (!ganConnected) {
    document.getElementById('btStatus').textContent = 'Press scan to search for nearby GAN timers.';
    document.getElementById('btScanBtn').style.display = '';
    document.getElementById('btDisconnBtn').style.display = 'none';
  }
  lucide.createIcons();
});
document.getElementById('btModalClose').addEventListener('click', ()=>btModal.classList.add('h'));
btModal.addEventListener('click', e=>{ if(e.target===btModal) btModal.classList.add('h'); });
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
    if (statusEl) statusEl.textContent = 'Press scan to search for nearby GAN timers.';
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
  statusEl.innerHTML = '<span style="color:var(--purple)">Scanning…</span> Select your GAN timer from the browser dialog.';
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
document.querySelectorAll('.ac[data-mode]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const mode = btn.dataset.mode;
    document.querySelectorAll('.ac[data-mode]').forEach(b=>b.classList.toggle('on', b===btn));
    document.querySelector('.t-center').style.display = mode==='timer' ? '' : 'none';
    document.getElementById('mode-cube').classList.toggle('active', mode==='cube');
    document.getElementById('mode-battle').classList.toggle('active', mode==='battle');
    document.querySelector('.t-rp').style.display = mode==='timer' ? '' : 'none';
  });
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
  if(s==='idle'){hintEl.innerHTML=`Hold <strong>${key}</strong> to ready`;}
  else if(s==='holding'){hintEl.innerHTML=`Keep holding <strong>${key}</strong>…`;}
  else if(s==='ready'){hintEl.innerHTML=`Release <strong>${key}</strong> to start!`;}
  else if(s==='running'){hintEl.innerHTML=`Press <strong>${key}</strong> to stop`;}
  else if(s==='stopped'){hintEl.innerHTML=`Waiting for opponent…`;}
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

lucide.createIcons();
