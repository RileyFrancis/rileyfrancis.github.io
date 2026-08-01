/**
 * Decorative wireframe cubes that tumble and drift in the page's side gutters.
 *
 * Three things this is careful about:
 *
 *  1. Fit. Cubes are placed inside the measured empty gutter beside the content
 *     column (the wrapper's border box minus its padding), not at fixed
 *     percentages of the window. When a gutter is too narrow to hold a cube --
 *     narrow windows, phones -- nothing is created at all, so there is no
 *     overlap and no cost.
 *
 *  2. Page height. The cube field is a viewport-sized band that wraps around
 *     modularly instead of a fixed strip of document, so a 500px page and a
 *     50,000px page both stay evenly populated and no cube can scroll away
 *     into a region that never renders.
 *
 *  3. Cost. Rotation keyframes are precomputed once into path strings, so a
 *     frame is at most one setAttribute plus one transform write per cube, and
 *     only when a value actually changed. The rAF loop stops itself once the
 *     scroll easing settles, so an idle page does zero work per frame.
 */
(function () {
  "use strict";

  // ---------- config ----------
  var ROT_FRAMES = 300; // precomputed rotation keyframes
  var ROT_PERIOD = Math.PI * 10; // rx wraps 5x and ry (0.8 * rx) 4x -> seamless
  var ROT_PER_PX = 0.002; // radians of tumble per pixel scrolled
  var SIZE_MIN = 34;
  var SIZE_MAX = 96;
  var SPEED_MIN = 0.08; // parallax drift, as a fraction of scroll distance
  var SPEED_MAX = 0.45;
  var COLOR_A = [107, 188, 255];
  var COLOR_B = [52, 163, 23];
  var MIN_GUTTER = 84; // px of clear space a side needs before we draw in it
  var CONTENT_GAP = 8; // keep-away margin from the content column
  var EDGE_BLEED = 0.35; // fraction of a cube allowed to hang off the window
  var DENSITY_PX = 62; // one cube per this much viewport height
  var COUNT_MIN = 8;
  var COUNT_MAX = 22;
  var EASE = 0.12; // scroll smoothing; higher is snappier
  var SETTLE_PX = 0.05; // stop animating once we are this close to the target

  var SVG_NS = "http://www.w3.org/2000/svg";

  var layer = document.querySelector(".cube-layer");
  var wrapper = document.querySelector(".wrapper");
  if (!layer || !wrapper) return;

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- rotation keyframes ----------
  // The cube geometry depends only on the single scalar `r`, and every cube
  // shares it (offset by a per-cube seed), so one table serves all of them.
  // A fixed viewBox means it serves every cube *size* too.

  var S = 20;
  var VERTS = [
    [-S, -S, -S], [S, -S, -S], [S, S, -S], [-S, S, -S],
    [-S, -S, S], [S, -S, S], [S, S, S], [-S, S, S]
  ];
  var EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  function framePath(r) {
    var cx = Math.cos(r), sx = Math.sin(r);
    var cy = Math.cos(r * 0.8), sy = Math.sin(r * 0.8);
    var px = [], py = [];

    for (var i = 0; i < 8; i++) {
      var v = VERTS[i];
      // Rotate about Y, then X, then apply the same weak perspective as before.
      var x1 = v[0] * cy + v[2] * sy;
      var z1 = -v[0] * sy + v[2] * cy;
      var y2 = v[1] * cx - z1 * sx;
      var z2 = v[1] * sx + z1 * cx;
      var s = 200 / (200 + z2);
      px.push((x1 * s).toFixed(1));
      py.push((y2 * s).toFixed(1));
    }

    var d = "";
    for (var e = 0; e < EDGES.length; e++) {
      var a = EDGES[e][0], b = EDGES[e][1];
      d += "M" + px[a] + " " + py[a] + "L" + px[b] + " " + py[b];
    }
    return d;
  }

  var FRAMES = new Array(ROT_FRAMES);
  for (var f = 0; f < ROT_FRAMES; f++) {
    FRAMES[f] = framePath((f / ROT_FRAMES) * ROT_PERIOD);
  }
  var FRAME_SCALE = ROT_FRAMES / ROT_PERIOD;

  // ---------- state ----------
  var cubes = [];
  var band = 0; // wrap height: one viewport plus a cube-sized margin each end
  var margin = SIZE_MAX + 20;
  var y = window.scrollY || 0; // eased scroll position
  var targetY = y;
  var running = false;
  var rafId = 0;
  var resizeId = 0;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mod(a, n) { return ((a % n) + n) % n; }

  function colorAt(t) {
    return "rgb(" +
      Math.round(lerp(COLOR_A[0], COLOR_B[0], t)) + "," +
      Math.round(lerp(COLOR_A[1], COLOR_B[1], t)) + "," +
      Math.round(lerp(COLOR_A[2], COLOR_B[2], t)) + ")";
  }

  // ---------- layout ----------

  // Free space to the left and right of the content column. The wrapper's own
  // horizontal padding is deliberately empty space reserved for these cubes,
  // so the keep-out zone is its content box, not its border box.
  function measureGutters() {
    var rect = wrapper.getBoundingClientRect();
    var cs = window.getComputedStyle(wrapper);
    // clientWidth, not innerWidth: excludes a classic scrollbar's width.
    var vw = document.documentElement.clientWidth;
    return {
      left: rect.left + parseFloat(cs.paddingLeft),
      right: vw - (rect.right - parseFloat(cs.paddingRight))
    };
  }

  // Horizontal placement for one cube: fully inside its gutter, except for an
  // allowed bleed past the window edge.
  function placeX(gutter, side, size, vw) {
    var lo, hi;
    if (side < 0) {
      lo = -size * EDGE_BLEED;
      hi = gutter - CONTENT_GAP - size;
    } else {
      lo = vw - gutter + CONTENT_GAP;
      hi = vw - size * (1 - EDGE_BLEED);
    }
    if (hi < lo) return lo;
    return lo + Math.random() * (hi - lo);
  }

  function teardown() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
    cubes.length = 0;
    layer.textContent = "";
  }

  function build() {
    teardown();

    var g = measureGutters();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var useLeft = g.left >= MIN_GUTTER;
    var useRight = g.right >= MIN_GUTTER;
    if (!useLeft && !useRight) return; // no room: draw nothing, cost nothing

    var count = Math.round(vh / DENSITY_PX);
    if (count < COUNT_MIN) count = COUNT_MIN;
    if (count > COUNT_MAX) count = COUNT_MAX;
    if (!useLeft || !useRight) count = Math.ceil(count / 2);

    band = vh + margin * 2;

    var frag = document.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      // Depth: slower cubes read as further away, so they are drawn smaller.
      var depth = Math.random();
      var speed = lerp(SPEED_MIN, SPEED_MAX, depth);
      var size = lerp(SIZE_MIN, SIZE_MAX, depth);

      var side;
      if (useLeft && useRight) side = i % 2 === 0 ? -1 : 1;
      else side = useLeft ? -1 : 1;

      var svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "cube-svg");
      svg.setAttribute("viewBox", "-50 -50 100 100");
      svg.setAttribute("aria-hidden", "true");
      svg.style.width = size + "px";
      svg.style.height = size + "px";

      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("stroke", colorAt(Math.random()));
      svg.appendChild(path);
      frag.appendChild(svg);

      var x = placeX(side < 0 ? g.left : g.right, side, size, vw);

      cubes.push({
        svg: svg,
        path: path,
        speed: speed,
        // Spread evenly down the band, with enough jitter to avoid a visible
        // ladder but not enough to let them clump.
        baseY: (i + 0.5 + (Math.random() - 0.5) * 0.7) * (band / count),
        // Prebuilt transform prefix: x is fixed until the next rebuild, so the
        // render loop only ever concatenates the y term.
        xs: "translate3d(" + x.toFixed(1) + "px,",
        seed: Math.random() * ROT_PERIOD,
        frame: -1,
        lastY: NaN
      });
    }

    layer.appendChild(frag);
    render();
  }

  // ---------- render ----------

  function render() {
    for (var i = 0; i < cubes.length; i++) {
      var c = cubes[i];

      var idx = (mod(y * ROT_PER_PX + c.seed, ROT_PERIOD) * FRAME_SCALE) | 0;
      if (idx >= ROT_FRAMES) idx = ROT_FRAMES - 1; // float-rounding guard
      if (idx !== c.frame) {
        c.frame = idx;
        c.path.setAttribute("d", FRAMES[idx]);
      }

      // Modular wrap: independent of document height, so a very tall page
      // behaves exactly like a short one and no cube is ever stranded.
      var ty = mod(c.baseY - y * c.speed, band) - margin;
      if (ty !== c.lastY) {
        c.lastY = ty;
        // transform only -- never top/left -- so this stays off the layout path.
        c.svg.style.transform = c.xs + ty.toFixed(1) + "px,0)";
      }
    }
  }

  function tick() {
    var dy = targetY - y;
    if (dy < SETTLE_PX && dy > -SETTLE_PX) {
      y = targetY;
      render();
      running = false;
      rafId = 0;
      return; // settled: burn no more frames until the next scroll
    }
    y += dy * EASE;
    render();
    rafId = requestAnimationFrame(tick);
  }

  function kick() {
    if (!running && cubes.length) {
      running = true;
      rafId = requestAnimationFrame(tick);
    }
  }

  // ---------- wiring ----------

  build();

  if (!reduceMotion) {
    window.addEventListener("scroll", function () {
      targetY = window.scrollY;
      kick();
    }, { passive: true });
  }

  window.addEventListener("resize", function () {
    clearTimeout(resizeId);
    resizeId = setTimeout(function () {
      y = targetY = window.scrollY;
      build();
    }, 150);
  });
})();
