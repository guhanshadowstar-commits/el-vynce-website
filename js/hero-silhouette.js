/* EL VYNCE — animated monochrome city hero (day/night cycle).
   A procedural downtown of wireframe/solid buildings on a street grid, populated by
   low-poly figures wearing real Warrior Drop tees, looping through a continuous
   day-to-night-to-day cycle. Strictly achromatic: only black/white/gray at every
   point in the cycle. Interactive: click a figure to jump to its product, cursor
   parallax, scroll-linked camera pull-back.
   ES module (three.js r0.160). No external 3D asset files, no build step. */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Real product photography — front print of each tee. Cycled across every figure
// so, over time, the full catalogue is represented walking the street.
const SHIRT_PRODUCTS = [
  { image: "images/products/built-different-front.jpg", id: "ev-006b" },
  { image: "images/products/dare-to-be-different-front.jpg", id: "ev-006" },
  { image: "images/products/frequency-front.jpg", id: "ev-007" },
  { image: "images/products/im-just-a-girl-front.jpg", id: "ev-008" },
  { image: "images/products/inner-noise-front.jpg", id: "ev-009" },
  { image: "images/products/just-be-resilient-front.jpg", id: "ev-005" },
  { image: "images/products/rebel-soul-front.jpg", id: "ev-010" },
  { image: "images/products/style-pays-off-front.jpg", id: "ev-004" },
];

const SMALL_SCREEN_WIDTH = 768; // below this, trim figure/building counts for perf.
const isSmallScreen = window.innerWidth < SMALL_SCREEN_WIDTH;
const FIGURE_COUNT = isSmallScreen ? 5 : 8;
const BUILDINGS_PER_ROW = isSmallScreen ? 1 : 2;

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const textureLoader = new THREE.TextureLoader();

// ---------------------------------------------------------------------------
// Day/night cycle constants
// ---------------------------------------------------------------------------
// Full cycle length in seconds (~60s dawn->day->dusk->night->dawn). cyclePhase
// below is a 0..1 loop value derived from elapsed time / CYCLE_SECONDS.
const CYCLE_SECONDS = 62;

// Grayscale stops sampled across the cycle. Everything here is strictly
// black/white/gray — no hue is ever introduced.
const SKY_DAY = new THREE.Color(0xf5f5f5);
const SKY_NIGHT = new THREE.Color(0x050505);
const BUILDING_EDGE_DAY = new THREE.Color(0x000000);
const BUILDING_EDGE_NIGHT = new THREE.Color(0xffffff);
const GROUND_DAY = new THREE.Color(0xe4e4e4);
const GROUND_NIGHT = new THREE.Color(0x141414);
const FACADE_DAY = new THREE.Color(0xffffff);
const FACADE_NIGHT = new THREE.Color(0x1c1c1c);

// addEdges() draws a thin outline (EdgesGeometry) over a solid mesh so shapes
// keep a crisp graphic silhouette instead of dissolving into flat shading —
// this is what lets the buildings/figures still read as line art at night.
function addEdges(mesh, color = 0x000000) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const material = new THREE.LineBasicMaterial({ color, linewidth: 1 });
  const line = new THREE.LineSegments(edges, material);
  mesh.add(line);
  return { mesh, edgeMaterial: material };
}

function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, material) {
  // No edge-line overlay on limbs — they're small and numerous (up to 8 figures x
  // 8 limb segments), and the extra LineSegments draw calls were a real cost on
  // mobile GPUs. Limbs stay flat matte gray/black instead.
  const upperGroup = new THREE.Group();
  upperGroup.position.set(sideOffset, originY, 0);

  const upperGeo = new THREE.CapsuleGeometry(upperRadius, upperLen - upperRadius * 1.4, 4, 6);
  const upperMesh = new THREE.Mesh(upperGeo, material);
  upperMesh.position.set(0, -upperLen / 2, 0);
  upperGroup.add(upperMesh);

  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(0, -upperLen, 0);
  const lowerGeo = new THREE.CapsuleGeometry(lowerRadius, lowerLen - lowerRadius * 1.4, 4, 6);
  const lowerMesh = new THREE.Mesh(lowerGeo, material);
  lowerMesh.position.set(0, -lowerLen / 2, 0);
  lowerGroup.add(lowerMesh);
  upperGroup.add(lowerGroup);

  return { upperGroup, lowerGroup };
}

function createFigure(shirtImageUrl) {
  // Solid-shaded matte material (not wireframe) — needs real lights in the scene
  // to read. Stays a fixed dark gray across the whole day/night cycle so the
  // tee texture on the torso remains the clear focal point at all times.
  const skin = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.05 });

  const figure = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.5, 4, 8);
  const torsoMesh = new THREE.Mesh(torsoGeo, skin);
  const torso = addEdges(torsoMesh).mesh;
  torso.position.set(0, 1.05, 0);
  figure.add(torso);

  // Real product photo (front of the tee) mapped onto a plane on the chest.
  // Falls back to a plain gray torso panel if the texture fails to load
  // (e.g. a bad path or offline asset) rather than showing a broken/blank plane.
  const shirtGeo = new THREE.PlaneGeometry(0.46, 0.6);
  const shirtMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, depthWrite: false });
  const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
  shirtMesh.position.set(0, 0.05, 0.345);
  torso.add(shirtMesh);
  textureLoader.load(
    shirtImageUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      shirtMat.map = tex;
      shirtMat.color.set(0xffffff);
      shirtMat.needsUpdate = true;
    },
    undefined,
    () => {
      // Load failed — keep the plain gray fallback panel already assigned above.
      console.warn("EL VYNCE hero: tee texture failed to load, using gray fallback:", shirtImageUrl);
    }
  );

  const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const head = addEdges(new THREE.Mesh(headGeo, skin)).mesh;
  head.position.set(0, 1.66, 0);
  figure.add(head);

  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8);
  const neck = addEdges(new THREE.Mesh(neckGeo, skin)).mesh;
  neck.position.set(0, 1.47, 0);
  figure.add(neck);

  const hips = new THREE.Group();
  hips.position.set(0, 0.72, 0);
  figure.add(hips);

  const shoulderY = 1.32;
  const armSpan = 0.4;
  const leftArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, -armSpan, skin);
  const rightArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, armSpan, skin);
  figure.add(leftArm.upperGroup, rightArm.upperGroup);

  const legSpan = 0.16;
  const leftLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, -legSpan, skin);
  const rightLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, legSpan, skin);
  hips.add(leftLeg.upperGroup, rightLeg.upperGroup);

  return { group: figure, torso, head, leftArm, rightArm, leftLeg, rightLeg, hips };
}

// Builds one building box with a canvas-drawn facade texture (window grid) plus
// a set of small emissive "window" sprites that stay invisible by day and glow
// white at night — the only bit of "light" the city shows after dark.
function createBuilding(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);

  // Facade texture: light gray field with a grid of slightly-darker window
  // rectangles. Recolored day->night via material.color, so the same canvas
  // texture serves both phases (division line: e.g. a window disappears into a
  // dark facade at night while its emissive dot sprite ignites in front of it).
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#d8d8d8";
  const cols = 4;
  const rows = Math.round(8 * (h / 6));
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  const windowCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cellW + cellW * 0.22;
      const cy = r * cellH + cellH * 0.22;
      const cw = cellW * 0.56;
      const ch = cellH * 0.56;
      ctx.fillRect(cx, cy, cw, ch);
      windowCells.push({ r, c, rows, cols });
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, h / 2, 0);

  // Sparse emissive window dots on the two street-facing sides only (front/back
  // faces along Z) — enough to read as "lit windows" at night without the cost
  // of dots on every face of every building.
  const windowGroup = new THREE.Group();
  const windowGeo = new THREE.PlaneGeometry(w * 0.06, h * 0.03);
  const litFraction = 0.35; // fraction of window cells that glow at night, rest stay dark
  const maxDots = 26; // hard cap per building — keeps draw calls bounded on tall buildings
  let dotsPlaced = 0;
  for (const cell of windowCells) {
    if (dotsPlaced >= maxDots) break;
    if (Math.random() > litFraction) continue;
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const dot = new THREE.Mesh(windowGeo, dotMat);
    const px = (cell.c + 0.5) / cell.cols * w - w / 2;
    const py = (cell.rows - cell.r - 0.5) / cell.rows * h - h / 2 + h / 2;
    dot.position.set(px, py, d / 2 + 0.01);
    windowGroup.add(dot);
    const dotBack = new THREE.Mesh(windowGeo, dotMat.clone());
    dotBack.position.set(-px, py, -d / 2 - 0.01);
    dotBack.rotation.y = Math.PI;
    windowGroup.add(dotBack);
    dotsPlaced++;
  }
  mesh.add(windowGroup);

  return { mesh, facadeMaterial: mat, windowDots: windowGroup.children };
}

function initHeroSilhouette() {
  const mount = document.getElementById("hero-silhouette");
  const heroHeader = mount ? mount.closest("header") : null;
  if (!mount) return;

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null;

  // Base camera pose (before parallax/scroll offsets are applied each frame).
  const BASE_CAM_POS = new THREE.Vector3(0, 2.6, 8.2);
  const BASE_CAM_TARGET = new THREE.Vector3(0, 1.1, 0);
  // Scroll-pulled-back pose — camera rises and retreats as the visitor scrolls past the hero.
  const SCROLL_CAM_POS = new THREE.Vector3(0, 6.5, 16);
  const SCROLL_CAM_TARGET = new THREE.Vector3(0, 2, 0);
  // Slow cinematic drift added on top of the base pose — a gentle figure-eight-ish
  // sway so the city always feels alive even with the pointer untouched.
  const DRIFT_AMPLITUDE_X = 0.6;
  const DRIFT_AMPLITUDE_Y = 0.18;
  const DRIFT_SPEED = 0.06;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_CAM_TARGET);

  // Capped at 2x — this scene has a lot of geometry, and rendering at full
  // retina resolution beyond 2x was a needless GPU cost with no visible gain.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cursor = "default";
  mount.appendChild(renderer.domElement);

  // ---- Lighting (required for solid MeshStandardMaterial shading) ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  // ---- Sky backdrop: a plain color plane whose color is driven by the day/night
  // cycle each frame (see updateDayNightCycle). Replaces the old static gradient
  // since the sky now needs to continuously shift between near-white and near-black.
  const bgGeo = new THREE.PlaneGeometry(90, 45);
  const bgMat = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone(), depthWrite: false, fog: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 8, -22);
  scene.add(bgMesh);

  // Sun/moon disc — a single flat circle that arcs across the sky and swaps
  // its look (solid white sun glow vs flatter white moon disc) across the cycle.
  const celestialGeo = new THREE.CircleGeometry(1.1, 32);
  const celestialMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
  const celestial = new THREE.Mesh(celestialGeo, celestialMat);
  celestial.position.set(0, 14, -21);
  scene.add(celestial);

  // ---- Street / ground plane ----
  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: GROUND_DAY.clone(), roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Faint sidewalk-seam grid lines on top of the ground. Grid colors are fixed
  // (not cycle-driven) — they're subtle enough at both extremes to stay legible.
  const gridHelper = new THREE.GridHelper(40, 20, 0xcccccc, 0xd9d9d9);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  // ---- Simple geometric city skyline flanking the street, both sides ----
  const buildingRowZ = [-7, -11];
  const buildingEdgeMaterials = [];
  const buildingFacadeMaterials = [];
  const allWindowDots = [];
  [-1, 1].forEach((side) => {
    buildingRowZ.forEach((z, i) => {
      for (let j = 0; j < BUILDINGS_PER_ROW; j++) {
        const w = 2.2 + Math.random() * 1.6;
        const h = 3 + Math.random() * (5 + i * 2.5);
        const d = 2.2 + Math.random() * 1.6;
        const building = createBuilding(w, h, d);
        building.mesh.position.x = side * (5.5 + j * 3.2 + Math.random() * 0.4);
        building.mesh.position.z = z + (Math.random() - 0.5) * 1.2;
        scene.add(building.mesh);
        buildingFacadeMaterials.push(building.facadeMaterial);
        allWindowDots.push(...building.windowDots);

        // Edge wireframe outline per building — same addEdges() treatment as the
        // figures, so buildings keep a crisp line-art silhouette through the cycle.
        const edgeGeo = new THREE.EdgesGeometry(building.mesh.geometry);
        const edgeMat = new THREE.LineBasicMaterial({ color: BUILDING_EDGE_DAY.clone() });
        const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        building.mesh.add(edgeLines);
        buildingEdgeMaterials.push(edgeMat);
      }
    });
  });

  // ---- Spawn NPC figures on independent wandering paths along the street ----
  const WALK_SPEED = 3.2;
  const SWING_HIP = 0.55;
  const SWING_KNEE = 0.7;
  const SWING_SHOULDER = 0.35;
  const SWING_ELBOW = 0.4;
  // Chance per second a walking figure decides to pause for a beat (window-shopping pace variety).
  const PAUSE_CHANCE_PER_SEC = 0.04;
  const PAUSE_DURATION = [1.2, 2.8];

  const npcs = [];
  for (let i = 0; i < FIGURE_COUNT; i++) {
    const product = SHIRT_PRODUCTS[i % SHIRT_PRODUCTS.length];
    const fig = createFigure(product.image);
    scene.add(fig.group);

    const npc = {
      ...fig,
      productId: product.id,
      pathRadiusX: 1.6 + Math.random() * 1.8,
      pathRadiusZ: 1.0 + Math.random() * 1.2,
      pathSpeed: (0.1 + Math.random() * 0.12), // wide per-figure pace variety
      pathPhase: Math.random() * Math.PI * 2,
      centerX: (i - (FIGURE_COUNT - 1) / 2) * 1.6 + (Math.random() - 0.5) * 0.6,
      centerZ: -1 + (Math.random() - 0.5) * 1.5,
      walkPhase: Math.random() * Math.PI * 2,
      scale: 0.85 + Math.random() * 0.3,
      paused: false,
      pauseUntil: 0,
      pausedAtPathT: 0,
    };
    fig.group.scale.setScalar(npc.scale);
    npcs.push(npc);
  }

  const clock = new THREE.Clock();

  // ---- Cursor-driven camera parallax ----
  let pointerX = 0; // normalized -1..1
  let pointerY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  window.addEventListener("mousemove", (e) => {
    const rect = mount.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  });

  // ---- Scroll-linked camera pull-back ----
  let scrollProgress = 0; // 0 = top of hero, 1 = fully scrolled past
  function updateScrollProgress() {
    if (!heroHeader) return;
    const rect = heroHeader.getBoundingClientRect();
    const total = rect.height || window.innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / total));
    scrollProgress = p;
  }
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();

  // ---- Click a figure to jump to its product ----
  const raycaster = new THREE.Raycaster();
  const pointerVec = new THREE.Vector2();

  function npcUnderPointer(clientX, clientY) {
    const rect = mount.getBoundingClientRect();
    pointerVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerVec, camera);
    const targets = npcs.map((n) => n.group);
    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !npcs.find((n) => n.group === obj)) obj = obj.parent;
    return obj ? npcs.find((n) => n.group === obj) : null;
  }

  // Canvas must not swallow clicks meant for the search bar / CTA button — those
  // sit above the hero as normal DOM elements, and only the empty canvas area
  // should be clickable (for the figure-click-to-product feature).
  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.addEventListener("click", (e) => {
    const hit = npcUnderPointer(e.clientX, e.clientY);
    if (hit) window.location.href = `product-detail.html?id=${hit.productId}`;
  });
  // Throttled — raycasting against every figure on every single mousemove event
  // was a steady extra cost piling on top of the render loop. ~15 checks/sec is
  // plenty for a hover-cursor change and is unnoticeable to a real user.
  let lastHoverCheck = 0;
  renderer.domElement.addEventListener("mousemove", (e) => {
    const now = performance.now();
    if (now - lastHoverCheck < 66) return;
    lastHoverCheck = now;
    const hit = npcUnderPointer(e.clientX, e.clientY);
    renderer.domElement.style.cursor = hit ? "pointer" : "default";
  });

  // Pause the render loop entirely once the hero scrolls out of view — no point
  // burning GPU/CPU on a scene nobody can see, and it stops competing with the
  // rest of the page's scroll/animation work for the main thread.
  let isVisible = true;
  if ("IntersectionObserver" in window && heroHeader) {
    new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(heroHeader);
  }

  // Also pause on background tabs (visibilitychange) — IntersectionObserver alone
  // doesn't cover a backgrounded browser tab where the hero is still "in view".
  let tabHidden = document.hidden;
  document.addEventListener("visibilitychange", () => {
    tabHidden = document.hidden;
  });

  // ---- Day/night cycle state ----
  // Reused scratch color objects so the per-frame lerps don't allocate garbage.
  const skyColor = new THREE.Color();
  const groundColor = new THREE.Color();
  const facadeColor = new THREE.Color();
  const edgeColor = new THREE.Color();
  let isNightNow = false;

  // cyclePhase: 0 = dawn/start of day, 0.5 = deep night, 1 = back to dawn (loops).
  // Shaped with a cosine so day and night both have a "held" bright/dark plateau
  // rather than a linear ramp that spends equal time mid-transition.
  function updateDayNightCycle(t) {
    const cyclePhase = (t % CYCLE_SECONDS) / CYCLE_SECONDS; // 0..1
    // nightAmount: 0 = full day, 1 = full night. cos-shaped so it eases in/out
    // and holds near the extremes instead of spending most of its time blending.
    const nightAmount = (1 - Math.cos(cyclePhase * Math.PI * 2)) / 2;

    skyColor.copy(SKY_DAY).lerp(SKY_NIGHT, nightAmount);
    bgMat.color.copy(skyColor);

    groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, nightAmount);
    groundMat.color.copy(groundColor);

    facadeColor.copy(FACADE_DAY).lerp(FACADE_NIGHT, nightAmount);
    buildingFacadeMaterials.forEach((m) => m.color.copy(facadeColor));

    edgeColor.copy(BUILDING_EDGE_DAY).lerp(BUILDING_EDGE_NIGHT, nightAmount);
    buildingEdgeMaterials.forEach((m) => m.color.copy(edgeColor));

    // Window dots: invisible by day, glow in (opacity ramps up) once nightAmount
    // passes the halfway point, so lights only "switch on" once dusk sets in.
    const windowGlow = Math.max(0, (nightAmount - 0.5) / 0.5);
    allWindowDots.forEach((dot) => {
      dot.material.opacity = windowGlow * 0.9;
    });

    // Sun/moon arc: swings across the sky opposite the night amount (sun is up
    // during day, dips below the horizon at night while the moon takes over).
    const arcAngle = cyclePhase * Math.PI * 2;
    celestial.position.x = Math.sin(arcAngle) * 16;
    celestial.position.y = 8 + Math.cos(arcAngle) * 9;
    celestial.material.opacity = Math.max(0.15, 1 - nightAmount * 0.3);
    // Slight scale-down + dimmer look reads as "moon" vs "sun" without any hue shift.
    const celestialScale = 1 - nightAmount * 0.35;
    celestial.scale.setScalar(celestialScale);

    // Ambient/sun light dims into night so the whole scene reads darker overall,
    // not just the background color.
    ambient.intensity = 0.65 - nightAmount * 0.35;
    sun.intensity = (0.85 - nightAmount * 0.55) + Math.sin(t * 0.02 * 0.5) * 0.05;
    fill.intensity = 0.3 - nightAmount * 0.15;

    // Toggle the header's is-night class only on real state changes, driving the
    // CSS transitions in style.css for the wordmark/paragraph/CTA colors.
    const shouldBeNight = nightAmount > 0.55;
    if (shouldBeNight !== isNightNow) {
      isNightNow = shouldBeNight;
      if (heroHeader) heroHeader.classList.toggle("is-night", isNightNow);
    }
  }

  // ---- Reduced motion: render a single static day frame, no animation loop ----
  if (prefersReducedMotion) {
    updateDayNightCycle(0);
    renderer.render(scene, camera);
  } else {
    function animate() {
      requestAnimationFrame(animate);
      if (!isVisible || tabHidden) return;
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();

      npcs.forEach((npc) => {
        // Ambient pause behavior — occasionally a figure stops walking for a beat.
        if (npc.paused) {
          if (t > npc.pauseUntil) npc.paused = false;
        } else if (Math.random() < PAUSE_CHANCE_PER_SEC * dt) {
          npc.paused = true;
          npc.pausedAtPathT = t * npc.pathSpeed + npc.pathPhase;
          npc.pauseUntil = t + PAUSE_DURATION[0] + Math.random() * (PAUSE_DURATION[1] - PAUSE_DURATION[0]);
        }

        const pathT = npc.paused ? npc.pausedAtPathT : t * npc.pathSpeed + npc.pathPhase;
        const x = npc.centerX + Math.cos(pathT) * npc.pathRadiusX;
        const z = npc.centerZ + Math.sin(pathT * 1.3) * npc.pathRadiusZ;
        const nextPathT = pathT + 0.05;
        const nx = npc.centerX + Math.cos(nextPathT) * npc.pathRadiusX;
        const nz = npc.centerZ + Math.sin(nextPathT * 1.3) * npc.pathRadiusZ;
        const heading = Math.atan2(nx - x, nz - z);

        npc.group.position.set(x, 0, z);
        if (!npc.paused) npc.group.rotation.y = heading;

        const walkActive = npc.paused ? 0 : 1;
        const phase = t * WALK_SPEED + npc.walkPhase;
        npc.leftLeg.upperGroup.rotation.x = Math.sin(phase) * SWING_HIP * walkActive;
        npc.rightLeg.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_HIP * walkActive;
        npc.leftLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 0.5)) * SWING_KNEE * walkActive;
        npc.rightLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 1.5)) * SWING_KNEE * walkActive;

        npc.leftArm.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_SHOULDER * walkActive;
        npc.rightArm.upperGroup.rotation.x = Math.sin(phase) * SWING_SHOULDER * walkActive;
        npc.leftArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW * walkActive;
        npc.rightArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW * walkActive;

        npc.hips.position.y = 0.72 + Math.abs(Math.sin(phase)) * 0.02 * walkActive;
        npc.torso.rotation.z = Math.sin(phase) * 0.02 * walkActive;
        npc.head.rotation.y = Math.sin(phase * 0.5) * 0.06;
      });

      updateDayNightCycle(t);

      // Cursor parallax: ease toward the target offset rather than snapping.
      parallaxX += (pointerX - parallaxX) * 0.04;
      parallaxY += (pointerY - parallaxY) * 0.04;

      // Slow cinematic drift — an independent, near-imperceptible sway so the
      // camera never sits perfectly still even when the pointer doesn't move.
      const driftX = Math.sin(t * DRIFT_SPEED) * DRIFT_AMPLITUDE_X;
      const driftY = Math.sin(t * DRIFT_SPEED * 0.7) * DRIFT_AMPLITUDE_Y;

      // Blend base camera pose toward the scroll-pulled-back pose as the visitor scrolls past the hero.
      const camPos = BASE_CAM_POS.clone().lerp(SCROLL_CAM_POS, scrollProgress);
      const camTarget = BASE_CAM_TARGET.clone().lerp(SCROLL_CAM_TARGET, scrollProgress);

      // Parallax + drift offset shrinks as we pull back, so it doesn't fight the scroll motion.
      const parallaxStrength = 0.5 * (1 - scrollProgress);
      camPos.x += parallaxX * parallaxStrength + driftX * (1 - scrollProgress);
      camPos.y += -parallaxY * parallaxStrength * 0.5 + driftY * (1 - scrollProgress);

      camera.position.copy(camPos);
      camera.lookAt(camTarget);

      renderer.render(scene, camera);
    }
    animate();
  }

  function onResize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (prefersReducedMotion) renderer.render(scene, camera);
  }
  window.addEventListener("resize", onResize);
}

document.addEventListener("DOMContentLoaded", initHeroSilhouette);
