// ─── STATE ──────────────────────────────────────────────────────────────────
let state = {
  page: 'timer',
  puzzle: '3×3',
  sessions: [{name:'Session 1', puzzle:'3×3', times:[]}],
  sesIdx: 0,
  timerState: 'idle', // idle|holding|ready|running|stopped
  startMs: 0,
  elapsed: 0,
  holdStart: 0,
  rafId: null,
  scrHistory: [],
  scrIdx: -1,
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
    scrHistory: state.scrHistory.slice(-10)
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
      state.settings = Object.assign(state.settings, d.settings);
      // Reset XP if data is from the old placeholder system (no xpVersion flag)
      if (!state.settings.xpVersion) {
        state.settings.xp = 0; state.settings.level = 1;
        state.settings.xpVersion = 1;
      }
      state.settings.xpMax = xpForLevel(state.settings.level);
    }
    if (d.scrHistory) state.scrHistory = d.scrHistory;
  } catch(e) {}
}


function curSes() { return state.sessions[state.sesIdx]; }

function xpForLevel(level) {
  return Math.min(level * 1000, 10000);
}

function addXP(delta) {
  const s = state.settings;
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
}
