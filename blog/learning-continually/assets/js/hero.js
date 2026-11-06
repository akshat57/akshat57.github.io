/* Hero: an illustration, not data. Two evolution-strategies runs climb one toy 2-D reward surface.
   Every step each run scores N = 30 Gaussian perturbations of its own theta (Eq. 1), z-scores the scores (Eq. 2) and moves by
   the reward-weighted sum of directions (Eq. 3). The heterogeneous run's scores also carry data and sampling luck.
   The two runs start from different, hand-picked points: from a shared start the noisy run is reliably slower in this toy,
   so the starts are calibrated (by simulation) to equal arrival times on average, and each episode replays a random draw in
   which both reach the peak on the same step. The animation shows both data regimes reaching the optimum; it is not a race. */
(function () {
  "use strict";
  var canvas = document.getElementById("es-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var readout = document.getElementById("es-readout");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COLORS = [[47, 98, 155], [180, 49, 108]];  /* shared batch, heterogeneous */
  var N = 30, SIGMA = 0.06, ALPHA = 0.085, STEP_MS = 750, HOLD_MS = 1600, NEAR = 0.07, CAP = 22;
  var NOISE = Math.sqrt(0.03 * 0.03 + 0.02 * 0.02);  /* data luck and sampling luck, combined */
  /* start pairs [shared, heterogeneous] with equal median arrival (12 steps) in simulation */
  var PAIRS = [
    [{ x: 0.060, y: 0.120 }, { x: 0.361, y: 0.715 }],
    [{ x: 0.165, y: 0.839 }, { x: 0.333, y: 0.183 }],
    [{ x: 0.063, y: 0.545 }, { x: 0.443, y: 0.913 }]
  ];

  /* reward surface on x in [0, A], y in [0, 1]: a rotated elliptical cone plus one gentle bump (no second maximum) */
  var A = 4 / 3, PEAK = { x: 0.97, y: 0.33 }, ROT = -0.5, AX = 0.78, BX = 0.46;
  function f(x, y) {
    var dx = x - PEAK.x, dy = y - PEAK.y;
    var u = dx * Math.cos(ROT) - dy * Math.sin(ROT), v = dx * Math.sin(ROT) + dy * Math.cos(ROT);
    var hill = 1 - Math.sqrt((u * u) / (AX * AX) + (v * v) / (BX * BX));
    var bx = x - 0.42, by = y - 0.70;
    return hill + 0.1 * Math.exp(-(bx * bx + by * by) / (2 * 0.12 * 0.12));
  }
  var FMIN = 1e9, FMAX = -1e9;
  (function () {
    for (var i = 0; i <= 80; i++) for (var j = 0; j <= 60; j++) {
      var z = f((i / 80) * (4 / 3), j / 60);
      if (z < FMIN) FMIN = z;
      if (z > FMAX) FMAX = z;
    }
  })();
  function score(x, y) { return (f(x, y) - FMIN) / (FMAX - FMIN); }

  var s = 1;
  function rand() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  function gauss() { var u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
  function near(p) { return Math.hypot(p.x - PEAK.x, p.y - PEAK.y) < NEAR; }

  /* simulate one episode; returns per-step records and the arrival step of each run */
  function simulate(pair, seed) {
    s = seed;
    var th = [{ x: pair[0].x, y: pair[0].y }, { x: pair[1].x, y: pair[1].y }], arr = [0, 0], steps = [];
    for (var t = 1; t <= CAP; t++) {
      var eps = [], luck = [], i;
      for (i = 0; i < N; i++) { eps.push({ x: gauss(), y: gauss() }); luck.push(NOISE * gauss()); }
      var rec = { eps: eps, from: [th[0], th[1]], Z: [], to: [] };
      for (var k = 0; k < 2; k++) {
        var R = [], mean = 0, sd = 0, dx = 0, dy = 0, Z = [];
        for (i = 0; i < N; i++) {
          var v = score(th[k].x + SIGMA * eps[i].x, th[k].y + SIGMA * eps[i].y) + (k ? luck[i] : 0);
          R.push(v);
          mean += v;
        }
        mean /= N;
        for (i = 0; i < N; i++) sd += (R[i] - mean) * (R[i] - mean);
        sd = Math.sqrt(sd / N) || 1;
        for (i = 0; i < N; i++) { var z = (R[i] - mean) / sd; Z.push(z); dx += z * eps[i].x; dy += z * eps[i].y; }
        rec.Z.push(Z);
        th[k] = { x: Math.min(A - 0.02, Math.max(0.02, th[k].x + (ALPHA / N) * dx)),
                  y: Math.min(0.98, Math.max(0.02, th[k].y + (ALPHA / N) * dy)) };
        rec.to.push(th[k]);
        if (!arr[k] && near(th[k])) arr[k] = t;
      }
      steps.push(rec);
      if (arr[0] && arr[1]) break;
    }
    return { steps: steps, arr: arr };
  }

  var episodeNo = 0, ep = null, k = 0, t0 = 0, phase = "step", holdStart = 0, paused = false, visible = true, raf = 0, pausedAt = 0;
  function newEpisode() {
    var pair = PAIRS[episodeNo % PAIRS.length], best = null;
    for (var tries = 0; tries < 80; tries++) {  /* keep a draw in which both runs reach the peak on the same step */
      var sim = simulate(pair, 104729 * (episodeNo + 1) + 7919 * tries + 1);
      var gap = sim.arr[0] && sim.arr[1] ? Math.abs(sim.arr[0] - sim.arr[1]) : 99;
      if (!best || gap < best.gap) best = { sim: sim, gap: gap };
      if (gap === 0) break;
    }
    episodeNo++;
    ep = best.sim;
    ep.last = Math.max(ep.arr[0] || CAP, ep.arr[1] || CAP);
    ep.steps = ep.steps.slice(0, ep.last);
    k = 0;
    phase = "step";
    t0 = performance.now();
  }

  /* ---------- drawing ---------- */
  var W = 0, H = 0, dpr = 1, bg = null;
  function resize() {
    var r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width);
    H = Math.round(r.width * 0.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    bg = background();
  }
  var X = function (x) { return (x / A) * W; }, Y = function (y) { return y * H; };

  function background() {
    var off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    var o = off.getContext("2d");
    var w = off.width, h = off.height, img = o.createImageData(w, h), d = img.data;
    var LEVELS = 11, band = new Int16Array(w * h);
    var lo = [252, 252, 253], mid = [249, 238, 243], hi = [238, 190, 212];
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var z = score((i / w) * A, j / h);
        var b = Math.min(LEVELS - 1, Math.floor(z * LEVELS));
        band[j * w + i] = b;
        var q = Math.pow(b / (LEVELS - 1), 2.2), c;
        if (q < 0.6) { var t = q / 0.6; c = [lo[0] + (mid[0] - lo[0]) * t, lo[1] + (mid[1] - lo[1]) * t, lo[2] + (mid[2] - lo[2]) * t]; }
        else { var t2 = (q - 0.6) / 0.4; c = [mid[0] + (hi[0] - mid[0]) * t2, mid[1] + (hi[1] - mid[1]) * t2, mid[2] + (hi[2] - mid[2]) * t2]; }
        var kk = (j * w + i) * 4;
        d[kk] = c[0]; d[kk + 1] = c[1]; d[kk + 2] = c[2]; d[kk + 3] = 255;
      }
    }
    for (var jj = 1; jj < h; jj++) {  /* contour lines where the band changes */
      for (var ii = 1; ii < w; ii++) {
        var p = jj * w + ii;
        if (band[p] !== band[p - 1] || band[p] !== band[p - w]) {
          var q4 = p * 4;
          d[q4] = d[q4] * 0.82 + 180 * 0.18; d[q4 + 1] = d[q4 + 1] * 0.82 + 49 * 0.18; d[q4 + 2] = d[q4 + 2] * 0.82 + 108 * 0.18;
        }
      }
    }
    o.putImageData(img, 0, 0);
    return off;
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }

  function draw(now) {
    if (!W || !ep) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.strokeStyle = "rgba(152,36,90,0.55)";  /* peak */
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(PEAK.x) - 5, Y(PEAK.y)); ctx.lineTo(X(PEAK.x) + 5, Y(PEAK.y));
    ctx.moveTo(X(PEAK.x), Y(PEAK.y) - 5); ctx.lineTo(X(PEAK.x), Y(PEAK.y) + 5);
    ctx.stroke();

    var holding = phase === "hold", rec = ep.steps[Math.min(k, ep.steps.length - 1)];
    var p = holding ? 1 : Math.min(1, (now - t0) / STEP_MS);
    var pa = holding ? 0 : easeOut(Math.min(1, p / 0.3));
    var pc = holding ? 0 : Math.min(1, Math.max(0, (p - 0.25) / 0.2));
    var pm = holding ? 1 : ease(Math.min(1, Math.max(0, (p - 0.55) / 0.45)));
    var cur = [];
    for (var r = 0; r < 2; r++) {
      var from = rec.from[r], to = rec.to[r];
      cur.push({ x: from.x + (to.x - from.x) * pm, y: from.y + (to.y - from.y) * pm });
      ctx.strokeStyle = rgba(COLORS[r], 0.85);  /* trail */
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(X(ep.steps[0].from[r].x), Y(ep.steps[0].from[r].y));
      for (var j = 0; j < k; j++) ctx.lineTo(X(ep.steps[j].to[r].x), Y(ep.steps[j].to[r].y));
      ctx.lineTo(X(cur[r].x), Y(cur[r].y));
      ctx.stroke();
      ctx.fillStyle = rgba(COLORS[r], 0.7);
      ctx.beginPath(); ctx.arc(X(ep.steps[0].from[r].x), Y(ep.steps[0].from[r].y), 1.8, 0, 2 * Math.PI); ctx.fill();
      for (j = 0; j < k; j++) { ctx.beginPath(); ctx.arc(X(ep.steps[j].to[r].x), Y(ep.steps[j].to[r].y), 1.8, 0, 2 * Math.PI); ctx.fill(); }
      if (!holding) {
        var fade = 1 - 0.85 * pm;  /* population: larger and darker = scored above average */
        for (var i = 0; i < N; i++) {
          var z = rec.Z[r][i], up = Math.max(0, Math.min(1.6, z));
          ctx.fillStyle = rgba(COLORS[r], (z > 0 ? 0.35 + 0.45 * Math.min(1, z / 1.4) * pc : 0.22) * fade);
          ctx.beginPath();
          ctx.arc(X(from.x + SIGMA * rec.eps[i].x * pa), Y(from.y + SIGMA * rec.eps[i].y * pa), 1.6 + 1.9 * up * pc, 0, 2 * Math.PI);
          ctx.fill();
        }
        if (pm > 0 && pm < 1) {  /* the update */
          var ang = Math.atan2(Y(to.y) - Y(from.y), X(to.x) - X(from.x));
          ctx.strokeStyle = rgba(COLORS[r], 0.9 * (1 - pm));
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(X(from.x), Y(from.y)); ctx.lineTo(X(to.x), Y(to.y)); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(X(to.x), Y(to.y)); ctx.lineTo(X(to.x) - 6 * Math.cos(ang - 0.45), Y(to.y) - 6 * Math.sin(ang - 0.45));
          ctx.moveTo(X(to.x), Y(to.y)); ctx.lineTo(X(to.x) - 6 * Math.cos(ang + 0.45), Y(to.y) - 6 * Math.sin(ang + 0.45));
          ctx.stroke();
        }
      }
    }
    for (r = 0; r < 2; r++) {  /* theta markers */
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(X(cur[r].x), Y(cur[r].y), 6.5, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = rgba(COLORS[r], 1);
      ctx.beginPath(); ctx.arc(X(cur[r].x), Y(cur[r].y), 4.7, 0, 2 * Math.PI); ctx.fill();
    }
    if (readout) readout.textContent = "step " + (k + (holding || pm >= 1 ? 1 : 0)) + (holding ? " · both at the peak" : "");
  }

  function loop(now) {
    raf = 0;
    if (paused || !visible) return;
    if (phase === "hold") {
      if (now - holdStart >= HOLD_MS) newEpisode();
    } else if (now - t0 >= STEP_MS) {
      if (k + 1 >= ep.steps.length) { phase = "hold"; holdStart = now; }
      else { k++; t0 = now; }
    }
    draw(now);
    raf = window.requestAnimationFrame(loop);
  }
  function kick() {
    if (raf || paused || !visible || reduce) return;
    var gap = pausedAt ? performance.now() - pausedAt : 0;
    t0 += gap; holdStart += gap; pausedAt = 0;
    raf = window.requestAnimationFrame(loop);
  }
  function stop() { if (!pausedAt) pausedAt = performance.now(); }

  var pauseBtn = document.querySelector('.viz-controls [data-action="pause"]');
  if (pauseBtn) {
    if (reduce) pauseBtn.hidden = true;
    pauseBtn.addEventListener("click", function () {
      paused = !paused;
      pauseBtn.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;";
      pauseBtn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
      pauseBtn.title = paused ? "Play" : "Pause";
      if (paused) stop(); else kick();
    });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) kick(); else stop();
    }, { threshold: 0.05 }).observe(canvas);
  }
  if ("ResizeObserver" in window) {
    var rt = 0;
    new ResizeObserver(function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); draw(performance.now()); }, 80);
    }).observe(canvas);
  } else {
    window.addEventListener("resize", function () { resize(); draw(performance.now()); });
  }

  resize();
  newEpisode();
  if (reduce) { k = ep.steps.length - 1; phase = "hold"; draw(performance.now()); }
  else { draw(performance.now()); kick(); }
})();
