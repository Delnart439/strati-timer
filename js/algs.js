// ─── ALG MODAL ───────────────────────────────────────────────────────────────
function openAlgModal(set, idx) {
  state.modalAlgSet = set;
  state.modalAlgIdx = idx;
  const item = (set==='OLL'?OLL:PLL)[idx];
  const key  = `${set}_${item.id}`;
  const st   = state.algStatus[key]||'unknown';
  document.getElementById('am-num').textContent   = `#${item.id}`;
  document.getElementById('am-alg').textContent   = item.alg;
  document.getElementById('am-setup').textContent = item.setup||'–';
  const badge = document.getElementById('am-badge');
  badge.textContent = st==='learned'?'LEARNED':st==='learning'?'LEARNING':'UNKNOWN';
  badge.className = `alg-mo-s ${st==='learned'?'bl':st==='learning'?'bg':'bu'}`;
  if (set==='OLL' && item.top) drawOLLSvg(document.getElementById('am-svg'), item.top, item.sides);
  else if (set==='PLL') drawPLLSvg(document.getElementById('am-svg'), item.sides);
  else document.getElementById('am-svg').innerHTML='';
  // reset alts panel
  const altsWrap = document.getElementById('am-alts-wrap');
  const altsBtn  = document.getElementById('am-alts-btn');
  altsWrap.style.display = 'none';
  altsBtn.style.display = item.alts && item.alts.length ? '' : 'none';
  altsBtn.textContent = 'Show alternatives';
  document.getElementById('am-alts-list').innerHTML = '';
  document.getElementById('am-alts-count').textContent = '';
  // nav arrows
  const data = set==='OLL' ? OLL : PLL;
  document.getElementById('am-prev').disabled = idx === 0;
  document.getElementById('am-next').disabled = idx === data.length - 1;
  document.getElementById('algModal').classList.remove('h');
}

document.getElementById('am-alts-btn').addEventListener('click', ()=>{
  const set  = state.modalAlgSet;
  const idx  = state.modalAlgIdx;
  const item = (set==='OLL'?OLL:PLL)[idx];
  const wrap = document.getElementById('am-alts-wrap');
  const btn  = document.getElementById('am-alts-btn');
  if (wrap.style.display === 'none') {
    const list = document.getElementById('am-alts-list');
    const alts = item.alts||[];
    list.innerHTML = alts.map(a=>`<div class="am-alts-list-item">${a}</div>`).join('');
    document.getElementById('am-alts-count').textContent = alts.length ? `${alts.length} alts` : '';
    wrap.style.display = '';
    btn.textContent = 'Hide alternatives';
  } else {
    wrap.style.display = 'none';
    btn.textContent = 'Show alternatives';
  }
});

document.getElementById('algModal').addEventListener('click', e=>{
  if (e.target===document.getElementById('algModal')) document.getElementById('algModal').classList.add('h');
});
document.getElementById('algModalClose').addEventListener('click', ()=>document.getElementById('algModal').classList.add('h'));
document.getElementById('am-prev').addEventListener('click', ()=>{ if (state.modalAlgIdx>0) openAlgModal(state.modalAlgSet, state.modalAlgIdx-1); });
document.getElementById('am-next').addEventListener('click', ()=>{ const data=state.modalAlgSet==='OLL'?OLL:PLL; if (state.modalAlgIdx<data.length-1) openAlgModal(state.modalAlgSet, state.modalAlgIdx+1); });

document.addEventListener('keydown', e=>{
  if (isTyping()) return;
  // Modal case navigation
  if (!document.getElementById('algModal').classList.contains('h')) {
    if (e.key==='ArrowLeft') { e.preventDefault(); if (state.modalAlgIdx>0) openAlgModal(state.modalAlgSet, state.modalAlgIdx-1); }
    if (e.key==='ArrowRight') { e.preventDefault(); const d=state.modalAlgSet==='OLL'?OLL:PLL; if (state.modalAlgIdx<d.length-1) openAlgModal(state.modalAlgSet, state.modalAlgIdx+1); }
    if (e.key==='Escape') document.getElementById('algModal').classList.add('h');
    return;
  }
  // Time list scroll (up/down) — timer page uses .tl-area, stats page scrolls #pg-stats
  if (e.key==='ArrowDown' || e.key==='ArrowUp') {
    const scrollEl = state.page==='timer' ? document.querySelector('.tl-area')
                   : state.page==='stats'  ? document.getElementById('pg-stats')
                   : null;
    if (scrollEl) { e.preventDefault(); scrollEl.scrollBy({top: e.key==='ArrowDown' ? 48 : -48, behavior:'smooth'}); }
  }
});

['learned','learning','unknown'].forEach(st=>{
  document.getElementById(`am-${st}`).addEventListener('click', ()=>{
    const set=state.modalAlgSet, idx=state.modalAlgIdx;
    const item=(set==='OLL'?OLL:PLL)[idx];
    const key=`${set}_${item.id}`;
    state.algStatus[key]=st;
    save(); renderAlgCounts();
    renderAlgGrid(set);
    openAlgModal(set,idx);
  });
});

document.getElementById('algGrid').addEventListener('click', e=>{
  const card = e.target.closest('.alg-card');
  if (card) openAlgModal(card.dataset.set, +card.dataset.idx);
});

// Alg tabs
const CAT_SETS = {
  '3x3':  [{label:'OLL',id:'OLL'},{label:'PLL',id:'PLL'},{label:'ZBLL',id:'ZBLL'},{label:'Other',id:'Other3x3'}],
  '3BLD': [{label:'Corners',id:'BLD_Corners'},{label:'Edges',id:'BLD_Edges'}],
  'Other':[]
};

// ─── DRILL SESSION ───────────────────────────────────────────────────────────
const drill = {
  set: 'OLL', cas: null, casIdx: -1, scramble: '',
  tsState: 'idle', // idle | holding | ready | running | stopped
  startMs: 0, elapsed: 0, rafId: null, holdTimer: null,
  sessionLog: [], queue: [], sort: 'chrono',
};

function drillGetData() { return drill.set==='OLL'?OLL:PLL; }

function invertAlg(alg) {
  const moves = alg.replace(/[()[\]]/g, '').trim().split(/\s+/).filter(Boolean);
  return moves.reverse().map(m => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith('2')) return m;
    return m + "'";
  }).join(' ');
}

const Y_MAPS = {
  'y':  {R:'F',F:'L',L:'B',B:'R',r:'f',f:'l',l:'b',b:'r'},
  "y'": {R:'B',B:'L',L:'F',F:'R',r:'b',b:'l',l:'f',f:'r'},
  'y2': {R:'L',L:'R',F:'B',B:'F',r:'l',l:'r',f:'b',b:'f'},
};
const ROT_MOVES = new Set(['x',"x'","x2",'y',"y'","y2",'z',"z'","z2"]);

function removeOrientationMoves(alg) {
  let tokens = alg.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (ROT_MOVES.has(tokens[i])) {
      const map = Y_MAPS[tokens[i]];
      if (map) {
        for (let j = i+1; j < tokens.length; j++)
          tokens[j] = (map[tokens[j][0]] || tokens[j][0]) + tokens[j].slice(1);
      }
      tokens.splice(i--, 1);
    }
  }
  return tokens.join(' ');
}

function applyYRotation(alg, rot) {
  if (!rot) return alg;
  const map = Y_MAPS[rot];
  return alg.split(/\s+/).filter(Boolean).map(m => (map[m[0]] || m[0]) + m.slice(1)).join(' ');
}

const RFU = new Set(['R','F','U']);
const BASIC_MOVES = new Set(['R','F','U','L','D','B']);
const Y_ROTS = new Set(['y',"y'","y2"]);
function isBasicAlg(alg) {
  return alg.replace(/[()[\]]/g,'').trim().split(/\s+/).filter(Boolean)
    .every(m => Y_ROTS.has(m) || BASIC_MOVES.has(m.replace(/[2']/g,'')));
}

function drillMakeScramble(cas) {
  const pool = [cas.alg, ...(cas.alts || [])].filter(isBasicAlg);
  if (!pool.length) return cas.setup || '';
  const algLen = a => a.replace(/[()[\]]/g,'').trim().split(/\s+/)
    .filter(m => !Y_ROTS.has(m)).length;
  const isRFU = a => a.replace(/[()[\]]/g,'').trim().split(/\s+/)
    .every(m => Y_ROTS.has(m) || RFU.has(m.replace(/[2']/g,'')));
  const rfuPool = pool.filter(isRFU);
  let candidates;
  if (rfuPool.length) {
    candidates = rfuPool;
  } else {
    const lbCount = a => a.replace(/[()[\]]/g,'').trim().split(/\s+/)
      .filter(m => !Y_ROTS.has(m) && (m[0]==='L'||m[0]==='B')).length;
    const minLB = Math.min(...pool.map(lbCount));
    candidates = pool.filter(a => lbCount(a) === minLB);
  }
  candidates.sort((a, b) => algLen(a) - algLen(b));
  const alg = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
  const inv = removeOrientationMoves(invertAlg(alg));
  const rot = ['', 'y', "y'", 'y2'][Math.floor(Math.random() * 4)];
  return applyYRotation(inv, rot);
}

function drillShuffle() {
  const data = drillGetData();
  const valid = data.reduce((acc, cas, i) => {
    if ([cas.alg, ...(cas.alts||[])].some(isBasicAlg)) acc.push(i);
    return acc;
  }, []);
  drill.queue = [...valid];
  for (let i = drill.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [drill.queue[i], drill.queue[j]] = [drill.queue[j], drill.queue[i]];
  }
}

function drillOpen() {
  drill.set = state.modalAlgSet || 'OLL';
  drill.sessionLog = [];
  drill.queue = [];
  document.getElementById('drill-title').textContent = drill.set + ' Drill';
  document.getElementById('drillModal').classList.remove('h');
  drillNext();
}

function drillNext() {
  if (drill.rafId) { cancelAnimationFrame(drill.rafId); drill.rafId = null; }
  if (drill.holdTimer) { clearTimeout(drill.holdTimer); drill.holdTimer = null; }
  if (!drill.queue.length) drillShuffle();
  const data = drillGetData();
  drill.casIdx = drill.queue.shift();
  drill.cas = data[drill.casIdx];
  drill.scramble = drillMakeScramble(drill.cas);
  drill.tsState = 'idle';
  drill.elapsed = 0;
  document.getElementById('drill-scramble').textContent = drill.scramble;
  const disp = document.getElementById('drill-disp');
  disp.textContent = '0.000';
  disp.className = 'drill-disp';
  document.getElementById('drill-hint').textContent = 'Hold SPACE to start';
  document.getElementById('drill-reveal').classList.add('h');
  drillUpdateCount();
}

function drillStartRunning() {
  drill.tsState = 'running';
  drill.startMs = performance.now();
  const disp = document.getElementById('drill-disp');
  disp.className = 'drill-disp dt-running';
  document.getElementById('drill-hint').textContent = 'Press SPACE to stop';
  function tick() {
    drill.elapsed = performance.now() - drill.startMs;
    disp.textContent = fmtMs(drill.elapsed);
    drill.rafId = requestAnimationFrame(tick);
  }
  drill.rafId = requestAnimationFrame(tick);
}

function drillStop() {
  cancelAnimationFrame(drill.rafId); drill.rafId = null;
  drill.tsState = 'stopped';
  drill.elapsed = performance.now() - drill.startMs;
  const disp = document.getElementById('drill-disp');
  disp.textContent = fmtMs(drill.elapsed);
  disp.className = 'drill-disp dt-stopped';
  document.getElementById('drill-hint').textContent = 'Press SPACE for next case';
  // Save result
  const res = { set: drill.set, id: drill.cas.id, ms: Math.round(drill.elapsed), date: new Date().toISOString() };
  drill.sessionLog.unshift(res);
  state.drillResults.unshift(res);
  if (state.drillResults.length > 1000) state.drillResults = state.drillResults.slice(0, 1000);
  save();
  drillReveal();
  drillUpdateCount();
  drillUpdateLog();
}

function drillReveal() {
  const c = drill.cas, set = drill.set;
  const diagEl = document.getElementById('drill-diagram');
  if (set === 'OLL') diagEl.innerHTML = buildCubeSvg(c.top, 22, 2, 4, c.sides);
  else diagEl.innerHTML = buildCubeSvg(null, 22, 2, 4, c.sides);
  document.getElementById('drill-case-num').textContent = '#' + c.id;
  document.getElementById('drill-case-name').textContent = c.name || '';
  document.getElementById('drill-case-alg').textContent = c.alg;
  document.getElementById('drill-reveal').classList.remove('h');
  const key = `${set}_${c.id}`;
  const st = state.algStatus[key] || 'unknown';
  ['learned','learning','unknown'].forEach(s => {
    document.getElementById(`drill-st-${s}`).classList.toggle('on', s === st);
  });
}

function drillUpdateCount() {
  document.getElementById('drill-count').textContent = drill.sessionLog.length + ' solve' + (drill.sessionLog.length === 1 ? '' : 's');
}

function drillUpdateLog() {
  const el = document.getElementById('drill-log-list');
  if (!drill.sessionLog.length) { el.innerHTML = '<div class="drill-log-empty">No solves yet</div>'; return; }
  let rows = [...drill.sessionLog];
  if (drill.sort === 'best')  rows.sort((a, b) => a.ms - b.ms);
  if (drill.sort === 'worst') rows.sort((a, b) => b.ms - a.ms);
  el.innerHTML = rows.map((r, i) => {
    const rank = (drill.sort !== 'chrono') ? `<span class="drill-log-rank">#${i+1}</span>` : '';
    return `<div class="drill-log-row">${rank}<span class="drill-log-t">${fmtMs(r.ms)}</span><span class="drill-log-c">${r.set} #${r.id}</span></div>`;
  }).join('');
}

// Drill modal events
function drillCleanup() {
  if (drill.rafId) { cancelAnimationFrame(drill.rafId); drill.rafId = null; }
  if (drill.holdTimer) { clearTimeout(drill.holdTimer); drill.holdTimer = null; }
}
document.getElementById('drillClose').addEventListener('click', () => {
  document.getElementById('drillModal').classList.add('h');
  drillCleanup();
});
document.querySelector('.drill-btn').addEventListener('click', drillOpen);
document.getElementById('drill-next').addEventListener('click', drillNext);
document.getElementById('drill-del').addEventListener('click', () => {
  drill.sessionLog.shift();
  state.drillResults.shift();
  save();
  // Put case back at end of remaining queue so it reappears after all others
  drill.queue.push(drill.casIdx);
  // Reset timer on same case so user can retry immediately
  drill.tsState = 'idle';
  drill.elapsed = 0;
  const disp = document.getElementById('drill-disp');
  disp.textContent = '0.000';
  disp.className = 'drill-disp';
  document.getElementById('drill-hint').textContent = 'Hold SPACE to start';
  document.getElementById('drill-reveal').classList.add('h');
  drillUpdateCount();
  drillUpdateLog();
});

['learned','learning','unknown'].forEach(st => {
  document.getElementById(`drill-st-${st}`).addEventListener('click', () => {
    const key = `${drill.set}_${drill.cas.id}`;
    state.algStatus[key] = st;
    save(); renderAlgCounts();
    ['learned','learning','unknown'].forEach(s => document.getElementById(`drill-st-${s}`).classList.toggle('on', s === st));
  });
});

['best','worst'].forEach(s => {
  document.getElementById(`drill-sort-${s}`).addEventListener('click', () => {
    drill.sort = drill.sort === s ? 'chrono' : s;
    document.getElementById('drill-sort-best').classList.toggle('on', drill.sort === 'best');
    document.getElementById('drill-sort-worst').classList.toggle('on', drill.sort === 'worst');
    drillUpdateLog();
  });
});

document.getElementById('algFilterBtn').addEventListener('click', () => {
  const statusChips = document.getElementById('algStatusChips');
  const open = statusChips.classList.toggle('h');
  document.getElementById('algFilterChevron').style.transform = open ? '' : 'rotate(180deg)';
});

// Spacebar — hold-to-ready, release-to-start (same as main timer)
document.addEventListener('keydown', e => {
  if (document.getElementById('drillModal').classList.contains('h')) return;
  if (isTyping()) return;
  if (e.key === 'Escape') { document.getElementById('drillModal').classList.add('h'); drillCleanup(); return; }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (drill.tsState === 'running') { drillStop(); return; }
    if (drill.tsState === 'stopped') { drillNext(); return; }
    if (drill.tsState === 'idle') {
      drill.tsState = 'holding';
      const disp = document.getElementById('drill-disp');
      disp.className = 'drill-disp dt-holding';
      document.getElementById('drill-hint').textContent = 'Keep holding…';
      drill.holdTimer = setTimeout(() => {
        drill.tsState = 'ready';
        disp.className = 'drill-disp dt-ready';
        document.getElementById('drill-hint').textContent = 'Release to start';
      }, state.settings.delay * 1000);
    }
  }
});
document.addEventListener('keyup', e => {
  if (document.getElementById('drillModal').classList.contains('h')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (drill.holdTimer) { clearTimeout(drill.holdTimer); drill.holdTimer = null; }
    if (drill.tsState === 'ready') { drillStartRunning(); return; }
    if (drill.tsState === 'holding') {
      drill.tsState = 'idle';
      document.getElementById('drill-disp').className = 'drill-disp';
      document.getElementById('drill-hint').textContent = 'Hold SPACE to start';
    }
  }
});

// ─── PLL RECOGNITION TRAINER ─────────────────────────────────────────────────
const pllRec = { correct: 0, total: 0, streak: 0, roundCorrect: 0, roundAnswered: 0, cas: null, currentSides: null, answered: false, roundDone: false, mode: '2d', queue: [], history: [], startTime: 0, currentAuf: 0 };

const AUF_LABELS = ['', 'U', 'U2', "U'"];
function pllRecAddHistoryRow(id, auf, ms, correct, sides) {
  const list = document.getElementById('pllrec-history-list');
  const item = document.createElement('div');
  item.className = `pllrec-history-item ${correct ? 'correct' : 'wrong'}`;
  const aufLabel = AUF_LABELS[auf] ? `<span class="pllrec-history-auf">${AUF_LABELS[auf]}</span>` : '';
  const thumbSvg = buildCubeSvg(null, 8, 1, 2, sides);
  item.innerHTML = `<span class="pllrec-history-svg">${thumbSvg}</span><span class="pllrec-history-label"><span class="pllrec-history-name">${id}</span>${aufLabel}</span><span class="pllrec-history-time">${(ms/1000).toFixed(2)}s</span>`;
  list.prepend(item);
}

function pllRecShuffle() {
  pllRec.queue = [];
  PLL.forEach((_, i) => [0,1,2,3].forEach(auf => pllRec.queue.push({idx:i, auf})));
  for (let i = pllRec.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pllRec.queue[i], pllRec.queue[j]] = [pllRec.queue[j], pllRec.queue[i]];
  }
}

function draw3DPLLSvg(svgEl, sidesArr) {
  const S = 14, G = 2, ST = S + G;   // sticker, gap, step
  const DX = 9, DY = 6;              // perspective depth offsets
  const PAD = 5;
  const OX = PAD;                    // front-left x
  const OY = PAD + 3 * DY;          // top of front face = bottom-front of U face
  const RX = OX + 3 * ST;           // right face x start
  const gc = (fi, i) => sidesArr ? (PLL_C[sidesArr[fi][i]] || PLL_SIDES[fi]) : PLL_SIDES[fi];
  const STK = 'stroke="#111" stroke-width="0.6" stroke-linejoin="round"';
  let s = '';
  const poly = (pts, fill) =>
    `<polygon points="${pts.map(([x,y])=>`${x},${y}`).join(' ')}" fill="${fill}" ${STK}/>`;

  // Front face — rectangles (bottom rows first so top row rendered last / on top)
  for (let row = 2; row >= 0; row--) {
    for (let c = 0; c < 3; c++) {
      const x = OX + c * ST, y = OY + row * ST;
      const clr = row === 0 ? gc(2, c) : PLL_C['B'];
      s += poly([[x,y],[x+S,y],[x+S,y+S],[x,y+S]], clr);
    }
  }
  // Right face panel — stickers from sides[1] (right strip)
  for (let row = 2; row >= 0; row--) {
    for (let r = 2; r >= 0; r--) {
      const rx = RX + r * DX, ry = OY + row * ST - r * DY;
      const clr = row === 0 ? gc(1, 2 - r) : PLL_C['R'];
      s += poly([[rx,ry],[rx+DX,ry-DY],[rx+DX,ry-DY+S],[rx,ry+S]], clr);
    }
  }
  // U face — parallelograms (back-to-front, on top of everything)
  for (let r = 2; r >= 0; r--) {
    for (let c = 0; c < 3; c++) {
      const bx = OX + c * ST + r * DX, by = OY - r * DY;
      s += poly([[bx,by],[bx+S,by],[bx+S+DX,by-DY],[bx+DX,by-DY]], '#f5d714');
    }
  }
  svgEl.setAttribute('viewBox', `0 0 ${RX + 3*DX + PAD} ${OY + 3*ST + PAD}`);
  svgEl.innerHTML = s;
}

function rotatePLLSides(sides, n) {
  let s = sides.map(f => [...f]);
  for (let i = 0; i < n; i++) {
    const [f, r, b, l] = s;
    s = [[...l].reverse(), [...f], [...r].reverse(), [...b]];
  }
  return s;
}

const PLL_LETTERS = [...new Set(PLL.map(c => c.id[0].toUpperCase()))];

function pllRecBuildGrid() {
  const grid = document.getElementById('pllrec-grid');
  grid.innerHTML = PLL_LETTERS.map(l =>
    `<button class="pllrec-btn" data-id="${l}">${l}</button>`
  ).join('');
  grid.querySelectorAll('.pllrec-btn').forEach(btn => {
    btn.addEventListener('click', () => pllRecAnswer(btn.dataset.id));
  });
}

function pllRecShowRoundEnd() {
  pllRec.roundDone = true;
  const total = PLL.length * 4;
  const pct = Math.round(pllRec.roundCorrect / total * 100);
  document.getElementById('pllrec-re-score').textContent =
    `${pllRec.roundCorrect} / ${total} correct  (${pct}%)`;
  document.getElementById('pllrec-svg-wrap').style.display = 'none';
  document.getElementById('pllrec-fb').className = 'pllrec-fb h';
  document.getElementById('pllrec-grid').style.display = 'none';
  document.getElementById('pllrec-roundend').style.display = 'flex';
}

function pllRecContinue() {
  if (!pllRec.roundDone) return;
  pllRec.roundDone = false;
  pllRec.roundCorrect = 0;
  pllRec.roundAnswered = 0;
  document.getElementById('pllrec-correct').textContent = '0';
  document.getElementById('pllrec-roundend').style.display = 'none';
  document.getElementById('pllrec-svg-wrap').style.display = '';
  document.getElementById('pllrec-grid').style.display = '';
  pllRecShuffle();
  pllRecNext();
}

function pllRecNext() {
  pllRec.answered = false;
  if (!pllRec.queue.length) { pllRecShowRoundEnd(); return; }
  const { idx, auf } = pllRec.queue.pop();
  pllRec.cas = PLL[idx];
  pllRec.currentAuf = auf;
  pllRec.startTime = Date.now();
  pllRec.currentSides = rotatePLLSides(pllRec.cas.sides, auf);
  pllRecRender(pllRec.currentSides);
  const fb = document.getElementById('pllrec-fb');
  fb.textContent = '';
  fb.className = 'pllrec-fb h';
  document.querySelectorAll('.pllrec-btn').forEach(b => {
    b.className = 'pllrec-btn';
    b.disabled = false;
  });
}

function pllRecAnswer(letter) {
  if (pllRec.answered) return;
  letter = letter.toUpperCase();
  if (!PLL_LETTERS.includes(letter)) return;
  pllRec.answered = true;
  pllRec.total++;
  const casLetter = pllRec.cas.id[0].toUpperCase();
  const correct = letter === casLetter;
  const ms = Date.now() - pllRec.startTime;
  if (correct) { pllRec.correct++; pllRec.roundCorrect++; pllRec.streak++; }
  else { pllRec.streak = 0; }
  pllRec.roundAnswered++;
  pllRec.history.push({ id: pllRec.cas.id, auf: pllRec.currentAuf, ms, correct, sides: pllRec.currentSides });
  pllRecAddHistoryRow(pllRec.cas.id, pllRec.currentAuf, ms, correct, pllRec.currentSides);
  document.getElementById('pllrec-correct').textContent = pllRec.roundAnswered;
  document.getElementById('pllrec-streak').textContent = pllRec.streak >= 3 ? `🔥 ${pllRec.streak}` : '';
  const fb = document.getElementById('pllrec-fb');
  if (correct) {
    fb.innerHTML = `<div>✓ Correct — ${pllRec.cas.id} (${pllRec.cas.name || pllRec.cas.id})</div><div class="pllrec-fb-hint">Space → next</div>`;
    fb.className = 'pllrec-fb correct';
  } else {
    fb.innerHTML = `<div>✗ It was ${pllRec.cas.id} (${pllRec.cas.name || pllRec.cas.id})</div><div class="pllrec-fb-hint">Space → next</div>`;
    fb.className = 'pllrec-fb wrong';
  }
  document.querySelectorAll('.pllrec-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.id === casLetter) b.classList.add('correct');
    else if (b.dataset.id === letter && !correct) b.classList.add('wrong');
  });
}

function pllRecOpen() {
  pllRec.correct = 0; pllRec.total = 0; pllRec.streak = 0;
  pllRec.roundCorrect = 0; pllRec.roundAnswered = 0; pllRec.roundDone = false; pllRec.queue = [];
  pllRec.history = []; pllRec.startTime = 0; pllRec.currentAuf = 0;
  document.getElementById('pllrec-history-list').innerHTML = '';
  document.getElementById('pllrec-roundend').style.display = 'none';
  document.getElementById('pllrec-svg-wrap').style.display = '';
  document.getElementById('pllrec-grid').style.display = '';
  document.getElementById('pllrec-correct').textContent = '0';
  document.getElementById('pllrec-total').textContent = PLL.length * 4;
  document.getElementById('pllrec-streak').textContent = '';
  pllRecBuildGrid();
  pllRecShuffle();
  pllRecNext();
  document.getElementById('pllRecModal').classList.remove('h');
}

function pllRecRender(rotated) {
  const svg = document.getElementById('pllrec-svg');
  if (pllRec.mode === '3d') draw3DPLLSvg(svg, rotated);
  else drawPLLSvg(svg, rotated);
}

document.getElementById('pllrec-open-btn').addEventListener('click', pllRecOpen);
document.getElementById('pllrec-re-btn').addEventListener('click', pllRecContinue);
document.getElementById('pllRecClose').addEventListener('click', () =>
  document.getElementById('pllRecModal').classList.add('h'));
document.getElementById('pllRecModal').addEventListener('click', e => {
  if (e.target === document.getElementById('pllRecModal'))
    document.getElementById('pllRecModal').classList.add('h');
});

['2d', '3d'].forEach(m => {
  document.getElementById(`pllrec-${m}-btn`).addEventListener('click', () => {
    pllRec.mode = m;
    document.getElementById('pllrec-2d-btn').classList.toggle('on', m === '2d');
    document.getElementById('pllrec-3d-btn').classList.toggle('on', m === '3d');
    if (pllRec.cas) pllRecRender(pllRec.currentSides || pllRec.cas.sides);
  });
});

document.addEventListener('keydown', e => {
  if (document.getElementById('pllRecModal').classList.contains('h')) return;
  if (e.key === 'Escape') { document.getElementById('pllRecModal').classList.add('h'); return; }
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    if (pllRec.roundDone) { pllRecContinue(); return; }
    if (pllRec.answered) { pllRecNext(); return; }
    return;
  }
  if (pllRec.roundDone || pllRec.answered || e.repeat || e.ctrlKey || e.metaKey) return;
  pllRecAnswer(e.key);
});

function selectCat(cat) {
  document.querySelectorAll('.alg-cat').forEach(b=>b.classList.toggle('on', b.dataset.cat===cat));
  const sets = CAT_SETS[cat]||[];
  const subEl = document.getElementById('algSubTabs');
  subEl.innerHTML = sets.map((s,i)=>`<button class="alg-tab${i===0?' on':''}" data-alg="${s.id}">${s.label}</button>`).join('');
  subEl.style.display = sets.length ? 'flex' : 'none';
  // Wire sub-tab clicks
  subEl.querySelectorAll('.alg-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      subEl.querySelectorAll('.alg-tab').forEach(t=>t.classList.remove('on'));
      tab.classList.add('on');
      state.algFilter = null; state.algStatusFilter = null;
      state.modalAlgSet = tab.dataset.alg;
      document.getElementById('pllrec-open-btn').style.display = tab.dataset.alg === 'PLL' ? '' : 'none';
      renderAlgFilter(tab.dataset.alg);
      renderAlgGrid(tab.dataset.alg);
    });
  });
  const firstSet = sets[0]?.id || '';
  state.algFilter = null; state.algStatusFilter = null;
  state.modalAlgSet = firstSet;
  document.getElementById('pllrec-open-btn').style.display = firstSet === 'PLL' ? '' : 'none';
  renderAlgFilter(firstSet);
  renderAlgGrid(firstSet);
}

document.querySelectorAll('.alg-cat').forEach(btn=>{
  btn.addEventListener('click', ()=> selectCat(btn.dataset.cat));
});

