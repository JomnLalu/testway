(function () {
  'use strict';

  var root = document.documentElement;

  var raf = window.requestAnimationFrame.bind(window);
  var clock = window.performance.now.bind(window.performance);
  var PASSIVE = { passive: true };

  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function wrap(v, p) { return v - p * Math.floor(v / p); }

  function damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  }

  var tokens = window.getComputedStyle(root);
  function token(name) { return tokens.getPropertyValue(name).trim(); }
  function ms(name) { return parseFloat(token(name)) || 0; }
  function hex(name) { return parseInt(token(name).slice(1), 16); }

  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrowQuery = window.matchMedia('(width < 896px)');
  var reduced = reducedQuery.matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var PALETTE = {
    stone: hex('--stone'),
    petrol: hex('--petrol'),
    chalk: hex('--chalk'),
    ink: hex('--ink'),
    seaLight: hex('--sea-light')
  };

  function scrollY() {
    return window.pageYOffset || root.scrollTop || 0;
  }

  var PAGES = {
    home: {
      formation: { base: 10, rise: 1, noise: 8, bay: 6, depth: 0.9 }
    },
    about: {
      formation: { base: 6, rise: 2, noise: 0, bay: 8, depth: 0.9 }
    },
    capabilities: {
      formation: { base: 6, rise: 1, noise: 0, bay: 5, depth: 0.9, zig: 2 }
    },
    work: {
      formation: { base: 4, rise: 1, noise: 0, bay: 4, depth: 0.42, wave: 8 }
    },
    contact: {
      formation: { base: 3, rise: 1, noise: 3, bay: 9, depth: 0.9 }
    }
  };

  var page = PAGES[document.body.getAttribute('data-page')] || PAGES.home;
  var dark = root.getAttribute('data-chapter') === 'dark';

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

  var BOOT_KEY = 'jm:booted';
  var warm = root.getAttribute('data-boot') === 'warm';

  var boot = (function () {
    var el = document.getElementById('boot');
    var bar = document.getElementById('bootBar');
    var label = document.getElementById('bootLabel');
    var total = 2;
    var done = 0;
    var finished = false;
    var booted = false;
    var queue = [];

    function paint() {
      if (bar) bar.style.transform = 'scaleX(' + (done / total) + ')';
    }

    function release() {
      booted = true;
      if (el) el.setAttribute('data-done', 'true');
      root.setAttribute('data-booted', 'true');
      if (root.classList.contains('no-js')) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-reveal]'), function (item) {
          item.classList.add('is-in', 'is-instant');
        });
        root.classList.remove('no-js');
      }
      while (queue.length) queue.shift()();
    }

    function finish() {
      if (finished) return;
      finished = true;
      try { window.sessionStorage.setItem(BOOT_KEY, '1'); } catch (err) { }
      if (warm) {
        release();
        return;
      }
      if (bar) bar.style.transform = 'scaleX(1)';
      if (label) label.textContent = 'Ready';
      window.setTimeout(release, reduced ? 0 : ms('--t-base'));
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
      ready: function (fn) {
        if (booted) fn();
        else queue.push(fn);
      }
    };
  })();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { boot.step(); }).catch(function () { boot.step(); });
  } else {
    boot.step();
  }

  (function chrome() {
    var masthead = document.getElementById('masthead');
    var toggle = document.getElementById('menuToggle');
    var menu = document.getElementById('menu');

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

    var openAtPress = false;

    document.addEventListener('pointerdown', function () {
      openAtPress = masthead.getAttribute('data-open') === 'true';
    }, true);

    document.addEventListener('click', function (e) {
      var wasOpen = openAtPress || masthead.getAttribute('data-open') === 'true';
      openAtPress = false;
      if (!wasOpen || masthead.contains(e.target)) return;
      setMenu(false);
      e.stopImmediatePropagation();
    });

    masthead.addEventListener('focusout', function (e) {
      if (masthead.getAttribute('data-open') !== 'true') return;
      if (e.relatedTarget && !masthead.contains(e.relatedTarget)) setMenu(false);
    });

    onMedia(narrowQuery, function (e) {
      if (!e.matches) setMenu(false);
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

  boot.ready(function reveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduced) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var opening = true;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (opening) entry.target.classList.add(warm ? 'is-instant' : 'is-late');
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
      opening = false;
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });

    items.forEach(function (el) { io.observe(el); });
  });

  (function copyControl() {
    var btn = document.getElementById('copyEmail');
    var status = document.getElementById('copyStatus');
    if (!btn) return;

    var address = btn.getAttribute('data-copy');
    var DONE_HOLD = 2800;
    var busy = false;
    var slowTimer = null;
    var resetTimer = null;

    btn.hidden = false;

    function setState(state, message) {
      btn.setAttribute('data-state', state);
      btn.setAttribute('aria-disabled', state === 'working' ? 'true' : 'false');
      if (status) status.textContent = message || '';
    }

    function settle(state, message) {
      window.clearTimeout(slowTimer);
      busy = false;
      setState(state, message);
      if (state === 'done') {
        resetTimer = window.setTimeout(function () { setState('idle', ''); }, DONE_HOLD);
      }
    }

    function fallbackCopy(text) {
      var active = document.activeElement;
      var input = document.createElement('input');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(input);
      if (active && active.focus) active.focus({ preventScroll: true });
      return ok;
    }

    btn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      window.clearTimeout(resetTimer);
      if (status) status.textContent = '';
      slowTimer = window.setTimeout(function () { setState('working', ''); }, ms('--t-base'));

      var task = (navigator.clipboard && navigator.clipboard.writeText)
        ? navigator.clipboard.writeText(address)
        : (fallbackCopy(address) ? Promise.resolve() : Promise.reject(new Error('blocked')));

      task.then(function () {
        settle('done', address + ' is on your clipboard.');
      }).catch(function () {
        settle('idle', 'Your browser blocked the clipboard. The address is ' + address + '.');
      });
    });
  })();

  var THREE_URLS = [
    'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
    'https://unpkg.com/three@0.185.1/build/three.module.min.js'
  ];

  function loadThree(i) {
    return import(THREE_URLS[i]).catch(function (err) {
      if (i + 1 < THREE_URLS.length) return loadThree(i + 1);
      throw err;
    });
  }

  (function stage() {
    var canvas = document.getElementById('stage');

    function unavailable(reason) {
      root.setAttribute('data-webgl', 'off');
      if (window.console && console.warn) {
        console.warn('Stage: showing the static fallback. ' + (reason && reason.message ? reason.message : reason));
      }
      boot.step();
    }

    if (!canvas) {
      boot.step();
      return;
    }

    for (var name in PALETTE) {
      if (isNaN(PALETTE[name])) {
        unavailable('The brand tokens could not be read from the stylesheet.');
        return;
      }
    }

    if (!('WebGL2RenderingContext' in window)) {
      unavailable('This browser has no WebGL 2.');
      return;
    }

    loadThree(0).then(build, function (err) {
      unavailable('three.js could not be loaded: ' + (err && err.message ? err.message : err));
    }).catch(unavailable);

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

      var DEG = Math.PI / 180;
      var CELL = 1;
      var MODULE = 0.5;
      var JOINT = 1;
      var MAX_COLS = 40;
      var MAX_ROWS = 72;
      var COUNT = MAX_ROWS * MAX_COLS * 2;
      var live = 0;
      var MAX_H = 14;
      var TALLEST = 24;
      var MATTE_W = 0.9;
      var GLASS_W = 0.98;
      var GLASS_D = 0.24;
      var GLASS_RISE = 4;

      var LENS_WIDE = { fov: 34, tilt: 50 * DEG, dist: 32 };
      var LENS_TALL = { fov: 22, tilt: 58 * DEG, dist: 48 };
      var LENS = LENS_WIDE;
      var FIT_Y = 0.55;
      var MARGIN_PX = 48;
      var NARROW_EDGE = 0.8;
      var PARALLAX = 0.42;

      var TRAVEL_RATE = 7;
      var SWAY_RATE = 2.6;
      var HEIGHT_RATE = 9;
      var WELL_RATE = 5;
      var WELL_FOLLOW = 14;
      var PULSE_RATE = 16;

      var CREST_Y = 4;
      var WELL_SIGMA = 1.8;
      var WELL_DEPTH = 5 * MODULE;

      var RIPPLE_REACH = 48;
      var RIPPLE_SPEED = 1.2;
      var RIPPLE_FADE = 0.9;
      var RING_WIDTH = 1.3;
      var RIPPLE_KICK = 1.2 * MODULE;
      var MAX_RIPPLES = 4;

      var FORMATION = page.formation;
      var DEPTH = FORMATION.depth * CELL;
      var CLIFF = 2;

      var maxDpr = coarse ? 1.5 : 2;
      var MAX_PIXELS = 6e6;

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
      renderer.shadowMap.autoUpdate = false;
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
        uLineDark: { value: tone(PALETTE.petrol, PALETTE.chalk, 0.40) },
        uAmbientDark: { value: 0.55 },
        uPulse: { value: new THREE.Color(PALETTE.seaLight).multiplyScalar(1.6) },
        uPulseFilter: { value: new THREE.Color(PALETTE.seaLight) }
      };
      var sea = uniforms.uPulseFilter.value;
      sea.multiplyScalar(1 / Math.max(sea.r, sea.g, sea.b));

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

      var LIGHT_DIR = new THREE.Vector3(-0.14, 0.44, -0.89).normalize();

      var key = new THREE.DirectionalLight(PALETTE.chalk, 4.5);
      key.castShadow = true;
      key.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      key.shadow.radius = 1;
      scene.add(key);
      scene.add(key.target);

      scene.add(new THREE.HemisphereLight(PALETTE.chalk, PALETTE.petrol, 1.5));

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

        add(new THREE.BoxGeometry(30, 16, 30), tone(PALETTE.petrol, PALETTE.chalk, 0.16), 0, 2, 0, THREE.BackSide);
        add(new THREE.PlaneGeometry(12, 5), new THREE.Color(PALETTE.chalk).multiplyScalar(3.2), -3, 9, -12);
        add(new THREE.PlaneGeometry(26, 3), new THREE.Color(PALETTE.chalk).multiplyScalar(1.6), 0, -4, 13);
        add(new THREE.PlaneGeometry(26, 0.5), new THREE.Color(PALETTE.seaLight).multiplyScalar(2.6), 0, -1, 14);

        var pmrem = new THREE.PMREMGenerator(renderer);
        var texture = pmrem.fromScene(room, 0.03).texture;
        pmrem.dispose();
        parts.forEach(function (p) { p.dispose(); });
        return texture;
      }

      var matteMat = new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.94, metalness: 0 });
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

      var matteGeo = new THREE.BoxGeometry(1, 1, 1);
      matteGeo.translate(0, 0.5, 0);
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

      var height = new Float32Array(COUNT);
      var base = new Float32Array(COUNT);
      var glassy = new Uint8Array(COUNT);
      var rowOf = new Int32Array(COUNT);

      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShadowMaterial({ color: PALETTE.ink, opacity: 0.16 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

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

      var view = { w: 1, h: 1, dpr: 1, cssH: 1 };
      var canyon = 6;
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

        if (cast(columnEdge(), FIT_Y, floorPlane, hit)) canyon = Math.max(hit.x, CELL);

        var far = cast(0, 1.08, floorPlane, hit) ? hit.z : -80;
        var near = cast(0, -1.08, roofPlane, hit) ? hit.z : 20;
        rows = Math.min(MAX_ROWS, Math.ceil((near - far + 6) / CELL));
        period = rows * CELL;
        zFar = near + 3 - period;

        var reach = cast(1.08, 1.08, floorPlane, hit) ? hit.x : canyon + MAX_COLS;
        cols = clamp(Math.ceil((reach - canyon) / CELL) + 2, 3, MAX_COLS);

        probeA.set(0, 0, 0).project(camera);
        probeB.set(0, 0, -CELL).project(camera);
        var pxPerUnit = Math.max(Math.abs(probeB.y - probeA.y) * view.h / 2, 1e-3);
        travelPerPx = PARALLAX / pxPerUnit;

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
      }

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
                writeBox(mA, i, x, z, MATTE_W * CELL, h, DEPTH);
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

      function paint(dt, snap) {
        var still = snap || reduced;
        var busy = false;

        var goal = reduced ? 0 : travelPerPx * scrollY();
        travel = still ? goal : damp(travel, goal, TRAVEL_RATE, dt);
        if (Math.abs(goal - travel) > 1e-4) busy = true;
        else travel = goal;

        var tracking = pointer.inside && !reduced;
        var aimX = tracking ? pointer.nx : 0;
        var aimY = tracking ? pointer.ny : 0;
        sway.x = still ? aimX : damp(sway.x, aimX, SWAY_RATE, dt);
        sway.y = still ? aimY : damp(sway.y, aimY, SWAY_RATE, dt);
        if (Math.abs(aimX - sway.x) + Math.abs(aimY - sway.y) > 1e-4) busy = true;
        placeCamera(sway.x, sway.y);

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

        for (var n = ripples.length - 1; n >= 0; n--) {
          var rp = ripples[n];
          rp.radius = damp(rp.radius, RIPPLE_REACH, RIPPLE_SPEED, dt);
          rp.energy = damp(rp.energy, 0, RIPPLE_FADE, dt);
          rp.width = RING_WIDTH + rp.radius * 0.06;
          if (rp.energy < 0.004) ripples.splice(n, 1);
        }
        if (ripples.length) busy = true;

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

      var CONTROLS = 'a, button, input, select, textarea, label, summary, [role="button"], #masthead';
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
        var stale = glassMat.envMap;
        glassMat.envMap = studio();
        if (stale) stale.dispose();
        root.setAttribute('data-webgl', 'on');
        dirty = true;
        snapNext = true;
        play();
      });

      window.addEventListener('pagehide', function (e) {
        pause();
        if (e.persisted) return;
        try { renderer.dispose(); } catch (err) { }
      });

      window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        snapNext = true;
        play();
      });
    }
  })();
})();
