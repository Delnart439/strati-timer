// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtMs(ms, {plus2=false,dnf=false}={}) {
  if (dnf) return 'DNF';
  const t = plus2 ? ms + 2000 : ms;
  if (t < 60000) return (Math.floor(t / 10) / 100).toFixed(2);
  const m = Math.floor(t / 60000);
  const s = (Math.floor((t % 60000) / 10) / 100).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function fmtMsFull(ms, flags={}) {
  if (flags.dnf) return `DNF (${fmtMs(ms)})`;
  if (flags.plus2) return fmtMs(ms, {plus2:true}) + '+';
  return fmtMs(ms);
}
function fmtMs2(ms, flags={}) {
  if (flags.dnf) return 'DNF';
  const t = flags.plus2 ? ms + 2000 : ms;
  if (t < 60000) return (Math.floor(t / 10) / 100).toFixed(2) + (flags.plus2 ? '+' : '');
  const m = Math.floor(t / 60000);
  const s = (Math.floor((t % 60000) / 10) / 100).toFixed(2).padStart(5, '0');
  return `${m}:${s}` + (flags.plus2 ? '+' : '');
}

function curSes() { return state.sessions[state.sesIdx]; }

function sesMs() {
  return curSes().times.map(t => t.dnf ? Infinity : (t.plus2 ? t.ms+2000 : t.ms));
}

function calcAo(n) {
  const ts = curSes().times;
  if (ts.length < n) return null;
  const last = ts.slice(0, n);
  const dnfs = last.filter(t=>t.dnf).length;
  if (dnfs > 1) return null;
  const vals = last.map(t => t.dnf ? Infinity : (t.plus2 ? t.ms+2000 : t.ms)).sort((a,b)=>a-b);
  const trim = vals.slice(1, -1);
  if (trim.some(v=>v===Infinity)) return null;
  return trim.reduce((a,b)=>a+b,0)/trim.length;
}

function bestAo(n) {
  const ts = curSes().times;
  if (ts.length < n) return null;
  let best = null;
  for (let i = 0; i <= ts.length - n; i++) {
    const chunk = ts.slice(i, i+n);
    const dnfs = chunk.filter(t=>t.dnf).length;
    if (dnfs > 1) continue;
    const vals = chunk.map(t=>t.dnf?Infinity:(t.plus2?t.ms+2000:t.ms)).sort((a,b)=>a-b);
    const trim = vals.slice(1,-1);
    if (trim.some(v=>v===Infinity)) continue;
    const avg = trim.reduce((a,b)=>a+b,0)/trim.length;
    if (best===null || avg<best) best = avg;
  }
  return best;
}

function ao5At(idx) {
  const ts = curSes().times;
  const n = 5;
  if (idx + n > ts.length) return null;
  const chunk = ts.slice(idx, idx+n);
  const dnfs = chunk.filter(t=>t.dnf).length;
  if (dnfs > 1) return null;
  const vals = chunk.map(t=>t.dnf?Infinity:(t.plus2?t.ms+2000:t.ms)).sort((a,b)=>a-b);
  const trim = vals.slice(1,-1);
  if (trim.some(v=>v===Infinity)) return null;
  return trim.reduce((a,b)=>a+b,0)/trim.length;
}

function calcMean() {
  const ts = curSes().times.filter(t=>!t.dnf);
  if (!ts.length) return null;
  return ts.reduce((a,t)=>a+(t.plus2?t.ms+2000:t.ms),0)/ts.length;
}

function bestSingle() {
  const valid = curSes().times.filter(t=>!t.dnf);
  if (!valid.length) return null;
  return Math.min(...valid.map(t=>t.plus2?t.ms+2000:t.ms));
}

// ─── SCRAMBLE GENERATORS ──────────────────────────────────────────────────────
const _rnd = n => Math.floor(Math.random() * n);
const _pick = arr => arr[_rnd(arr.length)];

// Axis-aware NxN generator: no two consecutive moves on the same axis (U/D=0, F/B=1, R/L=2)
function genAxisScramble(moveBases, count) {
  const axisOf = m => /[UD]/.test(m) ? 0 : /[FB]/.test(m) ? 1 : 2;
  const sfxs = ["", "'", '2'];
  const result = [];
  let lastAxis = -1;
  for (let i = 0; i < count; i++) {
    const pool = moveBases.filter(m => axisOf(m) !== lastAxis);
    const base = pool[_rnd(pool.length)];
    result.push(base + sfxs[_rnd(3)]);
    lastAxis = axisOf(base);
  }
  return result.join(' ');
}

// 3×3 / 3OH: 20 moves, all 6 faces, no same axis twice in a row
function gen3x3() {
  return genAxisScramble(['U','D','F','B','L','R'], 20);
}

// 3BLD: same as 3×3 + 2 wide moves for cube orientation (Rw/Uw/Fw, no same face twice)
function gen3x3BLD() {
  const base = gen3x3();
  const wides = ['Rw',"Rw'",'Rw2','Uw',"Uw'",'Uw2','Fw',"Fw'",'Fw2'];
  let m1 = _pick(wides);
  let m2; do { m2 = _pick(wides); } while (m2[0] === m1[0]);
  return base + ' ' + m1 + ' ' + m2;
}

// 2×2: 9 moves using R, U, F only (3 independent axes)
function gen2x2() {
  return genAxisScramble(['U','F','R'], 9);
}

// 4×4: 44 moves — outer + wide moves (no Bw/Dw)
function gen4x4() {
  return genAxisScramble(['U','D','F','B','L','R','Uw','Fw','Rw'], 44);
}

// 5×5: 60 moves — same move set as 4×4
function gen5x5() {
  return genAxisScramble(['U','D','F','B','L','R','Uw','Dw','Fw','Bw','Lw','Rw'], 60);
}

// 6×6: 80 moves — cstimer style: outer + Uw/Rw/Fw + 3Uw/3Rw/3Fw
function gen6x6() {
  return genAxisScramble(['U','D','F','B','L','R','Uw','Rw','Fw','3Uw','3Rw','3Fw'], 80);
}

// 7×7: 100 moves — same as 6×6
function gen7x7() {
  return genAxisScramble(['U','D','F','B','L','R','Uw','Dw','Fw','Bw','Lw','Rw',
    '3Uw','3Dw','3Fw','3Bw','3Lw','3Rw'], 100);
}

// Pyraminx: 11 base moves (U L R B, no same face twice) + 0–4 random tip moves
function genPyraminx() {
  const bases = ['U','L','R','B'], sfxs = ["","'"];
  const result = [];
  let last = '';
  for (let i = 0; i < 11; i++) {
    let f; do { f = _pick(bases); } while (f === last);
    result.push(f + sfxs[_rnd(2)]); last = f;
  }
  const tips = ['u','l','r','b'].sort(() => Math.random() - .5).slice(0, _rnd(5));
  tips.forEach(t => result.push(t + sfxs[_rnd(2)]));
  return result.join(' ');
}

// FTO: ~24 moves, 8 faces (U F R L D B BL BR), CW/CCW only, no same or opposite face twice in a row
// Move set matches cstimer (ra="U U' F F' r r' l l' D D' B B' R R' L L'" with l→BL, r→BR)
function genFTO() {
  const faces = ['U','F','R','L','D','B','BL','BR'];
  const opposites = { U:'D', D:'U', F:'B', B:'F', R:'L', L:'R', BL:'BR', BR:'BL' };
  const sfxs = ["","'"];
  const result = [];
  let last = '', lastOpp = '';
  for (let i = 0; i < 24; i++) {
    let f;
    do { f = _pick(faces); } while (f === last || f === lastOpp);
    result.push(f + _pick(sfxs));
    last = f; lastOpp = opposites[f];
  }
  return result.join(' ');
}

// Skewb: 11 moves using R L U B (vertex-turn notation, no 2-suffix, no same face twice)
function genSkewb() {
  const bases = ['R','L','U','B'], sfxs = ["","'"];
  const result = [];
  let last = '';
  for (let i = 0; i < 11; i++) {
    let f; do { f = _pick(bases); } while (f === last);
    result.push(f + sfxs[_rnd(2)]); last = f;
  }
  return result.join(' ');
}

// Megaminx: WCA format — 7 rows of 5×(R±± D±±) + U/U'
function genMegaminx() {
  const pm = () => _rnd(2) ? '++' : '--';
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const row = [];
    for (let j = 0; j < 5; j++) { row.push('R' + pm()); row.push('D' + pm()); }
    row.push(_rnd(2) ? 'U' : "U'");
    rows.push(row.join(' '));
  }
  return rows.join('\n');
}

// Square-1: WCA format — (top, bottom)/ pairs, top/bottom ∈ [-5, 6]
function genSquare1() {
  const moves = [];
  for (let i = 0; i < 11; i++) {
    const t = _rnd(12) - 5, b = _rnd(12) - 5;
    moves.push(`(${t},${b})/`);
  }
  return moves.join(' ');
}

// Clock: WCA format — pin+face turns for front face, y2, face turns for back
function genClock() {
  const n = () => _rnd(6) + 1; // 1-6 clicks
  const s = () => _rnd(2) ? '+' : '-';
  const front = ['UR','DR','DL','UL'].map(p => `${p}${n()}${s()}`).join(' ')
    + ' ' + ['U','R','D','L','ALL'].map(f => `${f}${n()}${s()}`).join(' ');
  const back  = ['U','R','D','L','ALL'].map(f => `${f}${n()}${s()}`).join(' ');
  return `${front} y2 ${back}`;
}

// Gear Cube Random-State Scrambler
// Ported from csTimer's gearcube.js by cs0x7f (https://github.com/cs0x7f/cstimer), GPLv3
const GearCube = (() => {
  const cmv = [], emv = [], prun = [];
  let initialized = false;

  function getNPerm(arr, n) {
    let idx = 0;
    for (let i = 0; i < n; i++) {
      idx *= (n - i);
      for (let j = i + 1; j < n; j++) if (arr[j] < arr[i]) idx++;
    }
    return idx;
  }
  function setNPerm(arr, idx, n) {
    arr[n - 1] = 0;
    for (let i = n - 2; i >= 0; i--) {
      arr[i] = idx % (n - i);
      idx = Math.floor(idx / (n - i));
      for (let j = i + 1; j < n; j++) if (arr[j] >= arr[i]) arr[j]++;
    }
  }
  function cornerMove(idx, m) {
    const arr = [];
    setNPerm(arr, idx, 4);
    const tmp = arr[0]; arr[0] = arr[m + 1]; arr[m + 1] = tmp;
    return getNPerm(arr, 4);
  }
  function edgeMove(idx, m) {
    const arr = [];
    let ori = idx % 3;
    setNPerm(arr, Math.floor(idx / 3), 4);
    if (m === 0) {
      const tmp = arr[0]; arr[0] = arr[1]; arr[1] = arr[2]; arr[2] = arr[3]; arr[3] = tmp;
      ori = (ori + 1) % 3;
    } else if (m === 1) {
      const tmp = arr[0]; arr[0] = arr[1]; arr[1] = tmp;
    } else {
      const tmp = arr[0]; arr[0] = arr[3]; arr[3] = tmp;
    }
    return getNPerm(arr, 4) * 3 + ori;
  }
  function init() {
    if (initialized) return;
    initialized = true;
    for (let i = 0; i < 72; i++) { emv[i] = []; for (let m = 0; m < 3; m++) emv[i][m] = edgeMove(i, m); }
    for (let i = 0; i < 24; i++) { cmv[i] = []; for (let m = 0; m < 3; m++) cmv[i][m] = cornerMove(i, m); }
    for (let axis = 0; axis < 3; axis++) {
      const dist = { 0: 0 };
      for (let depth = 0; depth < 5; depth++) {
        for (const key in dist) {
          if (dist[key] !== depth) continue;
          const base = parseInt(key);
          for (let m = 0; m < 3; m++) {
            let q = base;
            for (let rep = 0; rep < 12; rep++) {
              const edge = q % 72, corner = Math.floor(q / 72);
              q = cmv[corner][m] * 72 + emv[edge][(m + axis) % 3];
              if (dist[q] === undefined) dist[q] = depth + 1;
            }
          }
        }
      }
      prun[axis] = dist;
    }
  }
  function getPrun(c, e1, e2, e3) {
    const p0 = prun[0][c * 72 + e1], p1 = prun[1][c * 72 + e2], p2 = prun[2][c * 72 + e3];
    if (p0 === undefined || p1 === undefined || p2 === undefined) return 999;
    return Math.max(p0, p1, p2);
  }
  const MOVE_LABELS = ["'","2'","3'","4'","5'","6","5","4","3","2",""];
  function search(c, e1, e2, e3, maxDepth, lastMove, solution) {
    if (maxDepth === 0) return c === 0 && e1 === 0 && e2 === 0 && e3 === 0;
    if (getPrun(c, e1, e2, e3) > maxDepth) return false;
    for (let m = 0; m < 3; m++) {
      if (m === lastMove) continue;
      let cx = c, e1x = e1, e2x = e2, e3x = e3;
      for (let rep = 0; rep < 11; rep++) {
        cx = cmv[cx][m]; e1x = emv[e1x][m];
        e2x = emv[e2x][(m + 1) % 3]; e3x = emv[e3x][(m + 2) % 3];
        if (search(cx, e1x, e2x, e3x, maxDepth - 1, m, solution)) {
          solution.push("URF"[m] + MOVE_LABELS[rep]);
          return true;
        }
      }
    }
    return false;
  }
  function getRandomState() {
    const state = [Math.floor(Math.random() * 24)];
    for (let axis = 0; axis < 3; axis++) {
      let edge, attempts = 0;
      do { edge = Math.floor(Math.random() * 72); attempts++; }
      while (prun[axis][state[0] * 72 + edge] === undefined && attempts < 500);
      state.push(edge);
    }
    return state;
  }
  function generateScramble(minLength = 0) {
    init();
    const state = getRandomState();
    const sol = [];
    let depth = minLength;
    while (true) {
      if (search(state[0], state[1], state[2], state[3], depth, -1, sol)) break;
      depth++;
      if (depth > 20) break;
    }
    return sol.reverse().join(' ');
  }
  return { generateScramble };
})();

function genScramble(puzzle) {
  switch (puzzle) {
    case '2×2':     return gen2x2();
    case '4×4':     return gen4x4();
    case '5×5':     return gen5x5();
    case '6×6':     return gen6x6();
    case '7×7':     return gen7x7();
    case 'Pyraminx':return genPyraminx();
    case 'Megaminx':return genMegaminx();
    case 'Skewb':   return genSkewb();
    case 'Square-1':return genSquare1();
    case 'Clock':   return genClock();
    case '3BLD':    return gen3x3BLD();
    case 'Gear Cube': return GearCube.generateScramble();
    case 'FTO':      return genFTO();
    default:        return gen3x3(); // 3×3, 3OH
  }
}

function pushScramble() {
  const s = genScramble(state.puzzle);
  state.scrHistory.push(s);
  state.scrIdx = state.scrHistory.length - 1;
  return s;
}

// ─── CUBE NET ──────────────────────────────────────────────────────────────────
// Face indices: U=0, R=1, F=2, D=3, L=4, B=5
// Sticker colors per face index
const CLRS = ['#f0f0f0','#e00000','#22c55e','#f5d714','#ff6a00','#3b82f6'];
//              U=white   R=red    F=green   D=yellow  L=orange  B=blue

// Each face has 9 stickers indexed 0-8 (row-major, top-left to bottom-right when face faces you):
// 0 1 2
// 3 4 5
// 6 7 8

// Cycle 4 sticker positions: a←b←c←d (for CW move, sticker at d goes to c, c→b, b→a, a→d)
function cyc4(st, a, b, c, d) {
  const t = st[a]; st[a] = st[d]; st[d] = st[c]; st[c] = st[b]; st[b] = t;
}

// Rotate face CW (its own 9 stickers)
function rotateFaceCW(st, f) {
  const b = f * 9;
  // corners
  cyc4(st, b+0, b+2, b+8, b+6);
  // edges
  cyc4(st, b+1, b+5, b+7, b+3);
}

// All moves defined as: face to rotate + 3 edge cycles (each cycle = 4 sticker indices into the full 54-array)
// Face*9 + sticker offset
const U=0,R=1,F=2,D=3,L=4,B=5;
const MOVES = {
  U: () => (st) => {
    rotateFaceCW(st, U);
    cyc4(st, B*9+0, R*9+0, F*9+0, L*9+0);
    cyc4(st, B*9+1, R*9+1, F*9+1, L*9+1);
    cyc4(st, B*9+2, R*9+2, F*9+2, L*9+2);
  },
  D: () => (st) => {
    rotateFaceCW(st, D);
    cyc4(st, F*9+6, R*9+6, B*9+6, L*9+6);
    cyc4(st, F*9+7, R*9+7, B*9+7, L*9+7);
    cyc4(st, F*9+8, R*9+8, B*9+8, L*9+8);
  },
  R: () => (st) => {
    rotateFaceCW(st, R);
    cyc4(st, U*9+2, B*9+6, D*9+2, F*9+2);
    cyc4(st, U*9+5, B*9+3, D*9+5, F*9+5);
    cyc4(st, U*9+8, B*9+0, D*9+8, F*9+8);
  },
  L: () => (st) => {
    rotateFaceCW(st, L);
    cyc4(st, U*9+0, F*9+0, D*9+0, B*9+8);
    cyc4(st, U*9+3, F*9+3, D*9+3, B*9+5);
    cyc4(st, U*9+6, F*9+6, D*9+6, B*9+2);
  },
  F: () => (st) => {
    rotateFaceCW(st, F);
    cyc4(st, U*9+6, R*9+0, D*9+2, L*9+8);
    cyc4(st, U*9+7, R*9+3, D*9+1, L*9+5);
    cyc4(st, U*9+8, R*9+6, D*9+0, L*9+2);
  },
  B: () => (st) => {
    rotateFaceCW(st, B);
    cyc4(st, U*9+2, L*9+0, D*9+6, R*9+8);
    cyc4(st, U*9+1, L*9+3, D*9+7, R*9+5);
    cyc4(st, U*9+0, L*9+6, D*9+8, R*9+2);
  },
  // Wide moves: face + adjacent middle slice (same direction)
  Rw: () => (st) => {
    MOVES.R()(st);
    cyc4(st, U*9+1, B*9+7, D*9+1, F*9+1);
    cyc4(st, U*9+4, B*9+4, D*9+4, F*9+4);
    cyc4(st, U*9+7, B*9+1, D*9+7, F*9+7);
  },
  Uw: () => (st) => {
    MOVES.U()(st);
    cyc4(st, B*9+3, R*9+3, F*9+3, L*9+3);
    cyc4(st, B*9+4, R*9+4, F*9+4, L*9+4);
    cyc4(st, B*9+5, R*9+5, F*9+5, L*9+5);
  },
  Fw: () => (st) => {
    MOVES.F()(st);
    cyc4(st, U*9+3, R*9+1, D*9+5, L*9+7);
    cyc4(st, U*9+4, R*9+4, D*9+4, L*9+4);
    cyc4(st, U*9+5, R*9+7, D*9+3, L*9+1);
  },
};

function applyMove(st, moveName) {
  let base, mod;
  if (moveName.endsWith("'"))      { base = moveName.slice(0,-1); mod = "'"; }
  else if (moveName.endsWith('2')) { base = moveName.slice(0,-1); mod = '2'; }
  else                             { base = moveName; mod = ''; }
  if (!MOVES[base]) return; // skip x/y/z rotations and unknown tokens
  const fn = MOVES[base]();
  if (mod === '2') { fn(st); fn(st); }
  else if (mod === "'") { fn(st); fn(st); fn(st); }
  else { fn(st); }
}

function cubeState(scr) {
  const st = Array.from({length:54}, (_,i) => (i/9)|0);
  if (!scr) return st;
  for (const tok of scr.trim().split(/\s+/)) applyMove(st, tok);
  return st;
}

function drawCubeNet(svgEl, scr, scale=1) {
  const S=Math.round(16*scale), G=1, STEP=S+G;
  const FG=Math.round(4*scale); // gap between faces
  // faceColIdx and faceRowIdx determine which face column/row (0-based)
  // pixel origin of each face: faceColIdx*(3*STEP+FG), faceRowIdx*(3*STEP+FG)
  const faces=[
    {fi:1, fj:0, face:U},  // U:  col=1, row=0
    {fi:0, fj:1, face:L},  // L:  col=0, row=1
    {fi:1, fj:1, face:F},  // F:  col=1, row=1
    {fi:2, fj:1, face:R},  // R:  col=2, row=1
    {fi:3, fj:1, face:B},  // B:  col=3, row=1
    {fi:1, fj:2, face:D},  // D:  col=1, row=2
  ];
  const faceSize = 3*STEP + FG;
  const vw = 4*3*STEP + 3*FG;
  const vh = 3*3*STEP + 2*FG;
  svgEl.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  const st = cubeState(scr);
  let s='';
  for(const {fi,fj,face} of faces){
    const base = face*9;
    const ox = fi*(3*STEP+FG), oy = fj*(3*STEP+FG);
    for(let r=0;r<3;r++) for(let c=0;c<3;c++){
      const x=ox+c*STEP, y=oy+r*STEP;
      s+=`<rect x="${x}" y="${y}" width="${S}" height="${S}" rx="2" fill="${CLRS[st[base+r*3+c]]}" stroke="#0004" stroke-width=".5"/>`;
    }
  }
  svgEl.innerHTML = s;
}

// ─── PUZZLE IMAGES (all events) ──────────────────────────────────────────────

function scrambleRNG(scr) {
  let h = 5381;
  for (const c of scr) h = (Math.imul(h,31) + c.charCodeAt(0)) | 0;
  return () => { h = Math.imul(h,1664525)+1013904223|0; return (h>>>0)/4294967296; };
}

function seededState(nFaces, perFace, scr) {
  const rng = scrambleRNG(scr);
  const st = Array.from({length:nFaces*perFace}, (_,i) => Math.floor(i/perFace));
  for (let i=st.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [st[i],st[j]]=[st[j],st[i]]; }
  return st;
}

// NxN cube cross net (seeded random colors, except 3×3 which uses the real simulator)
function drawCubeNetN(svgEl, n, scr, scale=1) {
  const S=Math.max(5,Math.round((n<=2?22:n<=4?14:n<=5?11:9)*scale));
  const G=1, STEP=S+G, FG=Math.max(2,Math.round(3*scale));
  const st = n===3 ? cubeState(scr) : seededState(6, n*n, scr);
  const layout=[{fi:1,fj:0,f:0},{fi:0,fj:1,f:4},{fi:1,fj:1,f:2},{fi:2,fj:1,f:1},{fi:3,fj:1,f:5},{fi:1,fj:2,f:3}];
  let s='';
  for (const {fi,fj,f} of layout) {
    const ox=fi*(n*STEP+FG), oy=fj*(n*STEP+FG), base=f*n*n;
    for (let r=0;r<n;r++) for (let c=0;c<n;c++)
      s+=`<rect x="${ox+c*STEP}" y="${oy+r*STEP}" width="${S}" height="${S}" rx="1" fill="${CLRS[st[base+r*n+c]]}" stroke="#0004" stroke-width=".5"/>`;
  }
  svgEl.setAttribute('viewBox',`0 0 ${4*n*STEP+3*FG} ${3*n*STEP+2*FG}`);
  svgEl.innerHTML = s;
}

// Pyraminx: proper tetrahedron net — one large equilateral triangle, 4 face regions × 9 stickers
// Pyraminx: star/cross net — central U face + 3 ear faces attached to each edge
function drawPyraminxNet(svgEl, scr, scale=1) {
  const L=Math.round(80*scale), SQ3=Math.sqrt(3), H=L*SQ3/2;
  // Central U face: V0(top), V1(bottom-left), V2(bottom-right)
  // Ear outer vertices: V3(left), V4(bottom), V5(right)
  const V0=[L,     0  ], V1=[L/2,   H  ], V2=[3*L/2, H  ];
  const V3=[0,     0  ], V4=[L,     H*2 ], V5=[2*L,   0  ];
  // Shrink each face toward its centroid to create a gap between faces
  const shrink=(f,k=0.88)=>{
    const cx=(f[0][0]+f[1][0]+f[2][0])/3, cy=(f[0][1]+f[1][1]+f[2][1])/3;
    return f.map(([x,y])=>[cx+(x-cx)*k, cy+(y-cy)*k]);
  };
  // Each face: [apex, base-left, base-right] for barycentric parameterization
  const faces=[
    shrink([V0, V1, V2]),  // U (central, apex at top)
    shrink([V3, V0, V1]),  // L (left ear, apex points left)
    shrink([V4, V1, V2]),  // B (bottom ear, apex points down)
    shrink([V5, V2, V0]),  // R (right ear, apex points right)
  ];
  // 9 sticker positions per face in barycentric coords (s toward base-left, t toward base-right)
  const SP=[
    [[0,0],[1/3,0],[0,1/3]],
    [[1/3,0],[2/3,0],[1/3,1/3]],
    [[1/3,0],[0,1/3],[1/3,1/3]],
    [[0,1/3],[1/3,1/3],[0,2/3]],
    [[2/3,0],[1,0],[2/3,1/3]],
    [[2/3,0],[1/3,1/3],[2/3,1/3]],
    [[1/3,1/3],[2/3,1/3],[1/3,2/3]],
    [[0,2/3],[1/3,1/3],[1/3,2/3]],
    [[0,2/3],[1/3,2/3],[0,1]],
  ];
  const lerp=(s,t,[vA,vBL,vBR])=>{
    const w=1-s-t;
    return [(w*vA[0]+s*vBL[0]+t*vBR[0]).toFixed(1),(w*vA[1]+s*vBL[1]+t*vBR[1]).toFixed(1)];
  };
  const PCLRS=['#f5d714','#22c55e','#e00000','#3b82f6'];
  const st=seededState(4,9,scr);
  let svg='';
  for(let f=0;f<4;f++){
    for(let i=0;i<9;i++){
      const v=SP[i].map(([s,t])=>lerp(s,t,faces[f]).join(','));
      svg+=`<polygon points="${v.join(' ')}" fill="${PCLRS[st[f*9+i]]}" stroke="#0003" stroke-width=".5"/>`;
    }
  }
  svgEl.setAttribute('viewBox',`0 0 ${2*L} ${Math.ceil(L*SQ3)}`);
  svgEl.innerHTML=svg;
}

// Megaminx: two pentagon "flowers" — each face has 11 stickers: 1 center + 5 edges + 5 corners
function drawMegaminxNet(svgEl, scr, scale=1) {
  const R=Math.round(17*scale);
  const d=R*2*Math.cos(Math.PI/5);
  const GAP=Math.round(6*scale);
  const MCLRS=['#f0f0f0','#f5d714','#e00000','#3b82f6','#22c55e','#ff6a00',
               '#ec4899','#7c3aed','#06b6d4','#84cc16','#a8a29e','#475569'];
  const st=seededState(12,11,scr);
  const rot0=-Math.PI/2, T=2*Math.PI/5;
  const fi=0.38; // center pentagon radius fraction
  const ep=0.25; // corner cut fraction along each outer edge
  const pt=([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`;

  const drawFace=(cx,cy,r,rot,faceIdx)=>{
    const base=faceIdx*11;
    const V=Array.from({length:5},(_,k)=>[cx+r*Math.cos(rot+k*T), cy+r*Math.sin(rot+k*T)]);
    const C=Array.from({length:5},(_,k)=>[cx+r*fi*Math.cos(rot+k*T), cy+r*fi*Math.sin(rot+k*T)]);
    // S[k]: ep-fraction along edge k from V[k]; E[k]: ep-fraction from V[(k+1)%5]
    const S=Array.from({length:5},(_,k)=>[
      V[k][0]+ep*(V[(k+1)%5][0]-V[k][0]), V[k][1]+ep*(V[(k+1)%5][1]-V[k][1])
    ]);
    const E=Array.from({length:5},(_,k)=>[
      V[(k+1)%5][0]+ep*(V[k][0]-V[(k+1)%5][0]), V[(k+1)%5][1]+ep*(V[k][1]-V[(k+1)%5][1])
    ]);
    let s='';
    // Center pentagon (sticker 0)
    s+=`<polygon points="${C.map(pt).join(' ')}" fill="${MCLRS[st[base]]}" stroke="#0004" stroke-width=".4"/>`;
    // 5 edge pieces (stickers 1-5): trapezoid S[k]→E[k]→C[k+1]→C[k]
    for(let k=0;k<5;k++){
      s+=`<polygon points="${pt(S[k])} ${pt(E[k])} ${pt(C[(k+1)%5])} ${pt(C[k])}" fill="${MCLRS[st[base+1+k]]}" stroke="#0004" stroke-width=".4"/>`;
    }
    // 5 corner pieces (stickers 6-10): kite C[k]→S[k]→V[k]→E[k-1], sharing sides with edge pieces
    for(let k=0;k<5;k++){
      s+=`<polygon points="${pt(C[k])} ${pt(S[k])} ${pt(V[k])} ${pt(E[(k-1+5)%5])}" fill="${MCLRS[st[base+6+k]]}" stroke="#0004" stroke-width=".4"/>`;
    }
    return s;
  };

  const groupW=d*2+R*2;
  let svg='';
  for(let g=0;g<2;g++){
    const gx=g*(groupW+GAP)+R+d, gy=R+d;
    svg+=drawFace(gx,gy,R,rot0,g*6);
    for(let i=0;i<5;i++){
      const ea=rot0+i*T+Math.PI/5;
      svg+=drawFace(gx+d*Math.cos(ea),gy+d*Math.sin(ea),R,ea+Math.PI,g*6+i+1);
    }
  }
  const vw=Math.ceil(2*(groupW+GAP)-GAP), vh=Math.ceil(2*(R+d));
  svgEl.setAttribute('viewBox',`0 0 ${vw} ${vh}`);
  svgEl.innerHTML=svg;
}

// Skewb: cross-net with each face subdivided into center octagon + 4 corner triangles (5 stickers)
function drawSkewbNet(svgEl, scr, scale=1) {
  const S=Math.max(5,Math.round(16*scale));
  const G=1, STEP=S+G, FG=Math.max(2,Math.round(3*scale));
  const FS=3*STEP;
  const SCLRS=['#f0f0f0','#e00000','#22c55e','#f5d714','#ff6a00','#3b82f6'];
  const st=seededState(6,5,scr);
  const layout=[{fi:1,fj:0,f:0},{fi:0,fj:1,f:4},{fi:1,fj:1,f:2},{fi:2,fj:1,f:1},{fi:3,fj:1,f:5},{fi:1,fj:2,f:3}];
  const c=0.45;
  let svg='';
  for(const {fi,fj,f} of layout){
    const ox=fi*(FS+FG), oy=fj*(FS+FG);
    const base=f*5;
    const clr=i=>SCLRS[st[base+i]%6];
    const px=(x,y)=>`${(ox+x*FS).toFixed(1)},${(oy+y*FS).toFixed(1)}`;
    svg+=`<polygon points="${px(c,0)} ${px(1-c,0)} ${px(1,c)} ${px(1,1-c)} ${px(1-c,1)} ${px(c,1)} ${px(0,1-c)} ${px(0,c)}" fill="${clr(0)}" stroke="#0004" stroke-width=".5"/>`;
    svg+=`<polygon points="${px(0,0)} ${px(c,0)} ${px(0,c)}" fill="${clr(1)}" stroke="#0004" stroke-width=".5"/>`;
    svg+=`<polygon points="${px(1,0)} ${px(1,c)} ${px(1-c,0)}" fill="${clr(2)}" stroke="#0004" stroke-width=".5"/>`;
    svg+=`<polygon points="${px(1,1)} ${px(1-c,1)} ${px(1,1-c)}" fill="${clr(3)}" stroke="#0004" stroke-width=".5"/>`;
    svg+=`<polygon points="${px(0,1)} ${px(0,1-c)} ${px(c,1)}" fill="${clr(4)}" stroke="#0004" stroke-width=".5"/>`;
  }
  svgEl.setAttribute('viewBox',`0 0 ${4*FS+3*FG} ${3*FS+2*FG}`);
  svgEl.innerHTML=svg;
}

// Square-1: simulate scramble to get real layer shapes (shape-shifting puzzle)
function drawSquare1Net(svgEl, scr, scale=1) {
  const R=Math.round(28*scale), G=Math.round(8*scale);
  const SQ1C=['#f0f0f0','#f5d714','#e00000','#ff6a00','#22c55e','#3b82f6'];
  const rng=scrambleRNG(scr);

  // Layer = array of piece sizes in notches: 2=corner(60°), 1=edge(30°), sum=12
  let top=[2,1,2,1,2,1,2,1], bot=[2,1,2,1,2,1,2,1];

  // Rotate layer clockwise by t notches (negative = CCW); splits pieces at cut if needed
  const rotate=(pieces,t)=>{
    t=((t%12)+12)%12;
    if(!t) return [...pieces];
    const arr=[...pieces];
    let sum=0, i=0;
    while(sum<t){
      if(sum+arr[i]>t){ const r=t-sum; arr.splice(i,1,r,arr[i]-r); i++; break; }
      sum+=arr[i++];
    }
    return [...arr.slice(i),...arr.slice(0,i)];
  };

  // Split layer at 6 notches (the slice cut)
  const halve=(pieces)=>{
    const arr=[...pieces];
    let sum=0, i=0;
    while(sum<6){
      if(sum+arr[i]>6){ const r=6-sum; arr.splice(i,1,r,arr[i]-r); i++; break; }
      sum+=arr[i++];
    }
    return [arr.slice(0,i), arr.slice(i)];
  };

  // Parse and apply each (t,b)/ move
  const re=/\((-?\d+),(-?\d+)\)/g;
  let m;
  while((m=re.exec(scr))!==null){
    top=rotate(top,+m[1]); bot=rotate(bot,+m[2]);
    const [tR,tL]=halve(top), [bR,bL]=halve(bot);
    top=[...bR,...tL]; bot=[...tR,...bL];
  }

  // Draw a layer as a flat polygon (straight edges, not arcs) to show actual shape
  let svg='';
  const drawLayer=(cx,cy,pieces)=>{
    let a=-Math.PI/2;
    const pts=pieces.map(sz=>{
      const p=[cx+R*Math.cos(a), cy+R*Math.sin(a)];
      a+=sz*Math.PI/6;
      return p;
    });
    pieces.forEach((sz,i)=>{
      const p1=pts[i], p2=pts[(i+1)%pts.length];
      const col=SQ1C[Math.floor(rng()*6)];
      svg+=`<polygon points="${cx.toFixed(1)},${cy.toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="${col}" stroke="#0004" stroke-width=".5"/>`;
    });
  };

  drawLayer(R, R, top);
  drawLayer(3*R+G, R, bot);
  svgEl.setAttribute('viewBox',`0 0 ${4*R+G} ${2*R}`);
  svgEl.innerHTML=svg;
}

// Clock: two circles (front/back) each with a 3×3 grid of mini clock hands
function drawClockNet(svgEl, scr, scale=1) {
  const R=Math.round(30*scale), G=Math.round(8*scale), rs=Math.round(R*0.22);
  const rng=scrambleRNG(scr);
  let svg='';
  for (let side=0;side<2;side++) {
    const cx=side*(R*2+G)+R, cy=R;
    svg+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#1a1050" stroke="#0004" stroke-width=".5"/>`;
    for (let row=0;row<3;row++) for (let col=0;col<3;col++) {
      const hx=cx+(col-1)*R*0.62, hy=cy+(row-1)*R*0.62;
      const ha=rng()*2*Math.PI;
      const hx2=hx+rs*0.75*Math.cos(ha-Math.PI/2), hy2=hy+rs*0.75*Math.sin(ha-Math.PI/2);
      svg+=`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${rs}" fill="none" stroke="#ffffff30" stroke-width="1"/>`;
      svg+=`<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${hx2.toFixed(1)}" y2="${hy2.toFixed(1)}" stroke="#fff" stroke-width="${Math.max(1,Math.round(1.5*scale))}"/>`;
    }
  }
  svgEl.setAttribute('viewBox',`0 0 ${2*R*2+G} ${R*2}`);
  svgEl.innerHTML = svg;
}

// FTO net: two square views, each divided by X into 4 face triangles,
// each face triangle subdivided into 4 sticker triangles via midpoints (32 stickers total)
// Left view:  U(top) R(right) F(bottom) L(left)
// Right view: B(top) BR(right) D(bottom) BL(left)
function drawFTONet(svgEl, scr, scale=1) {
  const S = Math.round(56 * scale);
  const G = Math.round(6 * scale);
  // U=white R=red F=green L=orange B=blue BL=purple D=yellow BR=cyan
  const FCLRS = ['#f0f0f0','#e00000','#22c55e','#ff6a00','#3b82f6','#7c3aed','#f5d714','#06b6d4'];
  // 8 faces × 9 stickers = 72; each color appears exactly 9 times in shuffled state
  const st = seededState(8, 9, scr);
  let svg = '';
  const tri = (pts, si) => {
    const p = pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    svg += `<polygon points="${p}" fill="${FCLRS[st[si]]}" stroke="#0005" stroke-width="0.5"/>`;
  };
  // Split triangle [A,B,C] into 9 by dividing each edge into thirds
  // pt(i,j) = A*(1-(i+j)/3) + B*(i/3) + C*(j/3)
  const sub9 = ([A, B, C]) => {
    const pt = (i, j) => [
      A[0]*(1-(i+j)/3) + B[0]*(i/3) + C[0]*(j/3),
      A[1]*(1-(i+j)/3) + B[1]*(i/3) + C[1]*(j/3),
    ];
    return [
      [pt(0,0), pt(1,0), pt(0,1)],   // same-orientation (6)
      [pt(1,0), pt(2,0), pt(1,1)],
      [pt(2,0), pt(3,0), pt(2,1)],
      [pt(0,1), pt(1,1), pt(0,2)],
      [pt(1,1), pt(2,1), pt(1,2)],
      [pt(0,2), pt(1,2), pt(0,3)],
      [pt(1,0), pt(0,1), pt(1,1)],   // inverted (3)
      [pt(2,0), pt(1,1), pt(2,1)],
      [pt(1,1), pt(0,2), pt(1,2)],
    ];
  };
  const drawHalf = (ox, faceOrder) => {
    const cx = ox + S/2, cy = S/2;
    const faces = [
      [[ox,0],[ox+S,0],[cx,cy]],    // top face
      [[ox+S,0],[ox+S,S],[cx,cy]],  // right face
      [[ox+S,S],[ox,S],[cx,cy]],    // bottom face
      [[ox,S],[ox,0],[cx,cy]],      // left face
    ];
    faces.forEach((face, fi) => {
      sub9(face).forEach((subTri, si) => tri(subTri, faceOrder[fi] * 9 + si));
    });
  };
  drawHalf(0,     [0, 1, 2, 3]);  // U R F L
  drawHalf(S + G, [4, 7, 6, 5]);  // B BR D BL
  svgEl.setAttribute('viewBox', `0 0 ${2*S+G} ${S}`);
  svgEl.innerHTML = svg;
}

// Master dispatcher: draw the correct image for any puzzle
function drawPuzzleImage(svgEl, puzzle, scr, scale=1) {
  switch(puzzle) {
    case '2×2':     drawCubeNetN(svgEl,2,scr,scale); break;
    case '4×4':     drawCubeNetN(svgEl,4,scr,scale); break;
    case '5×5':     drawCubeNetN(svgEl,5,scr,scale); break;
    case '6×6':     drawCubeNetN(svgEl,6,scr,scale); break;
    case '7×7':     drawCubeNetN(svgEl,7,scr,scale); break;
    case 'FTO':     drawFTONet(svgEl,scr,scale); break;
    case 'Pyraminx':drawPyraminxNet(svgEl,scr,scale); break;
    case 'Megaminx':drawMegaminxNet(svgEl,scr,scale); break;
    case 'Skewb':   drawSkewbNet(svgEl,scr,scale); break;
    case 'Square-1':drawSquare1Net(svgEl,scr,scale); break;
    case 'Clock':   drawClockNet(svgEl,scr,scale); break;
    case 'Gear Cube': drawCubeNet(svgEl,scr,scale); break;
    default:        drawCubeNet(svgEl,scr,scale); // 3×3, 3OH, 3BLD
  }
}

// ─── OLL SVG (top view) ────────────────────────────────────────────────────────
const OLL_Y = '#f5d714', OLL_N = '#3a2470', OLL_S = '#e8e8e8';
// WCA side colors: B(back)=blue, F(front)=green, L=orange, R=red
const PLL_SIDES = ['#0046ad','#009b48','#ff5800','#b71234']; // B, F, L, R
// PLL per-sticker color map: letter codes used in item.sides arrays
const PLL_C = {'R':'#b71234','O':'#ff5800','B':'#0046ad','G':'#009b48','F':'#009b48','L':'#ff5800','W':'#ffffff','N':'#b4b4b4'};
// T = side strip thickness; S = top face cell size
// Side strip index mapping (top face):
//   BL=0  B=1  BR=2
//   L=3   C=4  R=5
//   FL=6  F=7  FR=8
// Back strip (top of diagram, L→R): 0,1,2 (BL,B,BR)
// Front strip (bottom, L→R):        6,7,8 (FL,F,FR)
// Left strip (top→bottom):          0,3,6 (BL,L,FL)
// Right strip (top→bottom):         2,5,8 (BR,R,FR)
function buildCubeSvg(topArr, S, G, PAD, sidesArr) {
  const T = Math.max(2, Math.round(S * 0.35));
  const FACE = 3*S + 2*G;
  const W = T + PAD + FACE + PAD + T, H = W;
  const ox = T + PAD, oy = T + PAD;
  const rx = Math.max(1, Math.round(S/6));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (let r=0;r<3;r++) for (let c=0;c<3;c++) {
    const filled = topArr ? topArr[r*3+c] : 1;
    s += `<rect x="${ox+c*(S+G)}" y="${oy+r*(S+G)}" width="${S}" height="${S}" rx="${rx}" fill="${filled?OLL_Y:OLL_N}"/>`;
  }
  if (sidesArr) {
    const isOll = typeof sidesArr[0][0] === 'number';
    const gc = (fi, i) => isOll ? (sidesArr[fi][i] ? OLL_Y : OLL_N) : (PLL_C[sidesArr[fi][i]] || PLL_SIDES[fi]);
    [0,1,2].forEach((_,c) => { s += `<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${gc(0,c)}"/>`; });
    [0,1,2].forEach((_,r) => { s += `<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(1,r)}"/>`; });
    [0,1,2].forEach((_,c) => { s += `<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${gc(2,c)}"/>`; });
    [0,1,2].forEach((_,r) => { s += `<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(3,r)}"/>`; });
  } else {
    const sc = i => topArr ? (topArr[i] ? OLL_N : OLL_Y) : null;
    [0,1,2].forEach((ti,c) => { s += `<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${sc(ti)||PLL_SIDES[0]}"/>`; });
    [6,7,8].forEach((ti,c) => { s += `<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${sc(ti)||PLL_SIDES[1]}"/>`; });
    [0,3,6].forEach((ti,r) => { s += `<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${sc(ti)||PLL_SIDES[2]}"/>`; });
    [2,5,8].forEach((ti,r) => { s += `<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${sc(ti)||PLL_SIDES[3]}"/>`; });
  }
  s += '</svg>';
  return s;
}
function drawOLLSvg(svgEl, topArr, sidesArr) {
  const S=20, G=2, PAD=4, T=Math.round(S*0.35);
  const FACE=3*S+2*G, W=T+PAD+FACE+PAD+T, H=W;
  const ox=T+PAD, oy=T+PAD;
  let s='';
  for(let r=0;r<3;r++) for(let c=0;c<3;c++)
    s+=`<rect x="${ox+c*(S+G)}" y="${oy+r*(S+G)}" width="${S}" height="${S}" rx="3" fill="${topArr[r*3+c]?OLL_Y:OLL_N}"/>`;
  if (sidesArr) {
    const gc = (fi, i) => sidesArr[fi][i] ? OLL_Y : OLL_N;
    [0,1,2].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${gc(0,c)}"/>`; });
    [0,1,2].forEach((_,r)=>{ s+=`<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(1,r)}"/>`; });
    [0,1,2].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${gc(2,c)}"/>`; });
    [0,1,2].forEach((_,r)=>{ s+=`<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(3,r)}"/>`; });
  } else {
    const sc = i => topArr[i] ? OLL_N : OLL_Y;
    [0,1,2].forEach((ti,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${sc(ti)}"/>`; });
    [6,7,8].forEach((ti,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${sc(ti)}"/>`; });
    [0,3,6].forEach((ti,r)=>{ s+=`<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${sc(ti)}"/>`; });
    [2,5,8].forEach((ti,r)=>{ s+=`<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${sc(ti)}"/>`; });
  }
  svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svgEl.innerHTML = s;
}
function drawPLLSvg(svgEl, sidesArr) {
  const S=20, G=2, PAD=4, T=Math.round(S*0.35);
  const FACE=3*S+2*G, W=T+PAD+FACE+PAD+T, H=W;
  const ox=T+PAD, oy=T+PAD;
  let s='';
  for(let r=0;r<3;r++) for(let c=0;c<3;c++)
    s+=`<rect x="${ox+c*(S+G)}" y="${oy+r*(S+G)}" width="${S}" height="${S}" rx="3" fill="${OLL_Y}"/>`;
  if (sidesArr) {
    const gc = (fi, i) => PLL_C[sidesArr[fi][i]] || PLL_SIDES[fi];
    [0,1,2].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${gc(0,c)}"/>`; });
    [0,1,2].forEach((_,r)=>{ s+=`<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(1,r)}"/>`; });
    [0,1,2].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${gc(2,c)}"/>`; });
    [0,1,2].forEach((_,r)=>{ s+=`<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${gc(3,r)}"/>`; });
  } else {
    [0,1,2].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="0" width="${S}" height="${T}" rx="1" fill="${PLL_SIDES[0]}"/>`; });
    [6,7,8].forEach((_,c)=>{ s+=`<rect x="${ox+c*(S+G)}" y="${H-T}" width="${S}" height="${T}" rx="1" fill="${PLL_SIDES[1]}"/>`; });
    [0,3,6].forEach((_,r)=>{ s+=`<rect x="0" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${PLL_SIDES[2]}"/>`; });
    [2,5,8].forEach((_,r)=>{ s+=`<rect x="${W-T}" y="${oy+r*(S+G)}" width="${T}" height="${S}" rx="1" fill="${PLL_SIDES[3]}"/>`; });
  }
  svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svgEl.innerHTML = s;
}

// ─── GRAPHS ───────────────────────────────────────────────────────────────────
function niceStep(rangeS) {
  for(const s of [1,2,5,10,15,20,30,60]) if(rangeS/s<=6) return s;
  return Math.ceil(rangeS/5);
}

function drawGraph(svgId, datasets) {
  const svg=document.getElementById(svgId);
  if(!svg) return;
  const W=420,H=210,pad={t:16,r:12,b:28,l:52};
  const gw=W-pad.l-pad.r, gh=H-pad.t-pad.b;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const allVals=datasets.flatMap(d=>d.points.filter(v=>v!==null));
  if(!allVals.length){svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,.25)" font-size="11">No data</text>`;return;}
  // Nice Y axis in whole seconds
  const minS=Math.floor(Math.min(...allVals)/1000), maxS=Math.ceil(Math.max(...allVals)/1000);
  const step=niceStep(maxS-minS||1);
  const yStart=Math.floor(minS/step)*step, yEnd=Math.ceil(maxS/step)*step;
  const yMinMs=yStart*1000, yMaxMs=yEnd*1000, yRange=yMaxMs-yMinMs||1000;
  const xS=(i,n)=>pad.l+(n<=1?gw/2:(i/(n-1))*gw);
  const yS=v=>pad.t+gh-((v-yMinMs)/yRange)*gh;
  const colors=['#8c20e0','#22c55e','#f59e0b'];
  let html='';
  // Grid + Y labels
  for(let v=yStart;v<=yEnd;v+=step){
    const y=yS(v*1000);
    html+=`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`;
    html+=`<text x="${pad.l-5}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,.45)" font-size="11">${v}s</text>`;
  }
  // Average dashed line + label at tip
  const avg=allVals.reduce((a,b)=>a+b,0)/allVals.length;
  const avgY=yS(avg);
  html+=`<line x1="${pad.l}" y1="${avgY.toFixed(1)}" x2="${W-pad.r}" y2="${avgY.toFixed(1)}" stroke="rgba(255,255,255,.3)" stroke-width="1" stroke-dasharray="4,3"/>`;
  // Data lines
  datasets.forEach((d,di)=>{
    const pts=d.points,n=pts.length,color=colors[di]||'#fff';
    let path='',areaPath='',lastX=null,lastY=null;
    pts.forEach((v,i)=>{
      if(v===null) return;
      const x=xS(i,n).toFixed(1),y=yS(v).toFixed(1);
      if(!path){path=`M${x},${y}`;areaPath=`M${x},${pad.t+gh}L${x},${y}`;}
      else{path+=`L${x},${y}`;areaPath+=`L${x},${y}`;}
      lastX=x;lastY=y;
    });
    if(path){
      if(lastX) areaPath+=`L${lastX},${pad.t+gh}Z`;
      html+=`<path d="${areaPath}" fill="${color}" opacity="0.08"/>`;
      html+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
      // Hover tooltips on all points
      pts.forEach((v,i)=>{
        if(v===null) return;
        const cx=xS(i,n), cy=yS(v);
        const lbl=`${(v/1000).toFixed(2)}s`;
        const tx=cx, ty=cy;
        const bx=Math.max(pad.l, Math.min(tx-18, W-pad.r-36));
        const by=Math.max(pad.t, ty-22);
        const textY=by+10;
        html+=`<g class="sg-tip" style="cursor:default">`;
        html+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="transparent"/>`;
        html+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${i===n-1?3.5:2}" fill="${color}"/>`;
        html+=`<g class="sg-tip-label">`;
        html+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="36" height="14" rx="4" fill="#231450"/>`;
        html+=`<text x="${tx.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">${lbl}</text>`;
        html+=`</g></g>`;
      });
    }
  });
  svg.innerHTML=html;
}

function renderStatsGraphs() {
  const el=document.getElementById('statsGraphs');
  if(!el||el.style.display==='none') return;
  const origTs=curSes().times;
  const ts=[...origTs].reverse();
  // Time Trend
  const timePoints=ts.map(t=>t.dnf?null:(t.plus2?t.ms+2000:t.ms));
  drawGraph('sgTimes',[{points:timePoints}]);
  // Time Distribution histogram
  const vals=origTs.filter(t=>!t.dnf).map(t=>t.plus2?t.ms+2000:t.ms);
  const svg=document.getElementById('sgDist');
  if(!svg) return;
  const W=420,H=210,pad={t:16,r:12,b:28,l:52};
  const gw=W-pad.l-pad.r,gh=H-pad.t-pad.b;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  if(vals.length<2){svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,.25)" font-size="11">Not enough data</text>`;return;}
  const minV=Math.min(...vals),maxV=Math.max(...vals);
  const BUCKETS=10, bSize=(maxV-minV)/BUCKETS||1000;
  const counts=Array(BUCKETS).fill(0);
  vals.forEach(v=>{counts[Math.min(Math.floor((v-minV)/bSize),BUCKETS-1)]++;});
  const maxCount=Math.max(...counts);
  // Nice Y count axis
  const cStep=niceStep(maxCount||1);
  const cEnd=Math.ceil(maxCount/cStep)*cStep;
  const bw=gw/BUCKETS;
  const yC=c=>pad.t+gh-(c/cEnd)*gh;
  let html='';
  for(let c=0;c<=cEnd;c+=cStep){
    const y=yC(c);
    html+=`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`;
    html+=`<text x="${pad.l-5}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,.45)" font-size="11">${c}</text>`;
  }
  // Average vertical line
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  const avgX=pad.l+((avg-minV)/(maxV-minV||1))*gw;
  html+=`<line x1="${avgX.toFixed(1)}" y1="${pad.t}" x2="${avgX.toFixed(1)}" y2="${pad.t+gh}" stroke="rgba(255,255,255,.3)" stroke-width="1" stroke-dasharray="4,3"/>`;
  // Bars + count at tip
  counts.forEach((c,i)=>{
    const bh=(c/cEnd)*gh;
    const x=(pad.l+i*bw+1).toFixed(1),y=(pad.t+gh-bh).toFixed(1),w=(bw-2).toFixed(1);
    const lbl=Math.round((minV+(i+0.5)*bSize)/1000);
    html+=`<rect x="${x}" y="${y}" width="${w}" height="${bh.toFixed(1)}" fill="#8c20e0" rx="2" opacity="0.85"/>`;
    if(c>0) html+=`<text x="${(pad.l+(i+0.5)*bw).toFixed(1)}" y="${(parseFloat(y)-4).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,.7)" font-size="10" font-weight="bold">${c}</text>`;
    if(bw>28) html+=`<text x="${(pad.l+(i+0.5)*bw).toFixed(1)}" y="${(H-pad.b+14).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="10">${lbl}s</text>`;
  });
  svg.innerHTML=html;
}

