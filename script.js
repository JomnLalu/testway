/* ==========================================================================
   jomontolalu.com
   One fixed WebGL stage, five architectural states, scroll-bound.

   Hero          a stepped terrain of blocks rising to the back right
   About         two mirrored plinths facing each other across a gap
   Capabilities  four equal ziggurats on a tiled floor
   Work          long slat rows; a wave travels with the scroll, four signal rows
   Contact       every block settles into the three bars of the wordmark

   All motion is driven by a damped scroll value (frame-rate independent),
   so the architecture settles as you scroll down and reverses on the way up.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */
  var raf = window.requestAnimationFrame
    ? function (fn) { return window.requestAnimationFrame(fn); }
    : function (fn) { return window.setTimeout(function () { fn(Date.now()); }, 16); };

  var clock = (window.performance && window.performance.now)
    ? function () { return window.performance.now(); }
    : function () { return Date.now(); };

  var PASSIVE = false;
  try {
    var probe = Object.defineProperty({}, 'passive', {
      get: function () { PASSIVE = { passive: true }; return true; }
    });
    window.addEventListener('probe', null, probe);
    window.removeEventListener('probe', null, probe);
  } catch (err) {
    PASSIVE = false;
  }

  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* Exponential damping: identical feel at 30, 60 or 120 fps. */
  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrowQuery = window.matchMedia('(max-width: 899px)');
  var reduced = reducedQuery.matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var narrow = narrowQuery.matches;

  /* The only colours the scene may use. */
  var PALETTE = {
    stone: 0xE5E6E1,
    petrol: 0x0B1618,
    chalk: 0xE8EAE6,
    seaLight: 0x7FC9B6,
    seaDeep: 0x17564A
  };

  function scrollY() {
    return window.pageYOffset || root.scrollTop || 0;
  }

  /* ------------------------------------------------------------------------
     Frame-batched scroll and resize subscribers
     ------------------------------------------------------------------------ */
  var scrollSubs = [];
  var resizeSubs = [];
  var scrollQueued = false;
  var resizeQueued = false;

  function flushScroll() {
    scrollQueued = false;
    var y = scrollY();
    for (var i = 0; i < scrollSubs.length; i++) scrollSubs[i](y);
  }

  function queueScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    raf(flushScroll);
  }

  function flushResize() {
    resizeQueued = false;
    for (var i = 0; i < resizeSubs.length; i++) resizeSubs[i]();
    flushScroll();
  }

  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    raf(flushResize);
  }

  function onScrollFrame(fn) { scrollSubs.push(fn); }
  function onResizeFrame(fn) { resizeSubs.push(fn); }

  window.addEventListener('scroll', queueScroll, PASSIVE);
  window.addEventListener('resize', queueResize, PASSIVE);
  window.addEventListener('orientationchange', queueResize, PASSIVE);
  window.addEventListener('load', queueResize);

  if ('ResizeObserver' in window) {
    new ResizeObserver(queueResize).observe(document.body);
  }

  /* ------------------------------------------------------------------------
     Boot overlay: waits for fonts and the first rendered frame
     ------------------------------------------------------------------------ */
  var boot = (function () {
    var el = document.getElementById('boot');
    var bar = document.getElementById('bootBar');
    var label = document.getElementById('bootLabel');
    var total = 2;
    var done = 0;
    var finished = false;

    function paint() {
      if (bar) bar.style.width = Math.round((done / total) * 100) + '%';
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (bar) bar.style.width = '100%';
      if (label) label.textContent = 'Ready';
      window.setTimeout(function () {
        if (el) el.setAttribute('data-done', 'true');
        root.setAttribute('data-booted', 'true');
      }, reduced ? 0 : 180);
    }

    window.setTimeout(finish, 2600);
    paint();

    return {
      step: function () {
        done = Math.min(done + 1, total);
        paint();
        if (done >= total) finish();
      },
      finish: finish
    };
  })();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { boot.step(); })['catch'](function () { boot.step(); });
  } else {
    boot.step();
  }

  /* ------------------------------------------------------------------------
     Chrome: menu, active section, chapter and scrolled state
     ------------------------------------------------------------------------ */
  (function chrome() {
    var masthead = document.getElementById('masthead');
    var toggle = document.getElementById('menuToggle');
    var menu = document.getElementById('menu');
    var themeMeta = document.getElementById('themeColor');
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));

    if (!masthead || !toggle || !menu) return;

    function setMenu(open) {
      masthead.setAttribute('data-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setMenu(masthead.getAttribute('data-open') !== 'true');
    });

    menu.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && masthead.getAttribute('data-open') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (masthead.getAttribute('data-open') !== 'true') return;
      if (!masthead.contains(e.target)) setMenu(false);
    });

    onMedia(narrowQuery, function (e) {
      narrow = e.matches;
      if (!narrow) setMenu(false);
    });

    var sections = navLinks
      .map(function (a) { return document.getElementById(a.getAttribute('data-nav')); })
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      var seen = {};
      var current = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { seen[entry.target.id] = entry.intersectionRatio; });
        var bestId = null;
        var bestRatio = 0;
        var ids = Object.keys(seen);
        var i;
        for (i = 0; i < ids.length; i++) {
          if (seen[ids[i]] > bestRatio) { bestRatio = seen[ids[i]]; bestId = ids[i]; }
        }
        if (bestId === current) return;
        current = bestId;
        for (i = 0; i < navLinks.length; i++) {
          if (bestId && navLinks[i].getAttribute('data-nav') === bestId) {
            navLinks[i].setAttribute('aria-current', 'location');
          } else {
            navLinks[i].removeAttribute('aria-current');
          }
        }
      }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] });
      sections.forEach(function (s) { io.observe(s); });
    }

    var lastChapter = null;
    window.__setChapter = function (dark) {
      var next = dark ? 'dark' : 'light';
      if (lastChapter === next) return;
      lastChapter = next;
      root.setAttribute('data-chapter', next);
      if (themeMeta) themeMeta.setAttribute('content', dark ? '#0B1618' : '#E5E6E1');
    };

    var lastScrolled = null;
    window.__setScrolled = function (v) {
      if (v === lastScrolled) return;
      lastScrolled = v;
      masthead.setAttribute('data-scrolled', v ? 'true' : 'false');
    };
  })();

  /* ------------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------------ */
  (function reveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduced) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------------------------
     Copy email control
     ------------------------------------------------------------------------ */
  (function copyControl() {
    var btn = document.getElementById('copyEmail');
    var status = document.getElementById('copyStatus');
    if (!btn) return;

    var labelEl = btn.querySelector('.btn__label');
    var address = btn.getAttribute('data-copy');
    var resetTimer = null;

    function setState(state, label, message) {
      btn.setAttribute('data-state', state);
      btn.disabled = (state === 'working');
      labelEl.textContent = label;
      if (status) status.textContent = message || '';
    }

    function reset() {
      setState('idle', 'Copy email address', '');
    }

    function fallbackCopy(text) {
      var input = document.createElement('input');
      input.value = text;
      input.setAttribute('readonly', '');
      input.setAttribute('aria-hidden', 'true');
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(input);
      return ok;
    }

    btn.addEventListener('click', function () {
      window.clearTimeout(resetTimer);
      setState('working', 'Copying', '');
      var started = Date.now();

      var task = (navigator.clipboard && navigator.clipboard.writeText)
        ? navigator.clipboard.writeText(address)
        : (fallbackCopy(address) ? Promise.resolve() : Promise.reject(new Error('blocked')));

      function settle(fn) {
        window.setTimeout(fn, Math.max(0, 220 - (Date.now() - started)));
      }

      task.then(function () {
        settle(function () {
          setState('done', 'Email address copied', address + ' is on your clipboard.');
          resetTimer = window.setTimeout(reset, 2800);
        });
      })['catch'](function () {
        settle(function () {
          setState('idle', 'Copy email address', 'Your browser blocked the clipboard. The address is ' + address + '.');
        });
      });
    });
  })();

  /* ------------------------------------------------------------------------
     Director: maps raw scroll to a continuous stage value 0..4.
     Each section owns an anchor; between anchors the value eases with a
     plateau, so each composition holds still while its section is read.
     ------------------------------------------------------------------------ */
  var SECTION_IDS = ['hero', 'about', 'capabilities', 'work', 'contact'];
  var LAST = SECTION_IDS.length - 1;

  var director = {
    stage: 0,      /* target stage from scroll, 0..4 */
    flow: 0,       /* scroll distance in viewport heights, drives the work wave */
    workTop: 0,    /* top edge of #work relative to the viewport, CSS px */
    pointerX: 0,
    pointerY: 0
  };

  var metrics = {
    anchors: [0, 1, 2, 3, 4],
    workTopDoc: 0,
    mastheadH: 72
  };

  function measure() {
    var y = scrollY();
    var vh = window.innerHeight || 1;
    var maxScroll = Math.max(1, root.scrollHeight - vh);

    function top(id) {
      var el = document.getElementById(id);
      return el ? el.getBoundingClientRect().top + y : 0;
    }

    var a = [
      0,
      top('about') - vh * 0.2,
      top('capabilities') - vh * 0.2,
      top('work') - vh * 0.2,
      Math.min(top('contact') - vh * 0.1, maxScroll)
    ];

    for (var i = 1; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] + 1);

    metrics.anchors = a;
    metrics.workTopDoc = top('work');

    var masthead = document.getElementById('masthead');
    metrics.mastheadH = masthead ? masthead.offsetHeight : 72;
  }

  function stageFor(y) {
    var a = metrics.anchors;
    if (y <= a[0]) return 0;
    for (var i = 0; i < LAST; i++) {
      if (y < a[i + 1]) {
        var t = (y - a[i]) / (a[i + 1] - a[i]);
        /* Hold 15% at each end of the segment: compositions settle and rest. */
        return i + smoothstep((t - 0.15) / 0.7);
      }
    }
    return LAST;
  }

  function readScroll(y) {
    var vh = window.innerHeight || 1;
    director.stage = stageFor(y);
    director.flow = y / vh;
    director.workTop = metrics.workTopDoc - y;

    if (window.__setChapter) window.__setChapter(director.workTop <= metrics.mastheadH);
    if (window.__setScrolled) window.__setScrolled(y > 24);
  }

  measure();
  readScroll(scrollY());
  onResizeFrame(measure);
  onScrollFrame(readScroll);

  if (!coarse && !reduced) {
    window.addEventListener('pointermove', function (e) {
      director.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      director.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    }, PASSIVE);
  }

  /* ------------------------------------------------------------------------
     Stage
     ------------------------------------------------------------------------ */
  (function stage() {
    var canvas = document.getElementById('stage');

    if (typeof THREE === 'undefined' || !canvas) {
      root.setAttribute('data-webgl', 'off');
      boot.step();
      return;
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !coarse,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      root.setAttribute('data-webgl', 'off');
      boot.step();
      return;
    }

    var maxDpr = coarse ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(new THREE.Color(PALETTE.stone), 1);
    renderer.sortObjects = true;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 80);

    /* ---- Grid ------------------------------------------------------------ */
    var COLS = 32;
    var ROWS = 20;
    var CELL = 0.16;          /* one module: every block is built in cubes of this size */
    var COUNT = COLS * ROWS;

    var colors = {
      uStone: { value: new THREE.Color(PALETTE.stone) },
      uPetrol: { value: new THREE.Color(PALETTE.petrol) },
      uChalk: { value: new THREE.Color(PALETTE.chalk) },
      uSeaLight: { value: new THREE.Color(PALETTE.seaLight) },
      uSeaDeep: { value: new THREE.Color(PALETTE.seaDeep) }
    };

    var uniforms = {
      uStage: { value: 0 },
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uSplit: { value: -1 },
      uIntensity: { value: 1 },
      uFogNear: { value: 6 },
      uFogFar: { value: 14 },
      uStone: colors.uStone,
      uPetrol: colors.uPetrol,
      uChalk: colors.uChalk,
      uSeaLight: colors.uSeaLight,
      uSeaDeep: colors.uSeaDeep
    };

    /* Chapter split shared by the backdrop and the blocks: every pixel
       below the top edge of #work uses the dark palette. */
    var SPLIT_GLSL = [
      'uniform float uSplit;',
      'float darkMask(){',
      '  return clamp(uSplit - gl_FragCoord.y + 0.5, 0.0, 1.0);',
      '}'
    ].join('\n');

    /* ---- Backdrop: full-screen quad, stone above the split, petrol below -- */
    var backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: uniforms,
        depthTest: false,
        depthWrite: false,
        vertexShader: [
          'void main(){',
          '  gl_Position = vec4(position.xy, 0.0, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uStone;',
          'uniform vec3 uPetrol;',
          SPLIT_GLSL,
          'void main(){',
          '  gl_FragColor = vec4(mix(uStone, uPetrol, darkMask()), 1.0);',
          '}'
        ].join('\n')
      })
    );
    backdrop.frustumCulled = false;
    backdrop.renderOrder = -10;
    scene.add(backdrop);

    /* ---- Blocks ------------------------------------------------------------ */
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0); /* base on the floor, grows upward */

    var cellAttr = new Float32Array(COUNT * 2);
    var seedAttr = new Float32Array(COUNT);

    var VERT = [
      'attribute vec2 aCell;',
      'attribute float aSeed;',
      'uniform float uStage;',
      'uniform float uTime;',
      'uniform float uFlow;',
      'varying vec3 vNormal;',
      'varying vec3 vLocal;',
      'varying vec3 vSize;',
      'varying float vFloorY;',
      'varying float vAccent;',
      'varying float vDepth;',
      '',
      '#define CELL ' + CELL.toFixed(4),
      '',
      'float hash21(vec2 p){',
      '  p = fract(p * vec2(123.34, 345.45));',
      '  p += dot(p, p + 34.345);',
      '  return fract(p.x * p.y);',
      '}',
      'float vnoise(vec2 p){',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i);',
      '  float b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0));',
      '  float d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
      '}',
      'float inRange(float v, float a, float b){',
      '  return step(a - 0.5, v) * step(v, b + 0.5);',
      '}',
      '',
      /* S = (height in modules, presence 0..1, accent 0..1, unused)
         F = footprint (x, z) as a fraction of one cell */
      '// 0. Hero: stepped terrain rising to the back right',
      'void stHero(vec2 c, float seed, out vec4 S, out vec2 F){',
      '  vec2 q = c - vec2(15.5, 9.5);',
      '  float cheb = max(abs(q.x) / 15.0, abs(q.y) / 9.0);',
      '  float p = step(cheb, 0.80 + 0.2 * hash21(c + 7.13));',
      '  float rise = (c.x / 31.0) * 0.62 + (1.0 - c.y / 19.0) * 0.38;',
      '  float n = vnoise(c * 0.22 + 3.1);',
      '  float m = 1.0 + floor(pow(rise, 1.7) * 8.0 * (0.4 + 0.6 * n));',
      '  float breathe = 0.5 + 0.5 * sin(uTime * 0.32 + seed * 43.0);',
      '  m += smoothstep(0.93, 1.0, breathe);',
      '  S = vec4(m, p, step(0.975, seed) * step(4.0, m), 0.0);',
      '  F = vec2(0.84);',
      '}',
      '',
      '// 1. About: two mirrored plinths, stepping up toward the gap',
      'void stAbout(vec2 c, float seed, out vec4 S, out vec2 F){',
      '  float rows = inRange(c.y, 4.0, 15.0);',
      '  float left = rows * inRange(c.x, 3.0, 13.0);',
      '  float right = rows * inRange(c.x, 18.0, 28.0);',
      '  float m = 1.0;',
      '  m = mix(m, 1.0 + floor((c.x - 3.0) / 2.0), left);',
      '  m = mix(m, 1.0 + floor((28.0 - c.x) / 2.0), right);',
      '  float a = left * inRange(c.x, 13.0, 13.0) + right * inRange(c.x, 18.0, 18.0);',
      '  S = vec4(m, left + right, a, 0.0);',
      '  F = vec2(0.84);',
      '}',
      '',
      '// 2. Capabilities: four equal ziggurats on a tiled floor',
      'void stCapabilities(vec2 c, float seed, out vec4 S, out vec2 F){',
      '  float floorP = inRange(c.y, 3.0, 16.0) * inRange(c.x, 1.0, 30.0);',
      '  float lx = c.x - 3.0;',
      '  float k = floor(lx / 7.0);',
      '  float px = lx - k * 7.0;',
      '  float pad = inRange(k, 0.0, 3.0) * inRange(px, 0.0, 4.0) * inRange(c.y, 7.0, 11.0);',
      '  float d = max(abs(px - 2.0), abs(c.y - 9.0));',
      '  float m = mix(0.25, 1.0 + (2.0 - d) * 1.5, pad);',
      '  S = vec4(m, max(floorP, pad), pad * step(d, 0.5), 0.0);',
      '  F = mix(vec2(0.92), vec2(0.84), pad);',
      '}',
      '',
      '// 3. Work: slat rows; a wave travels with the scroll',
      'void stWork(vec2 c, float seed, out vec4 S, out vec2 F){',
      '  float p = inRange(c.x, 1.0, 30.0) * inRange(c.y, 1.0, 18.0);',
      '  float w = 0.5 + 0.5 * sin(c.x * 0.34 - uFlow * 2.4 + c.y * 0.62);',
      '  w *= 0.62 + 0.38 * sin(c.x * 0.13 + c.y * 0.21 - uFlow * 0.9);',
      '  float depth = 0.45 + 0.55 * (1.0 - c.y / 19.0);',
      '  float m = 0.75 + 6.5 * w * w * depth;',
      '  float signalRow = step(abs(mod(c.y, 4.0) - 3.0), 0.1);',
      '  S = vec4(m, p, signalRow * smoothstep(0.42, 0.62, w), 0.0);',
      '  F = vec2(0.96, 0.42);',
      '}',
      '',
      '// 4. Contact: the three bars of the wordmark on a low plinth',
      'void stContact(vec2 c, float seed, out vec4 S, out vec2 F){',
      '  float plinth = inRange(c.y, 5.0, 14.0) * inRange(c.x, 2.0, 29.0);',
      '  float rows = inRange(c.y, 7.0, 12.0);',
      '  float b1 = rows * inRange(c.x, 4.0, 8.0);',
      '  float b2 = rows * inRange(c.x, 13.0, 17.0);',
      '  float b3 = rows * inRange(c.x, 22.0, 26.0);',
      '  float bar = b1 + b2 + b3;',
      '  float m = 0.5;',
      '  m = mix(m, 6.0, b1);',
      '  m = mix(m, 11.0, b2);',
      '  m = mix(m, 16.0, b3);',
      '  S = vec4(m, max(plinth, bar), b3, 0.0);',
      '  F = mix(vec2(0.9), vec2(1.0), bar);',
      '}',
      '',
      'void stateAt(float i, vec2 c, float seed, out vec4 S, out vec2 F){',
      '  if (i < 0.5) stHero(c, seed, S, F);',
      '  else if (i < 1.5) stAbout(c, seed, S, F);',
      '  else if (i < 2.5) stCapabilities(c, seed, S, F);',
      '  else if (i < 3.5) stWork(c, seed, S, F);',
      '  else stContact(c, seed, S, F);',
      '}',
      '',
      'void main(){',
      '  float i0 = floor(uStage);',
      '  float f = uStage - i0;',
      '  float i1 = min(i0 + 1.0, 4.0);',
      '',
      '  vec4 A; vec2 FA; vec4 B; vec2 FB;',
      '  stateAt(i0, aCell, aSeed, A, FA);',
      '  stateAt(i1, aCell, aSeed, B, FB);',
      '',
      /* Staggered hand-off: blocks settle in a sweep from left to right,
         with a little per-block jitter, like a crane placing modules. */
      '  float delay = (aCell.x / 31.0) * 0.6 + aSeed * 0.4;',
      '  float k = smoothstep(0.0, 1.0, clamp((f - delay * 0.45) / 0.55, 0.0, 1.0));',
      '',
      '  float hA = mix(B.x, A.x, step(0.5, A.y));',
      '  float hB = mix(A.x, B.x, step(0.5, B.y));',
      '  float m = mix(hA, hB, k);',
      '  float p = mix(A.y, B.y, k);',
      '  vec2 fp = mix(FA, FB, k);',
      '  vAccent = mix(A.z, B.z, k);',
      '',
      '  float h = max(m * CELL, 0.004);',
      '  float sink = (1.0 - p) * (h + 0.32);',
      '  vec3 size = vec3(CELL * fp.x, h, CELL * fp.y);',
      '  if (p < 0.002) size = vec3(0.0);',
      '',
      '  vec3 local = position * size;',
      '  local.y -= sink;',
      '  vec3 origin = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);',
      '  vec4 mv = viewMatrix * modelMatrix * vec4(origin + local, 1.0);',
      '',
      '  vNormal = normal;',
      '  vLocal = position;',
      '  vSize = size;',
      '  vFloorY = local.y;',
      '  vDepth = -mv.z;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');

    var FRAG = [
      'uniform vec3 uStone;',
      'uniform vec3 uPetrol;',
      'uniform vec3 uChalk;',
      'uniform vec3 uSeaLight;',
      'uniform vec3 uSeaDeep;',
      'uniform float uIntensity;',
      'uniform float uFogNear;',
      'uniform float uFogFar;',
      SPLIT_GLSL,
      'varying vec3 vNormal;',
      'varying vec3 vLocal;',
      'varying vec3 vSize;',
      'varying float vFloorY;',
      'varying float vAccent;',
      'varying float vDepth;',
      '',
      '#define CELL ' + CELL.toFixed(4),
      '',
      'void main(){',
      '  float dm = darkMask();',
      '  vec3 bg = mix(uStone, uPetrol, dm);',
      '  vec3 n = normalize(vNormal);',
      '',
      /* Key light from the upper left front. Tops read brightest. */
      '  vec3 L = normalize(vec3(-0.5, 0.9, 0.42));',
      '  float lit = clamp(dot(n, L) / L.y, 0.0, 1.0);',
      '',
      /* Two palettes: chalk blocks on stone, petrol blocks on petrol.
         Shadows always fall toward petrol, highlights toward chalk. */
      '  vec3 face = mix(uChalk, mix(uPetrol, uChalk, 0.30), dm);',
      '  vec3 shade = mix(mix(uChalk, uPetrol, 0.48), mix(uPetrol, uChalk, 0.06), dm);',
      '  vec3 accent = mix(uSeaDeep, uSeaLight, dm);',
      '  float top = step(0.5, n.y);',
      '  face = mix(face, accent, vAccent * (0.22 + 0.78 * top));',
      '  vec3 col = mix(shade, face, 0.16 + 0.84 * lit);',
      '',
      /* Ambient occlusion where side faces meet the floor. */
      '  float side = 1.0 - abs(n.y);',
      '  float ao = smoothstep(0.0, 0.24, vFloorY);',
      '  col = mix(shade, col, mix(1.0, 0.4 + 0.6 * ao, side));',
      '',
      /* Hairline edges and module grooves, anti-aliased with derivatives. */
      '  vec3 wl = vLocal * vSize;',
      '  vec3 an = abs(n);',
      '  vec3 e = vec3(',
      '    0.5 * vSize.x - abs(wl.x),',
      '    min(wl.y, vSize.y - wl.y),',
      '    0.5 * vSize.z - abs(wl.z)',
      '  ) + an * 100.0;',
      '  float edge = min(min(e.x, e.y), e.z);',
      '  float lineE = 1.0 - smoothstep(0.0, max(fwidth(edge) * 1.2, 1e-4), edge);',
      '  float gy = mod(wl.y, CELL);',
      '  gy = min(gy, CELL - gy) + an.y * 100.0;',
      '  float lineG = 1.0 - smoothstep(0.0, max(fwidth(wl.y) * 1.1, 1e-4), gy);',
      '  float line = max(lineE, lineG * 0.5);',
      '  vec3 lineCol = mix(mix(uChalk, uPetrol, 0.66), mix(uPetrol, uChalk, 0.58), dm);',
      '  col = mix(col, lineCol, line * 0.6);',
      '',
      /* Sink below the floor into the ground colour; recede with depth. */
      '  float under = smoothstep(-0.01, -0.28, vFloorY);',
      '  float fog = smoothstep(uFogNear, uFogFar, vDepth);',
      '  float vis = uIntensity * (1.0 - under) * (1.0 - fog * 0.9);',
      '  if (under > 0.995) discard;',
      '  gl_FragColor = vec4(mix(bg, col, vis), 1.0);',
      '}'
    ].join('\n');

    var blockMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      extensions: { derivatives: true }
    });

    var blocks = new THREE.InstancedMesh(boxGeo, blockMat, COUNT);
    blocks.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    blocks.frustumCulled = false;

    var dummy = new THREE.Object3D();
    var idx = 0;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        dummy.position.set((c - (COLS - 1) / 2) * CELL, 0, (r - (ROWS - 1) / 2) * CELL);
        dummy.updateMatrix();
        blocks.setMatrixAt(idx, dummy.matrix);
        cellAttr[idx * 2] = c;
        cellAttr[idx * 2 + 1] = r;
        /* Deterministic per-block seed so the layout is identical every load */
        var s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
        seedAttr[idx] = s - Math.floor(s);
        idx++;
      }
    }
    blocks.instanceMatrix.needsUpdate = true;
    boxGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellAttr, 2));
    boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1));

    var group = new THREE.Group();
    group.add(blocks);
    scene.add(group);

    /* ---- Compositions --------------------------------------------------------
       pos / look: camera in world units.
       shift: lens shift as a fraction of the viewport, [x, y]. +x moves the
              architecture right, +y moves it up. This keeps perspective
              orthogonal (no camera yaw) while holding it opposite the text.
       intensity: how strongly the architecture reads against the ground.
       scale: proportion relative to the section's importance.
    ---------------------------------------------------------------------------- */
    var WIDE = [
      { pos: [5.2, 4.2, 8.4], look: [0.1, 0.45, 0], shift: [0.22, 0.02], intensity: 1.0, scale: 0.92 },
      { pos: [-5.4, 3.4, 7.6], look: [0, 0.35, 0], shift: [-0.22, -0.2], intensity: 0.92, scale: 0.78 },
      { pos: [2.6, 5.6, 7.4], look: [0, 0.2, 0], shift: [0.2, 0.2], intensity: 0.8, scale: 0.72 },
      { pos: [5.4, 2.1, 5.4], look: [0, 0.35, -0.4], shift: [0.22, -0.02], intensity: 0.85, scale: 1.0 },
      { pos: [-4.4, 3.0, 8.8], look: [0.2, 0.95, 0], shift: [0.22, -0.04], intensity: 1.0, scale: 0.84 }
    ];

    var NARROW = [
      { pos: [5.2, 4.8, 8.4], look: [0.1, 0.45, 0], shift: [0.0, 0.26], intensity: 0.6, scale: 0.8 },
      { pos: [-5.4, 3.8, 7.6], look: [0, 0.35, 0], shift: [0.0, 0.06], intensity: 0.7, scale: 0.84 },
      { pos: [2.6, 6.0, 7.4], look: [0, 0.2, 0], shift: [0.0, 0.0], intensity: 0.6, scale: 0.84 },
      { pos: [5.4, 2.6, 5.4], look: [0, 0.35, -0.4], shift: [0.0, 0.0], intensity: 0.7, scale: 1.0 },
      { pos: [-4.4, 3.2, 8.8], look: [0.2, 0.95, 0], shift: [0.0, -0.16], intensity: 0.85, scale: 0.84 }
    ];

    var keyframes = narrow ? NARROW : WIDE;
    var viewW = 1;
    var viewH = 1;
    var distScale = 1;

    function layout() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      viewW = w;
      viewH = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      keyframes = narrow ? NARROW : WIDE;
      /* Pull the camera back on tall screens so the structure keeps its proportion. */
      distScale = clamp(1 + (1.5 - camera.aspect) * 0.55, 1, 2.1);
      camera.updateProjectionMatrix();
    }

    layout();

    var pos = new THREE.Vector3();
    var look = new THREE.Vector3();
    var tmp = new THREE.Vector3();
    var bufferSize = new THREE.Vector2();

    var smooth = {
      stage: director.stage,
      flow: director.flow,
      px: 0,
      py: 0
    };

    function frameAt(stage) {
      var i0 = Math.floor(clamp(stage, 0, LAST));
      var i1 = Math.min(i0 + 1, LAST);
      var t = smoothstep(stage - i0);
      var a = keyframes[i0];
      var b = keyframes[i1];

      pos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
      look.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));

      return {
        shiftX: lerp(a.shift[0], b.shift[0], t),
        shiftY: lerp(a.shift[1], b.shift[1], t),
        intensity: lerp(a.intensity, b.intensity, t),
        scale: lerp(a.scale, b.scale, t)
      };
    }

    function paint(dt, snap) {
      /* Heavy architecture: a low damping constant so it settles, not snaps. */
      if (snap || reduced) {
        smooth.stage = director.stage;
        smooth.flow = director.flow;
        smooth.px = director.pointerX;
        smooth.py = director.pointerY;
      } else {
        smooth.stage = damp(smooth.stage, director.stage, 2.6, dt);
        smooth.flow = damp(smooth.flow, director.flow, 3.2, dt);
        smooth.px = damp(smooth.px, director.pointerX, 2.4, dt);
        smooth.py = damp(smooth.py, director.pointerY, 2.4, dt);
      }

      if (!reduced) uniforms.uTime.value += dt;
      uniforms.uStage.value = smooth.stage;
      uniforms.uFlow.value = smooth.flow;

      var frame = frameAt(smooth.stage);
      uniforms.uIntensity.value = frame.intensity;
      group.scale.setScalar(frame.scale);

      /* Camera: dolly between compositions, scaled for the viewport. */
      tmp.copy(pos).sub(look).multiplyScalar(distScale);
      pos.copy(look).add(tmp);
      pos.x += smooth.px * 0.32;
      pos.y += -smooth.py * 0.2;
      camera.position.copy(pos);
      camera.lookAt(look);

      var dist = tmp.length();
      uniforms.uFogNear.value = dist * 0.92;
      uniforms.uFogFar.value = dist * 1.7;

      /* Lens shift keeps the structure in the open half of the grid. */
      camera.setViewOffset(viewW, viewH, -frame.shiftX * viewW, frame.shiftY * viewH, viewW, viewH);

      /* Chapter split: read live scroll, not the damped value, so the
         ground under the DOM always matches the section above it. */
      renderer.getDrawingBufferSize(bufferSize);
      var ratio = bufferSize.y / (canvas.clientHeight || viewH);
      var workTop = metrics.workTopDoc - scrollY();
      uniforms.uSplit.value = bufferSize.y - workTop * ratio;

      renderer.render(scene, camera);
    }

    /* ---- Loop ---------------------------------------------------------------- */
    var running = false;
    var snapNext = true;
    var lastT = 0;

    function step(t) {
      if (!running) return;
      var dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      paint(dt, snapNext);
      snapNext = false;
      if (reduced) {
        running = false;
        return;
      }
      raf(step);
    }

    function play() {
      if (running || document.hidden) return;
      running = true;
      lastT = clock();
      raf(step);
    }

    function pause() {
      running = false;
    }

    paint(0, true);
    root.setAttribute('data-webgl', 'on');
    boot.step();

    onResizeFrame(function () {
      layout();
      snapNext = true;
      play();
    });

    /* With reduced motion there is no loop: one static frame per scroll. */
    onScrollFrame(function () {
      if (reduced) play();
    });

    onMedia(reducedQuery, function (e) {
      reduced = e.matches;
      snapNext = true;
      play();
    });

    onMedia(narrowQuery, function (e) {
      narrow = e.matches;
      layout();
      snapNext = true;
      play();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pause();
        return;
      }
      snapNext = true;
      play();
    });

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      pause();
      root.setAttribute('data-webgl', 'off');
    });

    canvas.addEventListener('webglcontextrestored', function () {
      root.setAttribute('data-webgl', 'on');
      snapNext = true;
      play();
    });

    window.addEventListener('pagehide', function () {
      pause();
      try { renderer.dispose(); } catch (err) { /* already released */ }
    });

    play();
  })();
})();
