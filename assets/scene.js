/* ============================================================
   scene.js — the climbing wall

   A panelled wall of holds, and a figure moving up it. Climbing is
   a sequence of discrete reaches: three limbs stay anchored while
   one travels. That constraint is what makes the motion readable —
   a walk cycle has to be animated, a reach only has to be solved.

   Scroll is the clock. One scroll position, one move.
   ============================================================ */

window.Scene = (function () {
  'use strict';

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var TAU = Math.PI * 2;

  /* deterministic jitter, so the route never reshuffles between frames */
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ── the route ───────────────────────────────────────────
     Two columns of holds, left and right, spaced a rung apart.
     Everything below is in units of canvas height, so the figure
     keeps its proportions whatever the panel's aspect. */
  var STEP = 0.098;          // vertical spacing between rungs
  var COL = 0.072;           // how far each column sits off centre
  var MOVES = 44;            // reaches over the whole page

  function holdX(side, k) {
    return side * (COL + (rnd(k * 3.7 + side * 11) - 0.5) * 0.055);
  }
  function holdY(k) { return -k * STEP - (rnd(k * 5.3) - 0.5) * 0.022; }

  /* ── the rig ─────────────────────────────────────────────── */
  var RIG = {
    upper: 0.058, fore: 0.055,
    thigh: 0.066, shin: 0.063,
    torso: 0.088, neck: 0.044, headR: 0.021
  };

  /* Limb order is the sequence a climber actually uses: right hand,
     left foot, left hand, right foot. Each advances one rung every
     fourth move, so three limbs are always loaded. */
  var LIMBS = [
    { key: 'RH', side: 1, hand: true,  order: 0, lift: 3 },
    { key: 'LF', side: -1, hand: false, order: 1, lift: 0 },
    { key: 'LH', side: -1, hand: true,  order: 2, lift: 3 },
    { key: 'RF', side: 1, hand: false, order: 3, lift: 0 }
  ];

  function rungAt(limb, m) { return Math.floor((m - limb.order + 3) / 4) + limb.lift; }

  /* ── state ─────────────────────────────────────────────── */
  var cv, ctx, W = 0, H = 0, dpr = 1;
  var raf = 0, running = false, reduced = false;
  var st = { p: 0, pT: 0 };
  var chalk = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth || 1;
    H = cv.clientHeight || 1;
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── two-bone IK ───────────────────────────────────────── */
  function ik(ax, ay, bx, by, l1, l2, sign) {
    var dx = bx - ax, dy = by - ay;
    var d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    var maxd = (l1 + l2) * 0.995, mind = Math.abs(l1 - l2) + 1e-4;
    if (d > maxd) { var k = maxd / d; dx *= k; dy *= k; d = maxd; }
    if (d < mind) { var k2 = mind / d; dx *= k2; dy *= k2; d = mind; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    var hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ux = dx / d, uy = dy / d;
    return {
      jx: ax + ux * a - uy * hh * sign,
      jy: ay + uy * a + hh * ux * sign,
      ex: ax + dx, ey: ay + dy
    };
  }

  /* ── where each limb is, at a given point in the sequence ── */
  function limbPos(limb, m, t) {
    var r0 = rungAt(limb, m);
    var r1 = rungAt(limb, m + 1);
    var from = { x: holdX(limb.side, r0), y: holdY(r0) };
    if (r1 === r0) return { x: from.x, y: from.y, moving: 0 };

    var to = { x: holdX(limb.side, r1), y: holdY(r1) };
    // the reach: out from the wall, up, and in again onto the hold
    var e = smooth(t);
    var arc = Math.sin(Math.PI * e);
    return {
      x: lerp(from.x, to.x, e) + limb.side * arc * 0.055,
      y: lerp(from.y, to.y, e) - arc * 0.030,
      moving: arc
    };
  }

  /* ── the wall ──────────────────────────────────────────── */
  function drawWall(camY, u, cx) {
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(0, 0, W, H);

    var top = camY - 0.62, bot = camY + 0.62;

    // T-nut grid: the detail that makes a flat panel read as a wall
    var gx = 0.062, gy = 0.062;
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    var i0 = Math.floor(top / gy) - 1, i1 = Math.ceil(bot / gy) + 1;
    for (var i = i0; i <= i1; i++) {
      var wy = i * gy;
      for (var j = -6; j <= 6; j++) {
        var wx = j * gx + (i % 2 ? gx * 0.5 : 0);
        var sx = cx + wx * u, sy = (wy - camY) * u + H * 0.5;
        if (sx < -8 || sx > W + 8 || sy < -8 || sy > H + 8) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.7, u * 0.0035), 0, TAU);
        ctx.fill();
      }
    }

    // the gym's lights fall on the middle of the panel
    var lg = ctx.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(0,0,0,.45)');
    lg.addColorStop(0.45, 'rgba(255,255,255,.022)');
    lg.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);

    // panel seams every four rows
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    for (var s = Math.floor(top / (gy * 4)) - 1; s <= Math.ceil(bot / (gy * 4)) + 1; s++) {
      var y = (s * gy * 4 - camY) * u + H * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
      ctx.stroke();
    }
  }

  /* Holds come in kinds. A wall of one shape reads as a pegboard;
     jugs, crimps and pinches read as a gym. */
  function drawHold(sx, sy, r, seed, live, chalked) {
    var kind = Math.floor(rnd(seed * 1.7) * 3);       // 0 jug, 1 crimp, 2 pinch
    var ax = kind === 1 ? 1.45 : (kind === 2 ? 0.62 : 1.0);
    var ay = kind === 1 ? 0.52 : (kind === 2 ? 1.30 : 0.86);
    var tilt = (rnd(seed * 2.3) - 0.5) * 0.9;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(tilt);

    ctx.beginPath();
    var N = 16;
    for (var i = 0; i <= N; i++) {
      var a = (i / N) * TAU;
      var rr = r * (1 + 0.26 * Math.sin(a * 2 + rnd(seed) * 6) + 0.14 * Math.sin(a * 3 + rnd(seed + 1) * 6));
      var x = Math.cos(a) * rr * ax, y = Math.sin(a) * rr * ay;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = live ? 'rgba(226,226,222,.82)' : 'rgba(150,150,156,.34)';
    ctx.fill();

    // lit from above left, the way a gym's ceiling lights sit
    ctx.beginPath();
    ctx.ellipse(-r * 0.22 * ax, -r * 0.26 * ay, r * 0.42 * ax, r * 0.30 * ay, -0.5, 0, TAU);
    ctx.fillStyle = live ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.16)';
    ctx.fill();

    // the bolt that holds it on
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.6, r * 0.14), 0, TAU);
    ctx.fillStyle = 'rgba(10,10,12,.45)';
    ctx.fill();

    /* Chalk builds up on everything already climbed, so the route below
       him carries a record of the way he came. */
    if (chalked) {
      for (var c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.ellipse((rnd(seed + c * 3) - 0.5) * r * 1.2 * ax,
                    -r * 0.5 * ay + (rnd(seed + c * 5) - 0.5) * r * 0.5,
                    r * (0.30 + rnd(seed + c) * 0.28) * ax,
                    r * (0.16 + rnd(seed + c * 2) * 0.14) * ay,
                    tilt * 0.5, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,.13)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Volumes: the big bolt-on features a gym breaks a flat wall with.
     They sit behind the holds and give the panel depth. */
  function drawVolume(camY, u, cx, k) {
    var side = (k % 12 === 0) ? -1 : 1;
    var wy = holdY(k) + STEP * 0.5;
    var sy = (wy - camY) * u + H * 0.5;
    if (sy < -H * 0.9 || sy > H * 1.9) return;
    var w = u * (0.16 + rnd(k * 9) * 0.10);
    var sx = cx + side * u * (0.20 + rnd(k * 4) * 0.10);
    var rot = (rnd(k * 6) - 0.5) * 1.2;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, w * 0.42);
    ctx.lineTo(w * 0.5, w * 0.20);
    ctx.lineTo(w * 0.05, -w * 0.55);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,.030)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.075)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // one lit facet, so it reads as a solid and not an outline
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, w * 0.42);
    ctx.lineTo(w * 0.05, -w * 0.55);
    ctx.lineTo(w * 0.5, w * 0.20);
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, w * 0.42);
    ctx.lineTo(w * 0.05, -w * 0.55);
    ctx.lineTo(-w * 0.1, w * 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fill();
    ctx.restore();
  }

  /* The anchor at the top of the route, waiting at the end of the page. */
  var ANCHOR = 15;
  function drawAnchor(camY, u, cx) {
    var sy = (holdY(ANCHOR) - camY) * u + H * 0.5;
    if (sy < -60 || sy > H + 60) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(210,210,206,.55)';
    ctx.fillStyle = 'rgba(210,210,206,.55)';
    ctx.lineWidth = Math.max(1, u * 0.004);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var bx = cx + s2 * u * 0.055;
      ctx.beginPath();
      ctx.arc(bx, sy, u * 0.010, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx, sy + u * 0.010);
      ctx.quadraticCurveTo(cx, sy + u * 0.055, cx, sy + u * 0.042);
      ctx.stroke();
    }
    // the ring everyone clips into
    ctx.beginPath();
    ctx.arc(cx, sy + u * 0.052, u * 0.013, 0, TAU);
    ctx.lineWidth = Math.max(1.2, u * 0.005);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoute(camY, u, cx, liveRungs, topRung) {
    var k0 = Math.floor((-camY - 0.66) / STEP) - 2;
    var k1 = Math.ceil((-camY + 0.66) / STEP) + 2;
    for (var k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
      if (k < 0) continue;
      if (k % 6 === 0) drawVolume(camY, u, cx, k);
      if (k > ANCHOR) continue;                    // nothing above the anchor
      for (var s = -1; s <= 1; s += 2) {
        var wx = holdX(s, k), wy = holdY(k);
        var sx = cx + wx * u, sy = (wy - camY) * u + H * 0.5;
        if (sy < -60 || sy > H + 60) continue;
        var side = s === 1 ? 'R' : 'L';
        var live = liveRungs[side].indexOf(k) >= 0;
        var r = u * 0.019 * (0.82 + rnd(k * 11 + s) * 0.5);
        drawHold(sx, sy, r, k * 7 + s * 3, live, k < topRung[side]);
      }
      // a scatter of holds that are not on the route, so it reads as a wall
      for (var q = 0; q < 1; q++) {
        var jx = (rnd(k * 13 + q * 5) - 0.5) * 0.66;
        if (Math.abs(jx) < 0.19) continue;
        var jy = holdY(k) + (rnd(k * 17 + q) - 0.5) * STEP;
        var jsx = cx + jx * u, jsy = (jy - camY) * u + H * 0.5;
        if (jsy < -60 || jsy > H + 60) continue;
        drawHold(jsx, jsy, u * 0.014 * (0.7 + rnd(k * 23 + q) * 0.8), k * 31 + q, false, false);
      }
    }
  }

  /* ── the climber ───────────────────────────────────────── */
  function drawClimber(P, u, cx, camY, breath, look) {
    function toS(p) { return { x: cx + p.x * u, y: (p.y - camY) * u + H * 0.5 }; }

    var LH = toS(P.LH), RH = toS(P.RH), LF = toS(P.LF), RF = toS(P.RF);

    /* The body hangs between what the hands hold and what the feet
       stand on. Placing hips and shoulders from those two centroids
       is what makes the posture read as climbing rather than posing. */
    var handC = { x: (LH.x + RH.x) / 2, y: (LH.y + RH.y) / 2 };
    var footC = { x: (LF.x + RF.x) / 2, y: (LF.y + RF.y) / 2 };
    var shoulderT = { x: handC.x + breath * u * 0.006, y: handC.y + u * (0.106 + breath * 0.004) };
    var hipT = { x: footC.x, y: footC.y - u * 0.108 };

    var mx = (shoulderT.x + hipT.x) / 2, my = (shoulderT.y + hipT.y) / 2;
    var dx = shoulderT.x - hipT.x, dy = shoulderT.y - hipT.y;
    var dl = Math.sqrt(dx * dx + dy * dy) || 1;
    var half = u * RIG.torso * 0.5;
    var sh = { x: mx + dx / dl * half, y: my + dy / dl * half };
    var hip = { x: mx - dx / dl * half, y: my - dy / dl * half };

    // shoulders and hips are a span, not a point
    var px = -dy / dl, py = dx / dl;
    var shW = u * 0.030, hipW = u * 0.024;
    var shL = { x: sh.x - px * shW, y: sh.y - py * shW };
    var shR = { x: sh.x + px * shW, y: sh.y + py * shW };
    var hipL = { x: hip.x - px * hipW, y: hip.y - py * hipW };
    var hipR = { x: hip.x + px * hipW, y: hip.y + py * hipW };

    var LA = ik(shL.x, shL.y, LH.x, LH.y, u * RIG.upper, u * RIG.fore, -1);
    var RA = ik(shR.x, shR.y, RH.x, RH.y, u * RIG.upper, u * RIG.fore, 1);
    var LL = ik(hipL.x, hipL.y, LF.x, LF.y, u * RIG.thigh, u * RIG.shin, -1);
    var RL = ik(hipR.x, hipR.y, RF.x, RF.y, u * RIG.thigh, u * RIG.shin, 1);

    var lw = Math.max(2, u * 0.0135);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function bone(a, j, e, w) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(j.jx, j.jy);
      ctx.lineTo(j.ex, j.ey);
      ctx.stroke();
    }

    // far side first, a shade back, so the figure has a front and a back
    ctx.strokeStyle = 'rgba(240,240,236,.52)';
    bone(shL, LA, LH, lw * 0.9);
    bone(hipL, LL, LF, lw * 0.95);

    ctx.strokeStyle = 'rgba(244,244,240,.96)';
    ctx.lineWidth = lw * 1.15;
    ctx.beginPath();                       // spine
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(sh.x, sh.y);
    ctx.stroke();
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();                       // shoulders and hips
    ctx.moveTo(shL.x, shL.y); ctx.lineTo(shR.x, shR.y);
    ctx.moveTo(hipL.x, hipL.y); ctx.lineTo(hipR.x, hipR.y);
    ctx.stroke();

    bone(shR, RA, RH, lw);
    bone(hipR, RL, RF, lw);

    // head, turned toward whatever is being reached for
    var hx = sh.x + dx / dl * u * RIG.neck + look.x * u * 0.014;
    var hy = sh.y + dy / dl * u * RIG.neck + look.y * u * 0.010;
    ctx.beginPath();
    ctx.arc(hx, hy, u * RIG.headR, 0, TAU);
    ctx.fillStyle = 'rgba(244,244,240,.96)';
    ctx.fill();

    // hands close on the hold rather than hover near it
    ctx.fillStyle = 'rgba(244,244,240,.96)';
    [[LH, LA], [RH, RA]].forEach(function (h) {
      ctx.beginPath(); ctx.arc(h[0].x, h[0].y, lw * 0.85, 0, TAU); ctx.fill();
    });

    /* Climbing shoes: a stiff wedge standing on the toe, aimed along the
       shin. A round dot for a foot is the one thing that gives a rig away. */
    [[LF, LL], [RF, RL]].forEach(function (f) {
      var fx = f[0].x, fy = f[0].y;
      var ang = Math.atan2(fy - f[1].jy, fx - f[1].jx);
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(lw * 0.35, 0, lw * 1.6, lw * 0.78, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  /* ── chalk, kicked off a hold as a hand lands ──────────── */
  function puff(x, y, u) {
    for (var i = 0; i < 7; i++) {
      chalk.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 0.5 - 0.1,
        r: u * (0.002 + Math.random() * 0.004),
        life: 0.6 + Math.random() * 0.5
      });
    }
  }

  var lastMove = -1;

  function draw(perf) {
    var p = st.p;
    var u = H;                         // one unit = canvas height
    var cx = W * 0.5;

    var mf = p * MOVES;
    var m = Math.floor(mf), t = mf - m;

    var P = {};
    var moverPos = null;
    for (var i = 0; i < LIMBS.length; i++) {
      var L = LIMBS[i];
      var q = limbPos(L, m, t);
      P[L.key] = q;
      if (q.moving > 0.001) moverPos = q;
    }

    // camera keeps the hips at the middle of the panel
    var camY = (P.LF.y + P.RF.y) / 2 - 0.108;

    // whatever the moving limb is heading for is what he is watching
    var look = { x: 0, y: -0.3 };
    if (moverPos) {
      var bx2 = (P.LF.x + P.RF.x) / 2, by2 = (P.LF.y + P.RF.y) / 2 - 0.16;
      var ddx = moverPos.x - bx2, ddy = moverPos.y - by2;
      var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      look = { x: ddx / dd, y: ddy / dd };
    }

    var topRung = {
      L: Math.max(rungAt(LIMBS[1], m), rungAt(LIMBS[2], m)),
      R: Math.max(rungAt(LIMBS[0], m), rungAt(LIMBS[3], m))
    };

    var liveRungs = {
      L: [rungAt(LIMBS[1], m), rungAt(LIMBS[2], m), rungAt(LIMBS[1], m + 1), rungAt(LIMBS[2], m + 1)],
      R: [rungAt(LIMBS[0], m), rungAt(LIMBS[3], m), rungAt(LIMBS[0], m + 1), rungAt(LIMBS[3], m + 1)]
    };

    drawWall(camY, u, cx);
    drawRoute(camY, u, cx, liveRungs, topRung);
    drawAnchor(camY, u, cx);

    // chalk
    if (!reduced) {
      if (m !== lastMove && lastMove >= 0) {
        var lm = LIMBS[((m % 4) + 4) % 4];
        var lp = limbPos(lm, m, 0);
        puff(cx + lp.x * u, (lp.y - camY) * u + H * 0.5, u);
      }
      lastMove = m;
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (var c = chalk.length - 1; c >= 0; c--) {
        var C = chalk[c];
        C.life -= 0.016;
        C.x += C.vx; C.y += C.vy; C.vy += 0.035;
        if (C.life <= 0) { chalk.splice(c, 1); continue; }
        ctx.globalAlpha = clamp(C.life, 0, 1) * 0.45;
        ctx.beginPath(); ctx.arc(C.x, C.y, C.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawClimber(P, u, cx, camY, Math.sin(perf * 0.0016), look);
  }

  function frame(now) {
    st.p += (st.pT - st.p) * (reduced ? 1 : 0.13);
    draw(now);
    if (running && !reduced) raf = requestAnimationFrame(frame);
  }

  function requestFrame() {
    if (!running) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  return {
    init: function () {
      cv = document.getElementById('wall');
      if (!cv) return;
      reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ctx = cv.getContext('2d');
      resize();
      window.addEventListener('resize', function () { resize(); if (reduced) requestFrame(); }, { passive: true });
      running = true;
      raf = requestAnimationFrame(frame);
    },
    set: function (p) {
      st.pT = clamp(p, 0, 1);
      if (reduced) requestFrame();
    },
    pause: function () { running = false; cancelAnimationFrame(raf); },
    resume: function () { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  };
})();
