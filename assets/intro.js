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
  var BAR = BEAT * 4;
  var SCENE_LEN = BAR * 2;
  var FIRST_SCENE = BAR;
  var FINALE = FIRST_SCENE + 3 * SCENE_LEN;
  var LANDING = FINALE + BAR;
  var WAVE = 0.5;
  var CELL_LIFE = 0.18;
  // Once the wave has cleared the masthead the real wordmark takes over from the drawn one
  var HANDOVER = LANDING + WAVE / 2;
  var HANDOVER_LEN = 0.16;
  var END = LANDING + WAVE + CELL_LIFE;

  function at(beat) { return beat * BEAT; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function phase(t, start, dur) { return clamp01((t - start) / dur); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  /* ---------- Easing: the site's own curves, read from its tokens ---------- */

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
  var easeHeavy = curveToken('--ease-heavy', '.65, 0, .15, 1');
  function easeInCubic(p) { return p * p * p; }
  function easeOutBack(p) { var q = p - 1; return 1 + 2.2 * q * q * q + 1.2 * q * q; }

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

  /* ---------- What each project scene says: copy from index.html and work.html ---------- */

  var SCENES = [
    {
      kicker: '01 · MangARTI',
      meta: 'Llama 3 8B · QLoRA · one laptop GPU',
      words: [['A', 4], ['language', 4.5], ['model', 5], ['that', 5.5], ['speaks', 6], ['Manadonese.', 6.5, 'accent']],
      graphic: drawSpellings
    },
    {
      kicker: '02 · IterMath',
      meta: 'Seven modules, from addition to permutations',
      words: [['A\u00a0math', 4], ['drill', 4.5], ['that', 5], ['sticks.', 6, 'stick']],
      graphic: drawModules
    },
    {
      kicker: '03 · BSQShuttle',
      meta: '33 daily departures across three routes',
      words: [['A', 4], ['shuttle', 4.5], ['you', 5], ['can', 5.25], ['actually', 5.5], ['catch.', 6, 'arrive']],
      graphic: drawRoute
    }
  ];
  var SCENE_CLOSE = at(7);

  /* ---------- Canvas, layout and text ---------- */

  var run = null;
  var ctx = null;
  var L = null;
  var runs = {};

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
      if (g.ch !== ' ' && g.ch !== '\u00a0') ctx.fillText(g.ch, x + g.x, y);
    }
  }

  function clipRect(x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  // Shift a run by (dx, dy) inside its own line box, so it appears from behind an edge
  function drawMasked(r, x, y, dx, dy, color) {
    if (!dx && !dy) { drawRun(r, x, y, color); return; }
    var pad = r.size * 0.2;
    ctx.save();
    clipRect(x - pad, y - r.ascent, r.width + 2 * pad, r.ascent + r.descent);
    drawRun(r, x + dx, y + dy, color);
    ctx.restore();
  }

  // The site's text entrance: a run slides up into view from behind its own line
  function drawRise(r, x, y, p, color) {
    if (p > 0) drawMasked(r, x, y, 0, (1 - p) * (r.ascent + r.descent), color);
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

    L = {
      W: W, H: H, dpr: dpr,
      left: mark.x, right: W - mark.x, headY: headY, bottom: bottom,
      m: m,
      kicker: Math.round(Math.max(14, Math.min(18, W * 0.0125))),
      wide: W >= 896,
      mark: mark,
      fold: fold,
      // Wordmark states as (x, y) of the mark's box and a scale relative to the real wordmark
      base: { x: center.x - 3 * m, y: center.y - 3 * m, s: base },
      big: { x: center.x - width * big / 2, y: center.y - MARK_BOX * mark.unit * big / 2, s: big },
      target: { x: mark.x, y: mark.y, s: 1 },
      cell: Math.max(24, Math.round(Math.min(W, H) / 14))
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
    return {
      fit: fit,
      top: L.bottom - height,
      area: { x: L.left, y: head, w: width, h: Math.max(0, L.bottom - height - gap - head) }
    };
  }

  /* ---------- Base layer: the mark, the seed and the finale ---------- */

  function barRect(state, i, rise) {
    var b = BARS[i];
    var u = state.s * L.mark.unit;
    var h = b.h * (rise === undefined ? 1 : rise);
    return { x: state.x + b.x * u, y: state.y + (b.y + b.h - h) * u, w: b.w * u, h: h * u };
  }

  function barColor(i) {
    return mix(C.stone, C.ink, BARS[i].alpha);
  }

  function drawMark(state, rises) {
    for (var i = 0; i < BARS.length; i++) {
      var r = barRect(state, i, rises ? rises[i] : 1);
      if (r.h > 0) fillBox(r.x, r.y, r.w, r.h, css(C.ink, BARS[i].alpha));
    }
  }

  // The name exactly as the masthead sets it, each glyph where the browser put it.
  // Drawn in the wordmark's own CSS pixels and scaled, so scale 1 is the real thing.
  // foldX and foldY at 1 stand the surname under the first name; at 0 the name is one line
  function drawName(state, t, start) {
    var wm = L.mark;
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.scale(state.s, state.s);
    ctx.font = wm.font;
    ctx.fillStyle = css(C.ink);
    for (var i = 0; i < wm.glyphs.length; i++) {
      var g = wm.glyphs[i];
      if (g.ch === ' ') continue;
      var surname = i > wm.split;
      var x = g.x + (surname ? state.foldX * L.fold.dx : 0);
      var shift = state.foldY * (surname ? L.fold.lead : -L.fold.lead);
      var p = ease(phase(t, start + (surname ? S8 : 0) + i * 0.018, 0.3));
      if (p <= 0) continue;
      if (p >= 1) {
        ctx.fillText(g.ch, x, wm.baseline + shift);
        continue;
      }
      ctx.save();
      clipRect(x - 2, wm.top + shift, g.w + 4, wm.height);
      ctx.fillText(g.ch, x, wm.baseline + shift + (1 - p) * wm.height);
      ctx.restore();
    }
    ctx.restore();
  }

  function seedRises(t) {
    return BARS.map(function (b, i) {
      return easeOutBack(phase(t, at(i + 1), S8 * 1.5));
    });
  }

  // The loader's track, redrawn: it spans the container, and the bars stand on it
  function drawSeedLine(t) {
    var s = L.base;
    var bar = barRect(s, 0);
    var y = bar.y + bar.h;
    var mid = s.x + MARK_BOX * L.mark.unit * s.s / 2;
    var retract = easeHeavy(phase(t, at(3.5), S8));
    var x1 = lerp(L.left, mid, retract);
    var x2 = lerp(lerp(L.left, L.right, easeHeavy(phase(t, 0, BEAT))), mid, retract);
    if (x2 > x1) hairline(x1, y, x2, y, css(C.ink));
  }

  // Finale: the mark steps aside for the name, then the wordmark flies to the masthead.
  // A two-line name folds back to one in the second half of the flight, once one line fits
  // the screen, in two eighths so the lines never cross: the surname slides clear of the
  // first name, then the lines meet. Scale is interpolated geometrically so the zoom reads
  // as even.
  function wordmarkState(t) {
    var flight = FINALE + at(2);
    var a = easeHeavy(phase(t, FINALE, BEAT));
    var f = easeHeavy(phase(t, flight, at(2)));
    var from = {
      x: lerp(L.base.x, L.big.x, a),
      y: lerp(L.base.y, L.big.y, a),
      s: L.base.s * Math.pow(L.big.s / L.base.s, a)
    };
    return {
      x: lerp(from.x, L.target.x, f),
      y: lerp(from.y, L.target.y, f),
      s: from.s * Math.pow(L.target.s / from.s, f),
      foldX: L.fold.on * (1 - easeHeavy(phase(t, flight + 2 * S8, S8))),
      foldY: L.fold.on * (1 - easeHeavy(phase(t, flight + 3 * S8, S8)))
    };
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

  function drawBase(t) {
    if (t >= LANDING) {
      ctx.clearRect(0, 0, L.W, L.H);
      drawLandingCells(t);
    } else {
      fillBox(0, 0, L.W, L.H, css(C.stone));
    }
    if (t < FIRST_SCENE) {
      drawSeedLine(t);
      drawMark(L.base, seedRises(t));
    } else if (t < FINALE) {
      drawMark(L.base);
    } else {
      // Engines round text baselines differently (Chromium: whole CSS pixels for the page,
      // device pixels for canvas), so the drawn wordmark dissolves into the real one
      // rather than swapping in a single frame.
      var state = wordmarkState(t);
      ctx.globalAlpha = 1 - phase(t, HANDOVER, HANDOVER_LEN);
      drawMark(state);
      drawName(state, t, FINALE + BEAT);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Project scenes: each bar opens into one project and folds back ---------- */

  // Opening: up to full height in an eighth, then out to full width. Closing reverses it,
  // and the fill turns back into the bar's own tone as it lands in place.
  function aperture(i, tau) {
    var bar = barRect(L.base, i);
    var closing = tau >= SCENE_CLOSE;
    var tall = closing ? 1 - easeHeavy(phase(tau, SCENE_CLOSE + S8, S8)) : easeHeavy(phase(tau, 0, S8));
    var wide = closing ? 1 - easeHeavy(phase(tau, SCENE_CLOSE, S8)) : easeHeavy(phase(tau, S8, S8));
    return {
      x: lerp(bar.x, 0, wide),
      y: lerp(bar.y, 0, tall),
      w: lerp(bar.w, L.W, wide),
      h: lerp(bar.h, L.H, tall),
      tone: 1 - tall,
      full: wide >= 1 && tall >= 1
    };
  }

  function drawHeader(scene, tau) {
    var k = textRun(scene.kicker, 500, L.kicker, 0);
    var m = textRun(scene.meta, 500, L.kicker, 0);
    var y = L.headY + k.cap / 2;
    var color = css(C.chalk, 0.72);
    drawRise(k, L.left, y, ease(phase(tau, S8, 0.36)), color);
    if (L.wide) drawRise(m, L.right - m.width, y, ease(phase(tau, S8 + S16, 0.36)), color);
    else drawRise(m, L.left, y + L.kicker * 1.5, ease(phase(tau, S8 + S16, 0.36)), color);
  }

  // Words land on the beat. The last word of each sentence moves the way it reads:
  // "sticks." drops and stops dead, "catch." pulls in like the shuttle and halts on the beat.
  function drawSentence(info, tau) {
    var fit = info.fit;
    var lh = fit.size * LINE_HEIGHT;
    for (var li = 0; li < fit.lines.length; li++) {
      var line = fit.lines[li];
      for (var wi = 0; wi < line.items.length; wi++) {
        var item = line.items[wi];
        var r = item.run;
        var y = info.top + li * lh + (lh - r.ascent - r.descent) / 2 + r.ascent;
        var x = L.left + item.x;
        var land = at(item.word[1]);
        var style = item.word[2];
        var color = style ? css(C['sea-light']) : css(C.chalk);
        if (style === 'stick') {
          var drop = easeInCubic(phase(tau, land - S8, S8));
          if (drop > 0) drawMasked(r, x, y, 0, -(1 - drop) * (r.ascent + r.descent), color);
        } else if (style === 'arrive') {
          var pull = easeHeavy(phase(tau, land - S8, S8));
          if (pull > 0) drawRun(r, x + (1 - pull) * (L.W - x), y, color);
        } else {
          drawRise(r, x, y, ease(phase(tau, land, 0.36)), color);
        }
      }
    }
  }

  function drawScene(i, tau) {
    var ap = aperture(i, tau);
    if (ap.w <= 0 || ap.h <= 0) return;
    ctx.save();
    if (!ap.full) clipRect(ap.x, ap.y, ap.w, ap.h);
    fillBox(ap.x, ap.y, ap.w, ap.h, css(mix(C.petrol, barColor(i), ap.tone)));
    ctx.globalAlpha = 1 - ap.tone;
    drawHeader(SCENES[i], tau);
    // Once the sentence starts, the graphic steps back so the line can be read
    ctx.globalAlpha = (1 - ap.tone) * (1 - 0.6 * ease(phase(tau, at(4), S8)));
    SCENES[i].graphic(tau, L.scenes[i].area);
    ctx.globalAlpha = 1 - ap.tone;
    drawSentence(L.scenes[i], tau);
    ctx.restore();
  }

  /* MangARTI: one word, "you", in three spellings. Ngana loses an a (Ngna), then the other
     a and its capital (ngn). Each letter keeps its identity across the three layouts. */
  var SPELLINGS = [
    { text: 'Ngana', map: [0, 1, 2, 3, 4] },
    { text: 'Ngna', map: [0, 1, -1, 2, 3] },
    { text: 'ngn', map: [0, 1, -1, 2, -1] }
  ];
  var CHANGES = [at(2), at(3)];

  function drawSpellings(tau, area) {
    var probe = textRun('Ngana', 700, 100, TRACK_DISPLAY);
    var size = Math.floor(Math.min(area.h * 0.6, area.w * 0.86 / (probe.width / 100), 260));
    var forms = SPELLINGS.map(function (f) { return textRun(f.text, 700, size, TRACK_DISPLAY); });
    var caption = textRun('One word, “you”, in three spellings', 500, Math.round(L.kicker * 1.15), 0);
    var a = forms[0];
    var lineBox = a.ascent + a.descent;
    var cx = area.x + area.w / 2;
    var y = area.y + (area.h - caption.size * 1.8) / 2 + a.cap / 2;
    var toB = easeHeavy(phase(tau, CHANGES[0], S8));
    var toC = easeHeavy(phase(tau, CHANGES[1], S8));

    ctx.save();
    clipRect(area.x, y - a.ascent, area.w, lineBox);
    ctx.font = a.font;
    ctx.fillStyle = css(C.chalk);
    for (var k = 0; k < SPELLINGS[0].text.length; k++) {
      var enter = ease(phase(tau, S8 + k * 0.05, 0.32));
      if (enter <= 0) continue;
      var xs = SPELLINGS.map(function (f, fi) {
        var j = f.map[k];
        return j < 0 ? null : cx - forms[fi].width / 2 + forms[fi].glyphs[j].x;
      });
      var x = xs[0];
      var dy = (1 - enter) * lineBox;
      if (xs[1] === null) {
        dy += easeInCubic(toB) * lineBox;
      } else {
        x = lerp(x, xs[1], toB);
        if (xs[2] === null) dy += easeInCubic(toC) * lineBox;
        else x = lerp(x, xs[2], toC);
      }
      if (k === 0) drawCaseFlip(x, y + dy, tau - CHANGES[1]);
      else ctx.fillText(a.glyphs[k].ch, x, y + dy);
    }
    ctx.restore();

    drawRise(caption, cx - caption.width / 2, y + a.descent + caption.size * 1.6,
      ease(phase(tau, at(3.25), 0.36)), css(C.chalk, 0.72));
  }

  // N folds down onto the baseline and n unfolds from it, like a split-flap
  function drawCaseFlip(x, y, tau) {
    var fold = phase(tau, 0, S16);
    var lower = fold >= 1;
    var sy = lower ? easeOutBack(phase(tau, S16, S16 * 1.5)) : 1 - easeInCubic(fold);
    if (sy <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, sy);
    ctx.fillText(lower ? 'n' : 'N', 0, 0);
    ctx.restore();
  }

  /* IterMath: the seven modules flip in on 16ths; nCr is picked and its working typesets */
  var MODULES = ['+', '\u2212', '×', '÷', '( )', 'nCr', 'nPr'];
  var PICK = 5;

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

  function drawModules(tau, area) {
    var g = moduleGrid(area);
    var pick = phase(tau, at(2.5), S16);
    var dim = 1 - 0.6 * ease(phase(tau, at(2.5), S8));
    for (var k = 0; k < MODULES.length; k++) {
      var flip = easeOutBack(phase(tau, S8 + k * S16, S16 * 1.5));
      if (flip <= 0) continue;
      var row = Math.floor(k / g.cols);
      var inRow = row === 0 ? Math.min(g.cols, MODULES.length) : MODULES.length - g.cols;
      var x = area.x + (area.w - (inRow * g.tile + (inRow - 1) * g.gap)) / 2 + (k - row * g.cols) * (g.tile + g.gap);
      var y = g.top + row * (g.tile + g.gap);
      var picked = k === PICK;
      var label = textRun(MODULES[k], 600, Math.round(g.tile * (MODULES[k].length > 1 ? 0.3 : 0.44)), 0);
      ctx.save();
      if (!picked) ctx.globalAlpha *= dim;
      ctx.translate(x + g.tile / 2, y + g.tile / 2);
      ctx.scale(1, flip);
      // The picked tile starts out like the rest (a chalk tint over petrol) and fills with sea-light
      roundedBox(-g.tile / 2, -g.tile / 2, g.tile, g.tile, Math.max(4, g.tile * 0.06),
        picked ? css(mix(C.petrol, C['sea-light'], pick)) : css(C.chalk, 0.08));
      if (picked) roundedBox(-g.tile / 2, -g.tile / 2, g.tile, g.tile, Math.max(4, g.tile * 0.06), css(C.chalk, 0.08 * (1 - pick)));
      drawRun(label, -label.width / 2, label.cap / 2, css(picked ? mix(C.chalk, C.petrol, pick) : C.chalk));
      ctx.restore();
    }
    drawFormula(tau, area, g);
  }

  function drawFormula(tau, area, g) {
    var size = Math.round(g.tile * 0.42);
    var lhs = textRun('nCr =', 600, size, 0);
    var numerator = textRun('n!', 600, size, 0);
    var denominator = textRun('r!(n \u2212 r)!', 600, size, 0);
    var barW = Math.max(numerator.width, denominator.width) + size * 0.4;
    var x = area.x + (area.w - (lhs.width + size * 0.4 + barW)) / 2;
    var barX = x + lhs.width + size * 0.4;
    var barY = g.formulaTop + size * 1.05;
    var weight = Math.max(2, size * 0.06);
    var start = at(3);
    var color = css(C.chalk);
    drawRise(lhs, x, barY + weight / 2 + lhs.cap / 2, ease(phase(tau, start, 0.36)), color);
    var draw = easeHeavy(phase(tau, start, S8));
    if (draw > 0) fillBox(barX, barY, barW * draw, weight, color);
    // The numerator rises out of the bar and the denominator drops out of it
    var open = ease(phase(tau, start + S16, 0.36));
    if (open <= 0) return;
    ctx.save();
    clipRect(barX, barY - size * 1.3, barW, size * 1.3);
    drawRun(numerator, barX + (barW - numerator.width) / 2, barY - size * 0.3 + (1 - open) * size * 1.3, color);
    ctx.restore();
    ctx.save();
    clipRect(barX, barY + weight, barW, size * 1.4);
    drawRun(denominator, barX + (barW - denominator.width) / 2, barY + weight + size - (1 - open) * size * 1.3, color);
    ctx.restore();
  }

  /* BSQShuttle: the Kemanggisan route. The shuttle reaches each stop on the beat. */
  var STOPS = ['BSQ', 'Kijang', 'Syahdan', 'Anggrek'];
  var ARRIVALS = [S8, at(1), at(2), at(3)];

  function drawRoute(tau, area) {
    var across = area.w >= area.h;
    var label = Math.round(L.kicker * 1.2);
    var stop = Math.max(8, Math.min(16, Math.min(area.w, area.h) * 0.035));
    var lead = textRun(STOPS[STOPS.length - 1], 500, label, 0).width / 2 + stop;
    var start = across ? { x: area.x + lead, y: area.y + area.h * 0.45 } : { x: area.x + stop * 2, y: area.y + stop * 2 };
    var span = across ? area.w - 2 * lead : area.h - stop * 4 - label;
    function point(u) {
      var d = span * u / (STOPS.length - 1);
      return across ? { x: start.x + d, y: start.y } : { x: start.x, y: start.y + d };
    }

    var u = 0;
    var speed = 0;
    for (var j = 1; j < ARRIVALS.length; j++) {
      var q = phase(tau, ARRIVALS[j] - S8, S8);
      u += easeHeavy(q);
      if (q > 0 && q < 1) speed = Math.sin(Math.PI * q);
    }
    var end = point((STOPS.length - 1) * easeHeavy(phase(tau, S16, S8)));
    var bus = point(u);
    var appear = easeOutBack(phase(tau, S8, S16 * 1.5));
    var travelled = css(C['sea-light']);
    hairline(start.x, start.y, across ? end.x : start.x, across ? start.y : end.y, css(C.chalk, 0.4));
    if (tau >= S8) hairline(start.x, start.y, across ? bus.x : start.x, across ? start.y : bus.y, travelled);

    for (var i = 0; i < STOPS.length; i++) {
      var p = point(i);
      var shown = easeOutBack(phase(tau, S16 + i * 0.06, S16 * 1.5));
      if (shown <= 0) continue;
      var reached = tau >= ARRIVALS[i];
      // Not under the shuttle: it would show through once the graphic is dimmed
      if (appear < 1 || Math.abs(u - i) > 0.05) {
        fillBox(p.x - stop / 2 * shown, p.y - stop / 2 * shown, stop * shown, stop * shown, css(C.chalk, reached ? 1 : 0.4));
      }
      var name = textRun(STOPS[i], 500, label, 0);
      var enter = ease(phase(tau, S8 + i * 0.06, 0.36));
      var color = css(C.chalk, reached ? 1 : 0.56);
      if (across) drawRise(name, p.x - name.width / 2, p.y + stop * 1.5 + name.cap + label * 0.4, enter, color);
      else drawRise(name, p.x + stop * 1.6, p.y + name.cap / 2, enter, color);
    }

    // The shuttle stretches along the route while it moves and settles when it stops
    if (appear <= 0) return;
    var size = stop * 2.2 * appear;
    var along = size * (1 + 0.8 * speed);
    var athwart = size * (1 - 0.25 * speed);
    if (across) fillBox(bus.x - along / 2, bus.y - athwart / 2, along, athwart, travelled);
    else fillBox(bus.x - athwart / 2, bus.y - along / 2, athwart, along, travelled);
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
    if (i < 0 || !aperture(i, tau).full) drawBase(t);
    if (i >= 0) drawScene(i, tau);
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

    // Seed: the hairline, then each bar sounds its own harmonic as it rises
    add(0, 'swish', { d: BEAT, g: 0.6 });
    CHORD.forEach(function (n, i) { add(i + 1, 'pluck', { n: n, g: 1.2 }); });
    add(2, 'riser', { d: at(2) });
    [3.25, 3.5, 3.75].forEach(function (b, i) { add(b, 'clap', { g: 0.35 + 0.25 * i }); });

    // Groove under the three projects. Each scene's bass sits on its bar's note.
    var bass = [[2], [3], [2, 4]];
    var stick = 18; // "sticks." lands here: one hard hit, then the beat stops for an eighth
    for (var beat = 4; beat < 28; beat++) {
      var scene = Math.floor((beat - 4) / 8);
      var inBar = beat % 4;
      if (beat === stick) {
        add(beat, 'kick', { g: 1.1 });
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
      if ((beat - 4) % 8 === 7) add(beat, 'riser', { d: BEAT, g: 0.5 });
    }

    // MangARTI: a drop for each lost letter; the sentence sings its own line
    add(6, 'drop');
    add(7, 'drop');
    melody(8, [24, 20, 24, 27, 24, 32], [0, 0.5, 1, 1.5, 2, 2.5], 0.8);
    // IterMath: the seven modules climb the scale, nCr rings, the working draws
    melody(12.5, [16, 18, 20, 24, 27, 30, 32], [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], 0.7);
    add(14.5, 'bell', { n: 40 });
    add(15, 'swish', { d: S8, g: 0.4 });
    melody(16, [24, 20, 18], [0, 0.5, 1], 0.8);
    // BSQShuttle: the route draws, and a station chime marks each arrival
    add(20.25, 'swish', { d: S8, g: 0.4 });
    [24, 20, 16].forEach(function (n, i) { add(21 + i, 'bell', { n: n }); });
    melody(24, [16, 20, 24, 20, 24], [0, 0.5, 1, 1.25, 1.5], 0.8);
    add(26, 'bell', { n: 32, g: 1.2 });

    // Name: the drums fall away and the mark's chord swells; the flight rises into the landing
    add(28, 'pad', { ns: CHORD.concat([16]), d: at(8) });
    add(28, 'bass', { n: 2, d: at(4), g: 0.5 });
    melody(29, [24, 32], [0, 0.5], 0.6);
    add(30, 'riser', { d: at(2), g: 1.2 });
    [31, 31.25, 31.5, 31.75].forEach(function (b, i) { add(b, 'clap', { g: 0.3 + 0.2 * i }); });

    // Landing
    add(32, 'impact');
    add(32, 'kick', { g: 1.2 });
    add(32, 'crash');
    [16, 24, 40].forEach(function (n) { add(32, 'pluck', { n: n, g: 0.9 }); });

    return score.sort(function (a, b) { return a.t - b.t; });
  }

  // introTime() is the intro's clock read now; offsets are computed against it, not against
  // a frame's timestamp, so the work done since the frame began does not delay the audio
  function createSound(introTime) {
    var AC = window.AudioContext;
    if (!AC) return null;
    var score = buildScore();
    var ac = null, input, verbIn, echoIn, noiseBuffer, bus = null;
    var on = false, wanted = false, next = 0, offset = 0, synced = false, idleTimer = 0;

    function build() {
      ac = new AC();
      var comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      chain(comp, gain(0.9), ac.destination);
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
      drop: function (w, e) {
        var o = osc('sine', HZ * 48, w, w + 0.2);
        o.frequency.exponentialRampToValueAtTime(HZ * 12, w + 0.14);
        out(chain(o, voice(0.25 * e.g, w, 0.003, 0.16)), 0.2);
      },
      swish: function (w, e) {
        var bp = filter('bandpass', 1200, 1.5);
        bp.frequency.setValueAtTime(1200, w);
        bp.frequency.exponentialRampToValueAtTime(7000, w + e.d);
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
        g.gain.setValueAtTime(level, w + Math.max(e.d - 1.4, e.d / 2));
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
      synced = false;
      next = 0;
      while (next < score.length && score[next].t < t) next++;
      // A sustained chord already under way joins in where it is
      score.slice(0, next).forEach(function (e) {
        if (e.v === 'pad' && e.t + e.d > t + 0.5) VOICES.pad(ac.currentTime, { ns: e.ns, d: e.t + e.d - t, g: e.g });
      });
    }

    function stop(fade) {
      closeBus(fade);
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
        if (!synced && ac.state === 'running') {
          var measured = measuredOffset();
          if (measured !== null) {
            offset = measured;
            synced = true;
          }
        }
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

  // Measured on the device: if frames keep running long, draw fewer pixels
  function adapt(interval, t) {
    if (t < BAR || run.maxDpr <= 1 || (window.devicePixelRatio || 1) <= 1) return;
    run.intervals = run.intervals * 0.9 + interval * 0.1;
    run.slow = run.intervals > 24 ? run.slow + 1 : 0;
    if (run.slow < 30) return;
    run.maxDpr = run.maxDpr > 1.5 ? 1.5 : 1;
    run.slow = 0;
    run.intervals = 16;
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
      var held = !!cover.parentNode;
      watch.disconnect();
      window.clearTimeout(timer);
      if (held) cover.parentNode.removeChild(cover);
      return held;
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
