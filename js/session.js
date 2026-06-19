// ─── NAVIGATION ────────────────────────────────────────────────────────────
function navigate(page) {
  state.page = page;
  document.querySelectorAll('.nav-item,.set-link').forEach(el=>{
    el.classList.toggle('active', el.dataset.page===page);
  });
  document.querySelectorAll('.page').forEach(el=>{
    el.classList.toggle('active', el.id===`pg-${page}`);
  });
  document.getElementById('tb').style.display = (page==='timer'||page==='stats') ? '' : 'none';
  document.getElementById('puzBtn').style.display = page==='timer' ? '' : 'none';
  document.querySelector('.tb-acts').style.display = page==='timer' ? '' : 'none';
  if (page==='timer') { showMascot('Mascotte/hi.png','Hey! Ready to solve?',0); resetSleepTimer(); }
  if (page==='stats') { renderStats(); renderTimeList(); }
  if (page==='algs') { selectCat('3x3'); renderAlgCounts(); }
  if (page==='social') { renderStats(); renderTimeList(); renderAlgCounts(); renderAlgChipIcons(); applySocialShare(); renderRecoFeed(); }
  if (page==='profile') { renderStats(); renderAlgCounts(); renderAlgChipIcons(); renderShareSessionPick(); }
}

document.querySelectorAll('.nav-item,.set-link').forEach(el=>{
  el.addEventListener('click', ()=>navigate(el.dataset.page));
});

document.getElementById('sbToggle').addEventListener('click', ()=>{
  document.getElementById('sb').classList.toggle('sb-collapsed');
});
document.getElementById('logoIcon').addEventListener('click', ()=>{
  const sb = document.getElementById('sb');
  if (sb.classList.contains('sb-collapsed')) sb.classList.remove('sb-collapsed');
});

// ─── SESSION MANAGEMENT ──────────────────────────────────────────────────────
function renderSesMenu() {
  const menu = document.getElementById('sesDdMenu');
  menu.innerHTML = state.sessions.map((s,i)=>`<div class="dd-item${i===state.sesIdx?' on':''}" data-i="${i}">${s.name}</div>`).join('');
  menu.querySelectorAll('.dd-item').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      state.sesIdx = +el.dataset.i;
      document.getElementById('sesName').textContent = curSes().name;
      state.puzzle = curSes().puzzle || '3×3';
      document.getElementById('puzName').textContent = state.puzzle;
      updatePuzIcon();
      puzMenu.querySelectorAll('.dd-item').forEach(e=>e.classList.toggle('on',e.textContent===state.puzzle));
      menu.classList.add('h');
      save(); renderStats(); renderTimeList(); pushScramble(); renderScramble();
    });
  });
}

document.getElementById('sesDdBtn').addEventListener('click', e=>{
  e.stopPropagation();
  renderSesMenu();
  document.getElementById('sesDdMenu').classList.toggle('h');
});

const sesNameModal = document.getElementById('sesNameModal');
const sesNameInput = document.getElementById('sesNameInput');
let sesNameMode = 'new';
function openSesNameModal(mode) {
  sesNameMode = mode;
  document.getElementById('sesNameModalTitle').textContent = mode==='new' ? 'New Session' : 'Rename Session';
  sesNameInput.value = mode==='new' ? `Session ${state.sessions.length+1}` : curSes().name;
  sesNameInput.style.borderColor = 'rgba(255,255,255,.2)';
  sesNameModal.classList.remove('h');
  setTimeout(()=>{ sesNameInput.focus(); sesNameInput.select(); }, 50);
}
function confirmSesName() {
  const name = sesNameInput.value.trim();
  if (!name) { sesNameInput.style.borderColor='var(--red)'; return; }
  if (sesNameMode==='new') {
    state.sessions.push({name, puzzle:state.puzzle, times:[]});
    state.sesIdx = state.sessions.length-1;
  } else {
    curSes().name = name;
  }
  document.getElementById('sesName').textContent = curSes().name;
  sesNameModal.classList.add('h');
  save(); renderStats(); renderTimeList(); pushScramble(); renderScramble();
}
document.getElementById('sesNameModalClose').addEventListener('click', ()=>sesNameModal.classList.add('h'));
sesNameModal.addEventListener('click', e=>{ if(e.target===sesNameModal) sesNameModal.classList.add('h'); });
document.getElementById('sesNameConfirm').addEventListener('click', confirmSesName);
sesNameInput.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmSesName(); sesNameInput.style.borderColor='rgba(255,255,255,.2)'; });

document.getElementById('newSesBtn').addEventListener('click', ()=>openSesNameModal('new'));
document.getElementById('renSesBtn').addEventListener('click', ()=>openSesNameModal('rename'));

const delSesModal = document.getElementById('delSesModal');
let delSesTargetIdx = -1;

function openDelSesModal() {
  if (state.sessions.length <= 1) { toast('Cannot delete the last session'); return; }
  delSesTargetIdx = -1;
  document.getElementById('delSesConfirmRow').style.display = 'none';
  const list = document.getElementById('delSesList');
  list.style.display = 'flex';
  list.innerHTML = state.sessions.map((s,i) => `
    <div data-i="${i}" style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.07);border-radius:10px;padding:11px 14px;cursor:pointer;font-size:14px;font-weight:600;transition:background .15s" class="del-ses-item">
      <span>${s.name}</span>
      <span style="font-size:11px;color:var(--dim)">${s.times.length} solve${s.times.length!==1?'s':''}</span>
    </div>`).join('');
  list.querySelectorAll('.del-ses-item').forEach(el => {
    el.addEventListener('mouseenter', ()=>el.style.background='rgba(255,255,255,.13)');
    el.addEventListener('mouseleave', ()=>el.style.background='rgba(255,255,255,.07)');
    el.addEventListener('click', ()=>{
      delSesTargetIdx = +el.dataset.i;
      document.getElementById('delSesTargetName').textContent = state.sessions[delSesTargetIdx].name;
      list.style.display = 'none';
      const row = document.getElementById('delSesConfirmRow');
      row.style.display = 'flex';
    });
  });
  delSesModal.classList.remove('h');
}

document.getElementById('delSesBtn').addEventListener('click', openDelSesModal);
document.getElementById('delSesModalClose').addEventListener('click', ()=>delSesModal.classList.add('h'));
delSesModal.addEventListener('click', e=>{ if(e.target===delSesModal) delSesModal.classList.add('h'); });
document.getElementById('delSesBack').addEventListener('click', ()=>{
  document.getElementById('delSesConfirmRow').style.display = 'none';
  document.getElementById('delSesList').style.display = 'flex';
});
document.getElementById('delSesConfirm').addEventListener('click', ()=>{
  if (delSesTargetIdx < 0) return;
  state.sessions.splice(delSesTargetIdx, 1);
  state.sesIdx = Math.min(state.sesIdx, state.sessions.length - 1);
  document.getElementById('sesName').textContent = curSes().name;
  delSesModal.classList.add('h');
  save(); renderStats(); renderTimeList(); pushScramble(); renderScramble();
});

// ─── PUZZLE SELECTOR ─────────────────────────────────────────────────────────
function getPuzIcon(puzzle) {
  const grids = {'2×2':2,'3×3':3,'4×4':4,'5×5':5,'6×6':6,'7×7':7,'3OH':3,'3BLD':3};
  if (grids[puzzle]) {
    const n = grids[puzzle], sz = 20, gap = 1, cell = (sz-(n-1)*gap)/n;
    let r = '';
    for(let row=0;row<n;row++) for(let col=0;col<n;col++){
      const x=(col*(cell+gap)).toFixed(1), y=(row*(cell+gap)).toFixed(1), c=cell.toFixed(1);
      r += `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="1" fill="currentColor"/>`;
    }
    return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
  }
  if (puzzle==='Pyraminx') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><polygon points="10,1 19,18 1,18" fill="currentColor"/></svg>`;
  if (puzzle==='Megaminx') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><polygon points="10,1 18.5,6.5 15.5,16.5 4.5,16.5 1.5,6.5" fill="currentColor"/></svg>`;
  if (puzzle==='Skewb') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="14" height="14" rx="2" transform="rotate(45 10 10)" fill="currentColor"/></svg>`;
  if (puzzle==='Square-1') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".35"/><rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/></svg>`;
  if (puzzle==='Clock') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none"/><line x1="10" y1="5" x2="10" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="10" x2="14" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  if (puzzle==='Gear Cube') return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" fill="currentColor" d="M8.1,1.2 L11.9,1.2 L11.4,3.6 L14.8,5.6 L16.7,4.0 L18.6,7.2 L16.2,8.0 L16.2,12.0 L18.6,12.8 L16.7,16.0 L14.8,14.3 L11.4,16.4 L11.9,18.8 L8.1,18.8 L8.6,16.4 L5.2,14.3 L3.3,16.0 L1.4,12.8 L3.8,12.0 L3.8,8.0 L1.4,7.2 L3.3,4.0 L5.2,5.6 L8.6,3.6 Z M13,10 A3,3,0,1,0,7,10 A3,3,0,1,0,13,10 Z"/></svg>`;
  return `<svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor"/><rect x="11" y="1" width="8" height="8" rx="1" fill="currentColor"/><rect x="1" y="11" width="8" height="8" rx="1" fill="currentColor"/><rect x="11" y="11" width="8" height="8" rx="1" fill="currentColor"/></svg>`;
}
function updatePuzIcon(){ document.getElementById('puzIcon').innerHTML = getPuzIcon(state.puzzle); }

const puzMenu = document.getElementById('puzDdMenu');
puzMenu.innerHTML = PUZZLES.map(p=>`<div class="dd-item${p===state.puzzle?' on':''}">${p}</div>`).join('');
puzMenu.querySelectorAll('.dd-item').forEach(el=>{
  el.addEventListener('click', e=>{
    e.stopPropagation();
    state.puzzle = el.textContent;
    curSes().puzzle = state.puzzle;
    document.getElementById('puzName').textContent = state.puzzle;
    updatePuzIcon();
    puzMenu.classList.add('h');
    puzMenu.querySelectorAll('.dd-item').forEach(e=>e.classList.toggle('on',e.textContent===state.puzzle));
    save(); pushScramble(); renderScramble();
  });
});
document.getElementById('puzBtn').addEventListener('click', e=>{
  e.stopPropagation();
  puzMenu.classList.toggle('h');
});

// Close dropdowns on outside click
document.addEventListener('click', ()=>{
  document.querySelectorAll('.dd-menu').forEach(m=>m.classList.add('h'));
});

// ─── SCRAMBLE NAVIGATION ────────────────────────────────────────────────────
document.getElementById('scrNext').addEventListener('click', ()=>{
  if (state.scrIdx < state.scrHistory.length-1) state.scrIdx++;
  else pushScramble();
  renderScramble();
});
document.getElementById('scrPrev').addEventListener('click', ()=>{
  if (state.scrIdx > 0) { state.scrIdx--; renderScramble(); }
});

// ─── TIME LIST CLICK (solve modal) ──────────────────────────────────────────
function modalSes() { return state.modalSesIdx >= 0 ? state.sessions[state.modalSesIdx] : curSes(); }

function openSolveModal(idx, sesIdx) {
  state.modalSolveIdx = idx;
  state.modalSesIdx = sesIdx !== undefined ? sesIdx : state.sesIdx;
  const ses = modalSes();
  const ts = ses.times;
  const t = ts[idx];
  document.getElementById('mo-num').textContent  = `#${ts.length - idx}`;
  document.getElementById('mo-time').textContent = fmtMsFull(t.ms, t) + 's';
  document.getElementById('mo-scr').innerHTML = t.scramble ? scrToHtml(t.scramble) : '–';
  const d = new Date(t.date);
  document.getElementById('mo-date').textContent  = d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  document.getElementById('mo-clock').textContent = d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  drawPuzzleImage(document.getElementById('mo-net'), ses.puzzle || state.puzzle, t.scramble||'', 0.85);
  document.getElementById('mo-dnf').style.opacity = t.dnf?'.5':'1';
  document.getElementById('mo-p2').style.opacity  = t.plus2?'.5':'1';
  const prevBtn = document.getElementById('mo-prev');
  const nextBtn = document.getElementById('mo-next');
  prevBtn.style.opacity = idx > 0 ? '1' : '0.3';
  prevBtn.disabled = idx <= 0;
  nextBtn.style.opacity = idx < ts.length - 1 ? '1' : '0.3';
  nextBtn.disabled = idx >= ts.length - 1;
  // CFOP split
  const cfopEl=document.getElementById('mo-cfop');
  if(cfopEl){
    const ct=t.cfop;
    if(ct&&ct.pll!=null){
      const c=ct.cross??0, o=ct.oll??ct.pll, p=ct.pll;
      const pairs=ct.f2lPairs||[];
      const f2lEnd=pairs.length===4?pairs[3].t:(ct.f2l??o);
      const os=ct.ollStart??f2lEnd, ps=ct.pllStart??o;
      const fmt=ms=>(ms/1000).toFixed(2)+'s';
      const ollRecog=os-f2lEnd, pllRecog=ps-o;
      const mkSeg=(ms,col,tip)=>{if(ms<=0)return '';const w=(ms/p*100).toFixed(1);return tip?`<div class="cfop-recog" style="width:${w}%;background:${col};height:100%"><span class="cfop-tip">${tip}</span></div>`:`<div style="width:${w}%;background:${col};height:100%"></div>`;};
      let barHtml=mkSeg(c,'#FFFFFF','');
      if(pairs.length===4){
        let prev=c;
        pairs.forEach(pair=>{
          const recog=pair.start!=null?pair.start-prev:0;
          barHtml+=mkSeg(recog,'rgba(59,158,255,.28)',recog>0?fmt(recog):'');
          barHtml+=mkSeg(pair.t-(pair.start??prev),'#3B9EFF','');
          prev=pair.t;
        });
      } else {
        barHtml+=mkSeg(f2lEnd-c,'#3B9EFF','');
      }
      barHtml+=mkSeg(ollRecog,'rgba(255,215,0,.30)',ollRecog>0?fmt(ollRecog):'');
      barHtml+=mkSeg(o-os,'#FFD700','');
      barHtml+=mkSeg(pllRecog,'rgba(255,128,0,.30)',pllRecog>0?fmt(pllRecog):'');
      barHtml+=mkSeg(p-ps,'#FF8000','');
      const preCount=pairs.filter(p=>p.start===null&&p.t===c).length;
      const crossName=preCount===1?'XCross':preCount>=2?'XXCross':'Cross';
      const lblItems=[
        {name:crossName,col:'#FFFFFF',total:c},
        {name:'F2L',    col:'#3B9EFF',total:f2lEnd-c},
        {name:'OLL',    col:'#FFD700',total:o-f2lEnd},
        {name:'PLL',    col:'#FF8000',total:p-o},
      ];
      cfopEl.style.display='';
      cfopEl.innerHTML=`
        <div id="mo-cfop-bar" style="display:flex;height:10px;border-radius:5px;background:rgba(255,255,255,.08);margin-bottom:7px;position:relative">${barHtml}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;text-align:center">
          ${lblItems.map(s=>`<div style="font-size:10px;font-weight:700;color:${s.col}">${s.name}<br><span style="color:#fff;font-size:13px;font-weight:800">${fmt(s.total)}</span></div>`).join('')}
        </div>`;
    } else { cfopEl.style.display='none'; cfopEl.innerHTML=''; }
  }
  // Reconstruction
  const reconWrap=document.getElementById('mo-recon-wrap');
  const reconEl=document.getElementById('mo-recon');
  if(reconWrap&&reconEl){
    const moves=t.moves, ct=t.cfop;
    if(moves&&moves.length>0){
      reconWrap.style.display='';
      const pairColors=['#3B9EFF','#3B9EFF','#3B9EFF','#3B9EFF'];
      const crossEnd=ct?.crossMI??moves.length;
      const f2lEnd=ct?.f2lMI??moves.length;
      const ollEnd=ct?.ollMI??moves.length;
      const pairMIs=(ct?.f2lPairs||[]).map(p=>p.mi??moves.length);
      // Build segments: [{label, col, moves[]}]
      const segments=[];
      const compress=mvs=>{const r=[];let i=0;while(i<mvs.length){const m=mvs[i];if(i+1<mvs.length&&mvs[i+1]===m&&!m.endsWith('2')){r.push(m.replace("'",'')+'2');i+=2;}else{r.push(m);i++;}}return r;};
      const faceHex={'U':'#FFFFFF','D':'#FFE000','R':'#FF2A2A','L':'#FF8000','F':'#00CC55','B':'#1A8FFF'};
      const dot=fc=>fc?`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${faceHex[fc]??'#888'};margin-right:3px;vertical-align:middle"></span>`:'';
      const fmt=ms=>(ms/1000).toFixed(2)+'s';
      const pairs=ct?.f2lPairs||[];
      const addSeg=(label,col,from,to,time_ms,dots)=>{
        if(to>from) segments.push({label,col,moves:compress(moves.slice(from,to)),time_ms,dots:dots||''});
      };
      const preSolved = pairs.filter(p=>p.start===null&&p.t!=null&&p.t===(ct?.cross??-1));
      const xLabel = preSolved.length===1?'XCross':preSolved.length>=2?'XXCross':'Cross';
      const xDots = dot(ct?.crossFc)+preSolved.map(p=>(p.colors||[]).map(fc=>dot(fc)).join('')).join('');
      addSeg(xLabel,'#FFFFFF',0,crossEnd, ct?.cross??0, xDots);
      if(pairMIs.length===4){
        let prev=crossEnd, prevT=ct?.cross??0;
        pairMIs.forEach((mi,i)=>{
          const pair=pairs[i];
          if(pair?.start===null&&pair?.t!=null&&pair.t===(ct?.cross??-1)){prev=mi;prevT=pair.t;return;}
          const pairDots=(pair?.colors||[]).map(fc=>dot(fc)).join('');
          addSeg(`F2L ${i+1}`,pairColors[i],prev,mi, pair?.t!=null?pair.t-prevT:null, pairDots);
          prev=mi; prevT=pair?.t??prevT;
        });
      } else {
        addSeg('F2L','#3B9EFF',crossEnd,f2lEnd, ct?.f2l!=null&&ct?.cross!=null?ct.f2l-ct.cross:null, '');
      }
      const ollLbl='OLL'+(ct?.ollCase!=null?` ${ct.ollCase}`:'');
      const pllLbl='PLL'+(ct?.pllCase?` ${ct.pllCase}`:'');
      addSeg(ollLbl,'#FFD700',f2lEnd,ollEnd, ct?.oll!=null&&ct?.f2l!=null?ct.oll-ct.f2l:null, '');
      addSeg(pllLbl,'#FF8000',ollEnd,moves.length, ct?.pll!=null&&ct?.oll!=null?ct.pll-ct.oll:null, '');
      reconEl.innerHTML=segments.map(seg=>
        `<div style="margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:700;color:${seg.col};text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:3px">${seg.dots}${seg.label}${seg.time_ms!=null?` <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,.45);margin-left:2px">(${fmt(seg.time_ms)})</span>`:''} :</span>
          <span style="font-size:15px;font-weight:600">${seg.moves.map(mv=>`<span style="color:#fff;margin-right:5px">${mv}</span>`).join('')}</span>
        </div>`
      ).join('');
    } else { reconWrap.style.display='none'; }
  }
  document.getElementById('solveModal').classList.remove('h');
}

document.getElementById('solveModal').addEventListener('click', e=>{
  if (e.target===document.getElementById('solveModal')) document.getElementById('solveModal').classList.add('h');
});
document.getElementById('solveModalClose').addEventListener('click', ()=>document.getElementById('solveModal').classList.add('h'));
document.getElementById('mo-prev').addEventListener('click', e=>{ e.stopPropagation(); if(state.modalSolveIdx > 0) openSolveModal(state.modalSolveIdx-1, state.modalSesIdx); });
document.getElementById('mo-next').addEventListener('click', e=>{ e.stopPropagation(); if(state.modalSolveIdx < modalSes().times.length-1) openSolveModal(state.modalSolveIdx+1, state.modalSesIdx); });
document.addEventListener('keydown', e=>{
  if (document.getElementById('solveModal').classList.contains('h')) return;
  if (e.key==='ArrowRight') { e.preventDefault(); if(state.modalSolveIdx < modalSes().times.length-1) openSolveModal(state.modalSolveIdx+1, state.modalSesIdx); }
  else if (e.key==='ArrowLeft') { e.preventDefault(); if(state.modalSolveIdx > 0) openSolveModal(state.modalSolveIdx-1, state.modalSesIdx); }
});

// Add time manually
function parseManualTime(s) {
  s = s.trim().replace(',','.');
  // Existing formats with colon or decimal
  if (s.includes(':') || s.includes('.')) {
    const m = s.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
    if (m) {
      const mins=parseInt(m[1]), secs=parseInt(m[2]), frac=m[3]?parseFloat('0.'+m[3])*1000:0;
      return mins*60000 + secs*1000 + Math.round(frac);
    }
    const n = parseFloat(s);
    if (!isNaN(n) && n > 0) return Math.round(n * 1000);
    return null;
  }
  // Pure digit shorthand
  const d = s.replace(/\D/g,'');
  if (!d || d.length > 6) return null;
  const z = d.padStart(6,'0');
  const mm=parseInt(z.slice(0,2)), ss=parseInt(z.slice(2,4)), cc=parseInt(z.slice(4,6));
  if (ss >= 60) return null;
  // Special case: single digit → minutes
  if (d.length === 1) return parseInt(d) * 60000;
  return mm*60000 + ss*1000 + cc*10;
}
const addTimeModal = document.getElementById('addTimeModal');
const addTimeInput = document.getElementById('addTimeInput');
document.getElementById('addTimeBtn').addEventListener('click', ()=>{
  addTimeInput.value = '';
  addTimeModal.classList.remove('h');
  setTimeout(()=>addTimeInput.focus(), 50);
});
document.getElementById('addTimeClose').addEventListener('click', ()=>addTimeModal.classList.add('h'));
addTimeModal.addEventListener('click', e=>{ if(e.target===addTimeModal) addTimeModal.classList.add('h'); });
function confirmAddTime() {
  const ms = parseManualTime(addTimeInput.value);
  if (ms===null) { addTimeInput.style.borderColor='var(--red)'; return; }
  const solve = { ms, dnf:false, plus2:false, scramble: state.scrHistory[state.scrIdx]||'', date: new Date().toISOString() };
  curSes().times.unshift(solve);
  document.getElementById('timerDisp').textContent = fmtMs(ms);
  save(); renderStats(); renderTimeList();
  addTimeModal.classList.add('h');
  pushScramble(); renderScramble();
}
document.getElementById('addTimeConfirm').addEventListener('click', confirmAddTime);
addTimeInput.addEventListener('keydown', e=>{ if(e.key==='Enter') confirmAddTime(); addTimeInput.style.borderColor='rgba(255,255,255,.2)'; });

document.getElementById('mo-dnf').addEventListener('click', ()=>{
  const t = modalSes().times[state.modalSolveIdx];
  t.dnf = !t.dnf; if(t.dnf) t.plus2=false;
  save(); renderStats(); renderTimeList(); renderSocLastSes();
  openSolveModal(state.modalSolveIdx, state.modalSesIdx);
});
document.getElementById('mo-p2').addEventListener('click', ()=>{
  const t = modalSes().times[state.modalSolveIdx];
  t.plus2 = !t.plus2; if(t.plus2) t.dnf=false;
  save(); renderStats(); renderTimeList(); renderSocLastSes();
  openSolveModal(state.modalSolveIdx, state.modalSesIdx);
});
document.getElementById('mo-del').addEventListener('click', ()=>{
  modalSes().times.splice(state.modalSolveIdx, 1);
  document.getElementById('solveModal').classList.add('h');
  save(); renderStats(); renderTimeList(); renderSocLastSes();
  const times = curSes().times;
  const disp = document.getElementById('timerDisp');
  const t = times[0];
  disp.textContent = t ? (t.dnf ? 'DNF' : fmtMs(t.ms+(t.plus2?2000:0))) : '0.000';
});

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(()=>{
    const orig = btn.innerHTML;
    btn.textContent = 'Copied!';
    setTimeout(()=>{ btn.innerHTML = orig; lucide.createIcons(); }, 1500);
  });
}
document.getElementById('mo-copy-scr').addEventListener('click', ()=>{
  copyToClipboard(document.getElementById('mo-scr').textContent, document.getElementById('mo-copy-scr'));
});
document.getElementById('scrCopy').addEventListener('click', ()=>{
  copyToClipboard(document.getElementById('scrTxt').textContent, document.getElementById('scrCopy'));
});

document.getElementById('timeList').addEventListener('click', e=>{
  const te = e.target.closest('.te');
  if (te) openSolveModal(+te.dataset.idx);
});
let shareSelectMode = false;
const shareSelected = new Set();

function setShareMode(on) {
  shareSelectMode = on;
  shareSelected.clear();
  document.getElementById('shareSelectBtn').classList.toggle('on', on);
  const countEl = document.getElementById('shareBarCount');
  const cancelBtn = document.getElementById('shareBarCancel');
  const genBtn = document.getElementById('shareBarGenerate');
  countEl.style.display = on ? 'inline' : 'none';
  cancelBtn.style.display = on ? 'inline-flex' : 'none';
  genBtn.style.display = on ? 'inline-flex' : 'none';
  document.getElementById('shareQuickSel').style.display = on ? 'flex' : 'none';
  document.querySelectorAll('.sq-btn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('#statsGrid .sc').forEach(el => {
    el.classList.toggle('selectable', on);
    el.classList.remove('selected');
  });
  countEl.textContent = '0 selected';
}

document.getElementById('statsGrid').addEventListener('click', e=>{
  const sc = e.target.closest('.sc');
  if (!sc) return;
  if (shareSelectMode) {
    const idx = +sc.dataset.idx;
    if (shareSelected.has(idx)) { shareSelected.delete(idx); sc.classList.remove('selected'); }
    else { shareSelected.add(idx); sc.classList.add('selected'); }
    document.getElementById('shareBarCount').textContent = `${shareSelected.size} selected`;
  } else {
    openSolveModal(+sc.dataset.idx);
  }
});

document.getElementById('shareSelectBtn').addEventListener('click', ()=> setShareMode(!shareSelectMode));
document.getElementById('shareBarCancel').addEventListener('click', ()=> setShareMode(false));

document.querySelectorAll('.sq-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const n = +btn.dataset.n;
    const ts = curSes().times;
    const count = Math.min(n, ts.length);
    shareSelected.clear();
    for (let i = 0; i < count; i++) shareSelected.add(i);
    document.querySelectorAll('#statsGrid .sc').forEach(el => {
      el.classList.toggle('selected', shareSelected.has(+el.dataset.idx));
    });
    document.getElementById('shareBarCount').textContent = `${shareSelected.size} selected`;
    document.querySelectorAll('.sq-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  });
});

document.getElementById('shareBarGenerate').addEventListener('click', ()=>{
  if (!shareSelected.size) return;
  const ts = curSes().times;
  const solves = [...shareSelected].sort((a,b)=>b-a).map(idx=>({idx, t:ts[idx], n:ts.length-idx}));
  const canvas = document.getElementById('shareCanvas');
  const n = solves.length;
  // Adaptive layout based on count
  const cols = n <= 3 ? n : n <= 8 ? 4 : n <= 15 ? 5 : n <= 30 ? 6 : n <= 60 ? 8 : 10;
  const rows = Math.ceil(n / cols);
  // Smaller cells for larger sets
  const CW = n <= 20 ? 110 : n <= 50 ? 90 : 76;
  const CH = n <= 20 ? 56  : n <= 50 ? 44  : 36;
  const PAD = 16, GAP = n <= 20 ? 8 : 6;
  const numFontSz  = n <= 20 ? 11 : n <= 50 ? 10 : 9;
  const timeFontSz = n <= 20 ? 15 : n <= 50 ? 13 : 11;
  const W = cols*CW + (cols-1)*GAP + PAD*2;
  const H = rows*CH + (rows-1)*GAP + PAD*2 + 54;
  canvas.width = W * 2; canvas.height = H * 2;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2,2);
  // Background
  ctx.fillStyle = '#1e1248';
  ctx.beginPath(); roundRect(ctx,0,0,W,H,14); ctx.fill();
  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${curSes().name} — ${solves.length} solve${solves.length!==1?'s':''}`, W/2, PAD+14);
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fillText(new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}), W/2, PAD+28);
  // Cells
  solves.forEach(({t, n}, i)=>{
    const col = i % cols, row = Math.floor(i / cols);
    const x = PAD + col*(CW+GAP), y = PAD+42 + row*(CH+GAP);
    ctx.fillStyle = '#3c146b';
    beginRoundRect(ctx, x, y, CW, CH, 8); ctx.fill();
    const numStr = `${n}.`;
    const timeStr = ' ' + fmtMs2(t.ms, t);
    ctx.font = `${numFontSz}px Inter, sans-serif`;
    const numW = ctx.measureText(numStr).width;
    ctx.font = `bold ${timeFontSz}px Inter, sans-serif`;
    const timeW = ctx.measureText(timeStr).width;
    const startX = x + CW/2 - (numW + timeW)/2;
    const midY = y + CH/2 + timeFontSz*0.35;
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = `${numFontSz}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(numStr, startX, midY);
    ctx.fillStyle = t.dnf?'#e00000':t.plus2?'#f59e0b':'#fff';
    ctx.font = `bold ${timeFontSz}px Inter, sans-serif`;
    ctx.fillText(timeStr, startX + numW, midY);
  });
  document.getElementById('shareImgModal').classList.remove('h');
  lucide.createIcons();
});

function roundRect(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function beginRoundRect(ctx,x,y,w,h,r){ctx.beginPath();roundRect(ctx,x,y,w,h,r);}

document.getElementById('shareImgClose').addEventListener('click', ()=>document.getElementById('shareImgModal').classList.add('h'));
document.getElementById('shareImgModal').addEventListener('click', e=>{ if(e.target===document.getElementById('shareImgModal')) document.getElementById('shareImgModal').classList.add('h'); });
document.getElementById('shareImgDownload').addEventListener('click', ()=>{
  const a = document.createElement('a');
  a.href = document.getElementById('shareCanvas').toDataURL('image/png');
  a.download = `strati-solves-${Date.now()}.png`;
  a.click();
});
document.getElementById('shareImgCopy').addEventListener('click', ()=>{
  document.getElementById('shareCanvas').toBlob(blob=>{
    navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>showToast('Copied!')).catch(()=>showToast('Copy failed'));
  });
});

// ─── CLEAR SESSION ───────────────────────────────────────────────────────────
document.getElementById('graphToggleBtn').addEventListener('click', ()=>{
  const btn = document.getElementById('graphToggleBtn');
  const el = document.getElementById('statsGraphs');
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'flex';
  btn.classList.toggle('on', !visible);
  if (!visible) renderStatsGraphs();
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
  const n = curSes().times.length;
  document.getElementById('clearTimesInfo').textContent = `This will permanently delete all ${n} solve${n!==1?'s':''} in "${curSes().name}".`;
  clearTimesModal.classList.remove('h');
});


// ── CUBE NET TOGGLE ──
(function() {
  const area = document.getElementById('cubeArea');
  const btn  = document.getElementById('cubeTogBtn');
  if (!area || !btn) return;
  function applyCubeNetState() {
    const hidden = !!state.settings.hideCubeNet;
    area.classList.toggle('cube-hidden', hidden);
    btn.innerHTML = hidden
      ? '<i data-lucide="eye"></i>'
      : '<i data-lucide="eye-off"></i>';
    lucide.createIcons();
  }
  applyCubeNetState();
  btn.addEventListener('click', () => {
    state.settings.hideCubeNet = !state.settings.hideCubeNet;
    save();
    applyCubeNetState();
  });
})();
