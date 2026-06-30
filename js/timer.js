// ─── TIMER LOGIC ────────────────────────────────────────────────────────────
let holdTimer = null;

// ─── MASCOT SYSTEM ───────────────────────────────────────────────────────────
let _mascotHideTimer = null;
let _sleepTimer = null;

function showMascot(src, msg, duration=20000) {
  const el=document.getElementById('mascot');
  const area=document.getElementById('mascotArea');
  const bub=document.getElementById('spBubble');
  if(_mascotHideTimer){clearTimeout(_mascotHideTimer);_mascotHideTimer=null;}
  el.src=src;
  if(msg){bub.textContent=msg;bub.style.display='';}
  else bub.style.display='none';
  area.style.display='flex';
  el.style.animation='none'; el.offsetHeight; el.style.animation='mascotPop .35s cubic-bezier(.4,-.2,.6,1.4)';
  if(duration>0) _mascotHideTimer=setTimeout(()=>{area.style.display='none';},duration);
}

function hideMascot(){
  if(_mascotHideTimer){clearTimeout(_mascotHideTimer);_mascotHideTimer=null;}
  document.getElementById('mascotArea').style.display='none';
}

function resetSleepTimer(){
  if(_sleepTimer) clearTimeout(_sleepTimer);
  _sleepTimer=setTimeout(()=>{
    if(document.getElementById('mascotArea').style.display==='none')
      showMascot('Mascotte/sleep.png','zzz...',0);
  }, 3*60*1000);
}

function setTimerState(s) {
  state.timerState = s;
  document.getElementById('timerDisp').className = s;
  if(s==='inspecting'||s==='holding'||s==='ready'||s==='running') hideMascot();
}

// ─── INSPECTION (WCA-style 15s) ───────────────────────────────────────────────
let inspectRafId = null;
let inspectBeep8 = false, inspectBeep12 = false;
let inspectAudioCtx = null;
function inspectUnlockAudio() {
  try {
    if (!inspectAudioCtx || inspectAudioCtx.state === 'closed') inspectAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (inspectAudioCtx.state === 'suspended') inspectAudioCtx.resume();
  } catch(e) {}
}

function inspectBeepSound(freq, dur, vol=0.4) {
  try {
    inspectUnlockAudio();
    const osc = inspectAudioCtx.createOscillator();
    const gain = inspectAudioCtx.createGain();
    osc.connect(gain); gain.connect(inspectAudioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, inspectAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, inspectAudioCtx.currentTime + dur);
    osc.start(); osc.stop(inspectAudioCtx.currentTime + dur);
  } catch(e) {}
}

function startInspection() {
  inspectUnlockAudio();
  state.inspectActive = true;
  state.inspectStart = Date.now();
  state.inspectPenalty = 0;
  inspectBeep8 = false; inspectBeep12 = false;
  setTimerState('inspecting');
  inspectTick();
}

function finishInspection() {
  state.inspectActive = false;
  if (inspectRafId) { cancelAnimationFrame(inspectRafId); inspectRafId = null; }
}

function inspectTick() {
  if (!state.inspectActive) return;
  const elapsed = Date.now() - state.inspectStart;
  const disp = document.getElementById('timerDisp');
  if (elapsed >= 17000) {
    // Inspection time exceeded — automatic DNF
    state.inspectActive = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    spaceDown = false; touchDown = false;
    const solve = {
      ms: 0, dnf: true, plus2: false,
      scramble: state.scrHistory[state.scrIdx]||'',
      date: new Date().toISOString()
    };
    curSes().times.unshift(solve);
    addXP(1);
    renderStats();
    renderTimeList();
    setTimerState('stopped');
    disp.textContent = 'DNF';
    pushScramble();
    renderScramble();
    inspectRafId = null;
    return;
  }
  if (!inspectBeep8 && elapsed >= 8000) { inspectBeepSound(880, 0.1); inspectBeep8 = true; }
  if (!inspectBeep12 && elapsed >= 12000) {
    inspectBeepSound(660, 0.1);
    setTimeout(()=>inspectBeepSound(660, 0.1), 150);
    inspectBeep12 = true;
  }
  state.inspectPenalty = elapsed >= 15000 ? 2 : 0;
  disp.textContent = elapsed >= 15000 ? '+2' : String(Math.max(0, Math.ceil((15000-elapsed)/1000)));
  inspectRafId = requestAnimationFrame(inspectTick);
}

function tick() {
  const elapsed = Date.now() - state.startMs;
  document.getElementById('timerDisp').textContent = fmtMs(elapsed);
  state.rafId = requestAnimationFrame(tick);
}

function startTimer() {
  state.startMs = Date.now();
  state.rafId = requestAnimationFrame(tick);
  setTimerState('running');
}

function stopTimer(overrideMs) {
  if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId=null; }
  const ms = overrideMs !== undefined ? overrideMs : Date.now() - state.startMs;
  state.elapsed = ms;
  document.getElementById('timerDisp').textContent = fmtMs(ms);
  // Capture stats before adding solve
  const prevBestSingle=bestSingle(), prevBestAo5=bestAo(5), prevBestAo12=bestAo(12), prevBestAo100=bestAo(100);
  // Save solve
  const solve = {
    ms, dnf:false, plus2: state.inspectPenalty===2,
    scramble: state.scrHistory[state.scrIdx]||'',
    date: new Date().toISOString(),
    ...(overrideMs !== undefined ? { stackmat: true } : {}),
    ...(typeof scPendingSolveData!=='undefined'&&scPendingSolveData?scPendingSolveData:{})
  };
  state.inspectPenalty = 0;
  curSes().times.unshift(solve);
  addXP(1);
  renderStats();
  renderTimeList();
  setTimerState('stopped');
  // Smart mascot feedback
  const nbSingle=bestSingle(), nbAo5=bestAo(5), nbAo12=bestAo(12), nbAo100=bestAo(100);
  const mean=calcMean();
  const valids=curSes().times.filter(t=>!t.dnf).map(t=>t.plus2?t.ms+2000:t.ms);
  const worst=valids.length>1?Math.max(...valids):null;
  resetSleepTimer();
  if(nbSingle!==null&&(prevBestSingle===null||nbSingle<prevBestSingle))
    showMascot('Mascotte/happy.png','Congrats, new PB single!',20000);
  else if(nbAo5!==null&&(prevBestAo5===null||nbAo5<prevBestAo5))
    showMascot('Mascotte/happy.png',"Congrats, you did your best average of 5! Let's celebrate?",20000);
  else if(nbAo12!==null&&(prevBestAo12===null||nbAo12<prevBestAo12))
    showMascot('Mascotte/happy.png',"Congrats, you did your best average of 12! Let's celebrate?",20000);
  else if(nbAo100!==null&&(prevBestAo100===null||nbAo100<prevBestAo100))
    showMascot('Mascotte/happy.png',"Congrats, you did your best average of 100! Let's celebrate?",20000);
  else if(prevBestAo5!==null&&ms<prevBestAo5)
    showMascot('Mascotte/happy.png','Wow!',20000);
  else if(worst!==null&&ms===worst&&valids.length>=3)
    showMascot('Mascotte/mad.PNG','That was a rough one...',20000);
  else if(mean!==null&&ms>mean&&valids.length>=5)
    showMascot('Mascotte/mad.PNG','You can do better!',20000);
  else if(mean!==null&&ms<mean&&valids.length>=5)
    showMascot('Mascotte/happy.png','Better!',20000);
  else
    hideMascot();
  // Generate next scramble
  pushScramble();
  renderScramble();
}

// Key events
let spaceDown = false;
let ganConnected = false;
function isTyping(){ return ['INPUT','TEXTAREA'].includes(document.activeElement.tagName); }
function fmtMs(ms){ const t=ms/1000; return t<60?t.toFixed(3):`${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`; }

// ─── AO DETAIL MODAL ─────────────────────────────────────────────────────────
function getAoWindow(n, isBest) {
  const ts = curSes().times;
  if (ts.length < n) return null;
  if (!isBest) return { chunk: ts.slice(0, n), startIdx: 0 };
  let best=null, bestIdx=0;
  for (let i=0; i<=ts.length-n; i++) {
    const chunk=ts.slice(i,i+n);
    const dnfs=chunk.filter(t=>t.dnf).length;
    if (dnfs>1) continue;
    const vals=chunk.map(t=>t.dnf?Infinity:(t.plus2?t.ms+2000:t.ms)).sort((a,b)=>a-b);
    const trim=vals.slice(1,-1);
    if (trim.some(v=>v===Infinity)) continue;
    const avg=trim.reduce((a,b)=>a+b,0)/trim.length;
    if (best===null||avg<best){best=avg;bestIdx=i;}
  }
  return best===null?null:{chunk:ts.slice(bestIdx,bestIdx+n),startIdx:bestIdx};
}

function openAoDetail(stat, type) {
  const ts = curSes().times;
  const modal = document.getElementById('aoDetailModal');
  const title = document.getElementById('aoDetailTitle');
  const avgEl = document.getElementById('aoDetailAvg');
  const list  = document.getElementById('aoDetailList');

  if (stat==='single') {
    // Find best or current single
    const valid = ts.filter(t=>!t.dnf);
    if (!valid.length) return;
    const t = type==='best' ? valid.reduce((a,b)=>(a.ms<b.ms?a:b)) : ts[0];
    const idx = ts.indexOf(t);
    title.textContent = type==='best' ? 'Best single' : 'Current single';
    avgEl.textContent = fmtMsFull(t.ms, t);
    list.innerHTML = `<div style="text-align:center;font-size:13px;color:var(--dim);cursor:pointer;text-decoration:underline" data-open-idx="${idx}">Solve #${ts.length-idx} — click to view</div>`;
    list.querySelector('[data-open-idx]').addEventListener('click', e=>{
      modal.classList.add('h');
      openSolveModal(+e.currentTarget.dataset.openIdx);
    });
    modal.classList.remove('h');
    return;
  }

  const n = stat==='ao5'?5:stat==='ao12'?12:100;
  const win = getAoWindow(n, type==='best');
  if (!win) return;
  const {chunk, startIdx} = win;

  const vals = chunk.map((t,i)=>({t,i,v:t.dnf?Infinity:(t.plus2?t.ms+2000:t.ms)}));
  const sorted = [...vals].sort((a,b)=>a.v-b.v);
  const trimmedLow  = new Set([sorted[0].i]);
  const trimmedHigh = new Set([sorted[sorted.length-1].i]);

  const avg = calcAoFromChunk(chunk);
  title.textContent = (type==='best'?'Best ':'Current ')+stat;
  avgEl.textContent = avg!==null?fmtMs(avg):'DNF';

  list.innerHTML = chunk.map((t,i)=>{
    const solveNum = ts.length - (startIdx+i);
    const isTrimLow = trimmedLow.has(i), isTrimHigh = trimmedHigh.has(i);
    const trimmed = isTrimLow || isTrimHigh;
    const color = isTrimLow ? '#00ff7f' : isTrimHigh ? '#ff2222' : '#fff';
    const d = t.date ? new Date(t.date) : null;
    const dateStr = d ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
    const timeStr = d ? d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:rgba(255,255,255,.06);border-radius:8px;cursor:pointer;font-size:17px" data-open-idx="${startIdx+i}">
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="color:var(--muted);font-size:12px">#${solveNum}</span>
        <span style="color:var(--dim);font-size:11px">${dateStr}${dateStr&&timeStr?' · ':''}${timeStr}</span>
      </div>
      <span style="font-weight:700;color:${color};${trimmed?'opacity:.5':''}">
        ${fmtMsFull(t.ms,t)}
      </span>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-open-idx]').forEach(el=>{
    el.addEventListener('click',()=>{
      modal.classList.add('h');
      openSolveModal(+el.dataset.openIdx);
    });
  });
  modal.classList.remove('h');
}

function calcAoFromChunk(chunk) {
  const dnfs=chunk.filter(t=>t.dnf).length;
  if(dnfs>1) return null;
  const vals=chunk.map(t=>t.dnf?Infinity:(t.plus2?t.ms+2000:t.ms)).sort((a,b)=>a-b);
  const trim=vals.slice(1,-1);
  if(trim.some(v=>v===Infinity)) return null;
  return trim.reduce((a,b)=>a+b,0)/trim.length;
}

document.getElementById('aoDetailClose').addEventListener('click',()=>document.getElementById('aoDetailModal').classList.add('h'));
document.getElementById('aoDetailModal').addEventListener('click',e=>{if(e.target===document.getElementById('aoDetailModal'))document.getElementById('aoDetailModal').classList.add('h');});

document.querySelectorAll('.sv.clickable').forEach(el=>{
  el.addEventListener('click',()=>{
    const v=el.textContent.trim();
    if(v==='–') return;
    openAoDetail(el.dataset.stat, el.dataset.type);
  });
});

const delSolveModal = document.getElementById('delSolveModal');
document.getElementById('delSolveCancel').addEventListener('click', ()=>delSolveModal.classList.add('h'));
delSolveModal.addEventListener('click', e=>{ if(e.target===delSolveModal) delSolveModal.classList.add('h'); });

const clearTimesModal = document.getElementById('clearTimesModal');
document.getElementById('clearTimesBtn').addEventListener('click', ()=>{
  const n = curSes().times.length;
  if (!n) { toast('No times to delete'); return; }
  document.getElementById('clearTimesInfo').textContent = `This will permanently delete all ${n} solve${n!==1?'s':''} in "${curSes().name}".`;
  clearTimesModal.classList.remove('h');
});
document.getElementById('clearTimesClose').addEventListener('click', ()=>clearTimesModal.classList.add('h'));
document.getElementById('clearTimesCancel').addEventListener('click', ()=>clearTimesModal.classList.add('h'));
clearTimesModal.addEventListener('click', e=>{ if(e.target===clearTimesModal) clearTimesModal.classList.add('h'); });
document.getElementById('clearTimesConfirm').addEventListener('click', ()=>{
  const n = curSes().times.length;
  curSes().times = [];
  clearTimesModal.classList.add('h');
  document.getElementById('timerDisp').textContent = '0.000';
  addXP(-n);
  renderStats(); renderTimeList();
});
document.addEventListener('keydown', e=>{
  if (!delSolveModal.classList.contains('h') && e.key==='Enter') {
    e.preventDefault();
    document.getElementById('delSolveConfirm').click();
  }
  if (!clearTimesModal.classList.contains('h') && e.key==='Enter') {
    e.preventDefault();
    document.getElementById('clearTimesConfirm').click();
  }
});
document.getElementById('delSolveConfirm').addEventListener('click', ()=>{
  const times = curSes().times;
  if (!times.length) return;
  times.splice(0, 1);
  addXP(-1);
  renderStats(); renderTimeList();
  setTimerState('idle');
  const disp = document.getElementById('timerDisp');
  const t = times[0];
  disp.textContent = t ? (t.dnf ? 'DNF' : fmtMs(t.ms+(t.plus2?2000:0))) : '0.000';
  delSolveModal.classList.add('h');
});

document.addEventListener('keydown', e => {
  if (e.code==='Space' && !e.repeat) {
    e.preventDefault();
    if (!document.getElementById('drillModal').classList.contains('h')) return; // drill modal owns space
    if (document.getElementById('mode-battle').classList.contains('active')) return;
    if (ganConnected) return; // GAN timer controls the timer
    if (state.timerState==='running') { stopTimer(); return; }
    if (state.timerState==='idle'||state.timerState==='stopped') {
      if (state.settings.inspection) { startInspection(); return; }
      spaceDown = true;
      setTimerState('holding');
      state.holdStart = Date.now();
      holdTimer = setTimeout(()=>{ if(spaceDown) setTimerState('ready'); }, state.settings.delay*1000);
      return;
    }
    if (state.timerState==='inspecting') {
      spaceDown = true;
      setTimerState('holding');
      state.holdStart = Date.now();
      holdTimer = setTimeout(()=>{ if(spaceDown) setTimerState('ready'); }, state.settings.delay*1000);
      return;
    }
  }
  // Shortcuts — only on timer page (not battle mode), not while typing, not while running
  if (state.page!=='timer' || document.getElementById('mode-battle').classList.contains('active') || isTyping() || state.timerState==='running' || state.timerState==='holding' || state.timerState==='ready' || state.timerState==='inspecting') return;
  if (e.key.toLowerCase()==='a') { document.getElementById('addTimeBtn').click(); return; }
  const times = curSes().times;
  if (!times.length) return;
  const last = times[0];
  if (e.key==='2') {
    last.plus2 = !last.plus2; if(last.plus2) last.dnf = false;
    save(); renderStats(); renderTimeList();
  }
  if (e.key.toLowerCase()==='d') {
    last.dnf = !last.dnf; if(last.dnf) last.plus2 = false;
    save(); renderStats(); renderTimeList();
  }
  if (e.key==='Delete' || e.key==='Backspace') {
    e.preventDefault();
    document.getElementById('delSolveInfo').textContent = `Solve #${times.length}: ${last.dnf?'DNF':fmtMs(last.ms+(last.plus2?2000:0))}`;
    delSolveModal.classList.remove('h');
  }
});
document.addEventListener('keyup', e => {
  if (e.code==='Space') {
    e.preventDefault();
    if (!document.getElementById('drillModal').classList.contains('h')) return; // drill modal owns space
    if (document.getElementById('mode-battle').classList.contains('active')) return;
    if (ganConnected) return;
    spaceDown = false;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer=null; }
    if (state.timerState==='ready') { if (state.inspectActive) finishInspection(); startTimer(); return; }
    if (state.timerState==='holding') { setTimerState(state.inspectActive ? 'inspecting' : 'idle'); }
  }
});

// Touch support
let touchDown = false;
document.addEventListener('touchstart', e => {
  if (state.page!=='timer') return;
  if (ganConnected) return;
  if (state.timerState==='running') { stopTimer(); return; }
  if (state.timerState==='idle'||state.timerState==='stopped') {
    if (state.settings.inspection) { startInspection(); return; }
    touchDown = true;
    setTimerState('holding');
    state.holdStart = Date.now();
    holdTimer = setTimeout(()=>{ if(touchDown) setTimerState('ready'); }, state.settings.delay*1000);
    return;
  }
  if (state.timerState==='inspecting') {
    touchDown = true;
    setTimerState('holding');
    state.holdStart = Date.now();
    holdTimer = setTimeout(()=>{ if(touchDown) setTimerState('ready'); }, state.settings.delay*1000);
  }
}, {passive:true});
document.addEventListener('touchend', () => {
  touchDown = false;
  if (holdTimer) { clearTimeout(holdTimer); holdTimer=null; }
  if (state.timerState==='ready') { if (state.inspectActive) finishInspection(); startTimer(); return; }
  if (state.timerState==='holding') setTimerState(state.inspectActive ? 'inspecting' : 'idle');
});

