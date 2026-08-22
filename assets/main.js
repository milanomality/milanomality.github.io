/* ============================================================
   main.js — one scroll position drives the sheet, the rail
   and every reveal.
   ============================================================ */

(function () {
  'use strict';

  var doc = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var band = function (v, a, b) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  var chapters = [].slice.call(document.querySelectorAll('[data-chapter]'));

  /* ── the brush is loaded before it touches down ────────── */
  var veil = document.getElementById('veil');
  function lift() {
    if (!veil) return;
    veil.classList.add('is-gone');
    setTimeout(function () { if (veil && veil.parentNode) veil.parentNode.removeChild(veil); }, 1400);
  }
  if (reduced) { lift(); }
  else {
    var lifted = false;
    var go = function () { if (!lifted) { lifted = true; setTimeout(lift, 520); } };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
      setTimeout(go, 2400);
    } else {
      window.addEventListener('load', go);
      setTimeout(go, 1800);
    }
  }

  /* ── margin rail ───────────────────────────────────────── */
  var ticks = document.getElementById('railTicks');
  var railFill = document.getElementById('railFill');
  var rail = document.getElementById('rail');
  var tickEls = [];

  if (ticks) {
    chapters.forEach(function (sec) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + sec.id;
      a.innerHTML = '<span class="tick__name">' + sec.dataset.chapter + '</span>' +
                    '<span class="tick__year mono">' + sec.dataset.mark + '</span>';
      li.appendChild(a);
      ticks.appendChild(li);
      tickEls.push(li);
    });
    setTimeout(function () { if (rail) rail.classList.add('is-live'); }, 1200);
  }

  /* ── count-ups ─────────────────────────────────────────── */
  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    if (isNaN(target)) return;
    if (reduced) { el.textContent = target + suffix; return; }
    var t0 = null, dur = 1800;
    function step(now) {
      if (t0 === null) t0 = now;
      var t = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── staged reveals ────────────────────────────────────── */
  function reveal(sec) {
    if (sec._revealed) return;
    sec._revealed = true;
    sec.classList.add('is-in');

    [].slice.call(sec.querySelectorAll('[data-stagger]')).forEach(function (group) {
      [].slice.call(group.children).forEach(function (kid, i) {
        setTimeout(function () {
          kid.classList.add('is-on');
          var n = kid.querySelector('[data-count]');
          if (n) countUp(n);
        }, reduced ? 0 : 300 + i * 120);
      });
    });

    var solo = sec.querySelector('[data-count]');
    if (solo && !solo.closest('[data-stagger]')) countUp(solo);
  }

  /* ── the loop ──────────────────────────────────────────── */
  var vh = window.innerHeight;
  var ticking = false;
  var activeTick = -1;

  function chapterProgress(el) {
    var r = el.getBoundingClientRect();
    var range = el.offsetHeight - vh;
    // Sticky chapters ride their own scroll range. Flowing ones (mobile)
    // are shorter than the viewport, so they ramp across the whole pass.
    if (range <= 0) return clamp((vh - r.top) / (el.offsetHeight + vh), 0, 1);
    return clamp(-r.top / range, 0, 1);
  }

  function update() {
    ticking = false;

    var max = doc.scrollHeight - vh;
    var p = max > 0 ? clamp(window.pageYOffset / max, 0, 1) : 0;

    if (window.Scene) window.Scene.set(p);
    if (railFill) railFill.style.height = (p * 100).toFixed(2) + '%';

    var here = -1;
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      if (r.top <= vh * 0.55 && r.bottom >= vh * 0.25) { reveal(chapters[i]); here = i; }
    }
    if (here !== activeTick && here >= 0) {
      if (tickEls[activeTick]) tickEls[activeTick].classList.remove('is-here');
      if (tickEls[here]) tickEls[here].classList.add('is-here');
      activeTick = here;
    }

  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { vh = window.innerHeight; onScroll(); }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!window.Scene) return;
    if (document.hidden) window.Scene.pause(); else window.Scene.resume();
  });

  if (window.Scene) window.Scene.init();
  update();
  setTimeout(function () { if (chapters[0]) reveal(chapters[0]); }, reduced ? 0 : 620);
})();
