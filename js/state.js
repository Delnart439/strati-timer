// ─── STATE ──────────────────────────────────────────────────────────────────
let state = {
  page: 'timer',
  puzzle: '3×3',
  sessions: [{name:'Session 1', puzzle:'3×3', times:[]}],
  sesIdx: 0,
  timerState: 'idle', // idle|inspecting|holding|ready|running|stopped
  startMs: 0,
  elapsed: 0,
  holdStart: 0,
  rafId: null,
  inspectActive: false,
  inspectStart: 0,
  inspectPenalty: 0,
  scrHistory: [],
  scrIdx: -1,
  splitActive: false,
  splitIdx: 0,
  modalSolveIdx: -1,
  modalSesIdx: -1,
  modalAlgSet: 'OLL',
  modalAlgIdx: 0,
  algStatus: {}, // {OLL_27: 'learned', ...}
  algFilter: null,
  algStatusFilter: null,
  drillResults: [], // {set, id, ms, date}[]
  settings: {inspection:false, delay:0.30, username:'Delnart', email:'', goal:10, createdAt:0, xp:0, xpMax:1000, level:1, xpVersion:1, share:{algs:true, session:true, sessionNames:null, prs:true}},
};

function save() {
  localStorage.setItem('strati', JSON.stringify({
    sessions: state.sessions, sesIdx: state.sesIdx,
    algStatus: state.algStatus, settings: state.settings, drillResults: state.drillResults,
    scrHistory: state.scrHistory.slice(-10),
    splitActive: state.splitActive, splitIdx: state.splitIdx
  }));
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('strati') || '{}');
    if (d.sessions) state.sessions = d.sessions;
    if (d.sesIdx !== undefined) state.sesIdx = d.sesIdx;
    state.puzzle = curSes()?.puzzle || state.puzzle;
    if (d.algStatus) state.algStatus = d.algStatus;
    if (d.drillResults) state.drillResults = d.drillResults;
    if (d.settings) {
      // Check version on raw data BEFORE merging so the default xpVersion:1 doesn't mask old data
      if (!d.settings.xpVersion) {
        d.settings.xp = 0; d.settings.level = 1; d.settings.xpVersion = 1;
      }
      state.settings = Object.assign(state.settings, d.settings);
      state.settings.xpMax = xpForLevel(state.settings.level);
    }
    if (d.scrHistory) state.scrHistory = d.scrHistory;
    if (d.splitActive !== undefined) state.splitActive = d.splitActive;
    if (d.splitIdx !== undefined) state.splitIdx = d.splitIdx;
  } catch(e) {}
}


function curSes() { return state.sessions[state.sesIdx]; }

function xpForLevel(level) {
  return Math.min(level * 1000, 10000);
}

let _lvlSolvesDone = 0, _lvlTotalMs = 0, _lvlBestMs = null;

function addXP(delta, solveMs) {
  const s = state.settings;
  const prevLevel = s.level;
  if (delta > 0 && solveMs != null && solveMs > 0) {
    _lvlSolvesDone++;
    _lvlTotalMs += solveMs;
    if (_lvlBestMs === null || solveMs < _lvlBestMs) _lvlBestMs = solveMs;
  } else if (delta > 0) {
    _lvlSolvesDone++;
  }
  s.xp += delta;
  // Level up
  while (s.xp >= xpForLevel(s.level)) {
    s.xp -= xpForLevel(s.level);
    s.level++;
  }
  // Level down
  while (s.level > 1 && s.xp < 0) {
    s.level--;
    s.xp += xpForLevel(s.level);
  }
  s.xp = Math.max(0, s.xp);
  s.xpMax = xpForLevel(s.level);
  save();
  if (typeof renderXP === 'function') renderXP();
  if (s.level > prevLevel) {
    const stats = { solves: _lvlSolvesDone, totalMs: _lvlTotalMs, bestMs: _lvlBestMs };
    _lvlSolvesDone = 0; _lvlTotalMs = 0; _lvlBestMs = null;
    return { newLevel: s.level, stats };
  }
  return null;
}
