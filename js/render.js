// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderStats() {
  const ao5=calcAo(5), ao12=calcAo(12), ao100=calcAo(100), mn=calcMean();
  const ts=splitTimes(), lastT=ts.length?ts[ts.length-1]:null;
  const cur0=lastT?(lastT.dnf?Infinity:(lastT.plus2?lastT.ms+2000:lastT.ms)):null;
  const bs0=bestSingle(), bao5=bestAo(5), bao12=bestAo(12), bao100=bestAo(100);
  document.getElementById('s-single').textContent = cur0!==null?(cur0===Infinity?'DNF':fmtMs(cur0)):'–';
  document.getElementById('s-ao5').textContent    = ao5!==null?fmtMs(ao5):'–';
  document.getElementById('s-ao12').textContent   = ao12!==null?fmtMs(ao12):'–';
  document.getElementById('s-ao100').textContent  = ao100!==null?fmtMs(ao100):'–';
  document.getElementById('s-mean').textContent   = mn!==null?fmtMs(mn):'–';
  document.getElementById('b-single').textContent = bs0!==null?fmtMs(bs0):'–';
  document.getElementById('b-ao5').textContent    = bao5!==null?fmtMs(bao5):'–';
  document.getElementById('b-ao12').textContent   = bao12!==null?fmtMs(bao12):'–';
  document.getElementById('b-ao100').textContent  = bao100!==null?fmtMs(bao100):'–';
  // Mobile quick stats
  const mobSolves=document.getElementById('mob-solves'); if(mobSolves) mobSolves.textContent=splitTimes().length;
  [['mob-mean',mn],['mob-ao5',ao5],['mob-ao12',ao12]].forEach(([id,v])=>{
    const el=document.getElementById(id); if(el) el.textContent=v!==null?fmtMs(v):'–';
  });
  // Stats page
  document.getElementById('st-total').textContent = ts.length;
  document.getElementById('st-best').textContent  = bs0!==null?fmtMs(bs0):'–';
  document.getElementById('st-ao5').textContent   = ao5!==null?fmtMs(ao5):'–';
  document.getElementById('st-ao12').textContent  = ao12!==null?fmtMs(ao12):'–';
  document.getElementById('st-ao100').textContent = ao100!==null?fmtMs(ao100):'–';
  document.getElementById('st-mean').textContent  = mn!==null?fmtMs(mn):'–';
  document.getElementById('stb-single').textContent = bs0!==null?fmtMs(bs0):'–';
  document.getElementById('stb-ao5').textContent    = bao5!==null?fmtMs(bao5):'–';
  document.getElementById('stb-ao12').textContent   = bao12!==null?fmtMs(bao12):'–';
  document.getElementById('stb-ao100').textContent  = bao100!==null?fmtMs(bao100):'–';
  // Profile/Social
  [['pr-s','prof-s'],['pr-5','prof-5'],['pr-12','prof-12'],['pr-100','prof-100']].forEach(([a,b],i)=>{
    const v=[bs0,bao5,bao12,bao100][i];
    const t = v!==null?fmtMs(v):'–';
    document.getElementById(a).textContent=t;
    document.getElementById(b).textContent=t;
  });
  if (typeof renderArchivedSessions === 'function') renderArchivedSessions();
}

let tlSortCol = null, tlSortDir = 'asc';

function renderTimeList() {
  const ts = splitTimes();
const bestIdx = (() => {
    let bi=-1, bv=Infinity;
    ts.forEach((t,i)=>{if(!t.dnf){const v=t.plus2?t.ms+2000:t.ms;if(v<bv){bv=v;bi=i;}}});
    return bi;
  })();
  // Update header sort indicators
  document.querySelectorAll('.tl-hdr .sortable').forEach(el => {
    const col = el.dataset.sort;
    el.classList.toggle('active', col===tlSortCol);
    const arrow = col===tlSortCol ? (tlSortDir==='asc'?' ↑':' ↓') : '';
    el.textContent = col + arrow;
  });
  // Build sorted entry list
  let entries = ts.map((t,i)=>({t,i}));
  if (tlSortCol==='single') {
    entries.sort((a,b)=>{
      const va=a.t.dnf?Infinity:(a.t.plus2?a.t.ms+2000:a.t.ms);
      const vb=b.t.dnf?Infinity:(b.t.plus2?b.t.ms+2000:b.t.ms);
      return tlSortDir==='asc'?va-vb:vb-va;
    });
  } else if (tlSortCol==='ao5') {
    entries.sort((a,b)=>{
      const va=ao5At(a.i)??(tlSortDir==='asc'?Infinity:-Infinity);
      const vb=ao5At(b.i)??(tlSortDir==='asc'?Infinity:-Infinity);
      return tlSortDir==='asc'?va-vb:vb-va;
    });
  }
  // Right panel list
  let html = '';
  entries.forEach(({t,i}) => {
    const ao = ao5At(i);
    const sClass = i===bestIdx?' best':'';
    const tCls   = t.dnf?'te-s te-dnf':t.plus2?'te-s te-p2':'te-s';
    html += `<div class="te${sClass}" data-idx="${i}">
      <span class="te-n">${ts.length-i}.</span>
      <span class="${tCls}" ${t.dnf ? `title="${fmtMs(t.ms)}"` : ''}>${t.dnf ? 'DNF' : fmtMs(t.ms + (t.plus2 ? 2000 : 0)) + (t.plus2 ? '+' : '')}</span>
      <span class="te-a">${ao!==null?fmtMs(ao):'–'}</span>
      <button class="te-del" onclick="event.stopPropagation();quickDelTime(${i})" title="Delete solve">×</button>
    </div>`;
  });
  document.getElementById('timeList').innerHTML = html || '<div style="padding:12px 14px;color:var(--muted);font-size:12px">No solves yet</div>';
  // Mobile time list
  const mobTl = document.getElementById('mob-tl');
  if (mobTl) {
    let mhtml = '';
    entries.slice(0, 40).forEach(({t, i}) => {
      const n = ts.length - i;
      const isBest = i === bestIdx;
      const v = t.dnf ? 'DNF' : fmtMs(t.ms + (t.plus2 ? 2000 : 0)) + (t.plus2 ? '+' : '');
      const tCls = t.dnf ? ' mob-te-dnf' : '';
      mhtml += `<div class="mob-te${isBest?' mob-te-best':''}" data-idx="${i}"><span class="mob-te-n">${n}.</span><span class="mob-te-t${tCls}">${v}</span></div>`;
    });
    mobTl.innerHTML = mhtml;
  }
  // Stats page grid
  let g='';
  ts.forEach((t,i)=>{
    const n=ts.length-i;
    g+=`<div class="sc" data-idx="${i}"><div class="sc-n">${n}.</div><span class="sc-t">${fmtMs2(t.ms,t)}</span><button class="sc-share" onclick="event.stopPropagation();shareOptClick('single',${i})" title="Share this solve"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button></div>`;
  });
  document.getElementById('statsGrid').innerHTML = g;
  renderStatsGraphs();
  renderSocLastSes();
}

function scrToHtml(scr) {
  return scr.split(/\s+/).filter(Boolean).map(m=>`<span style="white-space:nowrap">${m}</span>`).join(' ');
}
function renderScramble() {
  const scr = state.scrHistory[state.scrIdx] || '';
  const scrEl = document.getElementById('scrTxt');
  scrEl.innerHTML = scrToHtml(scr);
  const isBig = ['6×6','7×7','Megaminx'].includes(state.puzzle);
  scrEl.classList.toggle('scr-big', isBig);
  const netEl = document.getElementById('cubeNet');
  const areaEl = netEl.closest('.cube-area');
  if (areaEl) { areaEl.style.display = ''; if (state.settings.hideCubeNet) areaEl.classList.add('cube-hidden'); }
  drawPuzzleImage(netEl, state.puzzle, scr);
  const mobNetEl = document.getElementById('cubeNetMob');
  if (mobNetEl) drawPuzzleImage(mobNetEl, state.puzzle, scr);
  // Battle mode: shared scramble + net (keyboard mode)
  const bScrEl = document.getElementById('battleScrTxt');
  const bNetEl = document.getElementById('battleCubeNet');
  if (bScrEl) bScrEl.innerHTML = scrToHtml(scr);
  if (bNetEl) drawPuzzleImage(bNetEl, state.puzzle, scr);
  // Battle cube mode: per-player scramble texts
  const b1ScrEl = document.getElementById('b1-scr-txt');
  const b2ScrEl = document.getElementById('b2-scr-txt');
  if (b1ScrEl) b1ScrEl.innerHTML = scrToHtml(scr);
  if (b2ScrEl) b2ScrEl.innerHTML = scrToHtml(scr);
}

let socEvSel = null;

function renderSocLastSes() {
  const el = document.getElementById('socLastSes');
  if (!el) return;
  let s, sesIdx;
  if (socEvSel !== null) {
    sesIdx = socEvSel;
    s = state.sessions[sesIdx];
  } else {
    const shared = sharedSessions();
    if (!shared.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0">No solves yet</div>'; return; }
    s = shared[0].s; sesIdx = shared[0].i;
  }
  if (!s || !s.times.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0">No solves yet</div>';
    return;
  }
  const rev = [...s.times].reverse();
  el.innerHTML = rev.map((t, i) => {
    const realIdx = s.times.length - 1 - i;
    return `<div class="sc soc-sc-click" style="cursor:pointer" data-idx="${realIdx}" data-ses="${sesIdx}"><div class="sc-n">${s.times.length - i}.</div>${fmtMsFull(t.ms, t)}</div>`;
  }).join('');
}

document.getElementById('socLastSes').addEventListener('click', e => {
  const sc = e.target.closest('.soc-sc-click');
  if (!sc) return;
  openSolveModal(+sc.dataset.idx, +sc.dataset.ses);
});

function sharedSessions() {
  const names = state.settings.share?.sessionNames;
  return state.sessions.map((s, i) => ({s, i})).filter(({s}) =>
    s.times && s.times.length > 0 && (names === null || names === undefined || names.includes(s.name))
  );
}

let socProfileOpen = false;

function setSocView(profile) {
  socProfileOpen = profile;
  document.getElementById('socHomeView').classList.toggle('h', profile);
  document.getElementById('socProfileView').classList.toggle('h', !profile);
  document.getElementById('socProfBtn').classList.toggle('on', profile);
  document.getElementById('socHomeBtn').classList.toggle('on', !profile);
  document.getElementById('socNavTitle').textContent = profile ? 'Social — My Profile' : 'Social';
  if (profile) { renderAlgCounts(); renderAlgChipIcons(); applySocialShare(); }
}

document.getElementById('socProfBtn').addEventListener('click', () => setSocView(true));
document.getElementById('socHomeBtn').addEventListener('click', () => setSocView(false));

let recoFilter = 'all';

function renderRecoFeed() {
  const el = document.getElementById('recoFeed');
  if (!el) return;
  const filtered = recoFilter === 'all' ? RECO_DATA : RECO_DATA.filter(r => r.event === recoFilter);
  el.innerHTML = filtered.map((r, i) => {
    const tags = r.tags.map(t => `<span class="reco-tag ${t.toLowerCase()}">${t}</span>`).join('');
    const solLines = r.solution.split('\n').map(l => `<div>${l}</div>`).join('');
    return `<div class="reco-card">
      <div class="reco-top">
        <div class="reco-av">${r.av}</div>
        <div>
          <div class="reco-solver">${r.solver}</div>
          <div style="font-size:11px;color:var(--dim)">${r.comp}</div>
          <div style="font-size:10px;color:var(--muted)">Reco by ${r.recoBy}</div>
        </div>
        <div class="reco-time">${r.time}s</div>
      </div>
      <div class="reco-meta">
        <span class="reco-tag">${r.event === '3x3' ? '3×3' : r.event === '3bld' ? '3BLD' : r.event}</span>
        <span class="reco-tag">${r.method}</span>
        <span class="reco-tag">${r.date}</span>
        ${tags}
      </div>
      <div class="reco-scr"><b style="color:var(--muted)">Scramble</b><br>${r.scramble}</div>
      <div class="reco-stats">
        <div class="reco-stat"><div class="reco-stat-v">${r.moves}</div><div class="reco-stat-l">Moves</div></div>
        <div class="reco-stat"><div class="reco-stat-v">${r.tps}</div><div class="reco-stat-l">TPS</div></div>
      </div>
      <details style="margin-top:2px">
        <summary class="reco-btn"><i data-lucide="play" style="width:13px;height:13px"></i> View Reconstruction</summary>
        <div class="reco-scr" style="margin-top:8px;white-space:pre-wrap">${solLines}</div>
      </details>
    </div>`;
  }).join('');
  lucide.createIcons();
}

document.getElementById('recoFilters').addEventListener('click', e => {
  const btn = e.target.closest('.reco-filter');
  if (!btn) return;
  recoFilter = btn.dataset.f;
  document.querySelectorAll('.reco-filter').forEach(b => b.classList.toggle('on', b.dataset.f === recoFilter));
  renderRecoFeed();
});

function renderSocEvents() {
  const iconsEl = document.getElementById('socEvIcons');
  if (!iconsEl) return;
  const sessions = sharedSessions();
  if (socEvSel !== null && !sessions.find(({i}) => i === socEvSel)) socEvSel = null;
  const activeIdx = socEvSel !== null ? socEvSel : (sessions.length ? sessions[0].i : -1);
  iconsEl.innerHTML = sessions.map(({s, i}) =>
    `<button class="soc-ev-btn${i === activeIdx?' on':''}" data-idx="${i}">${getPuzIcon(s.puzzle)}<span>${s.name}</span></button>`
  ).join('');
  iconsEl.querySelectorAll('.soc-ev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      socEvSel = idx;
      iconsEl.querySelectorAll('.soc-ev-btn').forEach(b => b.classList.toggle('on', parseInt(b.dataset.idx) === socEvSel));
      renderSocLastSes();
    });
  });
}
const NOT_SHARED_HTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0;font-style:italic">Data not shared</div>';

function applySocialShare() {
  const sh = state.settings.share || {};

  // Algs section
  const algsContent = document.querySelector('#socAlgsSec .soc-alg-g');
  if (algsContent) algsContent.style.display = sh.algs !== false ? '' : 'none';
  let algsMsg = document.getElementById('socAlgsNotShared');
  if (!algsMsg) {
    algsMsg = document.createElement('div');
    algsMsg.id = 'socAlgsNotShared';
    document.getElementById('socAlgsSec')?.appendChild(algsMsg);
  }
  algsMsg.innerHTML = sh.algs !== false ? '' : NOT_SHARED_HTML;

  // Personal records section
  const recContent = document.querySelector('#socRecSec .soc-rg');
  if (recContent) recContent.style.display = sh.prs !== false ? '' : 'none';
  let recMsg = document.getElementById('socRecNotShared');
  if (!recMsg) {
    recMsg = document.createElement('div');
    recMsg.id = 'socRecNotShared';
    document.getElementById('socRecSec')?.appendChild(recMsg);
  }
  recMsg.innerHTML = sh.prs !== false ? '' : NOT_SHARED_HTML;

  // Session section
  const sesShared = sh.session !== false;
  renderSocEvents();
  if (!sesShared) {
    document.getElementById('socEvIcons').innerHTML = '';
    document.getElementById('socLastSes').innerHTML = NOT_SHARED_HTML;
  } else {
    renderSocLastSes();
  }
}

function renderShareSessionPick() {
  const wrap = document.getElementById('shareSessionPick');
  if (!wrap) return;
  const sh = state.settings.share || {};
  const sharedNames = sh.sessionNames;
  wrap.innerHTML = state.sessions.map((s, i) => {
    const checked = sharedNames === null || sharedNames === undefined || sharedNames.includes(s.name);
    return `<label class="prof-ses-chk"><input type="checkbox" ${checked ? 'checked' : ''} data-name="${s.name}"><span class="prof-ses-chk-name">${s.name}</span><span class="prof-ses-chk-puz">${s.puzzle || ''}</span></label>`;
  }).join('');

  const saveShare = () => {
    const sh = state.settings.share || (state.settings.share = {});
    sh.algs = document.getElementById('share-algs')?.checked !== false;
    sh.session = document.getElementById('share-session')?.checked !== false;
    sh.prs = document.getElementById('share-prs')?.checked !== false;
    const boxes = wrap.querySelectorAll('input[type=checkbox]');
    const allChecked = [...boxes].every(b => b.checked);
    sh.sessionNames = allChecked ? null : [...boxes].filter(b => b.checked).map(b => b.dataset.name);
    save();
    applySocialShare();
  };

  wrap.querySelectorAll('input').forEach(b => b.addEventListener('change', saveShare));
  ['share-algs','share-session','share-prs'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveShare);
  });

  const tog = document.getElementById('share-session');
  const setVis = () => { wrap.style.display = tog?.checked ? '' : 'none'; };
  setVis();
  tog?.addEventListener('change', setVis);

  // Restore toggle states
  const s = state.settings.share || {};
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val !== false; };
  setChk('share-algs', s.algs);
  setChk('share-session', s.session);
  setChk('share-prs', s.prs);
  setVis();
}
function renderAlgChipIcons() {
  const suneTop = [0,1,0,1,1,1,1,1,0];
  const suneSides = [[1,0,0],[1,0,0],[0,0,1],[0,0,0]];
  const tpermSides = [['O','O','G'],['R','B','O'],['R','R','G'],['B','G','B']];
  const oll21Top = [0,1,0,1,1,1,0,1,0];
  const oll21Sides = [[0,0,0],[1,0,1],[0,0,0],[1,0,1]];
  const suneSvg = buildCubeSvg(suneTop, 6, 1, 1, suneSides);
  const tpermSvg = buildCubeSvg(null, 6, 1, 1, tpermSides);
  const oll21Svg = buildCubeSvg(oll21Top, 6, 1, 1, oll21Sides);
  ['soc-ic-oll','prof-ic-oll'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = suneSvg; });
  ['soc-ic-pll','prof-ic-pll'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = tpermSvg; });
  ['soc-ic-zbll','prof-ic-zbll'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = oll21Svg; });
}
function renderAlgCounts() {
  const ollL = OLL.filter(o=>state.algStatus[`OLL_${o.id}`]==='learned').length;
  const pllL = PLL.filter(p=>state.algStatus[`PLL_${p.id}`]==='learned').length;
  const zbllL = Object.keys(state.algStatus).filter(k=>k.startsWith('ZBLL_')&&state.algStatus[k]==='learned').length;
  document.getElementById('soc-oll').textContent = `${ollL}/57 learned`;
  document.getElementById('soc-pll').textContent = `${pllL}/21 learned`;
  document.getElementById('soc-zbll').textContent = `${zbllL}/493 learned`;
  document.getElementById('prof-oll').textContent = `${ollL}/57 learned`;
  document.getElementById('prof-pll').textContent = `${pllL}/21 learned`;
  const setOpacity = (id, count) => { const el = document.getElementById(id); if (el) el.style.opacity = count > 0 ? '1' : '0.35'; };
  setOpacity('soc-chip-oll', ollL); setOpacity('prof-chip-oll', ollL);
  setOpacity('soc-chip-pll', pllL); setOpacity('prof-chip-pll', pllL);
  setOpacity('soc-chip-zbll', zbllL); setOpacity('prof-chip-zbll', zbllL);
}

const OLL_CATS = {
  'All Corners Oriented': [28,57],
  'Awkward Shapes': [29,30,41,42],
  'C Shapes': [34,46],
  'Dot': [1,2,3,4,17,18,19,20],
  'Fish Shapes': [9,10,35,37],
  'Knight Move': [13,14,15,16],
  'L Shapes': [47,48,49,50,53,54],
  'Lightning': [7,8,11,12,39,40],
  'Line': [51,52,55,56],
  'Solved Cross': [21,22,23,24,25,26,27],
  'P Shape': [31,32,43,44],
  'Square': [5,6],
  'T Shape': [33,45],
  'W Shapes': [36,38],
};
const PLL_CATS = {
  'Adjacent Swap': ['Aa','Ab','F','Ga','Gb','Gc','Gd','Ja','Jb','Ra','Rb','T'],
  'Edge Permutation': ['H','Ua','Ub','Z'],
  'Opposite Swap': ['E','Na','Nb','V','Y'],
};

function renderAlgFilter(set) {
  const wrap = document.getElementById('algFilterWrap');
  const chips = document.getElementById('algFilterChips');
  const statusChips = document.getElementById('algStatusChips');
  const cats = set==='OLL' ? OLL_CATS : set==='PLL' ? PLL_CATS : null;
  const allCases = set==='OLL' ? OLL : PLL;
  // Close status panel and reset on tab switch
  statusChips.classList.add('h');
  document.getElementById('algFilterChevron').style.transform = '';
  if (!cats) { wrap.classList.add('h'); return; }
  wrap.classList.remove('h');
  // Category chips — SVG diagram thumbnails, always visible
  chips.innerHTML = `<button class="alg-cat-chip alg-cat-chip-all${!state.algFilter?' on':''}">All</button>` +
    Object.keys(cats).map(name => {
      const ids = cats[name];
      const caseData = allCases.find(item => item.id === ids[0]);
      const svgHtml = caseData ? buildCubeSvg(caseData.top || null, 11, 1, 0, caseData.sides) : '';
      return `<button class="alg-cat-chip${state.algFilter===name?' on':''}" data-filter="${name}">${svgHtml}<div class="alg-cat-chip-name">${name}</div></button>`;
    }).join('');
  chips.querySelectorAll('.alg-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.algFilter = btn.dataset.filter || null;
      chips.querySelectorAll('.alg-cat-chip').forEach(b => b.classList.toggle('on', (b.dataset.filter||null)===state.algFilter));
      renderAlgGrid(set);
    });
  });
  // Status chips — populated once, toggled by Filter button
  const statuses = [{key:'learned',label:'✓ Learned'},{key:'learning',label:'~ Learning'},{key:'unknown',label:'? Unknown'}];
  statusChips.innerHTML = `<button class="alg-filter-chip${!state.algStatusFilter?' on':''}">All</button>` +
    statuses.map(s =>
      `<button class="alg-filter-chip${state.algStatusFilter===s.key?' on':''}" data-status="${s.key}">${s.label}</button>`
    ).join('');
  statusChips.querySelectorAll('.alg-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.algStatusFilter = btn.dataset.status || null;
      statusChips.querySelectorAll('.alg-filter-chip').forEach(b => b.classList.toggle('on', (b.dataset.status||null)===state.algStatusFilter));
      algFilterUpdateBtn();
      renderAlgGrid(set);
    });
  });
  algFilterUpdateBtn();
}

function algFilterUpdateBtn() {
  const label = state.algStatusFilter ? ({learned:'✓ Learned',learning:'~ Learning',unknown:'? Unknown'}[state.algStatusFilter]) : 'Filter';
  document.getElementById('algFilterLabel').textContent = label;
  document.getElementById('algFilterBtn').classList.toggle('active', !!state.algStatusFilter);
}

function renderAlgGrid(set) {
  const all = set==='OLL' ? OLL : set==='PLL' ? PLL : [];
  // Apply category filter
  const cats = set==='OLL' ? OLL_CATS : set==='PLL' ? PLL_CATS : null;
  const filterIds = (state.algFilter && cats) ? cats[state.algFilter] : null;
  const catData = filterIds ? all.filter(item => filterIds.includes(item.id)) : all;
  let data = [...catData];
  // Apply status filter
  if (state.algStatusFilter) data = data.filter(item => (state.algStatus[`${set}_${item.id}`]||'unknown') === state.algStatusFilter);
  const title = state.algFilter ? `${set} – ${state.algFilter} (${data.length})` : `All ${set} Cases (${data.length})`;
  document.getElementById('algSecTitle').textContent = title;
  // Progress bar: green=learned, orange=learning
  const learnedN = catData.filter(item => (state.algStatus[`${set}_${item.id}`]||'unknown')==='learned').length;
  const learningN = catData.filter(item => (state.algStatus[`${set}_${item.id}`]||'unknown')==='learning').length;
  const done = learnedN + learningN;
  const tot = catData.length;
  const donePct = tot ? (done/tot)*100 : 0;
  const innerLearnedPct = done > 0 ? (learnedN/done)*100 : 0;
  document.getElementById('algCount').textContent = `${done}/${tot} — ${Math.round(donePct)}%`;
  const fill = document.getElementById('algProgFill');
  fill.style.width = `${donePct}%`;
  fill.style.background = `linear-gradient(90deg, var(--green) ${innerLearnedPct}%, var(--gold) ${innerLearnedPct}%)`;
  let html='';
  data.forEach((item,i)=>{
    const key = `${set}_${item.id}`;
    const st = state.algStatus[key]||'unknown';
    const badge = st==='learned'?'<span class="alg-badge bl">LEARNED</span>':st==='learning'?'<span class="alg-badge bg">LEARNING</span>':'<span class="alg-badge bu">UNKNOWN</span>';
    let svgHtml='';
    if (set==='OLL' && item.top) {
      svgHtml=`<div class="alg-svg-wrap">${buildCubeSvg(item.top, 16, 1, 3, item.sides)}</div>`;
    } else if (set==='PLL') {
      svgHtml=`<div class="alg-svg-wrap">${buildCubeSvg(null, 16, 1, 3, item.sides)}</div>`;
    }
    html+=`<div class="alg-card" data-set="${set}" data-idx="${i}">${badge}<div class="alg-card-body">${svgHtml}<div class="alg-card-info"><div class="alg-num">#${item.id}</div><div class="alg-cs"><div><span>Median</span> <b>–</b></div><div><span>Best</span> <b>–</b></div></div></div></div></div>`;
  });
  if (!html) html='<div style="color:var(--muted);font-size:13px">Coming soon</div>';
  document.getElementById('algGrid').innerHTML = html;
}

