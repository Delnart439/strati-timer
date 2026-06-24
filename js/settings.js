// ─── SETTINGS ────────────────────────────────────────────────────────────────
function renderXP() {
  const { xp, xpMax, level } = state.settings;
  const pct = Math.round((xp / xpMax) * 100) + '%';
  [['sbLvl','xpFill','xpCur','xpMax'],
   ['socLvl','socXpFill','socXpCur','socXpMax'],
   ['profLvl','profXpFill','profXpCur','profXpMax']].forEach(([lvlId, fillId, curId, maxId]) => {
    document.getElementById(lvlId).textContent = level;
    document.getElementById(fillId).style.width = pct;
    document.getElementById(curId).textContent = xp.toLocaleString('fr-FR');
    document.getElementById(maxId).textContent = xpMax.toLocaleString('fr-FR');
  });
}

function loadSettings() {
  const s = state.settings;
  document.getElementById('setUsername').value = s.username||'';
  document.getElementById('setEmail').value    = s.email||'';
  document.getElementById('setInspection').checked = s.inspection;
  document.getElementById('delayVal').textContent  = s.delay.toFixed(2)+'s';
  document.getElementById('goalSlider').value = s.goal;
  document.getElementById('goalVal').textContent = s.goal+'s';
  renderXP();
  document.getElementById('sesName').textContent = curSes().name;
  const name = s.username || 'Delnart';
  document.getElementById('socName').textContent = name;
  document.getElementById('profName').textContent = name;
  const since = s.createdAt ? 'Playing since ' + new Date(s.createdAt).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '';
  document.getElementById('socSince').textContent = since;
  document.getElementById('profSince').textContent = since;
}

document.getElementById('saveProfileBtn').addEventListener('click', ()=>{
  state.settings.username = document.getElementById('setUsername').value;
  state.settings.email    = document.getElementById('setEmail').value;
  loadSettings();
  save(); toast('Profile saved!');
});
document.getElementById('setInspection').addEventListener('change', e=>{
  state.settings.inspection = e.target.checked; save();
});
document.getElementById('delayMinus').addEventListener('click', ()=>{
  state.settings.delay = Math.max(0.05, +(state.settings.delay-0.05).toFixed(2));
  document.getElementById('delayVal').textContent = state.settings.delay.toFixed(2)+'s'; save();
});
document.getElementById('delayPlus').addEventListener('click', ()=>{
  state.settings.delay = Math.min(3, +(state.settings.delay+0.05).toFixed(2));
  document.getElementById('delayVal').textContent = state.settings.delay.toFixed(2)+'s'; save();
});
document.getElementById('goalSlider').addEventListener('input', e=>{
  state.settings.goal = +e.target.value;
  document.getElementById('goalVal').textContent = state.settings.goal+'s'; save();
});

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
load();
if (!state.settings.createdAt) { state.settings.createdAt = Date.now(); save(); }
loadSettings();
pushScramble();
renderScramble();
renderStats();
renderTimeList();
selectCat('3x3');
renderAlgCounts();
renderAlgChipIcons();
renderSocEvents();
renderShareSessionPick();
setTimerState('idle');
showMascot('Mascotte/hi.png','Hey! Ready to solve?',0);
resetSleepTimer();
document.querySelectorAll('.tl-hdr .sortable').forEach(el => {
  el.addEventListener('click', () => {
    const col = el.dataset.sort;
    if (tlSortCol !== col) { tlSortCol = col; tlSortDir = 'asc'; }
    else if (tlSortDir === 'asc') { tlSortDir = 'desc'; }
    else { tlSortCol = null; tlSortDir = 'asc'; }
    renderTimeList();
  });
});
document.getElementById('sesName').textContent = curSes().name;
document.getElementById('puzName').textContent = state.puzzle;
updatePuzIcon();

// ── MOBILE RESPONSIVE ──
(function() {
  const sb = document.getElementById('sb');
  let mobileWasCollapsed = false;

  function handleResize() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile && !mobileWasCollapsed) {
      mobileWasCollapsed = true;
      sb.classList.add('sb-collapsed');
    } else if (!isMobile && mobileWasCollapsed) {
      mobileWasCollapsed = false;
      sb.classList.remove('sb-collapsed');
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();
})();
