/* ==========================================================================
   jomontolalu.com
   One script for every page, and one fixed WebGL stage on each: the
   kinetic data monolith.

   Two walls of matte, stacked blocks line a canyon. The copy sits on the
   empty floor between them: the canyon is fitted to the text column on
   every resize, so the architecture frames the content instead of sitting
   behind it.

   Page          each HTML file names itself on <body data-page>. That key
                 picks the chapter (stone or petrol ground) and the formation
                 the walls are built in, before the first frame is drawn
   Scroll        the walls travel toward the horizon at a parallax rate
   Pointer       a raycast onto the crest of the walls drives a topographic
                 well: blocks under the cursor sink, a ring around them rises
   Click / tap   a sea green pulse runs outward through the glass slats

   Every moving value is eased with exponential damping (frame-rate
   independent). The loop sleeps as soon as the architecture has settled.
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
  function wrap(v, p) { return v - p * Math.floor(v / p); }

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
    ink: 0x14181A,
    seaLight: 0x7FC9B6,
    seaDeep: 0x17564A
  };

  function scrollY() {
    return window.pageYOffset || root.scrollTop || 0;
  }

  /* ------------------------------------------------------------------------
     Pages: the one key every module reads. <body data-page> names the page.
     Its chapter is also written into that file's <html data-chapter> and
     theme-color, so the first paint is right before this script runs:
     keep the two in step.

     Formations are in height modules. The two columns on the canyon edge
     form a clean cliff; rise and noise build the mass behind it. Every `bay`
     rows the wall opens and a glass slat stands in the gap.
     ------------------------------------------------------------------------ */
  var PAGES = {
    home: {
      chapter: 'light',   /* the monolith */
      formation: { base: 10, rise: 1, noise: 8, bay: 6, depth: 0.9 }
    },
    about: {
      chapter: 'light',   /* terraces */
      formation: { base: 6, rise: 2, noise: 0, bay: 8, depth: 0.9 }
    },
    capabilities: {
      chapter: 'light',   /* four-block bays */
      formation: { base: 6, rise: 1, noise: 0, bay: 5, depth: 0.9, zig: 2 }
    },
    work: {
      chapter: 'dark',    /* data slats */
      formation: { base: 4, rise: 1, noise: 0, bay: 4, depth: 0.42, wave: 8 }
    },
    contact: {
      chapter: 'dark',    /* the monolith settles */
      formation: { base: 3, rise: 1, noise: 3, bay: 9, depth: 0.9 }
    }
  };

  var page = PAGES[document.body.getAttribute('data-page')] || PAGES.home;
  var dark = page.chapter === 'dark';

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
     Boot overlay: waits for fonts and the first rendered frame, once per
     visit. Every later page opens warm (the inline script in each <head>
     reads BOOT_KEY): no overlay, the copy enters straight away and the
     stage fades in when its first frame is ready.
     ------------------------------------------------------------------------ */
  var BOOT_KEY = 'jm:booted';

  var boot = (function () {
    var el = document.getElementById('boot');
    var bar = document.getElementById('bootBar');
    var label = document.getElementById('bootLabel');
    var warm = root.getAttribute('data-boot') === 'warm';
    var total = 2;
    var done = 0;
    var finished = false;
    var booted = false;
    var queue = [];

    /* The bar scales instead of resizing: compositor only, no layout */
    function paint() {
      if (bar) bar.style.transform = 'scaleX(' + (done / total) + ')';
    }

    function release() {
      booted = true;
      if (el) el.setAttribute('data-done', 'true');
      root.setAttribute('data-booted', 'true');
      /* The head script falls back to no-js if this file is slow or fails;
         a late boot takes the page back */
      root.classList.remove('no-js');
      while (queue.length) queue.shift()();
    }

    function finish() {
      if (finished) return;
      finished = true;
      try { window.sessionStorage.setItem(BOOT_KEY, '1'); } catch (err) { /* storage blocked: every page boots cold */ }
      if (warm) {
        /* Let the entrance styles paint once, so the copy still eases in */
        raf(function () { raf(release); });
        return;
      }
      if (bar) bar.style.transform = 'scaleX(1)';
      if (label) label.textContent = 'Ready';
      window.setTimeout(release, reduced ? 0 : 180);
    }

    if (warm) {
      finish();
    } else {
      window.setTimeout(finish, 2600);
      paint();
    }

    return {
      step: function () {
        done = Math.min(done + 1, total);
        paint();
        if (done >= total) finish();
      },
      /* Runs fn once the overlay has lifted (at once if it already has) */
      ready: function (fn) {
        if (booted) fn();
        else queue.push(fn);
      }
    };
  })();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { boot.step(); })['catch'](function () { boot.step(); });
  } else {
    boot.step();
  }

  /* ------------------------------------------------------------------------
     Chrome: chapter, menu and scrolled state. The current page is marked
     with aria-current="page" in each HTML file, so it needs no script.
     ------------------------------------------------------------------------ */
  (function chrome() {
    var masthead = document.getElementById('masthead');
    var toggle = document.getElementById('menuToggle');
    var menu = document.getElementById('menu');
    var themeMeta = document.getElementById('themeColor');

    /* Normally a no-op: the HTML already carries the page's chapter */
    root.setAttribute('data-chapter', page.chapter);
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#0B1618' : '#E5E6E1');

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

    /* Tabbing out of the open menu closes it, so it never hangs over the page */
    masthead.addEventListener('focusout', function (e) {
      if (masthead.getAttribute('data-open') !== 'true') return;
      if (e.relatedTarget && !masthead.contains(e.relatedTarget)) setMenu(false);
    });

    onMedia(narrowQuery, function (e) {
      narrow = e.matches;
      if (!narrow) setMenu(false);
    });

    var scrolled = null;

    function readScroll(y) {
      var next = y > 24;
      if (next === scrolled) return;
      scrolled = next;
      masthead.setAttribute('data-scrolled', next ? 'true' : 'false');
    }

    readScroll(scrollY());
    onScrollFrame(readScroll);
  })();

  /* ------------------------------------------------------------------------
     Reveal on scroll. Starts once the boot overlay lifts, so the first
     screen of every page enters in view rather than behind the overlay.
     ------------------------------------------------------------------------ */
  boot.ready(function reveal() {
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
    /* Threshold 0: a chapter much taller than the screen (the MangARTI case
       study) can never show 8% of itself at once, so any ratio would strand it */
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });

    items.forEach(function (el) { io.observe(el); });
  });

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

    /* aria-disabled, not disabled: a disabled button loses keyboard focus */
    function setState(state, label, message) {
      btn.setAttribute('data-state', state);
      btn.setAttribute('aria-disabled', state === 'working' ? 'true' : 'false');
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
      if (btn.getAttribute('aria-disabled') === 'true') return;
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
     Stage
     ------------------------------------------------------------------------ */
  /* Same build from two CDNs: the second is only tried if the first fails */
  var THREE_URLS = [
    'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
    'https://unpkg.com/three@0.185.1/build/three.module.min.js'
  ];

  function loadThree(i) {
    return import(THREE_URLS[i])['catch'](function (err) {
      if (i + 1 < THREE_URLS.length) return loadThree(i + 1);
      throw err;
    });
  }

  (function stage() {
    var canvas = document.getElementById('stage');

    /* Falls back to the static slats, and says why in the console */
    function unavailable(reason) {
      root.setAttribute('data-webgl', 'off');
      if (window.console && console.warn) {
        console.warn('Stage: showing the static fallback. ' + (reason && reason.message ? reason.message : reason));
      }
      boot.step();
    }

    if (!canvas) return;

    if (!('WebGL2RenderingContext' in window)) {
      unavailable('This browser has no WebGL 2.');
      return;
    }

    loadThree(0).then(build, function (err) {
      unavailable('three.js could not be loaded: ' + (err && err.message ? err.message : err));
    })['catch'](unavailable);

    function build(THREE) {
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          antialias: !coarse,
          alpha: false,
          powerPreference: 'high-performance'
        });
      } catch (err) {
        unavailable('WebGL 2 is disabled or unavailable on this device: ' + err.message);
        return;
      }

      /* ---- Dimensions --------------------------------------------------------
         One plan cell is one world unit. Blocks stack in height modules.
      ---------------------------------------------------------------------------- */
      var DEG = Math.PI / 180;
      var CELL = 1;
      var MODULE = 0.5;
      var JOINT = 1;            /* a visible joint every two modules: stacked cubes */
      var MAX_COLS = 40;        /* per wall: enough for a 32:9 monitor */
      var MAX_ROWS = 72;
      var COUNT = MAX_ROWS * MAX_COLS * 2;
      var live = 0;             /* slots in use: packed densely from index 0 */
      var MAX_H = 14;           /* tallest block, pointer rim included */
      var TALLEST = 24;         /* tallest profile, in modules: leaves room for the rim */
      var MATTE_W = 0.9;        /* footprint across the wall, as a fraction of a cell */
      var GLASS_W = 0.98;
      var GLASS_D = 0.24;       /* glass slats are thin along the canyon */
      var GLASS_RISE = 4;       /* modules a slat stands proud of its bay */

      /* Lenses. Landscape screens look down the canyon at a moderate angle,
         close enough that the walls lean out of frame and converge toward the
         far end. Portrait screens keep the horizontal field of a square frame
         from higher up, so a phone sees the same canyon rather than a
         telephoto crop of it. */
      var LENS_WIDE = { fov: 34, tilt: 50 * DEG, dist: 32 };
      var LENS_TALL = { fov: 22, tilt: 58 * DEG, dist: 48 };
      var LENS = LENS_WIDE;
      var FIT_Y = 0.55;         /* NDC height at which the wall base meets the column edge */
      var MARGIN_PX = 48;       /* air between the copy and the foot of each wall */
      var NARROW_EDGE = 0.8;    /* on phones the walls rise from the outer edges */
      var PARALLAX = 0.42;      /* floor speed at mid screen, relative to the page */

      /* Motion constants: exponential damping rates, per second */
      var TRAVEL_RATE = 7;
      var SWAY_RATE = 2.6;
      var HEIGHT_RATE = 9;
      var WELL_RATE = 5;
      var WELL_FOLLOW = 14;
      var PULSE_RATE = 16;

      /* Proximity well: a Ricker profile. The centre sinks by WELL_DEPTH,
         a ring at 1.73 sigma rises by 45% of that. */
      var CREST_Y = 4;
      var WELL_SIGMA = 1.8;
      var WELL_DEPTH = 5 * MODULE;

      /* Click pulse: the front eases out to RIPPLE_REACH while its energy decays */
      var RIPPLE_REACH = 48;
      var RIPPLE_SPEED = 1.2;
      var RIPPLE_FADE = 0.9;
      var RING_WIDTH = 1.3;
      var RIPPLE_KICK = 1.2 * MODULE;
      var MAX_RIPPLES = 4;

      /* The whole canyon is built in this page's formation (see PAGES), from
         the very first frame: nothing about it depends on scroll depth. */
      var FORMATION = page.formation;
      var CLIFF = 2;

      var maxDpr = coarse ? 1.5 : 2;
      var MAX_PIXELS = 6e6;     /* drawing buffer budget: keeps 4K and 5K screens in GPU memory */

      function pixelRatio() {
        var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
        var area = Math.max(window.innerWidth * window.innerHeight, 1);
        return Math.max(1, Math.min(dpr, Math.sqrt(MAX_PIXELS / area)));
      }

      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.setClearColor(new THREE.Color(dark ? PALETTE.petrol : PALETTE.stone), 1);
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      /* The light never moves: the shadow map is redrawn only when blocks do */
      renderer.shadowMap.autoUpdate = false;
      /* Refraction is blurred by roughness anyway: sample it at reduced size */
      renderer.transmissionResolutionScale = coarse ? 0.5 : 0.75;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(LENS.fov, window.innerWidth / window.innerHeight, 1, 160);

      function tone(a, b, t) {
        return new THREE.Color(a).lerp(new THREE.Color(b), t);
      }

      var uniforms = {
        uDark: { value: dark ? 1 : 0 },
        uJoint: { value: JOINT },
        uStone: { value: new THREE.Color(PALETTE.stone) },
        uPetrol: { value: new THREE.Color(PALETTE.petrol) },
        uAlbedo: { value: new THREE.Color(PALETTE.stone) },
        uAlbedoDark: { value: tone(PALETTE.petrol, PALETTE.stone, 0.16) },
        uLineDark: { value: tone(PALETTE.petrol, PALETTE.chalk, 0.42) },
        uAmbientDark: { value: 0.55 },
        uPulse: { value: new THREE.Color(PALETTE.seaLight).multiplyScalar(1.6) },
        uPulseFilter: { value: new THREE.Color(PALETTE.seaLight) }
      };
      /* The filter keeps the hue of sea green at full brightness */
      var sea = uniforms.uPulseFilter.value;
      sea.multiplyScalar(1 / Math.max(sea.r, sea.g, sea.b));

      /* ---- Backdrop: the page's chapter ground; unlit, exact ----------------
         Drawn as a mesh rather than left to the clear colour, so the glass
         refracts the same ground in the transmission pass. uDark is fixed
         per page: 0 on stone, 1 on petrol. */
      var backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: {
            uDark: uniforms.uDark,
            uStone: uniforms.uStone,
            uPetrol: uniforms.uPetrol
          },
          depthTest: false,
          depthWrite: false,
          vertexShader: [
            'void main(){',
            '  gl_Position = vec4(position.xy, 0.0, 1.0);',
            '}'
          ].join('\n'),
          fragmentShader: [
            'uniform float uDark;',
            'uniform vec3 uStone;',
            'uniform vec3 uPetrol;',
            'void main(){',
            '  gl_FragColor = vec4(mix(uStone, uPetrol, uDark), 1.0);',
            '  #include <colorspace_fragment>',
            '}'
          ].join('\n')
        })
      );
      backdrop.frustumCulled = false;
      backdrop.renderOrder = -10;
      scene.add(backdrop);

      /* ---- Light: a low, hard key from the far end of the canyon -----------
         Shadows run along the walls, stepping across the tops of the blocks
         in front, instead of across the floor under the copy. */
      var LIGHT_DIR = new THREE.Vector3(-0.14, 0.44, -0.89).normalize();

      var key = new THREE.DirectionalLight(0xFFFFFF, 3.7);
      key.castShadow = true;
      key.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      key.shadow.radius = 1;
      scene.add(key);
      scene.add(key.target);

      scene.add(new THREE.HemisphereLight(PALETTE.chalk, PALETTE.petrol, 1.5));

      /* ---- Studio environment, for the glass only ----------------------------
         A petrol room with chalk softboxes and one sea green line: the glass
         reflects nothing that is not in the palette.
      ---------------------------------------------------------------------------- */
      function studio() {
        var room = new THREE.Scene();
        var parts = [];

        function add(geo, color, x, y, z, side) {
          var mat = new THREE.MeshBasicMaterial({ color: color, side: side || THREE.DoubleSide });
          var mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, y, z);
          if (!side) mesh.lookAt(0, 0, 0);
          room.add(mesh);
          parts.push(geo, mat);
        }

        /* The slats are seen from above and in front: their faces mirror the
           lower half of the room behind the camera, their crests the upper
           half toward the key light. */
        add(new THREE.BoxGeometry(30, 16, 30), tone(PALETTE.petrol, PALETTE.chalk, 0.18), 0, 2, 0, THREE.BackSide);
        add(new THREE.PlaneGeometry(12, 5), new THREE.Color(PALETTE.chalk).multiplyScalar(3.2), -3, 9, -12);
        add(new THREE.PlaneGeometry(26, 3), new THREE.Color(PALETTE.chalk).multiplyScalar(1.6), 0, -4, 13);
        add(new THREE.PlaneGeometry(26, 0.5), new THREE.Color(PALETTE.seaLight).multiplyScalar(2.6), 0, -1, 14);

        var pmrem = new THREE.PMREMGenerator(renderer);
        var texture = pmrem.fromScene(room, 0.03).texture;
        pmrem.dispose();
        parts.forEach(function (p) { p.dispose(); });
        return texture;
      }

      /* ---- Materials ----------------------------------------------------------- */

      /* Matte structure: heavy stone on the light chapter, lifted petrol on the
         dark one, with hairline edges and module joints measured from the top,
         so a block that sinks loses modules into the floor. */
      var matteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.94, metalness: 0 });
      matteMat.onBeforeCompile = function (shader) {
        shader.uniforms.uDark = uniforms.uDark;
        shader.uniforms.uJoint = uniforms.uJoint;
        shader.uniforms.uAlbedo = uniforms.uAlbedo;
        shader.uniforms.uAlbedoDark = uniforms.uAlbedoDark;
        shader.uniforms.uLineDark = uniforms.uLineDark;
        shader.uniforms.uAmbientDark = uniforms.uAmbientDark;

        shader.vertexShader = [
          'varying vec3 vBlock;',
          'varying vec3 vBlockSize;',
          'varying vec3 vBlockNormal;',
          ''
        ].join('\n') + shader.vertexShader
          .replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vBlockSize = vec3(instanceMatrix[0][0], instanceMatrix[1][1], instanceMatrix[2][2]);',
            'vBlock = position * vBlockSize;',
            'vBlockNormal = normal;'
          ].join('\n'));

        shader.fragmentShader = [
          'uniform float uDark;',
          'uniform float uJoint;',
          'uniform vec3 uAlbedo;',
          'uniform vec3 uAlbedoDark;',
          'uniform vec3 uLineDark;',
          'uniform float uAmbientDark;',
          'varying vec3 vBlock;',
          'varying vec3 vBlockSize;',
          'varying vec3 vBlockNormal;',
          ''
        ].join('\n') + shader.fragmentShader
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'vec3 an = abs(vBlockNormal);',
            'vec3 rim = vec3(',
            '  0.5 * vBlockSize.x - abs(vBlock.x),',
            '  min(vBlock.y, vBlockSize.y - vBlock.y),',
            '  0.5 * vBlockSize.z - abs(vBlock.z)',
            ') + an * 1e3;',
            'float edge = min(min(rim.x, rim.y), rim.z);',
            'float lineE = 1.0 - smoothstep(0.0, max(fwidth(edge) * 1.25, 1e-4), edge);',
            'float drop = vBlockSize.y - vBlock.y;',
            'float gy = mod(drop, uJoint);',
            'gy = min(gy, uJoint - gy) + an.y * 1e3;',
            'float lineG = 1.0 - smoothstep(0.0, max(fwidth(drop) * 1.1, 1e-4), gy);',
            'float line = max(lineE * 0.8, lineG * 0.45);',
            'vec3 albedo = mix(uAlbedo, uAlbedoDark, uDark);',
            'vec3 ink = mix(albedo * 0.6, uLineDark, uDark);',
            'diffuseColor.rgb = mix(albedo, ink, line);'
          ].join('\n'))
          .replace('#include <lights_fragment_end>', [
            '#include <lights_fragment_end>',
            'reflectedLight.indirectDiffuse *= mix(1.0, uAmbientDark, uDark);'
          ].join('\n'));
      };

      /* Liquid glass: one refraction bounce (front faces only, so the renderer
         never adds a back-face transmission pass), slight roughness, a thin
         sea green body tint like the edge of float glass. */
      var glassMat = new THREE.MeshPhysicalMaterial({
        color: PALETTE.chalk,
        metalness: 0,
        roughness: 0.16,
        transmission: 1,
        ior: 1.5,
        thickness: 0.5,
        attenuationColor: PALETTE.seaLight,
        attenuationDistance: 3.5,
        specularIntensity: 1,
        envMap: studio(),
        envMapIntensity: 1,
        side: THREE.FrontSide
      });
      /* The click pulse is sea green light carried by the glass. On petrol it
         is pure emission; on stone, where added light would wash out to white,
         the slat also filters what it transmits toward the same hue. */
      glassMat.onBeforeCompile = function (shader) {
        shader.uniforms.uDark = uniforms.uDark;
        shader.uniforms.uPulse = uniforms.uPulse;
        shader.uniforms.uPulseFilter = uniforms.uPulseFilter;
        shader.vertexShader = [
          'attribute float aPulse;',
          'varying float vPulse;',
          ''
        ].join('\n') + shader.vertexShader
          .replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vPulse = aPulse;'
          ].join('\n'));
        shader.fragmentShader = [
          'uniform float uDark;',
          'uniform vec3 uPulse;',
          'uniform vec3 uPulseFilter;',
          'varying float vPulse;',
          ''
        ].join('\n') + shader.fragmentShader
          .replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            'totalEmissiveRadiance += uPulse * vPulse;'
          ].join('\n'))
          .replace('#include <transmission_fragment>', [
            '#include <transmission_fragment>',
            'totalDiffuse *= mix(vec3(1.0), uPulseFilter, vPulse * (1.0 - uDark));'
          ].join('\n'));
      };

      /* ---- Instanced walls ------------------------------------------------------
         Every slot (row, side, column) owns one matte and one glass instance;
         whichever is not in use sits at zero scale.
      ---------------------------------------------------------------------------- */
      var matteGeo = new THREE.BoxGeometry(1, 1, 1);
      matteGeo.translate(0, 0.5, 0); /* base on the floor, grows upward */
      var glassGeo = matteGeo.clone();

      var pulseArr = new Float32Array(COUNT);
      var pulseAttr = new THREE.InstancedBufferAttribute(pulseArr, 1);
      pulseAttr.setUsage(THREE.DynamicDrawUsage);
      glassGeo.setAttribute('aPulse', pulseAttr);

      var matte = new THREE.InstancedMesh(matteGeo, matteMat, COUNT);
      var glass = new THREE.InstancedMesh(glassGeo, glassMat, COUNT);
      [matte, glass].forEach(function (mesh) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        scene.add(mesh);
      });
      matte.castShadow = true;
      matte.receiveShadow = true;

      /* Per-slot state */
      var height = new Float32Array(COUNT);
      var base = new Float32Array(COUNT);
      var depth = new Float32Array(COUNT);
      var glassy = new Uint8Array(COUNT);
      var rowOf = new Int32Array(COUNT);

      /* Shadow catcher: the floor is the exact backdrop colour, only darker in shadow */
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShadowMaterial({ color: PALETTE.ink, opacity: 0.14 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      /* ---- Deterministic noise -------------------------------------------------- */
      function hash(n) {
        var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return s - Math.floor(s);
      }

      function vnoise(x) {
        var i = Math.floor(x);
        var f = x - i;
        f = f * f * (3 - 2 * f);
        return hash(i) + (hash(i + 1) - hash(i)) * f;
      }

      /* ---- Layout: fit the canyon to the copy ----------------------------------- */
      /* w, h, dpr: the size the buffer and camera were built for.
         cssH: the canvas height on screen now, refreshed on every resize. */
      var view = { w: 1, h: 1, dpr: 1, cssH: 1 };
      var canyon = 6;            /* half width of the empty floor */
      var zFar = -40;
      var period = 60;
      var rows = 60;
      var cols = 10;
      var travelPerPx = 0.01;
      var dirty = true;

      var raycaster = new THREE.Raycaster();
      var ndc = new THREE.Vector2();
      var hit = new THREE.Vector3();
      var probeA = new THREE.Vector3();
      var probeB = new THREE.Vector3();
      var UP = new THREE.Vector3(0, 1, 0);
      var floorPlane = new THREE.Plane(UP, 0);
      var crestPlane = new THREE.Plane(UP, -CREST_Y);
      var roofPlane = new THREE.Plane(UP, -MAX_H);
      var look = new THREE.Vector3();

      function cast(nx, ny, plane, out) {
        ndc.set(nx, ny);
        raycaster.setFromCamera(ndc, camera);
        return raycaster.ray.intersectPlane(plane, out);
      }

      function placeCamera(px, py) {
        camera.position.set(
          px * 0.9,
          Math.sin(LENS.tilt) * LENS.dist - py * 0.6,
          Math.cos(LENS.tilt) * LENS.dist
        );
        look.set(px * 0.3, 0, 0);
        camera.lookAt(look);
        camera.updateMatrixWorld();
      }

      /* Right edge of the copy column plus a margin, in NDC. Every page sets
         its copy in the same canyon container, so the first one will do. */
      function columnEdge() {
        var ref = document.querySelector('main .container');
        var half = view.w / 2;
        var edge = 0.62;
        if (ref) {
          var rect = ref.getBoundingClientRect();
          var pad = parseFloat(window.getComputedStyle(ref).paddingLeft) || 0;
          edge = (half - (rect.left + pad) + MARGIN_PX) / half;
        }
        return clamp(edge, 0.2, narrowQuery.matches ? NARROW_EDGE : 0.96);
      }

      var corner = new THREE.Vector3();

      function fitShadow() {
        var zNear = zFar + period;
        var xMax = canyon + cols * CELL;
        key.target.position.set(0, 0, (zFar + zNear) / 2);
        key.position.copy(key.target.position).addScaledVector(LIGHT_DIR, 80);
        key.target.updateMatrixWorld();
        key.updateMatrixWorld();

        var cam = key.shadow.camera;
        cam.position.copy(key.position);
        cam.lookAt(key.target.position);
        cam.updateMatrixWorld();

        var minX = Infinity, maxX = -Infinity;
        var minY = Infinity, maxY = -Infinity;
        var minZ = Infinity, maxZ = -Infinity;
        for (var n = 0; n < 8; n++) {
          corner.set(n & 1 ? xMax : -xMax, n & 2 ? MAX_H : 0, n & 4 ? zNear : zFar)
            .applyMatrix4(cam.matrixWorldInverse);
          minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
          minZ = Math.min(minZ, corner.z); maxZ = Math.max(maxZ, corner.z);
        }
        cam.left = minX;
        cam.right = maxX;
        cam.bottom = minY;
        cam.top = maxY;
        cam.near = Math.max(0.5, -maxZ - 2);
        cam.far = -minZ + 2;
        cam.updateProjectionMatrix();

        ground.scale.set(xMax * 2 + 8, period + 8, 1);
        ground.position.set(0, 0, (zFar + zNear) / 2);
      }

      /* On touch screens the browser toolbar changes the height while
         scrolling: within this slack the buffer is kept and simply scaled. */
      var HEIGHT_SLACK = coarse ? 160 : 0;

      function viewportChanged() {
        return window.innerWidth !== view.w ||
          Math.abs(window.innerHeight - view.h) > HEIGHT_SLACK ||
          pixelRatio() !== view.dpr;
      }

      function layout() {
        view.w = window.innerWidth;
        view.h = window.innerHeight;
        view.dpr = pixelRatio();
        renderer.setPixelRatio(view.dpr);
        renderer.setSize(view.w, view.h, false);
        view.cssH = canvas.clientHeight || view.h;
        camera.aspect = view.w / view.h;
        LENS = camera.aspect < 1 ? LENS_TALL : LENS_WIDE;
        camera.fov = camera.aspect < 1
          ? 2 * Math.atan(Math.tan(LENS.fov * DEG / 2) / camera.aspect) / DEG
          : LENS.fov;
        camera.updateProjectionMatrix();
        placeCamera(0, 0);

        /* The foot of each wall meets the column edge at FIT_Y */
        if (cast(columnEdge(), FIT_Y, floorPlane, hit)) canyon = Math.max(hit.x, CELL);

        /* Rows: from past the top edge of the frame to where the tallest block
           would still reach up into the bottom edge. Margins cover the sway. */
        var far = cast(0, 1.08, floorPlane, hit) ? hit.z : -80;
        var near = cast(0, -1.08, roofPlane, hit) ? hit.z : 20;
        rows = Math.min(MAX_ROWS, Math.ceil((near - far + 6) / CELL));
        period = rows * CELL;
        zFar = near + 3 - period;

        /* Columns: out past the far corner of the frame */
        var reach = cast(1.08, 1.08, floorPlane, hit) ? hit.x : canyon + MAX_COLS;
        cols = clamp(Math.ceil((reach - canyon) / CELL) + 2, 3, MAX_COLS);

        /* Travel: the floor at mid screen moves at PARALLAX times page speed */
        probeA.set(0, 0, 0).project(camera);
        probeB.set(0, 0, -CELL).project(camera);
        var pxPerUnit = Math.max(Math.abs(probeB.y - probeA.y) * view.h / 2, 1e-3);
        travelPerPx = PARALLAX / pxPerUnit;

        /* Slots are packed by (row, side, column) for the current column count:
           reset them all, then only the live range is drawn and uploaded. */
        matte.instanceMatrix.array.fill(0);
        glass.instanceMatrix.array.fill(0);
        pulseArr.fill(0);
        rowOf.fill(-2147483647);
        live = rows * 2 * cols;
        matte.count = live;
        glass.count = live;

        fitShadow();
        dirty = true;
        renderer.shadowMap.needsUpdate = true;
      }

      /* ---- Profiles ------------------------------------------------------------- */
      function profileAt(g, side, c, i) {
        var P = FORMATION;
        var bay = wrap(g, P.bay);
        var mass = Math.max(0, c - CLIFF + 1);
        var m = P.base + P.rise * mass;
        if (P.noise && mass) m += Math.floor(vnoise(g * 0.19 + c * 0.53 + side * 31.7) * P.noise);
        if (P.zig) {
          var half = P.bay / 2;
          m += Math.round((half - Math.abs(bay - half)) * P.zig);
        }
        if (P.wave) m += Math.round(P.wave * (0.5 + 0.5 * Math.sin(g * 0.55 - c * 0.7 + side * 1.9)));
        var isGlass = bay === 0;
        if (isGlass) m += GLASS_RISE;
        base[i] = clamp(m, 1, TALLEST) * MODULE;
        glassy[i] = isGlass ? 1 : 0;
        depth[i] = P.depth * CELL;
      }

      /* ---- Interaction state ---------------------------------------------------- */
      var travel = 0;
      var pointer = { nx: 0, ny: 0, inside: false };
      var sway = { x: 0, y: 0 };
      var well = { x: 0, z: 0, tx: 0, tz: 0, amt: 0 };
      var ripples = [];

      function ringAt(x, s) {
        var v = 0;
        for (var n = 0; n < ripples.length; n++) {
          var rp = ripples[n];
          var dx = x - rp.x;
          var ds = s - rp.s;
          var q = (Math.sqrt(dx * dx + ds * ds) - rp.radius) / rp.width;
          if (q > -3 && q < 3) v += rp.energy * Math.exp(-q * q);
        }
        return v > 1 ? 1 : v;
      }

      function upload(attr, length) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, length);
        attr.needsUpdate = true;
      }

      function writeBox(a, i, x, z, sx, sy, sz) {
        var o = i * 16;
        a[o] = sx; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
        a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
        a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = sz; a[o + 11] = 0;
        a[o + 12] = x; a[o + 13] = 0; a[o + 14] = z; a[o + 15] = 1;
      }

      /* Walk every live slot: wrap rows along the canyon, resolve the profile of
         rows that just came round, add the pointer well and click rings, then
         ease each block toward its target height. Returns true while moving. */
      function layBlocks(dt, still) {
        var mA = matte.instanceMatrix.array;
        var gA = glass.instanceMatrix.array;
        var kH = still ? 1 : 1 - Math.exp(-HEIGHT_RATE * dt);
        var kP = still ? 1 : 1 - Math.exp(-PULSE_RATE * dt);
        var wellOn = well.amt > 0.002;
        var inv = 1 / (WELL_SIGMA * WELL_SIGMA);
        var ringOn = ripples.length > 0;
        var busy = false;
        var pulsed = false;

        for (var r = 0; r < rows; r++) {
          var z = zFar + wrap(r * CELL - travel, period);
          var s = z + travel;
          var g = Math.round((s - zFar) / CELL);

          for (var side = 0; side < 2; side++) {
            var dir = side ? 1 : -1;

            for (var c = 0; c < cols; c++) {
              var i = (r * 2 + side) * cols + c;
              var fresh = rowOf[i] !== g;
              if (fresh || dirty) {
                profileAt(g, side, c, i);
                rowOf[i] = g;
              }

              var x = dir * (canyon + (c + 0.5) * CELL);
              var target = base[i];

              if (wellOn) {
                var dx = x - well.x;
                var dz = z - well.z;
                var q = (dx * dx + dz * dz) * inv;
                if (q < 16) target -= WELL_DEPTH * well.amt * (1 - q) * Math.exp(-0.5 * q);
              }

              var ring = ringOn ? ringAt(x, s) : 0;
              target += ring * RIPPLE_KICK;
              if (target < MODULE * 0.5) target = MODULE * 0.5;

              var h = (fresh || still) ? target : height[i] + (target - height[i]) * kH;
              if (Math.abs(target - h) > 0.002) busy = true;
              else h = target;
              height[i] = h;

              if (glassy[i]) {
                writeBox(gA, i, x, z, GLASS_W * CELL, h, GLASS_D * CELL);
                writeBox(mA, i, x, z, 0, 0, 0);
                var p = pulseArr[i] + (ring - pulseArr[i]) * kP;
                if (p < 0.001 && ring === 0) p = 0;
                if (p !== pulseArr[i]) { pulseArr[i] = p; pulsed = true; }
                if (p > 0) busy = true;
              } else {
                writeBox(mA, i, x, z, MATTE_W * CELL, h, depth[i]);
                writeBox(gA, i, x, z, 0, 0, 0);
                if (pulseArr[i] !== 0) { pulseArr[i] = 0; pulsed = true; }
              }
            }
          }
        }

        dirty = false;
        upload(matte.instanceMatrix, live * 16);
        upload(glass.instanceMatrix, live * 16);
        if (pulsed) upload(pulseAttr, live);
        return busy;
      }

      /* ---- Frame ------------------------------------------------------------------ */
      function paint(dt, snap) {
        var still = snap || reduced;
        var busy = false;

        /* Travel along the canyon with the page */
        var goal = reduced ? 0 : travelPerPx * scrollY();
        travel = still ? goal : damp(travel, goal, TRAVEL_RATE, dt);
        if (Math.abs(goal - travel) > 1e-4) busy = true;
        else travel = goal;

        /* A slight lens sway toward the pointer */
        var tracking = pointer.inside && !reduced;
        var aimX = tracking ? pointer.nx : 0;
        var aimY = tracking ? pointer.ny : 0;
        sway.x = still ? aimX : damp(sway.x, aimX, SWAY_RATE, dt);
        sway.y = still ? aimY : damp(sway.y, aimY, SWAY_RATE, dt);
        if (Math.abs(aimX - sway.x) + Math.abs(aimY - sway.y) > 1e-4) busy = true;
        placeCamera(sway.x, sway.y);

        /* Proximity: raycast the cursor onto the crest of the walls */
        var want = 0;
        if (tracking && cast(pointer.nx, -pointer.ny, crestPlane, hit)) {
          want = 1;
          well.tx = hit.x;
          well.tz = hit.z;
        }
        if (still || well.amt < 0.02) {
          well.x = well.tx;
          well.z = well.tz;
        } else {
          well.x = damp(well.x, well.tx, WELL_FOLLOW, dt);
          well.z = damp(well.z, well.tz, WELL_FOLLOW, dt);
        }
        well.amt = still ? want : damp(well.amt, want, WELL_RATE, dt);
        if (Math.abs(want - well.amt) > 1e-3 || Math.abs(well.tx - well.x) + Math.abs(well.tz - well.z) > 1e-3) busy = true;

        /* Click rings: the front eases out, the energy decays */
        for (var n = ripples.length - 1; n >= 0; n--) {
          var rp = ripples[n];
          rp.radius = damp(rp.radius, RIPPLE_REACH, RIPPLE_SPEED, dt);
          rp.energy = damp(rp.energy, 0, RIPPLE_FADE, dt);
          rp.width = RING_WIDTH + rp.radius * 0.06;
          if (rp.energy < 0.004) ripples.splice(n, 1);
        }
        if (ripples.length) busy = true;

        /* Blocks: walked only when something that shapes them changed. A frame
           that only sways the lens reuses the instance buffers and shadow map. */
        var shaped = still || dirty || blocksBusy || ripples.length > 0 ||
          travel !== drawn.travel || well.amt !== drawn.amt ||
          (well.amt > 0.002 && (well.x !== drawn.x || well.z !== drawn.z));
        if (shaped) {
          blocksBusy = layBlocks(dt, still);
          drawn.travel = travel;
          drawn.amt = well.amt;
          drawn.x = well.x;
          drawn.z = well.z;
          renderer.shadowMap.needsUpdate = true;
        }
        if (blocksBusy) busy = true;

        renderer.render(scene, camera);
        return busy;
      }

      /* ---- Loop: runs only while something is still settling ------------------------ */
      var blocksBusy = true;
      var drawn = { travel: NaN, amt: NaN, x: NaN, z: NaN };
      var running = false;
      var snapNext = true;
      var lost = false;
      var lastT = 0;

      function step(t) {
        if (!running) return;
        var dt = clamp((t - lastT) / 1000, 0, 0.05);
        lastT = t;
        var busy = paint(dt, snapNext);
        snapNext = false;
        if (!busy || reduced) {
          running = false;
          return;
        }
        raf(step);
      }

      function play() {
        if (running || lost || document.hidden) return;
        running = true;
        lastT = clock();
        raf(step);
      }

      function pause() {
        running = false;
      }

      function ripple(nx, ny) {
        if (!cast(nx, ny, crestPlane, hit)) return;
        if (ripples.length >= MAX_RIPPLES) ripples.shift();
        ripples.push({ x: hit.x, s: hit.z + travel, radius: 0, width: RING_WIDTH, energy: 1 });
        play();
      }

      layout();
      paint(0, true);
      root.setAttribute('data-webgl', 'on');
      boot.step();

      /* ---- Events -------------------------------------------------------------------- */
      /* The body observer also lands here when only the document reflows
         (fonts, content): the formation does not depend on the document, so
         the frame is untouched. Buffers are rebuilt for real viewport changes. */
      onResizeFrame(function () {
        view.cssH = canvas.clientHeight || window.innerHeight;
        if (viewportChanged()) {
          layout();
          snapNext = true;
        }
        play();
      });

      onScrollFrame(function () {
        play();
      });

      if (!coarse) {
        window.addEventListener('pointermove', function (e) {
          if (reduced || e.pointerType === 'touch') return;
          pointer.nx = (e.clientX / view.w) * 2 - 1;
          pointer.ny = (e.clientY / view.cssH) * 2 - 1;
          pointer.inside = true;
          play();
        }, PASSIVE);

        document.addEventListener('mouseout', function (e) {
          if (e.relatedTarget) return;
          pointer.inside = false;
          play();
        });

        window.addEventListener('blur', function () {
          pointer.inside = false;
          play();
        });
      }

      /* A click on the page itself (not on a control) sends a pulse */
      var CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"]';
      document.addEventListener('click', function (e) {
        if (reduced || e.button !== 0 || e.detail === 0) return;
        if (e.target && e.target.closest && e.target.closest(CONTROLS)) return;
        ripple((e.clientX / view.w) * 2 - 1, 1 - (e.clientY / view.cssH) * 2);
      });

      onMedia(reducedQuery, function (e) {
        reduced = e.matches;
        ripples.length = 0;
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
        lost = true;
        pause();
        root.setAttribute('data-webgl', 'off');
      });

      canvas.addEventListener('webglcontextrestored', function () {
        lost = false;
        /* The environment lives in a render target: its pixels did not survive */
        var stale = glassMat.envMap;
        glassMat.envMap = studio();
        if (stale) stale.dispose();
        root.setAttribute('data-webgl', 'on');
        dirty = true;
        snapNext = true;
        play();
      });

      /* Keep the renderer when the page goes into the back/forward cache */
      window.addEventListener('pagehide', function (e) {
        pause();
        if (e.persisted) return;
        try { renderer.dispose(); } catch (err) { /* already released */ }
      });

      window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        snapNext = true;
        play();
      });
    }
  })();
})();
