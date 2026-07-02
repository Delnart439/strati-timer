// Minimal mathlib + shims required by scramble_444.js (cstimer 4x4 WCA solver)
var mathlib = (function() {
    var Cnk = [];
    for (var i = 0; i < 32; i++) {
        Cnk[i] = [];
        for (var j = 0; j < 32; j++) Cnk[i][j] = 0;
    }
    for (var i = 0; i < 32; i++) {
        Cnk[i][0] = Cnk[i][i] = 1;
        for (var j = 1; j < i; j++) Cnk[i][j] = Cnk[i-1][j-1] + Cnk[i-1][j];
    }

    function rn(n) { return Math.floor(Math.random() * n); }
    function rndEl(arr) { return arr[rn(arr.length)]; }

    function circle(arr) {
        var len = arguments.length - 1;
        var temp = arr[arguments[len]];
        for (var i = len; i > 1; i--) arr[arguments[i]] = arr[arguments[i-1]];
        arr[arguments[1]] = temp;
        return circle;
    }

    function acycle(arr, perm, pow) {
        if (pow === undefined) pow = 1;
        var plen = perm.length;
        var tmp = [];
        for (var i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
        for (var i = 0; i < plen; i++) arr[perm[(i + pow) % plen]] = tmp[i];
        return acycle;
    }

    function bitCount(x) {
        x = x - ((x >> 1) & 0x55555555);
        x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
    }

    function rndPerm(n, isEven) {
        var p = 0, arr = [];
        for (var i = 0; i < n; i++) arr[i] = i;
        for (var i = 0; i < n - 1; i++) {
            var k = rn(n - i);
            circle(arr, i, i + k);
            p ^= k != 0;
        }
        if (isEven && p) circle(arr, 0, 1);
        return arr;
    }

    function setNPerm(arr, idx, n) {
        arr[n - 1] = 0;
        for (var i = n - 2; i >= 0; i--) {
            arr[i] = idx % (n - i);
            idx = Math.floor(idx / (n - i));
            for (var j = i + 1; j < n; j++) {
                if (arr[j] >= arr[i]) arr[j]++;
            }
        }
    }

    function getNPerm(arr, n) {
        var i, j, s = 0;
        for (i = n - 2; i >= 0; i--) {
            s = (s + arr[i]) * (n - 1 - i);
            for (j = i + 1; j < n; j++) {
                if (arr[j] > arr[i]) s--;
            }
        }
        return s;
    }

    function idxArray(arr, idx) {
        return arr.map(function(e) { return e[idx]; });
    }

    function valuedArray(len, val) {
        var ret = [], isFun = typeof val === 'function';
        for (var i = 0; i < len; i++) ret[i] = isFun ? val(i) : val;
        return ret;
    }

    return {
        Cnk: Cnk, rn: rn, rndEl: rndEl,
        circle: circle, acycle: acycle,
        bitCount: bitCount,
        rndPerm: rndPerm,
        setNPerm: setNPerm, getNPerm: getNPerm,
        idxArray: idxArray, valuedArray: valuedArray
    };
})();

// Shims required by scramble_444.js
var DEBUG = false;
if (typeof $ === 'undefined') var $ = {};
$.now = $.now || function() { return Date.now(); };

// 3x3 reduction solver — delegates to min2phase (loaded before this)
var scramble_333 = {
    solvFacelet: function(f3) {
        if (typeof min2phase !== 'undefined') {
            try { return min2phase.solve(f3); } catch(e) {}
        }
        return '';
    }
};

// Minimal scrMgr — captures registered scramble functions
var scrMgr = (function() {
    var fns = {};
    function reg(name, fn) {
        fns[name] = fn;
        return reg;
    }
    return {
        reg: reg,
        get: function(name) { return fns[name]; },
        fixCase: function(cases) { return 0; }
    };
})();
