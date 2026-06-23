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
  const cubeEl=document.getElementById('mo-cube');
  if(cubeEl){
    if(t.cubeName){cubeEl.style.color='';cubeEl.textContent=t.cubeName;}
    else{cubeEl.style.color='var(--dim)';cubeEl.textContent='Use a Bluetooth cube';}
  }
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
      const f2lEnd=(ct?.f2l!=null)?ct.f2l:(pairs.length===4?pairs[3].t:o);
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
        if(ct?.f2l!=null&&ct.f2l>prev) barHtml+=mkSeg(ct.f2l-prev,'#3B9EFF','');
      } else {
        barHtml+=mkSeg(f2lEnd-c,'#3B9EFF','');
      }
      barHtml+=mkSeg(ollRecog,'rgba(255,215,0,.30)',ollRecog>0?fmt(ollRecog):'');
      barHtml+=mkSeg(o-os,'#FFD700','');
      barHtml+=mkSeg(pllRecog,'rgba(255,128,0,.30)',pllRecog>0?fmt(pllRecog):'');
      barHtml+=mkSeg(p-ps,'#FF8000','');
      const preCount=pairs.filter(p=>p.start===null&&p.t===c).length;
      const crossName=preCount===1?'XCross':preCount>=2?'XXCross':'Cross';
      const ollName='OLL'+(ct?.ollCase!=null?` (${ct.ollCase})`:'');
      const pllName='PLL'+(ct?.pllCase?` (${ct.pllCase})`:'');
      const lblItems=[
        {name:crossName,col:'#FFFFFF',total:c},
        {name:'F2L',    col:'#3B9EFF',total:f2lEnd-c},
        {name:ollName,  col:'#FFD700',total:o-f2lEnd},
        {name:pllName,  col:'#FF8000',total:p-o},
      ];
      cfopEl.style.display='';
      cfopEl.innerHTML=`
        <div id="mo-cfop-bar" style="display:flex;height:10px;border-radius:5px;background:rgba(255,255,255,.08);margin-bottom:7px;position:relative">${barHtml}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;text-align:center">
          ${lblItems.map(s=>`<div style="font-size:10px;font-weight:700;color:${s.col}">${s.name}<br><span style="color:#fff;font-size:13px;font-weight:800">${fmt(s.total)}</span></div>`).join('')}
        </div>`;
    } else {
      cfopEl.style.display='';
      cfopEl.innerHTML=`
        <div style="display:flex;height:10px;border-radius:5px;background:rgba(255,255,255,.08);margin-bottom:7px"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;text-align:center">
          ${['Cross','F2L','OLL','PLL'].map(n=>`<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.18)">${n}<br><span style="color:rgba(255,255,255,.18);font-size:13px;font-weight:800">—</span></div>`).join('')}
        </div>
        <div style="text-align:center;margin-top:10px;font-size:11px;color:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;gap:5px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8.5 5.5 15 12l-6.5 6.5L12 22l7-7-6-3 6-3-7-7z"/><line x1="2" y1="2" x2="22" y2="22" stroke-opacity=".5"/></svg>
          Use an electronic Bluetooth cube to see more analysis data
        </div>`;
    }
  }
  // Reconstruction
  const reconWrap=document.getElementById('mo-recon-wrap');
  const reconEl=document.getElementById('mo-recon');
  if(reconWrap&&reconEl){
    const moves=t.moves, ct=t.cfop, startFl=t.startFl;
    if(moves&&moves.length>0){
      reconWrap.style.display='';
      // ── Orientation helpers ──────────────────────────────────────────────────
      const CUBE_ROTS=new Set(['x',"x'",'x2','y',"y'",'y2','z',"z'",'z2']);
      const normMoves=moves;
      // ── Build segments ───────────────────────────────────────────────────────
      const pairColors=['#3B9EFF','#3B9EFF','#3B9EFF','#3B9EFF'];
      const crossEnd=ct?.crossMI??moves.length;
      const f2lEnd=Math.max(crossEnd, ct?.f2lMI??moves.length);
      const ollEnd=Math.max(f2lEnd, ct?.ollMI??moves.length);
      const segments=[];
      // Returns [{mv, from, to}] merging consecutive duplicate moves (X X → X2) while tracking original indices
      const compressWithMap=(mvs,base)=>{const r=[];let i=0;while(i<mvs.length){const m=mvs[i];if(i+1<mvs.length&&mvs[i+1]===m&&!m.endsWith('2')){r.push({mv:m.replace("'",'')+'2',from:base+i,to:base+i+2});i+=2;}else{r.push({mv:m,from:base+i,to:base+i+1});i++;}}return r;};
      const faceHex={'U':'#FFFFFF','D':'#FFE000','R':'#FF2A2A','L':'#FF8000','F':'#00CC55','B':'#1A8FFF'};
      const dot=fc=>fc?`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${faceHex[fc]??'#888'};margin-right:3px;vertical-align:middle"></span>`:'';
      const fmt=ms=>(ms/1000).toFixed(2)+'s';
      const pairs=ct?.f2lPairs||[];
      const addSeg=(label,col,from,to,time_ms,dots,prefix)=>{
        if(to>from||(prefix&&prefix.length)) segments.push({label,col,from,to,time_ms,dots:dots||'',prefix:prefix||[]});
      };
      const preSolved = pairs.filter(p=>p.start===null&&p.t!=null&&p.t===(ct?.cross??-1));
      const xLabel = preSolved.length===1?'XCross':preSolved.length>=2?'XXCross':'Cross';
      const xDots = dot(ct?.crossFc)+preSolved.map(p=>(p.colors||[]).map(fc=>dot(fc)).join('')).join('');
      addSeg(xLabel,'#FFFFFF',0,crossEnd, ct?.cross??0, xDots);
      // f2lPairs is already sorted by t (slot completion time) by smartcube.js
      // Filter out pairs solved during cross (XCross), then number remaining from 1
      const f2lOnlyPairs=pairs.filter(p=>!(p.mi!=null&&p.mi<=crossEnd));
      if(f2lOnlyPairs.length>0){
        let prev=crossEnd, prevT=ct?.cross??0;
        f2lOnlyPairs.forEach((pair,idx)=>{
          const pairDots=(pair?.colors||[]).map(fc=>dot(fc)).join('');
          const isLast=idx===f2lOnlyPairs.length-1;
          const segEnd=isLast?f2lEnd:(pair.mi??moves.length);
          const segTime=isLast?(ct?.f2l!=null?ct.f2l-prevT:null):(pair?.t!=null?pair.t-prevT:null);
          addSeg(`F2L ${idx+1}`,pairColors[idx],prev,segEnd,segTime,pairDots);
          prev=segEnd; prevT=isLast?(ct?.f2l??prevT):(pair?.t??prevT);
        });
      } else if(crossEnd<f2lEnd){
        addSeg('F2L','#3B9EFF',crossEnd,f2lEnd, ct?.f2l!=null&&ct?.cross!=null?ct.f2l-ct.cross:null, '');
      }
      const ollLbl='OLL'+(ct?.ollCase!=null?` (${ct.ollCase})`:'');
      const pllLbl='PLL'+(ct?.pllCase?` (${ct.pllCase})`:'');
      addSeg(ollLbl,'#FFD700',f2lEnd,ollEnd, ct?.oll!=null&&ct?.f2l!=null?ct.oll-ct.f2l:null, '');
      addSeg(pllLbl,'#FF8000',ollEnd,moves.length, ct?.pll!=null&&ct?.oll!=null?ct.pll-ct.oll:null, '');
      reconEl.innerHTML=segments.map(seg=>{
        const prefixItems=(seg.prefix||[]).map(mv=>({mv,from:-1,to:-1}));
        const bodyItems=compressWithMap(normMoves.slice(seg.from,seg.to),seg.from);
        const items=[...prefixItems,...bodyItems];
        const movesHtml=items.map(({mv,from,to})=>{
          const isRot=CUBE_ROTS.has(mv);
          const col=isRot?'#aaaaaa':'#fff';
          const st=isRot?'font-style:italic;':'';
          const link=from>=0?`class="rp-mv" data-from="${from}" data-to="${to}" onclick="rpPause?.();rpGoTo?.(${to})" `:'';
          return `<span ${link}style="${st}color:${col};margin-right:5px;${from>=0?'cursor:pointer':''}">${mv}</span>`;
        }).join('');
        return `<div style="margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:700;color:${seg.col};text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:3px">${seg.dots}${seg.label}${seg.time_ms!=null?` <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,.45);margin-left:2px">(${fmt(seg.time_ms)})</span>`:''} :</span>
          <span style="font-size:15px;font-weight:600">${movesHtml}</span>
        </div>`;
      }).join('');
    } else {
      reconWrap.style.display='';
      reconEl.innerHTML='<div style="color:rgba(255,255,255,.2);font-size:13px;font-style:italic">—</div>';
    }
  }
  if(typeof rpOpen==='function') rpOpen(t);
  document.getElementById('solveModal').classList.remove('h');
}

document.getElementById('solveModal').addEventListener('click', e=>{
  if (e.target===document.getElementById('solveModal')){document.getElementById('solveModal').classList.add('h');if(typeof rpClose==='function')rpClose();}
});
document.getElementById('solveModalClose').addEventListener('click', ()=>{document.getElementById('solveModal').classList.add('h');if(typeof rpClose==='function')rpClose();});
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

document.getElementById('statsGrid').addEventListener('click', e=>{
  const sc = e.target.closest('.sc');
  if (sc && !e.target.closest('.sc-share')) openSolveModal(+sc.dataset.idx);
});

// ── Share dropdown ──
const _shareBtn  = document.getElementById('shareSelectBtn');
const _shareOpts = document.getElementById('shareOpts');
_shareBtn.addEventListener('click', e => {
  e.stopPropagation();
  const ts = curSes().times;
  const open = _shareOpts.style.display !== 'none';
  if (!open) {
    document.getElementById('shOptAo5').disabled   = calcAo(5)   === null;
    document.getElementById('shOptAo12').disabled  = calcAo(12)  === null;
    document.getElementById('shOptAo50').disabled  = calcAo(50)  === null;
    document.getElementById('shOptAo100').disabled = calcAo(100) === null;
    document.getElementById('shOptSingle').disabled = !ts.length;
    lucide.createIcons();
  }
  _shareOpts.style.display = open ? 'none' : '';
  _shareBtn.classList.toggle('on', !open);
});
document.addEventListener('click', () => {
  _shareOpts.style.display = 'none';
  _shareBtn.classList.remove('on');
});

function shareOptClick(type, param) {
  _shareOpts.style.display = 'none';
  _shareBtn.classList.remove('on');
  generateShareImg(type, param);
}


function _sMs(ms) { return fmtMs(ms).slice(0, -1); }

let _logoImg = null;
let _lastShareType = 'session', _lastShareParam = null;
(function() {
  fetch('Mascotte/logo.png').then(r => r.blob()).then(blob => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        _logoImg = img;
        const modal = document.getElementById('shareImgModal');
        if (modal && !modal.classList.contains('h') && _lastShareType) {
          generateShareImg(_lastShareType, _lastShareParam);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(blob);
  }).catch(() => {});
})();

function _drawCubeCell(ctx, x, y, size, label, value, opts) {
  const R = 14;
  const bg = (opts && opts.bg) || 'rgba(255,255,255,0.07)';
  ctx.fillStyle = bg;
  beginRoundRect(ctx, x, y, size, size, R); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
  beginRoundRect(ctx, x, y, size, size, R); ctx.stroke();

  const cx = x + size / 2;

  if (opts && opts.isLogo) {
    const lsize = 58;
    if (_logoImg) {
      ctx.save();
      ctx.filter = 'grayscale(1) brightness(6)';
      ctx.drawImage(_logoImg, cx - lsize / 2, y + 10, lsize, lsize);
      ctx.restore();
      ctx.filter = 'none';
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Inter,system-ui,sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.fillText('STRATI', cx, y + 10 + lsize + 22);
    ctx.font = 'bold 13px Inter,system-ui,sans-serif';
    ctx.fillStyle = 'rgba(168,85,247,0.65)';
    ctx.fillText('TIMER', cx, y + 10 + lsize + 40);
    return;
  }

  ctx.font = 'bold 15px Inter,system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'center';
  ctx.fillText(label, cx, y + size * 0.4);

  const str = String(value);
  let fs = str.length <= 5 ? 30 : str.length <= 7 ? 24 : str.length <= 10 ? 19 : 14;
  ctx.font = `900 ${fs}px Inter,system-ui,sans-serif`;
  const maxW = size - 14;
  while (fs > 10 && ctx.measureText(str).width > maxW) { fs--; ctx.font = `900 ${fs}px Inter,system-ui,sans-serif`; }
  ctx.fillStyle = (opts && opts.color) || '#fff';
  ctx.fillText(str, cx, y + size * 0.72);
}

function _shareCtxSetup(W, H) {
  const canvas = document.getElementById('shareCanvas');
  canvas.width = W * 2; canvas.height = H * 2;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, W, H);
  return ctx;
}

function _shareCardBg(ctx, W, H, R) {
  // background always transparent — canvas CSS provides dark preview in modal
}

function _niceYTicks(minMs, maxMs) {
  const minS = minMs / 1000, maxS = maxMs / 1000, range = maxS - minS;
  const steps = [0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120];
  const step = steps.find(s => range / s <= 5) || 120;
  const ticks = [];
  for (let v = Math.ceil(minS / step) * step; v <= maxS + step * 0.01; v = +(v + step).toFixed(6))
    ticks.push(Math.round(v * 1000));
  return { ticks, step };
}
function _niceYLabel(ms, step) {
  const s = ms / 1000;
  return (step < 1 ? s.toFixed(1) : String(Math.round(s))) + 's';
}
function _drawYAxis(ctx, minV, maxV, gx, gy, gh, gw, py) {
  const { ticks, step } = _niceYTicks(minV, maxV);
  ctx.font = '9px Inter,system-ui,sans-serif'; ctx.textAlign = 'right';
  ticks.forEach(ms => {
    const y = py(ms);
    if (y < gy - 4 || y > gy + gh + 4) return;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(_niceYLabel(ms, step), gx - 6, y + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
    ctx.setLineDash([]);
  });
}
function _drawGraph(ctx, solves, total, gx, gy, gw, gh) {
  const plotData = solves.filter(t => !t.dnf);
  const dnfData  = solves.map((t, i) => ({ t, i })).filter(({ t }) => t.dnf);
  if (plotData.length < 2) {
    ctx.font = '11px Inter,system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'center';
    ctx.fillText('Not enough solves to graph', gx + gw / 2, gy + gh / 2); return;
  }
  // Solve count label — top right
  ctx.font = 'bold 9px Inter,system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'right';

  const vals = plotData.map(t => t.ms + (t.plus2 ? 2000 : 0));
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = (maxV - minV) || 1;
  const plotIdx = plotData.map(t => solves.indexOf(t));
  const px = i => gx + (i / Math.max(total - 1, 1)) * gw;
  const py = v => gy + gh - ((v - minV) / range) * gh * 0.88 - gh * 0.06;
  _drawYAxis(ctx, minV, maxV, gx, gy, gh, gw, py);
  // Fill
  const fill = ctx.createLinearGradient(0, gy, 0, gy + gh);
  fill.addColorStop(0, 'rgba(168,85,247,0.25)'); fill.addColorStop(1, 'rgba(168,85,247,0.02)');
  ctx.beginPath();
  ctx.moveTo(px(plotIdx[0]), gy + gh); ctx.lineTo(px(plotIdx[0]), py(vals[0]));
  for (let i = 1; i < plotData.length; i++) {
    const cpx = (px(plotIdx[i-1]) + px(plotIdx[i])) / 2;
    ctx.bezierCurveTo(cpx, py(vals[i-1]), cpx, py(vals[i]), px(plotIdx[i]), py(vals[i]));
  }
  ctx.lineTo(px(plotIdx[plotData.length-1]), gy + gh);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  // Line
  ctx.beginPath(); ctx.moveTo(px(plotIdx[0]), py(vals[0]));
  for (let i = 1; i < plotData.length; i++) {
    const cpx = (px(plotIdx[i-1]) + px(plotIdx[i])) / 2;
    ctx.bezierCurveTo(cpx, py(vals[i-1]), cpx, py(vals[i]), px(plotIdx[i]), py(vals[i]));
  }
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.stroke();
  // Dots
  if (plotData.length <= 60) {
    plotData.forEach((t, i) => {
      ctx.beginPath();
      ctx.arc(px(plotIdx[i]), py(vals[i]), plotData.length <= 20 ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = t.plus2 ? '#f59e0b' : '#a855f7'; ctx.fill();
    });
  }
  // DNF markers
  dnfData.forEach(({ i }) => {
    const x = px(i), y = gy + gh * 0.5;
    ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 1.5;
    const s = 4;
    ctx.beginPath(); ctx.moveTo(x-s,y-s); ctx.lineTo(x+s,y+s); ctx.moveTo(x+s,y-s); ctx.lineTo(x-s,y+s); ctx.stroke();
  });
}

function _shareHeader(ctx, W, PAD, subtitle, sesName, dateStr) {
  ctx.font = 'bold 20px Inter,system-ui,sans-serif';
  ctx.fillStyle = '#7110c0'; ctx.textAlign = 'left';
  ctx.fillText('STRATI', PAD, PAD + 20);
  if (subtitle) {
    ctx.font = 'bold 11px Inter,system-ui,sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.fillText(subtitle, PAD + ctx.measureText('STRATI').width + 8, PAD + 20);
  }
  ctx.font = 'bold 13px Inter,system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
  ctx.fillText(sesName, W - PAD, PAD + 15);
  ctx.font = '11px Inter,system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(dateStr, W - PAD, PAD + 31);
}

function _shareDivider(ctx, W, PAD, y) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
}

function _shareFooter(ctx, W, H) {
  ctx.font = '10px Inter,system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center'; ctx.fillText('STRATI TIMER', W / 2, H - 9);
}

function generateShareImg(type, param) {
  type = type || 'session';
  _lastShareType = type; _lastShareParam = param;
  const ts = curSes().times;
  if (!ts.length) { toast('No solves to share'); return; }

  if (type === 'ao') { _generateShareAo(param); return; }
  if (type === 'single') { _generateShareSingle(param || 0); return; }

  const W = 480, H = 480, PAD = 24, GAP = 12, R = 20;
  const CELL = (W - PAD * 2 - GAP * 2) / 3;

  const ctx = _shareCtxSetup(W, H);
  _shareCardBg(ctx, W, H, R);

  const ses = curSes();
  const pb   = bestSingle();
  const mean = calcMean();

  const dated = ts.filter(t => t.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  let trainingStr = '–';
  if (dated.length >= 2) {
    const mins = Math.round((new Date(dated[dated.length-1].date) - new Date(dated[0].date)) / 60000);
    trainingStr = mins < 1 ? '<1m' : mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60?' '+(mins%60)+'m':''}`;
  } else if (dated.length === 1) { trainingStr = '<1m'; }

  const btSolves = ts.filter(t => t.moves && t.moves.length > 0 && !t.dnf && t.ms > 0);
  const hasTps   = btSolves.length > 0;
  const avgTps   = hasTps ? btSolves.reduce((s, t) => s + t.moves.length / (t.ms / 1000), 0) / btSolves.length : 0;

  // Top row
  const topCells = [
    { label: 'BEST SINGLE',   value: pb   !== null ? _sMs(pb)   : '–' },
    { label: 'SESSION AVG',   value: mean !== null ? _sMs(mean) : '–' },
    { label: 'N° SOLVES',     value: String(ts.length) },
  ];
  topCells.forEach((cell, i) => {
    _drawCubeCell(ctx, PAD + i * (CELL + GAP), PAD, CELL, cell.label, cell.value, cell);
  });

  // Middle row — graph
  const graphRowY = PAD + CELL + GAP;
  const HPAD = 10, YLABELW = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  beginRoundRect(ctx, PAD, graphRowY, W - PAD * 2, CELL, 14); ctx.fill();
  ctx.save();
  ctx.beginPath(); roundRect(ctx, PAD + 1, graphRowY + 1, W - PAD * 2 - 2, CELL - 2, 13); ctx.clip();
  _drawGraph(ctx, [...ts].reverse(), ts.length, PAD + HPAD + YLABELW, graphRowY + 8, W - 2 * (PAD + HPAD) - YLABELW, CELL - 16);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
  beginRoundRect(ctx, PAD, graphRowY, W - PAD * 2, CELL, 14); ctx.stroke();

  // Bottom row
  const botCells = [
    { label: 'TRAINING TIME', value: trainingStr },
    { label: 'AVG TPS',       value: hasTps ? avgTps.toFixed(1) : '–' },
    { isLogo: true, bg: 'rgba(113,16,192,0.35)' },
  ];
  const botY = PAD + 2 * (CELL + GAP);
  botCells.forEach((cell, i) => {
    _drawCubeCell(ctx, PAD + i * (CELL + GAP), botY, CELL, cell.label || '', cell.value || '', cell);
  });

  document.getElementById('shareImgModal').classList.remove('h');
  lucide.createIcons();
}

// ── Average card ──
function _generateShareAo(n) {
  const ts = curSes().times;
  const win = getAoWindow(n, false);
  if (!win) { toast(`Not enough solves for Ao${n}`); return; }
  const { chunk } = win;
  const avg = calcAoFromChunk(chunk);

  const W = 480, H = 480, PAD = 24, GAP = 12, R = 20;
  const CELL = (W - PAD * 2 - GAP * 2) / 3;

  const ctx = _shareCtxSetup(W, H);
  _shareCardBg(ctx, W, H, R);

  const ses = curSes();
  const chunkValid = chunk.filter(t => !t.dnf);
  const pbMs = chunkValid.length ? Math.min(...chunkValid.map(t => t.ms + (t.plus2 ? 2000 : 0))) : null;
  const pb = pbMs !== null && isFinite(pbMs) ? pbMs : null;

  const datedSorted = chunk.filter(t => t.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  let trainingStr = '–';
  if (datedSorted.length >= 2) {
    const mins = Math.round((new Date(datedSorted[datedSorted.length-1].date) - new Date(datedSorted[0].date)) / 60000);
    trainingStr = mins < 1 ? '<1m' : mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h${mins%60?' '+(mins%60)+'m':''}`;
  } else if (datedSorted.length === 1) { trainingStr = '<1m'; }

  const btSolves = chunk.filter(t => t.moves && t.moves.length > 0 && !t.dnf && t.ms > 0);
  const hasTps   = btSolves.length > 0;
  const avgTps   = hasTps ? btSolves.reduce((s, t) => s + t.moves.length / (t.ms / 1000), 0) / btSolves.length : 0;

  // Top row
  const topCells = [
    { label: `AO${n}`,      value: avg !== null ? _sMs(avg) : 'DNF', color: avg !== null ? '#fff' : '#e00000' },
    { label: 'BEST SINGLE', value: pb  !== null ? _sMs(pb)  : '–' },
    { label: 'TRAINING TIME', value: trainingStr },
  ];
  topCells.forEach((cell, i) => {
    _drawCubeCell(ctx, PAD + i * (CELL + GAP), PAD, CELL, cell.label, cell.value, cell);
  });

  // Middle row — graph (chunk solves)
  const graphRowY = PAD + CELL + GAP;
  const HPAD = 10, YLABELW = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  beginRoundRect(ctx, PAD, graphRowY, W - PAD * 2, CELL, 14); ctx.fill();
  ctx.save();
  ctx.beginPath(); roundRect(ctx, PAD + 1, graphRowY + 1, W - PAD * 2 - 2, CELL - 2, 13); ctx.clip();
  _drawGraph(ctx, [...chunk].reverse(), chunk.length, PAD + HPAD + YLABELW, graphRowY + 8, W - 2 * (PAD + HPAD) - YLABELW, CELL - 16);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
  beginRoundRect(ctx, PAD, graphRowY, W - PAD * 2, CELL, 14); ctx.stroke();

  // Bottom row
  const botCells = [
    { label: 'N° SOLVES',     value: String(n) },
    { label: 'AVG TPS',       value: hasTps ? avgTps.toFixed(1) : '–' },
    { isLogo: true, bg: 'rgba(113,16,192,0.35)' },
  ];
  const botY = PAD + 2 * (CELL + GAP);
  botCells.forEach((cell, i) => {
    _drawCubeCell(ctx, PAD + i * (CELL + GAP), botY, CELL, cell.label || '', cell.value || '', cell);
  });

  document.getElementById('shareImgModal').classList.remove('h');
  lucide.createIcons();
}

// ── Single solve card ──
function _generateShareSingle(idx) {
  const ts = curSes().times;
  const t = ts[idx];
  if (!t) { toast('No solve found'); return; }

  const W = 600, H = 300, PAD = 28, R = 20;
  const ctx = _shareCtxSetup(W, H);
  _shareCardBg(ctx, W, H, R);

  const ses = curSes();
  const n = ts.length - idx;
  const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '';
  _shareHeader(ctx, W, PAD, null, ses.name, dateStr);
  _shareDivider(ctx, W, PAD, PAD + 42);

  // Big time
  const timeStr = t.dnf ? 'DNF' : fmtMs(t.ms, t);
  ctx.textAlign = 'center';
  ctx.font = `bold 64px Inter,system-ui,sans-serif`;
  ctx.fillStyle = t.dnf ? '#e00000' : t.plus2 ? '#f59e0b' : '#fff';
  ctx.fillText(timeStr, W / 2, PAD + 42 + 68);

  // Solve number label
  ctx.font = '11px Inter,system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`Solve #${n}`, W / 2, PAD + 42 + 88);

  // Scramble (word-wrap)
  if (t.scramble) {
    _shareDivider(ctx, W, PAD, PAD + 42 + 100);
    const words = t.scramble.split(/\s+/).filter(Boolean);
    const lineH = 18, maxW = W - PAD * 2;
    ctx.font = '12px Inter,system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    let line = '', lineY = PAD + 42 + 118;
    words.forEach((w, wi) => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, W / 2, lineY); line = w; lineY += lineH;
      } else { line = test; }
      if (wi === words.length - 1 && line) ctx.fillText(line, W / 2, lineY);
    });
  }

  _shareFooter(ctx, W, H);
  document.getElementById('shareImgModal').classList.remove('h');
  lucide.createIcons();
}

function roundRect(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function beginRoundRect(ctx,x,y,w,h,r){ctx.beginPath();roundRect(ctx,x,y,w,h,r);}

document.getElementById('shareImgClose').addEventListener('click', ()=>document.getElementById('shareImgModal').classList.add('h'));
document.getElementById('shareImgModal').addEventListener('click', e=>{ if(e.target===document.getElementById('shareImgModal')) document.getElementById('shareImgModal').classList.add('h'); });
document.getElementById('shareImgDownload').addEventListener('click', ()=>{
  const a = document.createElement('a');
  a.href = document.getElementById('shareCanvas').toDataURL('image/png');
  a.download = `strati-${Date.now()}.png`;
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
