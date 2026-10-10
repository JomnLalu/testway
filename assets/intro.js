/* Homepage intro: "Three bars". The plan, scene timings and reasons are in INTRO.md.
   Everything the intro adds to the page is created here; style.css and script.js are not
   touched. To remove the intro: delete this file, intro.css and its <script> tag. */
(function () {
  'use strict';

  var root = document.documentElement;
  var script = document.currentScript;
  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var raf = window.requestAnimationFrame.bind(window);
  var clock = window.performance.now.bind(window.performance);

  var INTRO_KEY = 'jm:intro';
  // The longest the page stays behind a plain cover once the site's loader has lifted, while
  // the intro's stylesheet is still on its way
  var HOLD_MS = 2000;
  // On a slow device the page's own 3D stage can hold up every frame for seconds as it starts.
  // The first gap longer than PAUSE_MS is a pause and the piece carries on where it stopped;
  // later ones are dropped frames, so a device that is slow throughout still finishes on time.
  // Only if frames stay away for STALL_MS does the intro give the page back.
  var PAUSE_MS = 1000;
  var STALL_MS = 6000;

  var markEl = document.querySelector('.wordmark__mark');
  var nameEl = document.querySelector('.wordmark span');
  var footer = document.querySelector('.site-footer');

  if (reducedQuery.matches || !script || !markEl || !nameEl || !nameEl.firstChild || !footer ||
      !document.createElement('canvas').getContext) return;

  /* ---------- Time: 125 BPM, so an eighth note is the site's --t-base (240 ms) ---------- */

  var BEAT = 60 / 125;
  var S8 = BEAT / 2;
  var S16 = BEAT / 4;
  var S32 = BEAT / 8;
  var BAR = BEAT * 4;
  var SCENE_LEN = BAR * 2;
  var FIRST_SCENE = BAR;
  var FINALE = FIRST_SCENE + 3 * SCENE_LEN;
  var LANDING = FINALE + BAR;
  // The one deliberate hold: everything freezes for an eighth, in silence, then the wordmark
  // slams home in the next eighth and lands on the final hit
  var FREEZE = at(31);
  var SLAM = at(31.5);
  var WAVE = 0.5;
  var CELL_LIFE = 0.18;
  // Once the wave has cleared the masthead the real wordmark takes over from the drawn one
  var HANDOVER = LANDING + WAVE / 2;
  var HANDOVER_LEN = 0.16;
  // Every squash, shake and wink after the landing has died away by now, so the drawn wordmark
  // is exactly in place when the handover starts; calm() tapers them off before it
  var SETTLED = HANDOVER - 0.03;
  var END = LANDING + WAVE + CELL_LIFE;

  function at(beat) { return beat * BEAT; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function phase(t, start, dur) { return clamp01((t - start) / dur); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  // Seconds since the last beat
  function sinceBeat(t) { return ((t % BEAT) + BEAT) % BEAT; }
  // The clock for everything that keeps moving in the background: it stands still through
  // the pause, then carries on
  function held(t) { return t < FREEZE ? t : Math.max(FREEZE, t - (SLAM - FREEZE)); }
  function calm(t) { return 1 - phase(t, LANDING + 0.12, SETTLED - LANDING - 0.12); }

  /* ---------- Easing and motion: the site's own curve, expo, back and springs ---------- */

  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function curveX(u) { return ((ax * u + bx) * u + cx) * u; }
    function slopeX(u) { return (3 * ax * u + 2 * bx) * u + cx; }
    function solve(x) {
      var u = x;
      for (var i = 0; i < 8; i++) {
        var err = curveX(u) - x;
        var d = slopeX(u);
        if (Math.abs(err) < 1e-6) return u;
        if (Math.abs(d) < 1e-6) break;
        u -= err / d;
      }
      // Newton can stall on flat stretches of the curve; bisection always converges
      var lo = 0, hi = 1;
      u = x;
      while (hi - lo > 1e-6) {
        if (curveX(u) < x) lo = u; else hi = u;
        u = (lo + hi) / 2;
      }
      return u;
    }
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      var u = solve(p);
      return ((ay * u + by) * u + cy) * u;
    };
  }

  var tokens = window.getComputedStyle(root);
  function token(name) { return tokens.getPropertyValue(name).trim(); }
  function num(value) { return parseFloat(value) || 0; }

  function curveToken(name, fallback) {
    var m = /cubic-bezier\(([^)]+)\)/.exec(token(name));
    var v = (m ? m[1] : fallback).split(',').map(parseFloat);
    return bezier(v[0], v[1], v[2], v[3]);
  }

  var ease = curveToken('--ease', '.2, .7, .2, 1');
  function easeInCubic(p) { return p * p * p; }
  function expoOut(p) { return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); }
  function expoIn(p) { return p <= 0 ? 0 : Math.pow(2, 10 * p - 10); }
  // Overshoots by about a tenth, then settles
  function backOut(p) { var q = p - 1; return 1 + 2.7 * q * q * q + 1.7 * q * q; }
  // Pulls back by about a tenth before it goes: anticipation built into the curve
  function backIn(p) { return p * p * (2.7 * p - 1.7); }

  // A damped spring let go s seconds ago: it leaves 0, overshoots 1 and settles there
  function spring(s, hz, zeta) {
    if (s <= 0) return 0;
    var w = 2 * Math.PI * hz;
    var wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * s) * (Math.cos(wd * s) + zeta * w / wd * Math.sin(wd * s));
  }

  // A spring struck s seconds ago: it starts at 1, swings through 0 and dies away
  function ring(s, hz, zeta) {
    if (s < 0) return 0;
    var w = 2 * Math.PI * hz;
    return Math.exp(-zeta * w * s) * Math.cos(w * Math.sqrt(1 - zeta * zeta) * s);
  }

  // A shove s seconds ago: out, back past where it was, and still again
  function nudge(s) { return s < 0 ? 0 : Math.exp(-9 * s) * Math.sin(30 * s); }

  // A short hop: from 0 up to 1 and back to 0 over dur seconds
  function bump(s, dur) { return s > 0 && s < dur ? Math.sin(Math.PI * s / dur) : 0; }

  // Landing: wider and flatter at once, a rebound, then square again; the area is kept
  function squash(s, amount) {
    var k = 1 - amount * ring(s, 5, 0.32);
    return { sx: 1 / k, sy: k };
  }

  // Fast things stretch along their path; v in their own sizes per second
  function stretchFor(v) { return 1 + Math.min(0.45, Math.abs(v) * 0.012); }

  /* ---------- Palette and type from style.css ---------- */

  var C = null;
  var FONT = '';
  var TRACK_DISPLAY = -0.04;
  var LINE_HEIGHT = 1.1;

  function readPalette() {
    var out = {};
    var names = ['stone', 'petrol', 'chalk', 'ink', 'sea-light'];
    for (var i = 0; i < names.length; i++) {
      var value = token('--' + names[i]);
      if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
      var n = parseInt(value.slice(1), 16);
      out[names[i]] = [n >> 16, (n >> 8) & 255, n & 255];
    }
    return out;
  }

  function css(c, alpha) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (alpha === undefined ? 1 : alpha) + ')';
  }

  function mix(a, b, p) {
    return [Math.round(lerp(a[0], b[0], p)), Math.round(lerp(a[1], b[1], p)), Math.round(lerp(a[2], b[2], p))];
  }

  /* ---------- The mark: three bars on a 4-unit module, as in the SVG ---------- */

  var BARS = [
    { x: 2, y: 14, w: 4, h: 8, alpha: 0.4 },
    { x: 10, y: 10, w: 4, h: 12, alpha: 0.72 },
    { x: 18, y: 2, w: 4, h: 20, alpha: 1 }
  ];
  var MARK_BOX = 24;
  // The tallest bar is five modules; the sea-light module that plays the lead is its top one
  var MODULE = 4;

  /* ---------- What each project scene says: copy from index.html and work.html ---------- */

  // Each word: the beat it is cued on (counted from the scene's start), how it moves, and
  // whether it is the accent. Rise, converge, spin and zip start on their cue; drop, slam,
  // stick and arrive land on it. ripple: [beat, word] a hop that runs out from that word.
  var SCENES = [
    {
      kicker: '01 · MangARTI',
      meta: 'Llama 3 8B · QLoRA · one laptop GPU',
      words: [['A', 4, 'rise'], ['language', 4.5, 'rise'], ['model', 5, 'converge'], ['that', 5.5, 'rise'],
        ['speaks', 6, 'drop'], ['Manadonese.', 6.5, 'slam', true]],
      ripple: [6.75, 0],
      graphic: drawSpellings,
      marquee: 'MangARTI · Ngana · Ngna · ngn · ',
      drift: -1
    },
    {
      kicker: '02 · IterMath',
      meta: 'Seven modules, from addition to permutations',
      words: [['A math', 4, 'rise'], ['drill', 4.5, 'spin'], ['that', 5, 'rise'], ['sticks.', 6, 'stick', true]],
      ripple: [6.5, 3],
      graphic: drawModules,
      marquee: '+ − × ÷ ( ) nCr nPr ',
      drift: 1
    },
    {
      kicker: '03 · BSQShuttle',
      meta: '33 daily departures across three routes',
      words: [['A', 4, 'rise'], ['shuttle', 4.5, 'zip'], ['you', 5, 'rise'], ['can', 5.25, 'rise'],
        ['actually', 5.5, 'converge'], ['catch.', 6, 'arrive', true]],
      ripple: null,
      graphic: drawRoute,
      marquee: 'BSQ · Kijang · Syahdan · Anggrek · ',
      drift: -1
    }
  ];
  var SCENE_CLOSE = at(7);
  // Letters of a word follow each other by this much
  var STAGGER = { rise: 0.022, converge: 0.02, spin: 0.03, zip: 0.035, drop: 0.028, slam: 0.03 };
  // Words that move as one, and how long before its cue each one shows
  var WHOLE = { slam: 0.16, stick: S8, arrive: S8 };
  // Motion trails: how many fainter copies a fast move leaves, 22 ms apart
  var TRAIL = 2;

  /* ---------- Canvas, layout and text ---------- */

  var run = null;
  var ctx = null;
  var L = null;
  var runs = {};
  // Set when the device is slow: trails, chromatic splits, the marquee and the second dot
  // layer are left out
  var lite = false;

  // Glyph by glyph, so tracking and per-letter motion work in every browser (canvas
  // letterSpacing is not universal). Each x includes the kerning from the glyph before it.
  function textRun(text, weight, size, track) {
    var key = text + '|' + weight + '|' + size + '|' + track;
    if (runs[key]) return runs[key];
    var font = weight + ' ' + size + 'px ' + FONT;
    ctx.font = font;
    var glyphs = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var advance = ctx.measureText(ch).width;
      var end = ctx.measureText(text.slice(0, i + 1)).width;
      glyphs.push({ ch: ch, x: end - advance + track * size * i, w: advance });
    }
    var m = ctx.measureText(text);
    var last = glyphs[glyphs.length - 1];
    runs[key] = {
      font: font,
      size: size,
      glyphs: glyphs,
      width: last ? last.x + last.w : 0,
      ascent: m.fontBoundingBoxAscent || size * 0.92,
      descent: m.fontBoundingBoxDescent || size * 0.24,
      cap: ctx.measureText('H').actualBoundingBoxAscent || size * 0.7
    };
    return runs[key];
  }

  function drawRun(r, x, y, color) {
    ctx.font = r.font;
    ctx.fillStyle = color;
    for (var i = 0; i < r.glyphs.length; i++) {
      var g = r.glyphs[i];
      if (g.ch !== ' ' && g.ch !== ' ') ctx.fillText(g.ch, x + g.x, y);
    }
  }

  function clipRect(x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  function fillBox(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // 1 CSS px, snapped to whole device pixels so it stays crisp at any ratio
  function hairline(x1, y1, x2, y2, color) {
    var t = Math.max(1, Math.round(L.dpr)) / L.dpr;
    if (y1 === y2) fillBox(x1, Math.round(y1 * L.dpr) / L.dpr, x2 - x1, t, color);
    else fillBox(Math.round(x1 * L.dpr) / L.dpr, y1, t, y2 - y1, color);
  }

  function roundedBox(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // A sea-light frame bursting outward from a box centred on (x, y): the impact ring
  function drawFrame(x, y, w, h, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = css(C['sea-light']);
    ctx.lineWidth = Math.max(2, L.m * 0.05);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.restore();
  }

  // Greedy wrap of display words at one size; null if a single word cannot fit
  function wrap(words, size, maxWidth) {
    var space = textRun(' ', 700, size, TRACK_DISPLAY).glyphs[0].w + TRACK_DISPLAY * size;
    var lines = [];
    var line = null;
    for (var i = 0; i < words.length; i++) {
      var r = textRun(words[i][0], 700, size, TRACK_DISPLAY);
      if (r.width > maxWidth) return null;
      if (line && line.width + space + r.width <= maxWidth) {
        line.items.push({ word: words[i], run: r, x: line.width + space });
        line.width += space + r.width;
      } else {
        line = { items: [{ word: words[i], run: r, x: 0 }], width: r.width };
        lines.push(line);
      }
    }
    return lines;
  }

  function fitSentence(words, maxWidth, maxHeight, maxSize) {
    for (var size = Math.floor(maxSize); size > 20; size -= 2) {
      var lines = wrap(words, size, maxWidth);
      if (lines && lines.length * size * LINE_HEIGHT <= maxHeight) return { size: size, lines: lines };
    }
    return { size: 20, lines: wrap(words, 20, Infinity) };
  }

  // The real wordmark, measured character by character: the last frame is drawn from this
  function readWordmark() {
    var box = markEl.getBoundingClientRect();
    var ratio = window.devicePixelRatio || 1;
    // The browser paints the SVG on whole device pixels; the text keeps its fractional x
    var x = Math.round(box.left * ratio) / ratio;
    var y = Math.round(box.top * ratio) / ratio;
    var text = nameEl.firstChild;
    var style = window.getComputedStyle(nameEl);
    var font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    var range = document.createRange();
    var glyphs = [];
    for (var i = 0; i < text.length; i++) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      var glyph = range.getBoundingClientRect();
      glyphs.push({ ch: text.data.charAt(i), x: glyph.left - x, w: glyph.width });
    }
    range.selectNodeContents(text);
    var line = range.getBoundingClientRect();
    ctx.font = font;
    var m = ctx.measureText(text.data);
    var ascent = m.fontBoundingBoxAscent || num(style.fontSize) * 0.92;
    var descent = m.fontBoundingBoxDescent || num(style.fontSize) * 0.24;
    return {
      x: x,
      y: y,
      unit: box.width / MARK_BOX,
      font: font,
      glyphs: glyphs,
      split: text.data.indexOf(' '),
      // The rect may be the line-height box or the font's content box; half-leading covers both
      baseline: line.top - y + (line.height - ascent - descent) / 2 + ascent,
      top: line.top - y,
      height: line.height,
      width: line.right - x
    };
  }

  function layout() {
    var o = run.overlay;
    var W = o.clientWidth;
    var H = o.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, run.maxDpr);
    run.canvas.width = Math.round(W * dpr);
    run.canvas.height = Math.round(H * dpr);
    runs = {};

    var mark = readWordmark();
    var gutter = num(token('--gutter'));
    var bottom = run.controls.getBoundingClientRect().top - gutter;
    var headY = mark.y + MARK_BOX * mark.unit / 2;
    var m = Math.min(W / 12, H / 16);
    var center = { x: W / 2, y: lerp(headY, bottom, 0.5) };
    var base = 6 * m / (MARK_BOX * mark.unit);
    // Where one line of name could only be drawn at under 2.4 times its real size (phones),
    // the finale sets it on two lines instead, so it can be large
    var fold = { on: 0, dx: 0, lead: mark.height / 2 };
    var width = mark.width;
    if (mark.split > 0 && 0.72 * (W - 2 * mark.x) / mark.width < 2.4) {
      fold.on = 1;
      fold.dx = mark.glyphs[0].x - mark.glyphs[mark.split + 1].x;
      width = Math.max(mark.glyphs[mark.split].x, mark.width + fold.dx);
    }
    var big = Math.min((fold.on ? 0.8 : 0.72) * (W - 2 * mark.x) / width, 0.28 * H / (MARK_BOX * mark.unit));
    var markH = MARK_BOX * mark.unit;
    // The wind-up before the pause: the wordmark crouches and pulls back from the masthead.
    // On phones it gathers into one line here, small enough to fit.
    var focus = { x: center.x, y: center.y };
    var wind = big * 0.9;
    if (fold.on) wind = Math.min(wind, 0.86 * (W - 2 * mark.x) / mark.width);
    var home = { x: mark.x + mark.width / 2, y: mark.y + markH / 2 };
    var windX = focus.x + (focus.x - home.x) * 0.05 - mark.width * wind / 2;
    var windY = focus.y + (focus.y - home.y) * 0.05 - markH * wind / 2;

    L = {
      W: W, H: H, dpr: dpr,
      left: mark.x, right: W - mark.x, headY: headY, bottom: bottom,
      m: m,
      kicker: Math.round(Math.max(14, Math.min(18, W * 0.0125))),
      wide: W >= 896,
      mark: mark,
      fold: fold,
      // The name's width as the finale first sets it (two lines on phones)
      nameWidth: width,
      // Wordmark states as (x, y) of the mark's box and a scale relative to the real wordmark
      base: { x: center.x - 3 * m, y: center.y - 3 * m, s: base },
      big: { x: center.x - width * big / 2, y: center.y - markH * big / 2, s: big },
      wind: { x: windX, y: windY, s: wind },
      target: { x: mark.x, y: mark.y, s: 1 },
      focus: focus,
      // The slam stretches the wordmark along the way it travels
      slamAcross: Math.abs(mark.x - windX) >= Math.abs(mark.y - windY),
      // One unit and one module of the mark at centre stage, and where its bars stand
      u: mark.unit * base,
      module: MODULE * mark.unit * base,
      ground: center.y - 3 * m + 22 * mark.unit * base,
      cell: Math.max(24, Math.round(Math.min(W, H) / 14)),
      marquee: Math.round(Math.min(H * 0.3, W * 0.2)),
      // Each scene as it starts to leave, drawn once for its exit (see snapshot)
      snaps: []
    };
    L.scenes = SCENES.map(sceneLayout);
  }

  function sceneLayout(scene) {
    var width = L.right - L.left;
    var avail = L.bottom - L.headY;
    var fit = fitSentence(scene.words, width, avail * 0.42, Math.min(L.W * 0.12, 120));
    var height = fit.lines.length * fit.size * LINE_HEIGHT;
    var head = L.headY + L.kicker * (L.wide ? 2 : 3.4);
    var gap = Math.max(16, L.m * 0.5);
    var area = { x: L.left, y: head, w: width, h: Math.max(0, L.bottom - height - gap - head) };
    ctx.font = '700 ' + L.marquee + 'px ' + FONT;
    return {
      fit: fit,
      top: L.bottom - height,
      area: area,
      focus: { x: area.x + area.w / 2, y: area.y + area.h / 2 },
      marqueeWidth: ctx.measureText(scene.marquee).width
    };
  }

  /* ---------- Posing glyphs: one letter at a time ---------- */

  // A pose: offset, scale about a point oy above the baseline, a turn and an opacity. One
  // shared object, reset for each use, so drawing a frame allocates nothing for it.
  var P = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, oy: 0, a: 1 };

  function pose() {
    P.dx = P.dy = P.rot = P.oy = 0;
    P.sx = P.sy = P.a = 1;
    return P;
  }

  // A glyph at the current pose; x is its left edge, y its baseline
  function drawPosed(ch, x, y, w) {
    if (P.a <= 0 || !P.sx || !P.sy) return;
    var alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * Math.min(1, P.a);
    if (P.sx === 1 && P.sy === 1 && !P.rot) {
      ctx.fillText(ch, x + P.dx, y + P.dy);
    } else {
      ctx.save();
      ctx.translate(x + w / 2 + P.dx, y + P.dy - P.oy);
      if (P.rot) ctx.rotate(P.rot);
      ctx.scale(P.sx, P.sy);
      ctx.fillText(ch, -w / 2, P.oy);
      ctx.restore();
    }
    ctx.globalAlpha = alpha;
  }

  // How a letter comes in, s seconds after its cue; box is its line's height. Sets the shared
  // pose and returns it, or null while the letter is not there yet.
  function letterIn(style, s, i, box) {
    var p = pose();
    if (style === 'slam') {
      // From the camera: huge and faint, down to size, squashing as it lands on the cue
      if (s <= -0.14) return null;
      if (s < 0) {
        var k = 1 - expoOut(1 + s / 0.14);
        p.sx = p.sy = 1 + 1.1 * k;
        p.oy = box * 0.35 * k;
        p.a = clamp01((s + 0.14) / 0.04);
      } else {
        var q = squash(s, 0.2);
        p.sx = q.sx;
        p.sy = q.sy;
      }
      return p;
    }
    if (style === 'drop') {
      // Falls from above onto the cue, squashes and bounces once
      if (s <= -0.2) return null;
      if (s < 0) {
        var f = 1 + s / 0.2;
        p.dy = -box * 2.2 * (1 - f * f);
        p.sy = 1 + 0.3 * f;
        p.sx = 1 / p.sy;
      } else {
        var d = squash(s, 0.25);
        p.dy = -box * 0.14 * bump(s, 0.16);
        p.sx = d.sx;
        p.sy = d.sy;
      }
      p.a = clamp01((s + 0.2) / 0.04);
      return p;
    }
    if (s <= 0) return null;
    if (style === 'rise') {
      // The site's entrance: up from behind its own line, overshooting a little
      p.dy = (1 - backOut(clamp01(s / 0.32))) * box;
    } else if (style === 'converge') {
      var c = 1 - spring(s, 3.4, 0.45);
      var angle = i * 2.4 + 0.7;
      p.dx = Math.cos(angle) * box * 1.3 * c;
      p.dy = Math.sin(angle) * box * 1.3 * c;
      p.rot = c * (i % 2 ? 0.5 : -0.5);
      p.a = clamp01(s / 0.06);
    } else if (style === 'spin') {
      // Turns in like a drill bit, a turn and a quarter
      p.sx = Math.cos((1 - expoOut(clamp01(s / 0.4))) * 2.5 * Math.PI);
    } else if (style === 'zip') {
      p.dx = -L.W * 0.45 * (1 - spring(s, 3, 0.55));
      p.a = clamp01(s / 0.04);
    }
    return p;
  }

  // A run whose letters rise from behind their line one after another, s seconds after the cue
  function drawRiseLetters(r, x, y, s, color) {
    if (s <= 0) return;
    var box = r.ascent + r.descent;
    var masked = s < 0.34 + r.glyphs.length * 0.014;
    if (masked) {
      ctx.save();
      clipRect(x - r.size * 0.2, y - r.ascent - box * 0.3, r.width + r.size * 0.4, box * 1.3);
    }
    ctx.font = r.font;
    ctx.fillStyle = color;
    for (var i = 0; i < r.glyphs.length; i++) {
      var g = r.glyphs[i];
      if (g.ch === ' ' || g.ch === ' ' || !letterIn('rise', s - i * 0.014, i, box)) continue;
      drawPosed(g.ch, x + g.x, y, g.w);
    }
    if (masked) ctx.restore();
  }

  /* ---------- Secondary motion: the dot field, the marquee, the camera ---------- */

  // The dot field's two layers: spacing (in cells), dot size, opacity and drift in px/s
  var FIELD = [{ gap: 1.8, dot: 2, alpha: 0.14, vx: 11, vy: 6 }, { gap: 3, dot: 1.4, alpha: 0.09, vx: 26, vy: 13 }];

  // Two parallax layers of dots drifting on the module grid, the only linear motion. On every
  // beat a ripple runs out from the focal point (fx, fy) and the dots it passes swell. Each dot
  // is its own rectangle: the canvas batches those far more cheaply than one long path.
  function drawField(t, fx, fy, color) {
    var since = sinceBeat(t);
    var front = since * Math.max(L.W, L.H) * 2.2;
    var swell = 2.2 * (1 - since / BEAT);
    for (var n = 0; n < (lite ? 1 : 2); n++) {
      var f = FIELD[n];
      var gap = L.cell * f.gap;
      var ox = (t * f.vx) % gap;
      var oy = (t * f.vy) % gap;
      ctx.fillStyle = css(color, f.alpha);
      for (var y = oy - gap; y < L.H + gap; y += gap) {
        for (var x = ox - gap; x < L.W + gap; x += gap) {
          var w = (Math.sqrt((x - fx) * (x - fx) + (y - fy) * (y - fy)) - front) / (L.cell * 1.5);
          var size = f.dot * (1 + swell * Math.exp(-w * w));
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    }
  }

  // The scene's own words, huge and faint, crossing the background; extra adds distance
  function drawMarquee(scene, info, tau, extra) {
    if (lite) return;
    var w = info.marqueeWidth;
    var off = ((tau * L.marquee * 0.8 + extra) % w + w) % w;
    ctx.font = '700 ' + L.marquee + 'px ' + FONT;
    ctx.fillStyle = css(C.chalk, 0.05);
    var y = L.H * 0.5 + L.marquee * 0.36;
    for (var x = scene.drift < 0 ? -off : off - w; x < L.W; x += w) ctx.fillText(scene.marquee, x, y);
  }

  // Impacts move the camera: [time, shake in px, zoom punch]
  var HITS = [[FIRST_SCENE, 0, 0.03], [at(10.5), 5, 0.03], [at(12), 0, 0.03], [at(14.5), 0, 0.02],
    [at(18), 8, 0.04], [at(20), 0, 0.03], [at(26), 6, 0.03], [FINALE, 4, 0.03], [LANDING, 3, 0]];
  // The countdown, faster each time: [time, which bar punches (-1: all), how close the camera cuts in]
  var COUNT = [[at(30), 2, 1.04], [at(30.5), 1, 1.08], [at(30.75), 0, 1.12], [at(30.875), -1, 1.16]];

  // Applies the camera for time t: the hits' shake and zoom punches, and the countdown's cuts,
  // which close in on the wordmark and come back out as it slams home. Still once settled.
  function camera(t) {
    if (t >= SETTLED) return;
    var h = held(t);
    var x = 0, y = 0, zoom = 1, fx = L.W / 2, fy = L.H / 2;
    for (var i = 0; i < HITS.length; i++) {
      var s = (HITS[i][0] > FREEZE ? t : h) - HITS[i][0];
      if (s < 0 || s > 0.5) continue;
      var d = Math.exp(-s / 0.07);
      x += HITS[i][1] * d * Math.sin(s * 110 + i);
      y += HITS[i][1] * d * Math.cos(s * 83 + 2 * i);
      zoom += HITS[i][2] * Math.exp(-s / 0.1);
    }
    var cut = 1;
    for (var c = 0; c < COUNT.length; c++) if (h >= COUNT[c][0]) cut = COUNT[c][2];
    if (cut !== 1) {
      zoom *= lerp(cut, 1, expoIn(phase(t, SLAM, S8)));
      fx = L.focus.x;
      fy = L.focus.y;
    }
    ctx.translate(fx + x * calm(t), fy + y * calm(t));
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);
  }

  /* ---------- Stone: the seed and the mark between scenes ---------- */

  function barRect(state, i) {
    var b = BARS[i];
    var u = state.s * L.mark.unit;
    return { x: state.x + b.x * u, y: state.y + b.y * u, w: b.w * u, h: b.h * u };
  }

  function barColor(i) {
    return mix(C.stone, C.ink, BARS[i].alpha);
  }

  // Bar i of a mark whose box is at (x, y) with unit u, risen to rise of its height, scaled
  // about its foot and lifted by dy
  function drawBar(x, y, u, i, rise, sx, sy, dy, color) {
    var b = BARS[i];
    var w = b.w * u * sx;
    var h = b.h * u * rise * sy;
    if (w > 0 && h > 0) fillBox(x + (b.x + b.w / 2) * u - w / 2, y + (b.y + b.h) * u - h + dy, w, h, color);
  }

  // When each bar is back after its scene: dropped in from above (landing on b11.5), landed
  // by its scene's collapse (b19.5), popped up a module short (b27.5)
  var BACK = [at(11.25), at(19.5), at(27.5)];

  // The bars on stage: stamped up in the seed, each crouching before it opens into its scene,
  // gone while the scene plays, and back afterwards. The mark crouches before the module lands.
  function drawStageMark(t) {
    for (var i = 0; i < BARS.length; i++) {
      var stamp = at(i + 1);
      var open = FIRST_SCENE + i * SCENE_LEN;
      if (t < stamp || (t >= open && t < BACK[i])) continue;
      var rise = 1, sy = 1, dy = 0;
      if (t < open) {
        rise = spring(t - stamp, 3.2, 0.38);
        sy = 1 - 0.2 * expoOut(phase(t, open - S16, S16));
      } else if (i === 0) {
        var f = phase(t, BACK[0], S16);
        dy = -L.H * (1 - f * f);
        sy = f < 1 ? stretchFor(2 * f * L.H / S16 / (BARS[0].h * L.u)) : squash(t - at(11.5), 0.25).sy;
      } else if (i === 1) {
        sy = squash(t - BACK[1], 0.28).sy;
      } else {
        rise = 0.8 * spring(t - BACK[2], 5, 0.5);
      }
      sy *= 1 - 0.12 * expoOut(phase(t, at(27.75), S16));
      drawBar(L.base.x, L.base.y, L.u, i, rise, 1 / sy, sy, dy, css(C.ink, BARS[i].alpha));
    }
  }

  // The loader's track, redrawn: it bursts out from where the module lands, overshoots the
  // container and settles, then (tugging outward first) snaps into the mark as the module dives
  function drawSeedLine(t) {
    if (t < at(0.5)) return;
    var mid = L.base.x + MARK_BOX * L.u / 2;
    var reach = spring(t - at(0.5), 2.2, 0.55);
    var back = backIn(phase(t, at(3.5), S8));
    var x1 = lerp(mid - reach * (mid - L.left), L.base.x, back);
    var x2 = lerp(mid + reach * (L.right - mid), L.base.x + MARK_BOX * L.u, back);
    if (x2 > x1) hairline(x1, L.ground, x2, L.ground, css(C.ink));
  }

  /* ---------- The module: the sea-light square that plays the lead ---------- */

  // A throw from (x0, y0) to (x1, y1) rising h above the straight line; y is the module's foot
  function arc(x0, y0, x1, y1, h, p, size) {
    return { x: lerp(x0, x1, (1 - Math.cos(Math.PI * p)) / 2), y: lerp(y0, y1, p) - h * 4 * p * (1 - p), size: size };
  }

  // Where the module is while it is on its own: in the seed, from IterMath to BSQ, and falling
  // onto the mark before the finale. The rest of the time it is in a scene or in the mark.
  function modulePath(t) {
    var m = L.module, u = L.u, g = L.ground;
    var xs = BARS.map(function (b) { return L.base.x + (b.x + b.w / 2) * u; });
    var mid = L.base.x + MARK_BOX * u / 2;
    var apex = g - m * 6;
    if (t < at(0.5)) return { x: mid, y: lerp(-m, g, Math.pow(t / at(0.5), 2)), size: m };
    if (t < at(0.75)) return { x: mid, y: g, size: m };
    if (t < at(1)) return arc(mid, g, xs[0], g, m * 1.2, phase(t, at(0.75), S16), m);
    if (t < at(3)) {
      var leg = Math.floor(t / BEAT) - 1;
      return arc(xs[leg], g, xs[leg + 1], g, m * 3, phase(t, at(leg + 1), BEAT), m);
    }
    if (t < at(3.25)) {
      var r = phase(t, at(3), S16);
      return { x: lerp(xs[2], mid, r), y: lerp(g, apex, 1 - (1 - r) * (1 - r)), size: m };
    }
    if (t < FIRST_SCENE) {
      var d = phase(t, at(3.25), at(0.75));
      return { x: lerp(mid, xs[0], d), y: lerp(apex, g - BARS[0].h * u * 0.8, d * d), size: m };
    }
    var bar3 = g - BARS[2].h * u * 0.8;
    if (t >= at(19.25) && t < at(20)) {
      var from = pickedTile();
      return arc(from.x, from.y, xs[2], bar3, L.H * 0.2, phase(t, at(19.25), at(0.75)), m);
    }
    if (t >= at(20) && t < at(20.5)) {
      var R = routeGeometry(L.scenes[2].area);
      var stop = R.point(0);
      var q = phase(t, at(20), S8);
      return arc(xs[2], bar3, stop.x, stop.y + R.stop * 1.1, L.H * 0.12, q, lerp(m, R.stop * 2.2, q));
    }
    if (t >= at(27.5) && t < FINALE) {
      return { x: xs[2], y: lerp(-m, g - 16 * u * 0.88, Math.pow(phase(t, at(27.5), S8), 2)), size: m };
    }
    return null;
  }

  // Where it hits something: [time, how hard]
  var CONTACTS = [[at(0.5), 0.35], [at(1), 0.3], [at(2), 0.3], [at(3), 0.3], [at(20), 0.3]];

  function drawModule(t) {
    var a = modulePath(t);
    if (!a) return;
    var b = modulePath(t - 1 / 120) || a;
    var vx = (a.x - b.x) * 120 / a.size;
    var vy = (a.y - b.y) * 120 / a.size;
    var k = stretchFor(Math.max(Math.abs(vx), Math.abs(vy)));
    var sx = Math.abs(vx) > Math.abs(vy) ? k : 1 / k;
    var sy = 1 / sx;
    for (var i = 0; i < CONTACTS.length; i++) {
      var q = squash(t - CONTACTS[i][0], CONTACTS[i][1]);
      sx *= q.sx;
      sy *= q.sy;
    }
    fillBox(a.x - a.size * sx / 2, a.y - a.size * sy, a.size * sx, a.size * sy, css(C['sea-light']));
  }

  /* ---------- The finale: name, countdown, pause, slam, landing, wink ---------- */

  // The wordmark's pose: (x, y) of the mark's box, scale s relative to the real wordmark, and
  // how far a two-line name is still folded. It hops aside (b28.5), winds up (b30.5–b31),
  // holds through the pause and slams home in an eighth, scaling geometrically.
  function finalePose(t) {
    if (t >= LANDING) return { x: L.target.x, y: L.target.y, s: 1, foldX: 0, foldY: 0 };
    if (t >= SLAM) {
      var p = expoIn(phase(t, SLAM, S8));
      return {
        x: lerp(L.wind.x, L.target.x, p),
        y: lerp(L.wind.y, L.target.y, p),
        s: L.wind.s * Math.pow(1 / L.wind.s, p),
        foldX: 0,
        foldY: 0
      };
    }
    var hop = ease(phase(t, at(28.5), S16));
    var wind = expoOut(phase(t, at(30.5), S8));
    var s = L.base.s * Math.pow(L.big.s / L.base.s, hop);
    var x = lerp(L.base.x, L.big.x, hop);
    var y = lerp(L.base.y, L.big.y, hop) - L.module * 2 * bump(t - at(28.5), S16);
    return {
      x: lerp(x, L.wind.x, wind),
      y: lerp(y, L.wind.y, wind),
      s: s * Math.pow(L.wind.s / s, wind),
      foldX: L.fold.on * (1 - ease(phase(t, at(30.5), S16))),
      foldY: L.fold.on * (1 - ease(phase(t, at(30.75), S16)))
    };
  }

  // The whole wordmark's squash and stretch: the module's landing, the crouch and hop aside,
  // the wind-up crouch, the stretch of the slam and the squash of the final hit
  function finaleSquash(t, h) {
    if (t >= SETTLED) return { sx: 1, sy: 1 };
    var sy = (1 - 0.22 * ring(h - FINALE, 5, 0.32)) * (1 - 0.18 * ring(h - at(28.75), 5, 0.32));
    if (h < at(28.5)) sy *= 1 - 0.15 * expoOut(phase(h, at(28.25), S16));
    sy *= 1 + 0.15 * bump(h - at(28.5), S16);
    sy *= 1 - 0.1 * expoOut(phase(h, at(30.5), S8)) * (1 - expoIn(phase(t, SLAM, S8)));
    var sx = 1 / sy;
    if (t >= SLAM && t < LANDING) {
      var k = 1 + 0.3 * expoIn(phase(t, SLAM, S8));
      if (L.slamAcross) { sx *= k; sy /= k; } else { sy *= k; sx /= k; }
    }
    if (t >= LANDING) {
      var q = 1 - 0.16 * ring(t - LANDING, 6, 0.38) * calm(t);
      sy *= q;
      sx /= q;
    }
    return { sx: sx, sy: sy };
  }

  function drawWordmark(state, t, h, alpha) {
    var wm = L.mark;
    var q = finaleSquash(t, h);
    var cx = wm.width / 2, cy = MARK_BOX * wm.unit / 2;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(state.x, state.y);
    ctx.scale(state.s, state.s);
    ctx.translate(cx, cy);
    ctx.scale(q.sx, q.sy);
    ctx.translate(-cx, -cy);
    drawFinaleMark(t, h);
    if (h > at(29)) drawName(state, h);
    ctx.restore();
  }

  // How far the countdown has punched bar i up
  function punch(h, i) {
    var sy = 1;
    for (var c = 0; c < COUNT.length; c++) {
      if (COUNT[c][1] === i || COUNT[c][1] < 0) sy *= 1 + 0.3 * ring(h - COUNT[c][0], 7, 0.45);
    }
    return sy;
  }

  // The mark in its own CSS pixels. The countdown punches the bars up one after another; bar 3
  // is four modules of ink with the module on top.
  function drawFinaleMark(t, h) {
    var u = L.mark.unit;
    for (var i = 0; i < BARS.length; i++) drawBar(0, 0, u, i, i === 2 ? 0.8 : 1, 1, punch(h, i), 0, css(C.ink, BARS[i].alpha));
    drawCap(t, h, u, punch(h, 2));
  }

  // The module on bar 3: sea-light until it sinks in (b30.875), then ink like the rest of the
  // bar. Once the wordmark has landed it winks: sea-light, shut and open, and ink again.
  function drawCap(t, h, u, sy) {
    var b = BARS[2];
    var size = MODULE * u * sy;
    var centre = (b.y + b.h) * u - 16 * u * sy - size / 2;
    var tone = 1 - phase(h, at(30.875), S32);
    var shut = 0;
    // b32.25 to the moment everything has settled
    var wink = t - at(32.25);
    var blink = SETTLED - at(32.25);
    if (wink > 0 && wink < blink) {
      tone = bump(wink, blink);
      shut = 0.85 * tone;
    }
    var height = size * (1 - shut);
    fillBox(b.x * u, centre - height / 2, b.w * u, height, css(mix(C.ink, C['sea-light'], tone)));
  }

  // The name exactly as the masthead sets it, each glyph where the browser put it, in the
  // wordmark's own CSS pixels. "Jonathan" rises in a fast wave, "Montolalu" slams in from the
  // camera; a hop runs along it at the start of the countdown. foldX and foldY at 1 stand the
  // surname under the first name; at 0 the name is one line.
  function drawName(state, h) {
    var wm = L.mark;
    ctx.font = wm.font;
    ctx.fillStyle = css(C.ink);
    for (var i = 0; i < wm.glyphs.length; i++) {
      var g = wm.glyphs[i];
      if (g.ch === ' ') continue;
      var surname = i > wm.split;
      var x = g.x + (surname ? state.foldX * L.fold.dx : 0);
      var y = wm.baseline + state.foldY * (surname ? L.fold.lead : -L.fold.lead);
      var hop = -wm.height * 0.25 * bump(h - at(30) - i * 0.018, 0.16);
      if (!surname) {
        var s = h - at(29) - i * 0.03;
        if (s <= 0) continue;
        var rise = 1 - backOut(clamp01(s / 0.3));
        if (!rise) {
          ctx.fillText(g.ch, x, y + hop);
          continue;
        }
        ctx.save();
        clipRect(x - 2, y - wm.baseline + wm.top - wm.height * 0.3, g.w + 4, wm.height * 1.3);
        ctx.fillText(g.ch, x, y + rise * wm.height);
        ctx.restore();
        continue;
      }
      var cue = at(29.5) + (i - wm.split - 1) * 0.03;
      if (!lite && h - cue < 0.02) {
        for (var k = TRAIL; k >= 1; k--) {
          if (!letterIn('slam', h - cue - k * 0.022, i, wm.height)) continue;
          P.a *= 0.12 * (TRAIL + 1 - k);
          drawPosed(g.ch, x, y, g.w);
        }
      }
      if (!letterIn('slam', h - cue, i, wm.height)) continue;
      P.dy += hop;
      drawPosed(g.ch, x, y, g.w);
    }
  }

  // Three sea-light dots circle the wordmark, faster with each step of the build: [from, rad/s]
  var ORBIT = [[FINALE, 2.4], [at(29), 3.6], [at(29.5), 5], [at(30), 7.5], [at(30.5), 10],
    [at(30.75), 14], [at(30.875), 18]];

  // They freeze in the pause and are drawn into the wordmark as it slams home
  function drawOrbit(t, h, state) {
    if (t >= LANDING) return;
    var angle = 0;
    for (var k = 0; k < ORBIT.length; k++) {
      var end = k + 1 < ORBIT.length ? ORBIT[k + 1][0] : Infinity;
      if (h > ORBIT[k][0]) angle += ORBIT[k][1] * (Math.min(h, end) - ORBIT[k][0]);
    }
    var markH = MARK_BOX * L.mark.unit * state.s;
    var width = (h < at(29) ? MARK_BOX * L.mark.unit : (state.foldY > 0.5 ? L.nameWidth : L.mark.width)) * state.s;
    var pull = 1 - expoIn(phase(t, SLAM, S8));
    var cx = state.x + width / 2, cy = state.y + markH / 2;
    var size = Math.max(3, L.module * 0.14);
    for (var n = 0; n < 3; n++) {
      var a = angle + n * 2 * Math.PI / 3;
      var x = cx + Math.cos(a) * (width * 0.5 + markH * 0.5) * pull;
      var y = cy + Math.sin(a) * markH * 0.95 * pull;
      fillBox(x - size / 2, y - size / 2, size, size, css(C['sea-light']));
    }
  }

  function drawFinale(t, h) {
    var state = finalePose(t);
    drawOrbit(t, h, state);
    // The slam leaves a trail
    if (!lite && t >= SLAM && t < LANDING) {
      for (var k = TRAIL; k >= 1; k--) {
        if (t - k * 0.03 >= SLAM) drawWordmark(finalePose(t - k * 0.03), t, h, 0.15 * (TRAIL + 1 - k));
      }
    }
    drawWordmark(state, t, h, 1 - phase(t, HANDOVER, HANDOVER_LEN));
    if (t >= LANDING) {
      var s = phase(t, LANDING, 0.35);
      var markH = MARK_BOX * L.mark.unit;
      var grow = lerp(0, markH * 2.5, expoOut(s));
      drawFrame(L.target.x + L.mark.width / 2, L.target.y + markH / 2, L.mark.width + grow * 2, markH + grow, 1 - s);
    }
  }

  // The landing breaks the cover into modules that clear outward from the wordmark. The
  // wavefront glows sea-light and fades as each module shrinks away, like the stage's ripple.
  function drawLandingCells(t) {
    var c = L.cell;
    var ox = L.target.x + MARK_BOX * L.mark.unit / 2;
    var oy = L.target.y + MARK_BOX * L.mark.unit / 2;
    var reach = Math.sqrt(Math.pow(Math.max(ox, L.W - ox), 2) + Math.pow(Math.max(oy, L.H - oy), 2));
    for (var y = 0; y < L.H; y += c) {
      for (var x = 0; x < L.W; x += c) {
        var cx = x + c / 2, cy = y + c / 2;
        var d = Math.sqrt((cx - ox) * (cx - ox) + (cy - oy) * (cy - oy));
        var q = phase(t, LANDING + WAVE * d / reach, CELL_LIFE);
        if (q >= 1) continue;
        var glow = 0.6 * Math.min(1, q * 6) * (1 - q);
        var size = c * (1 - easeInCubic(q));
        fillBox(cx - size / 2, cy - size / 2, size, size, css(mix(C.stone, C['sea-light'], glow)));
      }
    }
  }

  // Stone, with whatever is on it: the seed, the mark between scenes, or the finale
  function drawStage(t) {
    var h = held(t);
    if (t >= LANDING) {
      ctx.clearRect(0, 0, L.W, L.H);
      drawLandingCells(t);
    } else {
      fillBox(0, 0, L.W, L.H, css(C.stone));
    }
    ctx.save();
    camera(t);
    if (t < FINALE) {
      drawField(h, L.base.x + MARK_BOX * L.u / 2, L.base.y + MARK_BOX * L.u / 2, C.ink);
      if (t < FIRST_SCENE) drawSeedLine(t);
      drawStageMark(t);
    } else {
      if (t < LANDING) drawField(h, L.focus.x, L.focus.y, C.ink);
      drawFinale(t, h);
    }
    ctx.restore();
  }

  /* ---------- Project scenes: each bar opens into one project and closes again ---------- */

  // The graphic steps back (smaller, higher, dimmer) once the sentence starts
  function stepBack(tau) { return spring(tau - at(4), 2.6, 0.5); }

  // One project scene, full screen: petrol, the dot field and marquee, header, graphic and
  // sentence. tone (0–1) turns the fill toward its bar's colour and fades the rest.
  function drawSceneLayer(i, tau, t, tone) {
    var info = L.scenes[i];
    var a = info.area;
    fillBox(0, 0, L.W, L.H, css(tone ? mix(C.petrol, barColor(i), tone) : C.petrol));
    ctx.save();
    ctx.globalAlpha = 1 - tone;
    camera(t);
    drawField(held(t), info.focus.x, info.focus.y, C.chalk);
    drawMarquee(SCENES[i], info, tau, i === 2 ? shuttleAt(tau) * L.W * 0.3 : 0);
    drawHeader(SCENES[i], tau);
    var k = stepBack(tau);
    var s = 1 - 0.34 * k;
    var cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    ctx.save();
    ctx.translate(cx, cy - a.h * 0.1 * k);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha *= 1 - 0.58 * k;
    SCENES[i].graphic(tau, a);
    ctx.restore();
    drawSentence(i, tau, t);
    ctx.restore();
  }

  function drawHeader(scene, tau) {
    var k = textRun(scene.kicker, 500, L.kicker, 0);
    var m = textRun(scene.meta, 500, L.kicker, 0);
    var y = L.headY + k.cap / 2;
    var color = css(C.chalk, 0.72);
    drawRiseLetters(k, L.left, y, tau - S8, color);
    if (L.wide) drawRiseLetters(m, L.right - m.width, y, tau - S8 - S16, color);
    else drawRiseLetters(m, L.left, y + L.kicker * 1.5, tau - S8 - S16, color);
  }

  // The sentence, word by word on its cues. Landed letters sway gently in a travelling wave,
  // and a ripple can run out from one word: a wave along the line, or the jolt of a hard landing.
  function drawSentence(i, tau, t) {
    var scene = SCENES[i];
    var info = L.scenes[i];
    var fit = info.fit;
    var lh = fit.size * LINE_HEIGHT;
    var sway = held(t) * Math.PI / BEAT;
    var ripple = scene.ripple;
    var source = ripple ? scene.words[ripple[1]] : null;
    var origin = 0;
    fit.lines.forEach(function (line) {
      line.items.forEach(function (item) {
        if (item.word === source) origin = L.left + item.x + (source[2] === 'stick' ? item.run.width / 2 : 0);
      });
    });
    function lift(x, word) {
      var dy = fit.size * 0.012 * Math.sin(sway - x * 0.01);
      if (ripple && !(word === source && word[2] === 'stick')) {
        dy -= fit.size * 0.18 * bump(tau - at(ripple[0]) - Math.abs(x - origin) / L.W * 0.3, 0.2);
      }
      return dy;
    }
    for (var li = 0; li < fit.lines.length; li++) {
      var line = fit.lines[li];
      for (var wi = 0; wi < line.items.length; wi++) {
        var item = line.items[wi];
        var r = item.run;
        var y = info.top + li * lh + (lh - r.ascent - r.descent) / 2 + r.ascent;
        var x = L.left + item.x;
        var s = tau - at(item.word[1]);
        var color = css(item.word[3] ? C['sea-light'] : C.chalk);
        if (WHOLE[item.word[2]]) drawWholeWord(item, x, y, s, color, lift(x + r.width / 2, item.word));
        else drawLetters(item, x, y, s, color, lift);
      }
    }
  }

  function drawLetters(item, x, y, s, color, lift) {
    var r = item.run;
    var style = item.word[2];
    var box = r.ascent + r.descent;
    var stagger = STAGGER[style];
    if (s <= -0.2) return;
    var masked = style === 'rise' && s < 0.34 + stagger * r.glyphs.length;
    if (masked) {
      ctx.save();
      clipRect(x - r.size * 0.2, y - r.ascent - box * 0.3, r.width + r.size * 0.4, box * 1.3);
    }
    var trail = !lite && style === 'zip' && s < 0.5;
    ctx.font = r.font;
    ctx.fillStyle = color;
    for (var i = 0; i < r.glyphs.length; i++) {
      var g = r.glyphs[i];
      var cue = s - i * stagger;
      if (trail) {
        for (var k = TRAIL; k >= 1; k--) {
          if (!letterIn(style, cue - k * 0.022, i, box)) continue;
          P.a *= 0.12 * (TRAIL + 1 - k);
          drawPosed(g.ch, x + g.x, y, g.w);
        }
      }
      if (!letterIn(style, cue, i, box)) continue;
      P.dy += lift(x + g.x, item.word);
      drawPosed(g.ch, x + g.x, y, g.w);
    }
    if (masked) ctx.restore();
  }

  // Whole-word moves for the accents, s seconds after the cue, which is the moment of impact:
  // slam (in from the camera), stick (hangs and wobbles, pulls up, slams down and stops dead)
  // and arrive (rushes in from the right and halts). Sets the shared pose; null before it shows.
  function wordIn(style, s, x, box) {
    var p = pose();
    if (s <= -WHOLE[style]) return null;
    if (style === 'slam') {
      if (s < 0) {
        var k = 1 - expoOut(1 + s / WHOLE.slam);
        p.sx = p.sy = 1 + 1.1 * k;
        p.oy = box * 0.35 * k;
        p.a = clamp01((s + WHOLE.slam) / 0.05);
      } else {
        var q = squash(s, 0.22);
        p.sx = q.sx;
        p.sy = q.sy;
      }
    } else if (style === 'stick') {
      if (s < -S16) {
        var hang = (s + S8) / S16;
        p.dy = -box * 0.9;
        p.sx = p.sy = backOut(clamp01(hang * 1.2));
        p.oy = box * 0.35;
        p.rot = 0.06 * Math.sin(hang * 4.6) * (1 - hang);
      } else if (s < 0) {
        var u = 1 + s / S16;
        p.dy = -box * 0.9 * (1 - backIn(u));
        p.sy = 1 + 0.35 * u * u;
        p.sx = 1 / p.sy;
      } else {
        p.sy = 1 - 0.38 * (1 - expoOut(clamp01(s / 0.09)));
        p.sx = 1 / p.sy;
      }
    } else if (s < 0) {
      var v = 1 + s / WHOLE.arrive;
      p.dx = (L.W - x) * (1 - expoIn(v));
      p.sx = 1 + 0.5 * v * v * v;
      p.sy = 1 / p.sx;
    } else {
      p.sx = 1 - 0.28 * ring(s, 6, 0.4) - 0.08 * ring(s - S32, 6, 0.4);
      p.sy = 1 / p.sx;
    }
    return p;
  }

  // An accent word: a trail while it travels, a chromatic split as it hits, and for the slam a
  // sea-light frame bursting from it. The full stop of "catch." arrives a 32nd late.
  function drawWholeWord(item, x, y, s, color, lift) {
    var r = item.run;
    var style = item.word[2];
    var box = r.ascent + r.descent;
    var ax = style === 'arrive' ? x : x + r.width / 2;
    var n = r.glyphs.length;
    var body = style === 'arrive' ? n - 1 : n;
    function place(ss, dx, col, alpha, from, to) {
      if (!wordIn(style, ss, x, box)) return;
      ctx.save();
      ctx.globalAlpha *= alpha * Math.min(1, P.a);
      ctx.translate(ax + P.dx + dx, y + P.dy + lift - P.oy);
      if (P.rot) ctx.rotate(P.rot);
      ctx.scale(P.sx, P.sy);
      ctx.translate(-ax, P.oy - y);
      ctx.font = r.font;
      ctx.fillStyle = col;
      for (var i = from; i < to; i++) {
        if (r.glyphs[i].ch !== ' ') ctx.fillText(r.glyphs[i].ch, x + r.glyphs[i].x, y);
      }
      ctx.restore();
    }
    // ("sticks." only trails once it drops; before that it hangs in place)
    if (!lite && s > (style === 'stick' ? -S16 : -WHOLE[style]) && s < 0.02) {
      for (var k = TRAIL; k >= 1; k--) place(s - k * 0.022, 0, color, 0.12 * (TRAIL + 1 - k), 0, n);
    }
    if (!lite && s >= 0 && s < 0.2) {
      var d = 7 * Math.exp(-s / 0.06);
      place(s, -d, css(C.chalk), 0.5, 0, n);
      place(s, d, css(C['sea-light']), 0.5, 0, n);
    }
    place(s, 0, color, 1, 0, body);
    if (body < n) place(s - S32, 0, color, 1, body, n);
    if (style === 'slam' && s >= 0) {
      var f = clamp01(s / 0.35);
      drawFrame(x + r.width / 2, y - r.cap / 2, r.width + box * 1.6 * expoOut(f), box * (1 + 1.6 * expoOut(f)), 1 - f);
    }
  }

  /* MangARTI: one word, "you", in three spellings. Ngana loses an a (Ngna), then the other
     a and its capital (ngn). Each letter keeps its identity across the three layouts. */
  var SPELLINGS = [
    { text: 'Ngana', map: [0, 1, 2, 3, 4] },
    { text: 'Ngna', map: [0, 1, -1, 2, 3] },
    { text: 'ngn', map: [0, 1, -1, 2, -1] }
  ];
  var CHANGES = [at(2), at(3)];
  // The a knocked out at each change
  var KNOCKED = [2, 4];

  function drawSpellings(tau, area) {
    var probe = textRun('Ngana', 700, 100, TRACK_DISPLAY);
    var size = Math.floor(Math.min(area.h * 0.6, area.w * 0.86 / (probe.width / 100), 260));
    var forms = SPELLINGS.map(function (f) { return textRun(f.text, 700, size, TRACK_DISPLAY); });
    var caption = textRun('One word, “you”, in three spellings', 500, Math.round(L.kicker * 1.15), 0);
    var a = forms[0];
    var box = a.ascent + a.descent;
    var cx = area.x + area.w / 2;
    var y = area.y + (area.h - caption.size * 1.8) / 2 + a.cap / 2;

    function xIn(f, k) {
      var j = SPELLINGS[f].map[k];
      return j < 0 ? null : cx - forms[f].width / 2 + forms[f].glyphs[j].x;
    }

    // Letter k at time s: slammed in on its 16th, closing up on springs (a 16th apart) after
    // each change, or trembling and knocked out; jolted when a neighbour lands, hopping on
    // b6.5, a wave on b7.5, and a gentle sway. Sets the shared pose and returns the letter's x.
    function place(k, s) {
      if (!letterIn('slam', s - S8 - k * S16, k, box)) return null;
      var x = xIn(0, k);
      for (var c = 0; c < CHANGES.length; c++) {
        var next = xIn(c + 1, k);
        if (next !== null) x = lerp(x, next, spring(s - CHANGES[c] - Math.max(0, k - KNOCKED[c] - 1) * S16, 3.4, 0.45));
      }
      var out = KNOCKED.indexOf(k);
      if (out >= 0) {
        var gone = s - CHANGES[out];
        if (gone > -S16 && gone < 0) P.dx += Math.sin(s * 95) * size * 0.015;
        if (gone >= 0) {
          P.dy += box * (-3 * gone + 30 * gone * gone);
          P.rot = gone * (out ? -7 : 7);
          P.a *= 1 - phase(gone, 0.35, 0.2);
        }
      }
      for (var j = k + 1; j < SPELLINGS[0].text.length; j++) P.dy -= box * 0.05 * bump(s - S8 - j * S16, 0.1);
      P.dy -= box * 0.12 * bump(s - at(2.5) - k * 0.025, 0.2);
      P.dy -= box * 0.1 * bump(s - at(3.5) - k * 0.04, 0.2);
      P.dy += box * 0.012 * Math.sin(s * Math.PI / BEAT - k * 0.8);
      return x;
    }

    ctx.font = a.font;
    ctx.fillStyle = css(C.chalk);
    for (var k = 0; k < SPELLINGS[0].text.length; k++) {
      var g = a.glyphs[k];
      var ch = g.ch, w = g.w;
      // N folds down onto the baseline and n unfolds from it, like a split-flap
      var flip = k === 0 ? phase(tau, CHANGES[1], S16) : 0;
      if (flip >= 1) {
        ch = 'n';
        w = forms[2].glyphs[0].w;
      }
      if (!lite && tau - S8 - k * S16 < 0.02) {
        for (var j = TRAIL; j >= 1; j--) {
          var gx = place(k, tau - j * 0.022);
          if (gx === null) continue;
          P.a *= 0.12 * (TRAIL + 1 - j);
          drawPosed(ch, gx, y, w);
        }
      }
      var x = place(k, tau);
      if (x === null) continue;
      if (k === 0) {
        if (tau < CHANGES[1]) P.sy *= 1 - 0.15 * expoOut(phase(tau, at(2.75), S16));
        else P.sy *= flip < 1 ? 1 - easeInCubic(flip) : backOut(phase(tau, CHANGES[1] + S16, S16 * 1.5));
      }
      drawPosed(ch, x, y, w);
    }

    drawRiseLetters(caption, cx - caption.width / 2, y + a.descent + caption.size * 1.6, tau - at(3.25), css(C.chalk, 0.72));
  }

  /* IterMath: the seven modules jump in on 16ths; nCr is picked and its working typesets */
  var MODULES = ['+', '−', '×', '÷', '( )', 'nCr', 'nPr'];
  var PICK = 5;
  var PICKED = at(2.5);

  // Tiles, a gap and the formula (1.2 tiles tall) are sized together so the block fits the area
  function moduleGrid(area) {
    var cols = area.w / 7 >= 72 ? 7 : 4;
    var rows = Math.ceil(MODULES.length / cols);
    var tile = Math.min(area.w / (cols + (cols - 1) * 0.2), area.h / (rows + (rows - 1) * 0.2 + 0.3 + 1.2), 132);
    var gap = tile * 0.2;
    var grid = rows * tile + (rows - 1) * gap;
    var top = area.y + (area.h - (grid + gap * 1.5 + tile * 1.2)) / 2;
    return { cols: cols, tile: tile, gap: gap, top: top, formulaTop: top + grid + gap * 1.5 };
  }

  function tileCentre(g, area, k) {
    var row = Math.floor(k / g.cols);
    var inRow = row === 0 ? Math.min(g.cols, MODULES.length) : MODULES.length - g.cols;
    return {
      x: area.x + (area.w - (inRow * g.tile + (inRow - 1) * g.gap)) / 2 + (k - row * g.cols) * (g.tile + g.gap) + g.tile / 2,
      y: g.top + row * (g.tile + g.gap) + g.tile / 2,
      row: row
    };
  }

  // How much the IterMath scene is scaled as the picked tile is spat out: stepped back, and
  // breathed in as the scene starts to close
  var SPIT = SCENE_CLOSE + S16;
  function spitScale() { return (1 - 0.34 * stepBack(SPIT)) * 1.03; }

  // Where the picked tile's foot is on screen when it is spat out as the module (b19.25)
  function pickedTile() {
    var area = L.scenes[1].area;
    var g = moduleGrid(area);
    var c = tileCentre(g, area, PICK);
    var k = stepBack(SPIT);
    var s = 1 - 0.34 * k;
    var ax = area.x + area.w / 2, ay = area.y + area.h / 2;
    var x = ax + (c.x - ax) * s;
    var y = ay - area.h * 0.1 * k + (c.y + g.tile / 2 - ay) * s;
    return { x: L.W / 2 + (x - L.W / 2) * 1.03, y: L.H / 2 + (y - L.H / 2) * 1.03 };
  }

  function drawModules(tau, area) {
    var g = moduleGrid(area);
    var dim = 1 - 0.55 * ease(phase(tau, PICKED, S8));
    var corner = Math.max(4, g.tile * 0.06);
    var fill = phase(tau, PICKED, S16);
    var leave = expoIn(phase(tau, SCENE_CLOSE, S16));
    var pc = tileCentre(g, area, PICK);
    for (var k = 0; k < MODULES.length; k++) {
      var picked = k === PICK;
      // Each reaches its slot on its 16th, from below the screen, overshooting on a spring
      var s = tau - S8 - k * S16;
      if (s < -0.12 || (picked && tau >= SPIT)) continue;
      var c = tileCentre(g, area, k);
      var dist = L.H - c.y + g.tile;
      var rise = spring(s + 0.12, 3, 0.4);
      var v = (rise - spring(s + 0.112, 3, 0.4)) / 0.008 * dist / g.tile;
      var sy = stretchFor(v) * squash(s, 0.16).sy;
      var pulse = s > 0.3 ? 1 + 0.04 * Math.exp(-sinceBeat(tau - k * 0.02) / 0.07) : 1;
      var dx = 0;
      var dy = (1 - rise) * dist;
      if (picked) {
        if (tau < PICKED) sy *= 1 - 0.22 * expoOut(phase(tau, PICKED - S16, S16));
        dy -= g.tile * 0.6 * bump(tau - PICKED, S8);
        sy *= squash(tau - PICKED - S8, 0.22).sy;
      } else if (c.row === pc.row && Math.abs(k - PICK) === 1) {
        dx = (k - PICK) * g.tile * 0.2 * nudge(tau - PICKED);
      }
      var size = picked ? lerp(g.tile, L.module / spitScale(), leave) : g.tile;
      var label = textRun(MODULES[k], 600, Math.round(g.tile * (MODULES[k].length > 1 ? 0.3 : 0.44)), 0);
      ctx.save();
      if (!picked) ctx.globalAlpha *= dim;
      ctx.translate(c.x + dx, c.y + g.tile / 2 + dy);
      ctx.scale(pulse / sy, pulse * sy);
      // The picked tile starts out like the rest (a chalk tint over petrol) and fills with sea-light
      roundedBox(-size / 2, -size, size, size, Math.min(corner, size * 0.2),
        picked ? css(mix(C.petrol, C['sea-light'], fill)) : css(C.chalk, 0.08));
      if (picked && fill < 1) roundedBox(-size / 2, -size, size, size, corner, css(C.chalk, 0.08 * (1 - fill)));
      ctx.globalAlpha *= 1 - leave;
      drawRun(label, -label.width / 2, -size / 2 + label.cap / 2, css(picked ? mix(C.chalk, C.petrol, fill) : C.chalk));
      ctx.restore();
    }
    var burst = phase(tau, PICKED, 0.35);
    if (burst > 0 && burst < 1) {
      var grow = g.tile * (1 + 1.4 * expoOut(burst));
      drawFrame(pc.x, pc.y, grow, grow, 1 - burst);
    }
    drawFormula(tau, area, g);
  }

  // A run whose exclamation marks pop, one per cue
  function drawPopped(r, x, y, color, tau, cues) {
    ctx.font = r.font;
    ctx.fillStyle = color;
    var n = 0;
    for (var i = 0; i < r.glyphs.length; i++) {
      var g = r.glyphs[i];
      if (g.ch === ' ') continue;
      var p = pose();
      if (g.ch === '!') {
        p.sx = p.sy = 1 + 0.9 * Math.max(0, ring(tau - cues[n++], 6, 0.4));
        p.oy = r.cap / 2;
      }
      drawPosed(g.ch, x + g.x, y, g.w);
    }
  }

  // The working: "nCr =" rises, the fraction bar shoots across, n! springs up out of it and
  // r!(n − r)! drops out of it and bounces; then the three ! pop on 32nds
  function drawFormula(tau, area, g) {
    var size = Math.round(g.tile * 0.42);
    var lhs = textRun('nCr =', 600, size, 0);
    var numerator = textRun('n!', 600, size, 0);
    var denominator = textRun('r!(n − r)!', 600, size, 0);
    var barW = Math.max(numerator.width, denominator.width) + size * 0.4;
    var x = area.x + (area.w - (lhs.width + size * 0.4 + barW)) / 2;
    var barX = x + lhs.width + size * 0.4;
    var barY = g.formulaTop + size * 1.05;
    var weight = Math.max(2, size * 0.06);
    var start = at(3);
    var color = css(C.chalk);
    drawRiseLetters(lhs, x, barY + weight / 2 + lhs.cap / 2, tau - start, color);
    var draw = expoOut(phase(tau, start, S16));
    if (draw > 0) fillBox(barX, barY, barW * draw, weight, color);
    var s = tau - start - S16;
    if (s <= 0) return;
    var bangs = [at(3.5), at(3.625), at(3.75)];
    ctx.save();
    clipRect(barX - size, barY - size * 1.4, barW + 2 * size, size * 1.4);
    drawPopped(numerator, barX + (barW - numerator.width) / 2, barY - size * 0.3 + (1 - spring(s, 3.2, 0.42)) * size * 1.3,
      color, tau, bangs.slice(0, 1));
    ctx.restore();
    ctx.save();
    clipRect(barX - size, barY + weight, barW + 2 * size, size * 1.5);
    var f = clamp01(s / S16);
    var drop = s < S16 ? -(1 - f * f) * size * 1.3 : -size * 0.15 * bump(s - S16, 0.14);
    drawPopped(denominator, barX + (barW - denominator.width) / 2, barY + weight + size + drop, color, tau, bangs.slice(1));
    ctx.restore();
  }

  /* BSQShuttle: the Kemanggisan route. The shuttle reaches each stop on the beat. */
  var STOPS = ['BSQ', 'Kijang', 'Syahdan', 'Anggrek'];
  var ARRIVALS = [S8, at(1), at(2), at(3)];

  function routeGeometry(area) {
    var across = area.w >= area.h;
    var label = Math.round(L.kicker * 1.2);
    var stop = Math.max(8, Math.min(16, Math.min(area.w, area.h) * 0.035));
    var lead = textRun(STOPS[STOPS.length - 1], 500, label, 0).width / 2 + stop;
    var start = across ? { x: area.x + lead, y: area.y + area.h * 0.45 } : { x: area.x + stop * 2, y: area.y + stop * 2 };
    var span = across ? area.w - 2 * lead : area.h - stop * 4 - label;
    return {
      across: across,
      label: label,
      stop: stop,
      start: start,
      span: span,
      point: function (u) {
        var d = span * u / (STOPS.length - 1);
        return across ? { x: start.x + d, y: start.y } : { x: start.x, y: start.y + d };
      }
    };
  }

  // Where the shuttle is along the route, in stops: each leg pulls back first, arrives at full
  // speed on the beat, overshoots the stop and settles
  function shuttleAt(tau) {
    var u = 0;
    for (var j = 1; j < ARRIVALS.length; j++) {
      var s = tau - ARRIVALS[j];
      if (s >= 0) u = j + 0.14 * nudge(s);
      else if (s > -S8) u = j - 1 + backIn(1 + s / S8);
    }
    return u;
  }

  function drawRoute(tau, area) {
    var R = routeGeometry(area);
    var u = shuttleAt(tau);
    var v = (u - shuttleAt(tau - 1 / 120)) * 120;
    var end = R.point((STOPS.length - 1) * expoOut(phase(tau, S16, S16)));
    var bus = R.point(u);
    var travelled = css(C['sea-light']);
    if (tau >= S16) hairline(R.start.x, R.start.y, R.across ? end.x : R.start.x, R.across ? R.start.y : end.y, css(C.chalk, 0.4));
    if (tau >= S8) hairline(R.start.x, R.start.y, R.across ? bus.x : R.start.x, R.across ? R.start.y : bus.y, travelled);

    for (var i = 0; i < STOPS.length; i++) {
      var p = R.point(i);
      var since = tau - ARRIVALS[i];
      // Each stop pops in on a 32nd, and pops again when the shuttle reaches it
      var size = R.stop * backOut(phase(tau, S16 + i * S32, S16)) * (1 + 0.6 * Math.max(0, ring(since, 5, 0.4)));
      if (size > 0 && (tau < S8 || Math.abs(u - i) > 0.05)) {
        fillBox(p.x - size / 2, p.y - size / 2, size, size, css(C.chalk, since >= 0 ? 1 : 0.4));
      }
      var name = textRun(STOPS[i], 500, R.label, 0);
      var color = css(C.chalk, since >= 0 ? 1 : 0.56);
      var hop = -R.label * 0.6 * bump(since, 0.2);
      if (R.across) drawRiseLetters(name, p.x - name.width / 2, p.y + R.stop * 1.5 + name.cap + R.label * 0.4 + hop, tau - S8 - i * S32, color);
      else drawRiseLetters(name, p.x + R.stop * 1.6, p.y + name.cap / 2 + hop, tau - S8 - i * S32, color);
    }

    // The shuttle is the module, landed at BSQ on b20.5. It stretches along the route as it
    // moves, squashes against each stop, and hops at Anggrek and again in the background.
    if (tau < S8) return;
    var sz = R.stop * 2.2;
    var along = stretchFor(v * R.span / (STOPS.length - 1) / sz);
    for (var j = 0; j < ARRIVALS.length; j++) along *= 1 - 0.3 * ring(tau - ARRIVALS[j], 5, 0.32);
    var lift = sz * 1.2 * (bump(tau - at(3.5), S16) + bump(tau - at(6.5), S16));
    var land = squash(tau - at(3.75), 0.25).sy * squash(tau - at(6.75), 0.25).sy;
    var w = (R.across ? sz * along : sz / along) / land;
    var h = (R.across ? sz / along : sz * along) * land;
    // Speed lines streak behind it while it is moving fast
    var speed = Math.abs(v);
    if (!lite && speed > 1.5) {
      var len = sz * Math.min(3, speed * 0.5);
      var back = v > 0 ? -1 : 1;
      for (var n = -1; n <= 1; n++) {
        var l = len * (1 - Math.abs(n) * 0.3);
        var off = n * sz * 0.32;
        if (R.across) fillBox(bus.x + back * (w / 2 + sz * 0.2) + (back < 0 ? -l : 0), bus.y + off - 1, l, 2, css(C.chalk, 0.5));
        else fillBox(bus.x + off - 1, bus.y + back * (h / 2 + sz * 0.2) + (back < 0 ? -l : 0), 2, l, css(C.chalk, 0.5));
      }
    }
    fillBox(bus.x - w / 2, bus.y - h / 2 - lift, w, h, travelled);
  }

  /* ---------- Opening and closing a scene ---------- */

  // A scene covers the whole screen from once it is open until it starts to leave
  function sceneCovers(i, tau) {
    return tau >= S8 && tau < SCENE_CLOSE + (i === 1 ? S16 : 0);
  }

  function drawScene(i, tau, t) {
    if (tau < S8) openScene(i, tau, t);
    else if (tau < SCENE_CLOSE) drawSceneLayer(i, tau, t, 0);
    else closeScene(i, tau, t);
  }

  // Bar 1 bursts up then out; bar 2 out then up; bar 3 breaks into modules that pop in
  // outward from it until they fill the screen
  function openScene(i, tau, t) {
    var bar = barRect(L.base, i);
    ctx.save();
    ctx.beginPath();
    if (i < 2) {
      var first = expoOut(phase(tau, 0, S16));
      var second = expoOut(phase(tau, S16, S16));
      var tall = i === 0 ? first : second;
      var wide = i === 0 ? second : first;
      ctx.rect(lerp(bar.x, 0, wide), lerp(bar.y, 0, tall), lerp(bar.w, L.W, wide), lerp(bar.h, L.H, tall));
    } else {
      // The bar itself stays as the cascade's source
      ctx.rect(bar.x, bar.y, bar.w, bar.h);
      var c = L.cell;
      var ox = bar.x + bar.w / 2, oy = bar.y + bar.h / 2;
      var reach = Math.sqrt(Math.pow(Math.max(ox, L.W - ox), 2) + Math.pow(Math.max(oy, L.H - oy), 2));
      for (var y = 0; y < L.H; y += c) {
        for (var x = 0; x < L.W; x += c) {
          var d = Math.sqrt(Math.pow(x + c / 2 - ox, 2) + Math.pow(y + c / 2 - oy, 2));
          var size = c * backOut(phase(tau, S16 * d / reach, S16));
          if (size > 0) ctx.rect(x + (c - size) / 2, y + (c - size) / 2, size, size);
        }
      }
    }
    ctx.clip();
    drawSceneLayer(i, tau, t, 1 - expoOut(phase(tau, 0, S8)));
    ctx.restore();
  }

  // MangARTI leaves as six slices flying out left and right in turn; IterMath breathes in and
  // is sucked back into its bar; BSQ falls away in six strips, one after another
  function closeScene(i, tau, t) {
    var s = tau - SCENE_CLOSE;
    if (i === 1) {
      var p = expoIn(phase(s, S16, S16));
      if (p >= 1) return;
      var breathe = 1 + 0.03 * expoOut(clamp01(s / S16));
      var bar = barRect(L.base, 1);
      ctx.save();
      ctx.translate(lerp(L.W / 2, bar.x + bar.w / 2, p), lerp(L.H / 2, bar.y + bar.h / 2, p));
      ctx.scale(lerp(breathe, bar.w / L.W, p), lerp(breathe, bar.h / L.H, p));
      ctx.translate(-L.W / 2, -L.H / 2);
      drawSceneLayer(1, tau, t, p);
      ctx.restore();
      return;
    }
    var snap = snapshot(i);
    for (var k = 0; k < 6; k++) {
      if (i === 0) {
        var q = expoIn(phase(s, k * 0.02, 0.13));
        var band = L.H / 6;
        if (q < 1) drawSlice(snap, 0, k * band, L.W, band, (k % 2 ? 1 : -1) * L.W * q, 0);
      } else {
        var f = phase(s, k * 0.024, 0.18);
        var strip = L.W / 6;
        if (f < 1) drawSlice(snap, k * strip, 0, strip, L.H, 0, (L.H + 2) * f * f);
      }
    }
  }

  // The scene as it stands when it starts to leave, drawn once (per layout) for its exit
  function snapshot(i) {
    if (L.snaps[i]) return L.snaps[i];
    var canvas = document.createElement('canvas');
    canvas.width = run.canvas.width;
    canvas.height = run.canvas.height;
    var main = ctx;
    ctx = canvas.getContext('2d');
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    drawSceneLayer(i, SCENE_CLOSE, FIRST_SCENE + i * SCENE_LEN + SCENE_CLOSE, 0);
    ctx = main;
    L.snaps[i] = canvas;
    return canvas;
  }

  // Part (x, y, w, h) of a snapshot, moved by (dx, dy)
  function drawSlice(snap, x, y, w, h, dx, dy) {
    var d = L.dpr;
    ctx.drawImage(snap, x * d, y * d, w * d, h * d, x + dx, y + dy, w, h);
  }

  /* ---------- One frame ---------- */

  function sceneAt(t) {
    var i = Math.floor((t - FIRST_SCENE) / SCENE_LEN);
    return t >= FIRST_SCENE && i < SCENES.length ? i : -1;
  }

  function render(t) {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    var i = sceneAt(t);
    var tau = i < 0 ? 0 : t - FIRST_SCENE - i * SCENE_LEN;
    if (i < 0 || !sceneCovers(i, tau)) drawStage(t);
    if (i >= 0) drawScene(i, tau, t);
    ctx.save();
    camera(t);
    drawModule(t);
    ctx.restore();
    // The controls follow the chapter under them, as the site's components do
    setChapter(i >= 0 && tau > S8 && tau < SCENE_CLOSE + S8);
  }

  function setChapter(dark) {
    if (dark === run.dark) return;
    run.dark = dark;
    run.overlay.classList.toggle('scene-dark', dark);
    run.overlay.classList.toggle('scene-light', !dark);
    root.classList.toggle('is-intro-dark', dark);
  }

  /* ---------- Soundtrack: synthesised, on the same beat grid as the pictures ---------- */

  var HZ = 27.5;
  // The mark's bar heights, 8, 12 and 20, as harmonics of 27.5 Hz: 220, 330 and 550 Hz, A major
  var CHORD = [8, 12, 20];
  // Notes are queued a second ahead so a long frame (the page's own WebGL stage compiles its
  // shaders while the intro plays) cannot make them late. Stopping closes the bus they play
  // through, so nothing queued outlives Skip or Sound off.
  var LOOKAHEAD = 1;
  var MASTER = 0.9;

  function buildScore() {
    var score = [];
    function add(beat, voice, opts) {
      var e = opts || {};
      e.t = at(beat);
      e.v = voice;
      e.g = e.g === undefined ? 1 : e.g;
      score.push(e);
    }
    function melody(from, notes, beats, gain) {
      notes.forEach(function (n, i) { add(from + beats[i], 'pluck', { n: n, g: gain }); });
    }

    // Seed: the module falls and lands, then stamps each bar, which sounds its own harmonic
    add(0, 'swish', { d: S8, g: 0.5, down: true });
    add(0.5, 'kick', { g: 0.7 });
    add(0.5, 'pop', { n: 16 });
    CHORD.forEach(function (n, i) { add(i + 1, 'pluck', { n: n, g: 1.2 }); });
    [1.5, 2.5].forEach(function (b) { add(b, 'hat', { g: 0.5 }); });
    add(3, 'riser', { d: BEAT });
    [3.25, 3.5, 3.75].forEach(function (b, i) { add(b, 'clap', { g: 0.35 + 0.25 * i }); });

    // Groove under the three projects. Each scene's bass sits on its bar's note.
    var bass = [[2], [3], [2, 4]];
    var stick = 18; // "sticks." lands here: one hard hit, then the beat stops for an eighth
    for (var beat = 4; beat < 28; beat++) {
      var scene = Math.floor((beat - 4) / 8);
      var inBar = beat % 4;
      if (beat === stick) {
        add(beat, 'kick', { g: 1.1 });
        add(beat, 'clap');
        add(beat, 'pluck', { n: 8, g: 1 });
      } else {
        add(beat, 'kick');
        if (inBar === 1 || inBar === 3) add(beat, 'clap', { g: 0.7 });
        add(beat + 0.25, 'hat', { g: 0.35 });
      }
      add(beat + 0.5, 'hat', { g: 0.6, open: true });
      add(beat + 0.75, 'hat', { g: 0.45 });
      add(beat + 0.5, 'bass', { n: bass[scene][(beat % 2) % bass[scene].length] });
      if ((beat - 4) % 8 === 0) add(beat, 'crash', { g: 0.7 });
    }

    // MangARTI: a pop as each letter lands, a drop for each lost a, the sentence sings its
    // line, "Manadonese." hits, and the scene flies out
    [16, 18, 20, 24, 27].forEach(function (n, i) { add(4.5 + i / 4, 'pop', { n: n }); });
    add(6, 'drop');
    add(6, 'swish', { d: S16, g: 0.3 });
    add(6.5, 'pop', { n: 24 });
    add(7, 'drop');
    add(7, 'pop', { n: 16 });
    melody(8, [24, 20, 24, 27, 24, 32], [0, 0.5, 1, 1.5, 2, 2.5], 0.8);
    add(10.5, 'kick', { g: 0.9 });
    add(10.5, 'clap', { g: 0.9 });
    add(11, 'swish', { d: S8, g: 0.5 });
    add(11.5, 'pop', { n: 8 });
    add(11.5, 'riser', { d: S8, g: 0.6 });

    // IterMath: the seven modules climb the scale, nCr rings, the working draws and its !
    // pop, "sticks." drops and hits, and the scene is sucked back into its bar
    melody(12.5, [16, 18, 20, 24, 27, 30, 32], [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], 0.7);
    add(14.5, 'bell', { n: 40 });
    add(14.75, 'pop', { n: 32 });
    add(15, 'swish', { d: S8, g: 0.4 });
    [24, 30, 36].forEach(function (n, i) { add(15.5 + i / 8, 'pop', { n: n }); });
    melody(16, [24, 20, 18], [0, 0.5, 1], 0.8);
    add(17.75, 'swish', { d: S16, g: 0.4, down: true });
    add(18.5, 'pop', { n: 20 });
    add(19, 'swish', { d: S8, g: 0.5 });
    add(19.5, 'pop', { n: 12 });
    add(19.5, 'riser', { d: S8, g: 0.6 });

    // BSQShuttle: the route draws, the shuttle whooshes off and a station chime marks each
    // arrival, "catch." rushes in and hits, and the scene falls away
    add(20.25, 'swish', { d: S8, g: 0.4 });
    add(20.5, 'pop', { n: 16 });
    [20.75, 21.5, 22.5].forEach(function (b) { add(b, 'swish', { d: S16, g: 0.35 }); });
    [24, 20, 16].forEach(function (n, i) { add(21 + i, 'bell', { n: n }); });
    add(23.5, 'pop', { n: 24 });
    add(23.75, 'pop', { n: 16 });
    melody(24, [16, 20, 24, 20, 24], [0, 0.5, 1, 1.25, 1.5], 0.8);
    add(25.5, 'swish', { d: S8, g: 0.5 });
    add(26, 'bell', { n: 32, g: 1.2 });
    add(26, 'clap', { g: 0.9 });
    add(26.5, 'pop', { n: 24 });
    add(27, 'swish', { d: S8, g: 0.5, down: true });
    add(27.5, 'pop', { n: 12 });
    add(27.5, 'riser', { d: S8, g: 0.7 });

    // Name: the module completes the mark and its chord sounds; the name builds; the countdown
    // speeds up, toms and claps closer together; then silence for an eighth, and the slam
    add(28, 'kick', { g: 1.1 });
    add(28, 'crash');
    add(28, 'pad', { ns: CHORD.concat([16]), d: at(3) });
    add(28, 'bass', { n: 2, d: at(3) - 0.05, g: 0.5 });
    add(28.5, 'swish', { d: S16, g: 0.3 });
    add(28.75, 'pop', { n: 16 });
    add(29, 'kick');
    add(29.5, 'kick');
    add(29.5, 'clap', { g: 0.6 });
    melody(29, [24, 32], [0, 0.5], 0.6);
    add(29.5, 'riser', { d: at(1.5), g: 1 });
    [[30, 8], [30.5, 6], [30.75, 4], [30.875, 4], [30.9375, 4]].forEach(function (c) { add(c[0], 'tom', { n: c[1] }); });
    [30, 30.5, 30.75, 30.875].forEach(function (b, i) { add(b, 'clap', { g: 0.4 + 0.15 * i }); });
    add(31, 'hush', { d: S8 });
    add(31.5, 'swish', { d: S8, g: 1.6 });

    // Landing, and the wink
    add(32, 'impact');
    add(32, 'kick', { g: 1.2 });
    add(32, 'crash');
    [16, 24, 40].forEach(function (n) { add(32, 'pluck', { n: n, g: 0.9 }); });
    add(32.25, 'pop', { n: 40, g: 0.8 });

    return score.sort(function (a, b) { return a.t - b.t; });
  }

  // introTime() is the intro's clock read now; offsets are computed against it, not against
  // a frame's timestamp, so the work done since the frame began does not delay the audio
  function createSound(introTime) {
    var AC = window.AudioContext;
    if (!AC) return null;
    var score = buildScore();
    var ac = null, input, verbIn, echoIn, noiseBuffer, master, bus = null;
    var on = false, wanted = false, next = 0, offset = 0, idleTimer = 0;
    // Recent readings of the offset from getOutputTimestamp, and how many frames notes have waited
    var readings = [], waited = 0;

    function build() {
      ac = new AC();
      var comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master = gain(MASTER);
      chain(comp, master, ac.destination);
      input = comp;

      var verb = ac.createConvolver();
      verb.buffer = impulse(1.9);
      chain(verb, gain(0.32), comp);
      verbIn = verb;

      // Echo on a dotted eighth, so repeats fall on the 16th grid
      var delay = ac.createDelay(1);
      delay.delayTime.value = S8 * 1.5;
      var tone = filter('lowpass', 2400);
      chain(delay, tone, gain(0.33), delay);
      chain(tone, gain(0.28), comp);
      echoIn = delay;

      noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }

    function impulse(seconds) {
      var length = Math.round(ac.sampleRate * seconds);
      var buffer = ac.createBuffer(2, length, ac.sampleRate);
      for (var c = 0; c < 2; c++) {
        var data = buffer.getChannelData(c);
        for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
      return buffer;
    }

    // Connects nodes in series and returns the last one
    function chain() {
      for (var i = 1; i < arguments.length; i++) arguments[i - 1].connect(arguments[i]);
      return arguments[arguments.length - 1];
    }

    function gain(value) {
      var g = ac.createGain();
      g.gain.value = value;
      return g;
    }

    function filter(type, freq, q) {
      var f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q || 0.7;
      return f;
    }

    function osc(type, freq, when, until) {
      var o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, when);
      o.start(when);
      o.stop(until);
      return o;
    }

    function noise(when, dur) {
      var s = ac.createBufferSource();
      s.buffer = noiseBuffer;
      s.loop = true;
      s.start(when, Math.random() * 0.5);
      s.stop(when + dur);
      return s;
    }

    function envelope(param, when, peak, attack, decay) {
      param.setValueAtTime(0.0001, when);
      param.exponentialRampToValueAtTime(peak, when + attack);
      param.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    }

    function voice(peak, when, attack, decay) {
      var g = ac.createGain();
      envelope(g.gain, when, peak, attack, decay);
      return g;
    }

    function out(node, verb, echo) {
      node.connect(bus.dry);
      if (verb) chain(node, gain(verb), bus.verb);
      if (echo) chain(node, gain(echo), bus.echo);
    }

    var VOICES = {
      kick: function (w, e) {
        var body = osc('sine', 150, w, w + 0.45);
        body.frequency.exponentialRampToValueAtTime(44, w + 0.11);
        out(chain(body, voice(0.9 * e.g, w, 0.002, 0.38)));
        out(chain(noise(w, 0.03), filter('highpass', 3500), voice(0.2 * e.g, w, 0.001, 0.012)));
      },
      clap: function (w, e) {
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, w);
        [0, 0.01, 0.02].forEach(function (d) {
          g.gain.setValueAtTime(0.5 * e.g, w + d);
          g.gain.exponentialRampToValueAtTime(0.05 * e.g, w + d + 0.008);
        });
        g.gain.setValueAtTime(0.4 * e.g, w + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, w + 0.22);
        out(chain(noise(w, 0.25), filter('bandpass', 1500, 0.9), g), 0.25);
      },
      hat: function (w, e) {
        out(chain(noise(w, 0.2), filter('highpass', 7500), voice(0.18 * e.g, w, 0.001, e.open ? 0.16 : 0.035)));
      },
      bass: function (w, e) {
        var dur = e.d || S8 * 0.9;
        var lp = filter('lowpass', 1000, 5);
        lp.frequency.setValueAtTime(1000, w);
        lp.frequency.exponentialRampToValueAtTime(180, w + Math.min(dur, 0.4));
        [-8, 8].forEach(function (cents) {
          var o = osc('sawtooth', HZ * e.n, w, w + dur + 0.05);
          o.detune.setValueAtTime(cents, w);
          o.connect(lp);
        });
        out(chain(lp, voice(0.32 * e.g, w, 0.006, dur)));
      },
      pluck: function (w, e) {
        var lp = filter('lowpass', 3600, 2);
        lp.frequency.setValueAtTime(3600, w);
        lp.frequency.exponentialRampToValueAtTime(700, w + 0.25);
        osc('square', HZ * e.n, w, w + 0.5).connect(lp);
        osc('triangle', HZ * e.n * 2, w, w + 0.5).connect(lp);
        out(chain(lp, voice(0.16 * e.g, w, 0.004, 0.42)), 0.18, 0.35);
      },
      bell: function (w, e) {
        [[1, 0.16, 1.4], [2, 0.06, 0.6], [3, 0.04, 0.3], [4, 0.025, 0.2]].forEach(function (p) {
          out(chain(osc('sine', HZ * e.n * p[0], w, w + p[2] + 0.05), voice(p[1] * e.g, w, 0.002, p[2])), 0.3, 0.2);
        });
      },
      // A short pitched blip for small accents: a letter landing, a tile, a hop
      pop: function (w, e) {
        var o = osc('sine', HZ * e.n * 2, w, w + 0.12);
        o.frequency.exponentialRampToValueAtTime(HZ * e.n, w + 0.05);
        out(chain(o, voice(0.2 * e.g, w, 0.002, 0.09)), 0.15);
      },
      tom: function (w, e) {
        var o = osc('sine', HZ * e.n * 2, w, w + 0.4);
        o.frequency.exponentialRampToValueAtTime(HZ * e.n, w + 0.12);
        out(chain(o, voice(0.5 * e.g, w, 0.002, 0.3)), 0.2);
      },
      // The pause: everything, reverb and echo tails included, is cut for e.d
      hush: function (w, e) {
        master.gain.setTargetAtTime(0, w, 0.006);
        master.gain.setTargetAtTime(MASTER, w + e.d - 0.02, 0.004);
      },
      drop: function (w, e) {
        var o = osc('sine', HZ * 48, w, w + 0.2);
        o.frequency.exponentialRampToValueAtTime(HZ * 12, w + 0.14);
        out(chain(o, voice(0.25 * e.g, w, 0.003, 0.16)), 0.2);
      },
      swish: function (w, e) {
        var from = e.down ? 6000 : 1200;
        var bp = filter('bandpass', from, 1.5);
        bp.frequency.setValueAtTime(from, w);
        bp.frequency.exponentialRampToValueAtTime(e.down ? 600 : 7000, w + e.d);
        out(chain(noise(w, e.d + 0.05), bp, voice(0.12 * e.g, w, e.d * 0.7, e.d * 0.3)), 0.3);
      },
      riser: function (w, e) {
        var bp = filter('bandpass', 300, 4);
        bp.frequency.setValueAtTime(300, w);
        bp.frequency.exponentialRampToValueAtTime(6000, w + e.d);
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, w);
        g.gain.exponentialRampToValueAtTime(0.2 * e.g, w + e.d);
        g.gain.exponentialRampToValueAtTime(0.0001, w + e.d + 0.03);
        out(chain(noise(w, e.d + 0.05), bp, g), 0.3);
      },
      crash: function (w, e) {
        out(chain(noise(w, 1.7), filter('highpass', 4000), voice(0.12 * e.g, w, 0.002, 1.6)), 0.3);
      },
      impact: function (w, e) {
        var boom = osc('sine', 110, w, w + 1.5);
        boom.frequency.exponentialRampToValueAtTime(38, w + 0.5);
        out(chain(boom, voice(0.9 * e.g, w, 0.003, 1.4)), 0.4);
        var lp = filter('lowpass', 5000);
        lp.frequency.setValueAtTime(5000, w);
        lp.frequency.exponentialRampToValueAtTime(200, w + 0.9);
        out(chain(noise(w, 1), lp, voice(0.3 * e.g, w, 0.002, 0.9)), 0.4);
      },
      pad: function (w, e) {
        var lp = filter('lowpass', 1400, 0.5);
        var g = ac.createGain();
        var level = 0.06 * e.g;
        g.gain.setValueAtTime(0.0001, w);
        g.gain.linearRampToValueAtTime(level, w + Math.min(0.6, e.d / 2));
        g.gain.setValueAtTime(level, w + e.d - (e.release || Math.min(1.4, e.d / 2)));
        g.gain.linearRampToValueAtTime(0.0001, w + e.d);
        e.ns.forEach(function (n) {
          [-6, 6].forEach(function (cents) {
            var o = osc('sawtooth', HZ * n, w, w + e.d + 0.05);
            o.detune.setValueAtTime(cents, w);
            o.connect(lp);
          });
        });
        out(chain(lp, g), 0.5);
      }
    };

    function openBus() {
      bus = { dry: gain(1), verb: gain(1), echo: gain(1) };
      bus.dry.connect(input);
      bus.verb.connect(verbIn);
      bus.echo.connect(echoIn);
    }

    // Everything already scheduled goes through the bus, so closing it silences it at once
    function closeBus(fade) {
      var old = bus;
      bus = null;
      if (!old) return;
      ['dry', 'verb', 'echo'].forEach(function (k) {
        old[k].gain.setTargetAtTime(0, ac.currentTime, fade / 4);
      });
      window.setTimeout(function () {
        ['dry', 'verb', 'echo'].forEach(function (k) { old[k].disconnect(); });
      }, (fade + 0.1) * 1000);
    }

    // getOutputTimestamp says which context time is being heard right now, latency included,
    // so a note scheduled from it is heard in the frame that shows it
    function measuredOffset() {
      var stamp = ac.getOutputTimestamp ? ac.getOutputTimestamp() : null;
      if (!stamp || !(stamp.performanceTime > 0) || !(stamp.contextTime > 0)) return null;
      return stamp.contextTime + (clock() - stamp.performanceTime) / 1000 - introTime();
    }

    function startAt() {
      var t = introTime();
      window.clearTimeout(idleTimer);
      // Outside a click (returning to the tab) a browser may refuse; then it stays silent
      if (ac.state !== 'running') ac.resume().catch(function () {});
      openBus();
      offset = ac.currentTime - (ac.baseLatency || 0) - t;
      readings = [];
      waited = 0;
      next = 0;
      while (next < score.length && score[next].t < t) next++;
      // A sustained chord already under way joins in where it is
      score.slice(0, next).forEach(function (e) {
        if (e.v === 'pad' && e.t + e.d > t + 0.5) VOICES.pad(ac.currentTime, { ns: e.ns, d: e.t + e.d - t, g: e.g });
      });
    }

    function stop(fade) {
      closeBus(fade);
      // A pause still to come is called off with the rest
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(MASTER, ac.currentTime);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () { if (!bus) ac.suspend(); }, (fade + 0.2) * 1000);
    }

    return {
      // Called from a click: the only place an AudioContext may start
      toggle: function () {
        if (on) {
          on = wanted = false;
          stop(0.08);
          return false;
        }
        if (!ac) build();
        on = wanted = true;
        startAt();
        return true;
      },
      wanted: function () { return wanted; },
      update: function (t) {
        if (!on || !bus) return;
        // Read every frame, and the median of the last five used: one reading can be off while
        // the output starts up, and the audio clock can drift against the page's. Notes wait
        // (a few frames at most) until there are three readings.
        var measured = ac.state === 'running' ? measuredOffset() : null;
        if (measured !== null) {
          readings.push(measured);
          if (readings.length > 5) readings.shift();
          offset = readings.slice().sort(function (a, b) { return a - b; })[readings.length >> 1];
        }
        if (readings.length < 3 && ++waited < 10) return;
        while (next < score.length && score[next].t < t + LOOKAHEAD) {
          var e = score[next++];
          var when = e.t + offset;
          if (when > ac.currentTime - 0.03) VOICES[e.v](Math.max(when, ac.currentTime), e);
        }
      },
      pause: function () {
        if (on) stop(0.03);
      },
      resume: function () {
        if (on) startAt();
      },
      // Landed: nothing new is scheduled and the chord rings out. Skipped: fade now.
      end: function (landed) {
        if (!on) return;
        on = false;
        stop(landed ? 2.4 : 0.25);
      },
      level: function (t) {
        if (t >= FREEZE && t < SLAM) return [0.35, 0.35, 0.35];
        var b = t / BEAT;
        return [1, 2, 4].map(function (rate) { return 0.35 + 0.65 * Math.exp(-6 * ((b * rate) % 1)); });
      },
      isOn: function () { return on; }
    };
  }

  /* ---------- Taking over the page, and giving it back ---------- */

  var sound = createSound(currentTime);
  var changed = [];
  var watchdog = 0;

  function lockPage(overlay) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === overlay || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) return;
      var change = { el: el, inert: !el.inert, hidden: el.getAttribute('aria-hidden') !== 'true' };
      if (change.inert) el.inert = true;
      if (change.hidden) el.setAttribute('aria-hidden', 'true');
      changed.push(change);
    });
    root.classList.add('is-intro', 'is-intro-wordmark');
  }

  // Only what lockPage changed is put back; elements that were already hidden stay hidden
  function unlockPage() {
    changed.forEach(function (c) {
      if (c.inert) c.el.inert = false;
      if (c.hidden) c.el.removeAttribute('aria-hidden');
    });
    changed = [];
    root.classList.remove('is-intro', 'is-intro-wordmark', 'is-intro-dark');
  }

  var LEVEL_ICON = '<svg class="intro__level" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<rect x="1" y="9" width="3" height="6"></rect><rect x="6.5" y="6" width="3" height="9"></rect>' +
    '<rect x="12" y="0" width="3" height="15"></rect></svg>';

  function buildOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'intro scene-light';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Intro');
    overlay.setAttribute('aria-describedby', 'introNote');
    overlay.innerHTML =
      '<canvas class="intro__canvas" aria-hidden="true"></canvas>' +
      '<p class="sr-only" id="introNote">A ' + Math.round(END) + '-second animated introduction to the ' +
      'projects on this site, with an optional soundtrack. The home page opens when it ends.</p>' +
      '<div class="intro__controls">' +
      (sound ? '<button class="btn btn--ghost" type="button" data-intro="sound">' + LEVEL_ICON + '<span>Sound on</span></button>' : '') +
      '<button class="btn btn--ghost" type="button" data-intro="skip">Skip intro</button>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      var control = e.target.closest && e.target.closest('[data-intro]');
      if (control) guard(control.getAttribute('data-intro') === 'skip' ? skip : toggleSound);
      // Clicks on the intro belong to the intro, not to the page's own handlers underneath
      e.stopPropagation();
    });
    return overlay;
  }

  function currentTime() {
    return run && run.start !== null ? (clock() - run.start) / 1000 : 0;
  }

  function toggleSound() {
    if (!run || !sound) return;
    var on = sound.toggle();
    run.soundLabel.textContent = on ? 'Sound off' : 'Sound on';
    if (!on) setLevels([1, 1, 1]);
  }

  function setLevels(levels) {
    for (var i = 0; i < levels.length; i++) run.level.style.setProperty('--level-' + (i + 1), levels[i].toFixed(3));
  }

  function play(replay) {
    if (run || reducedQuery.matches) return;
    var overlay = buildOverlay();
    var soundButton = overlay.querySelector('[data-intro="sound"]');
    lite = false;
    run = {
      overlay: overlay,
      canvas: overlay.querySelector('canvas'),
      controls: overlay.querySelector('.intro__controls'),
      soundLabel: soundButton && soundButton.querySelector('span'),
      level: soundButton && soundButton.querySelector('svg'),
      returnFocus: replay ? document.activeElement : null,
      start: null,
      prevFrame: 0,
      paused: false,
      lastFrame: clock(),
      hiddenAt: 0,
      phase: replay ? 'entering' : 'playing',
      dark: false,
      maxDpr: 2,
      slow: 0,
      intervals: 0,
      dirty: false
    };
    overlay.setAttribute('data-phase', run.phase);
    ctx = run.canvas.getContext('2d');
    document.body.insertBefore(overlay, document.body.firstChild);
    lockPage(overlay);
    layout();
    if (replay && sound && sound.wanted()) toggleSound();
    watchdog = window.setInterval(function () { guard(checkStall); }, 1000);
    raf(frame);
  }

  function setPhase(name) {
    run.phase = name;
    run.overlay.setAttribute('data-phase', name);
  }

  function frame(now) {
    if (!run) return;
    guard(function () {
      if (run.start === null) run.start = now;
      var interval = run.prevFrame ? now - run.prevFrame : 0;
      run.prevFrame = now;
      if (interval > PAUSE_MS && !run.paused) {
        run.paused = true;
        run.start += interval;
        interval = 0;
        // Sound queued against the old timing is dropped and picks up from here
        if (sound) {
          sound.pause();
          sound.resume();
        }
      }
      if (run.phase === 'entering') setPhase('playing');
      if (run.dirty) {
        run.dirty = false;
        layout();
      }
      var t = (now - run.start) / 1000;
      if (t >= END) {
        finish();
        return;
      }
      if (t >= LANDING && run.phase === 'playing') setPhase('landing');
      if (t >= HANDOVER) root.classList.remove('is-intro-wordmark');
      render(t);
      if (sound && sound.isOn()) {
        sound.update(t);
        setLevels(sound.level(t));
      }
      adapt(interval, t);
      run.lastFrame = clock();
      raf(frame);
    });
  }

  // Measured on the device: if frames keep running long, first leave out the extra effects,
  // then draw fewer pixels
  function adapt(interval, t) {
    if (t < BAR || (lite && (run.maxDpr <= 1 || (window.devicePixelRatio || 1) <= 1))) return;
    run.intervals = run.intervals * 0.9 + interval * 0.1;
    run.slow = run.intervals > 24 ? run.slow + 1 : 0;
    if (run.slow < 30) return;
    run.slow = 0;
    run.intervals = 16;
    if (!lite) {
      lite = true;
      return;
    }
    run.maxDpr = run.maxDpr > 1.5 ? 1.5 : 1;
    layout();
  }

  function checkStall() {
    if (!run || document.hidden) return;
    if (clock() - run.lastFrame > STALL_MS) throw new Error('frames stopped');
  }

  function guard(fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.warn) console.warn('Intro: ended early. ' + (err && err.message ? err.message : err));
      finish();
    }
  }

  function skip() {
    if (!run || run.phase === 'leaving') return;
    setPhase('leaving');
    root.classList.remove('is-intro-wordmark');
    if (sound) sound.end(false);
    window.setTimeout(finish, num(token('--t-base')) + 40);
  }

  function finish() {
    var ended = run;
    if (!ended) return;
    run = null;
    window.clearInterval(watchdog);
    if (sound) sound.end(ended.phase === 'landing');
    // The overlay goes and the page comes back in the same frame
    if (ended.overlay.parentNode) ended.overlay.parentNode.removeChild(ended.overlay);
    unlockPage();
    var focus = ended.returnFocus;
    if (focus && document.contains(focus) && (!document.activeElement || document.activeElement === document.body)) {
      focus.focus({ preventScroll: true });
    }
  }

  /* ---------- Start ---------- */

  function sessionStore() {
    try {
      var s = window.sessionStorage;
      s.getItem(INTRO_KEY);
      return s;
    } catch (err) {
      return null;
    }
  }

  // Still on the site's loader: nothing of the page has been shown yet
  function pageUnseen() {
    return !root.hasAttribute('data-booted') && !root.classList.contains('no-js');
  }

  // The stylesheet costs one more round trip, and on a phone the site's loader often lifts
  // before it arrives. Until then a plain cover in the loader's colour sits just beneath the
  // loader, so the page stays unseen. It stays at most HOLD_MS past the loader and goes at once
  // if the site falls back to its static page. Returns its release, which says whether the
  // cover was still up.
  function holdPage() {
    var cover = document.createElement('div');
    var timer = 0;
    var watch = new window.MutationObserver(function () {
      if (root.classList.contains('no-js')) release();
      else if (root.hasAttribute('data-booted') && !timer) timer = window.setTimeout(release, HOLD_MS);
    });
    function release() {
      var up = !!cover.parentNode;
      watch.disconnect();
      window.clearTimeout(timer);
      if (up) cover.parentNode.removeChild(cover);
      return up;
    }
    cover.className = 'intro-hold';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:' + (num(token('--z-boot')) - 1);
    document.body.insertBefore(cover, document.body.firstChild);
    watch.observe(root, { attributes: true, attributeFilter: ['class', 'data-booted'] });
    return release;
  }

  function loadStyles(done) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    // Next to this script, wherever the site is hosted, with the same cache-busting query
    link.href = new URL('intro.css' + new URL(script.src).search, script.src).href;
    link.onload = function () { done(true); };
    link.onerror = function () { done(false); };
    document.head.appendChild(link);
  }

  function addFootnote() {
    var note = document.createElement('div');
    note.className = 'container intro-footnote';
    note.innerHTML = '<button class="link intro-footnote__replay" type="button">Replay intro</button>' +
      '<p>The intro and its soundtrack were made with Claude, an AI assistant.</p>';
    note.querySelector('button').addEventListener('click', function () { guard(function () { play(true); }); });
    footer.appendChild(note);
    return note;
  }

  var store = sessionStore();
  var releaseHold = store && !store.getItem(INTRO_KEY) && root.getAttribute('data-boot') !== 'warm' && pageUnseen() ?
    holdPage() : null;

  loadStyles(function (loaded) {
    // The cover comes down in the same task the intro goes up, so nothing shows between them
    var autoplay = !!releaseHold && releaseHold();
    C = readPalette();
    FONT = token('--font-display');
    if (!loaded || !C || !FONT) return;
    var note = addFootnote();

    onMedia(reducedQuery, function (e) {
      note.hidden = e.matches;
      if (e.matches && run) skip();
    });
    window.addEventListener('resize', function () { if (run) run.dirty = true; });
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function () { if (run) run.dirty = true; });
    }
    document.addEventListener('keydown', function (e) {
      if (run && (e.key === 'Escape' || e.key === 'Esc')) skip();
    });
    document.addEventListener('visibilitychange', function () {
      if (!run) return;
      if (document.hidden) {
        run.hiddenAt = clock();
        if (sound) sound.pause();
      } else if (run.hiddenAt) {
        if (run.start !== null) run.start += clock() - run.hiddenAt;
        run.hiddenAt = 0;
        run.prevFrame = 0;
        run.lastFrame = clock();
        if (sound) sound.resume();
      }
    });

    if (autoplay) {
      guard(function () {
        store.setItem(INTRO_KEY, '1');
        play(false);
      });
    }
  });

  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
})();
