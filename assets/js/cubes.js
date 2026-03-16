document.addEventListener("DOMContentLoaded", () => {
  let layer = document.getElementById("cube-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "cube-layer";
    layer.className = "cube-layer";
    document.body.appendChild(layer);
  }

  // ---------- CONFIG ----------
  const CUBE_COUNT = 50;
  const PAGE_SPREAD = 10000;
  const EDGE_OVERLAP_MIN = -3;
  const EDGE_OVERLAP_MAX = 6;
  const SPEED_MIN = 0;
  const SPEED_MAX = 0.5;
  const SIZE_MIN = 30;
  const SIZE_MAX = 100;
  const COLOR_A = [107, 188, 255];
  const COLOR_B = [52, 163, 23];

  // *** NEW: breakpoint to match your CSS ***
  const HIDE_BELOW_PX = 900;

  const cubes = [];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function randomColor() {
    const t = Math.random();
    const r = Math.round(lerp(COLOR_A[0], COLOR_B[0], t));
    const g = Math.round(lerp(COLOR_A[1], COLOR_B[1], t));
    const b = Math.round(lerp(COLOR_A[2], COLOR_B[2], t));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function project([x,y,z]) {
    const d = 200;
    const s = d / (d + z);
    return [x * s, y * s];
  }

  function cubeLines(rx, ry) {
    const s = 20;
    const pts = [
      [-s,-s,-s], [ s,-s,-s], [ s, s,-s], [-s, s,-s],
      [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s]
    ];
    const rotX = a => ([x,y,z]) =>
      [x, y*Math.cos(a)-z*Math.sin(a), y*Math.sin(a)+z*Math.cos(a)];
    const rotY = a => ([x,y,z]) =>
      [x*Math.cos(a)+z*Math.sin(a), y, -x*Math.sin(a)+z*Math.cos(a)];
    const p = pts.map(rotY(ry)).map(rotX(rx)).map(project);
    return [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7]
    ].map(([a,b]) => [p[a],p[b]]);
  }

  for (let i = 0; i < CUBE_COUNT; i++) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("cube-svg");
    svg.setAttribute("viewBox", "-50 -50 100 100");

    const side = (i % 2 === 0) ? "left" : "right";
    const edgeOffset = lerp(EDGE_OVERLAP_MIN, EDGE_OVERLAP_MAX, Math.random());
    svg.style[side] = `${edgeOffset}%`;

    const speed = lerp(SPEED_MIN, SPEED_MAX, Math.random());
    const t = (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
    const size = lerp(SIZE_MIN, SIZE_MAX, t);
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;

    const baseTop = (i / (CUBE_COUNT - 1)) * PAGE_SPREAD;
    const jitter = (Math.random() - 0.5) * 220;
    svg.style.top = `0px`;

    layer.appendChild(svg);

    cubes.push({
      svg,
      speed,
      size,
      color: randomColor(),
      rotSeed: Math.random() * Math.PI * 2,
      baseTopPx: baseTop + jitter
    });
  }

  let y = window.scrollY;
  let ty = y;
  let v = 0;

  window.addEventListener("scroll", () => { ty = window.scrollY; });

  function animate() {
    // *** NEW: skip all work if cubes are hidden ***
    if (window.innerWidth < HIDE_BELOW_PX) {
      requestAnimationFrame(animate);
      return;
    }

    v += (ty - y) * 0.01;
    v *= 0.85;
    y += v;

    const vh = window.innerHeight;

    cubes.forEach((c) => {
      const r = y * 0.002 + c.rotSeed;
      const lines = cubeLines(r, r * 0.8);

      c.svg.innerHTML = lines.map(
        ([[x1,y1],[x2,y2]]) =>
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.color}"/>`
      ).join("");

      const baseTopInViewportPx = (c.baseTopPx - y) * 0.18;
      const parallax = -y * c.speed;

      c.svg.style.transform = `translateY(${parallax}px)`;
      c.svg.style.top = `${(vh * 0.15) + baseTopInViewportPx}px`;
    });

    requestAnimationFrame(animate);
  }

  animate();
});