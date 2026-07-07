/* EL VYNCE — cinematic full-color city hero, real-time day/night cycle.
   A downtown street scene (colored sky, glowing sun/moon, muted-color buildings,
   warm/cool directional light) populated by real Mixamo human characters
   (models/people/*.glb) walking the street, each with a product tee design
   composited into their shirt texture, plus a hip-hop street performer and
   rare trip/sing street-life moments. Falls back to stylized procedural
   figures if the GLBs fail to load, so the hero never breaks. Time of day is
   driven by the visitor's actual local clock, not a fake loop. Interactive:
   click a figure to jump to its product, cursor parallax, scroll-linked
   camera pull-back. ES module (three.js r0.160). No build step. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";

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
// Horizontal reach of the sun/moon arc: the narrow portrait frustum can only
// see ~±8 world units at the sky plane, so the arc is tightened on phones.
const CELESTIAL_X = isSmallScreen ? 6 : 15;

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const textureLoader = new THREE.TextureLoader();

// ---------------------------------------------------------------------------
// Real-time day/night math
// ---------------------------------------------------------------------------
// dayFraction: a continuous 0..24 value built from the visitor's actual local
// hours + minutes (+ seconds, for smooth sub-minute motion) — NOT a fake sped
// up loop. Someone loading the hero at 17:55 sees the sun already low and the
// sky already warming toward sunset, and it keeps drifting in real time.
// Optional preview override: ?evhour=18.2 pins the scene to any hour (0-24)
// so day/sunset/night states can be checked without waiting for the clock.
const DEBUG_HOUR = parseFloat(new URLSearchParams(window.location.search).get("evhour"));

function getLocalDayFraction() {
  if (Number.isFinite(DEBUG_HOUR)) return ((DEBUG_HOUR % 24) + 24) % 24;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

// Key color/light stops across the day. Each stop is [hour, value]; helper
// below linearly interpolates between the two bracketing stops for a given
// hour so every transition (night->dawn->day->dusk->night) is continuous —
// no hard cuts, even across the wrap-around at midnight.
const SKY_STOPS = [
  [0, new THREE.Color(0x02040c)], // deep night
  [5, new THREE.Color(0x02040c)],
  [6, new THREE.Color(0xff9e5e)], // sunrise glow
  [7, new THREE.Color(0xffd39a)], // golden hour warmth lingering
  [9, new THREE.Color(0x8fc6f0)], // clear morning blue
  [12, new THREE.Color(0x6bb3e8)], // midday blue
  [16, new THREE.Color(0x7fbfe8)],
  [17.5, new THREE.Color(0xff9d6a)], // golden hour begins
  [18.5, new THREE.Color(0xff6f61)], // sunset
  [19.5, new THREE.Color(0x3a2a55)], // dusk purple
  [21, new THREE.Color(0x090a1c)], // deep night
  [24, new THREE.Color(0x02040c)],
];
const SUN_LIGHT_COLOR_STOPS = [
  [0, new THREE.Color(0x8fb0ff)], // moonlight (cool blue)
  [5.5, new THREE.Color(0x8fb0ff)],
  [6.5, new THREE.Color(0xffb37a)], // warm sunrise
  [9, new THREE.Color(0xfff3d6)], // clean daylight
  [16, new THREE.Color(0xfff3d6)],
  [17.5, new THREE.Color(0xffa15c)], // warm late afternoon
  [18.5, new THREE.Color(0xff7a4d)], // sunset orange
  [19.5, new THREE.Color(0x6a7bd6)],
  [20.5, new THREE.Color(0x8fb0ff)],
  [24, new THREE.Color(0x8fb0ff)],
];
const GROUND_STOPS = [
  [0, new THREE.Color(0x14161f)],
  [6, new THREE.Color(0x6b6157)],
  [9, new THREE.Color(0x8f887e)],
  [17.5, new THREE.Color(0x8f887e)],
  [18.5, new THREE.Color(0x6b5850)],
  [20, new THREE.Color(0x1c1d26)],
  [24, new THREE.Color(0x14161f)],
];

function sampleStops(stops, hour) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [h0, c0] = stops[i];
    const [h1, c1] = stops[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = h1 === h0 ? 0 : (hour - h0) / (h1 - h0);
      return c0.clone().lerp(c1, t);
    }
  }
  return stops[stops.length - 1][1].clone();
}

// sunAltitude01: 0 at horizon-or-below, 1 at solar noon. Sun is above the
// horizon roughly 6:00-18:30 (per brief); shaped with a sine so it rises/sets
// smoothly rather than popping. Moon uses the complementary window.
function sunAltitude01(hour) {
  const sunrise = 6.0;
  const sunset = 18.5;
  if (hour <= sunrise || hour >= sunset) return 0;
  const span = sunset - sunrise;
  const t = (hour - sunrise) / span; // 0..1 across the day
  return Math.sin(t * Math.PI); // 0 at rise/set, 1 at midday
}
function moonAltitude01(hour) {
  // Moon window mirrors the sun's, centered on midnight, wrapping across 0/24.
  const moonrise = 18.5;
  const moonset = 30.0; // = 6.0 next day
  let h = hour;
  if (h < moonrise) h += 24;
  if (h < moonrise || h > moonset) return 0;
  const span = moonset - moonrise;
  const t = (h - moonrise) / span;
  return Math.sin(t * Math.PI);
}
// nightAmount: 0 = full day (sun high), 1 = full night (sun fully down, moon
// out) — drives sky darkening, window glow, star opacity, ambient dimming.
function nightAmountFor(hour) {
  const sunAlt = sunAltitude01(hour);
  return THREE.MathUtils.clamp(1 - sunAlt * 1.4, 0, 1);
}

// addEdges() draws a thin outline (EdgesGeometry) over a solid mesh so shapes
// keep a crisp graphic silhouette instead of dissolving into flat shading.
function addEdges(mesh, color = 0x000000, opacity = 0.35) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.LineSegments(edges, material);
  mesh.add(line);
  return { mesh, edgeMaterial: material };
}

// ---------------------------------------------------------------------------
// Fallback stylized human figure (used only if Soldier.glb fails to load) —
// proper head/shoulders/arms/legs with a natural walk swing. Not a blocky
// android: capsule limbs, rounded head, torso taper.
// ---------------------------------------------------------------------------
function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, material) {
  const upperGroup = new THREE.Group();
  upperGroup.position.set(sideOffset, originY, 0);

  const upperGeo = new THREE.CapsuleGeometry(upperRadius, upperLen - upperRadius * 1.4, 4, 8);
  const upperMesh = new THREE.Mesh(upperGeo, material);
  upperMesh.position.set(0, -upperLen / 2, 0);
  upperGroup.add(upperMesh);

  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(0, -upperLen, 0);
  const lowerGeo = new THREE.CapsuleGeometry(lowerRadius, lowerLen - lowerRadius * 1.4, 4, 8);
  const lowerMesh = new THREE.Mesh(lowerGeo, material);
  lowerMesh.position.set(0, -lowerLen / 2, 0);
  lowerGroup.add(lowerMesh);
  upperGroup.add(lowerGroup);

  return { upperGroup, lowerGroup };
}

function attachShirtPlane(parent, shirtImageUrl, yOffset = 0.05, z = 0.345) {
  const shirtGeo = new THREE.PlaneGeometry(0.46, 0.6);
  const shirtMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, depthWrite: false });
  const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
  shirtMesh.position.set(0, yOffset, z);
  parent.add(shirtMesh);
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
      console.warn("EL VYNCE hero: tee texture failed to load, using fallback panel:", shirtImageUrl);
    }
  );
  return shirtMesh;
}

function createStylizedFigure(shirtImageUrl) {
  // Warm-neutral skin/clothing tone (not pure black) so the figure reads as a
  // human silhouette rather than a monochrome android, while staying subdued
  // enough that the tee graphic on the chest remains the focal point.
  const clothing = new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.85, metalness: 0.05 });
  const skinTone = new THREE.MeshStandardMaterial({ color: 0xc79a75, roughness: 0.7, metalness: 0 });

  const figure = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.5, 4, 8);
  const torsoMesh = new THREE.Mesh(torsoGeo, clothing);
  const torso = addEdges(torsoMesh).mesh;
  torso.position.set(0, 1.05, 0);
  figure.add(torso);

  // Real product photo mapped onto the chest. Falls back to a plain dark panel
  // if the texture fails to load rather than showing a broken/blank plane.
  attachShirtPlane(torso, shirtImageUrl);

  const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const head = addEdges(new THREE.Mesh(headGeo, skinTone)).mesh;
  head.position.set(0, 1.66, 0);
  figure.add(head);

  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8);
  const neck = addEdges(new THREE.Mesh(neckGeo, skinTone)).mesh;
  neck.position.set(0, 1.47, 0);
  figure.add(neck);

  const hips = new THREE.Group();
  hips.position.set(0, 0.72, 0);
  figure.add(hips);

  const shoulderY = 1.32;
  const armSpan = 0.4;
  const leftArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, -armSpan, skinTone);
  const rightArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, armSpan, skinTone);
  figure.add(leftArm.upperGroup, rightArm.upperGroup);

  const legSpan = 0.16;
  const leftLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, -legSpan, clothing);
  const rightLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, legSpan, clothing);
  hips.add(leftLeg.upperGroup, rightLeg.upperGroup);

  return {
    group: figure, torso, head, leftArm, rightArm, leftLeg, rightLeg, hips,
    isStylized: true,
  };
}

// Builds one building box with a canvas-drawn facade texture (muted realistic
// color + window grid) plus small emissive amber "window" sprites that stay
// invisible by day and glow warm at night.
const FACADE_PALETTES = [
  { base: "#a99483", window: "#7a6a5c", tint: 0xd8c9b8 }, // warm sandstone
  { base: "#8d95a1", window: "#666e78", tint: 0xc3cad4 }, // cool grigio
  { base: "#7d8b93", window: "#57646c", tint: 0xaeb8c2 }, // glass-blue tint
  { base: "#9c8f7a", window: "#6f6353", tint: 0xd2c4ab }, // warm gray
];

function createBuilding(w, h, d, paletteIndex) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const palette = FACADE_PALETTES[paletteIndex % FACADE_PALETTES.length];

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.window;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.85, metalness: 0.08 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, h / 2, 0);

  // Sparse emissive warm-amber window dots on the two street-facing sides only.
  const windowGroup = new THREE.Group();
  const windowGeo = new THREE.PlaneGeometry(w * 0.06, h * 0.03);
  const litFraction = 0.4;
  const maxDots = 26;
  let dotsPlaced = 0;
  for (const cell of windowCells) {
    if (dotsPlaced >= maxDots) break;
    if (Math.random() > litFraction) continue;
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0 });
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

  return { mesh, facadeMaterial: mat, windowDots: windowGroup.children, edgeTintColor: palette.tint };
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
  // Portrait phones get a pulled-back, wider-angle framing: the desktop pose
  // crops the street canyon to a sliver on a tall narrow viewport.
  const BASE_CAM_POS = isSmallScreen
    ? new THREE.Vector3(0, 3.0, 12.5)
    : new THREE.Vector3(0, 2.6, 8.2);
  const BASE_CAM_TARGET = isSmallScreen
    ? new THREE.Vector3(0, 1.4, -1.5)
    : new THREE.Vector3(0, 1.1, 0);
  // Scroll-pulled-back pose — camera rises and retreats as the visitor scrolls past the hero.
  const SCROLL_CAM_POS = isSmallScreen
    ? new THREE.Vector3(0, 7, 19)
    : new THREE.Vector3(0, 6.5, 16);
  const SCROLL_CAM_TARGET = new THREE.Vector3(0, 2, 0);
  // Slow cinematic drift added on top of the base pose.
  const DRIFT_AMPLITUDE_X = 0.6;
  const DRIFT_AMPLITUDE_Y = 0.18;
  const DRIFT_SPEED = 0.06;

  const camera = new THREE.PerspectiveCamera(isSmallScreen ? 55 : 45, width / height, 0.1, 100);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_CAM_TARGET);

  // Capped at 2x — plenty of geometry here already; rendering at full retina
  // resolution beyond 2x was a needless GPU cost with no visible gain.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cursor = "default";
  mount.appendChild(renderer.domElement);

  // ---- Lighting ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  // "sun" doubles as the moonlight source at night — same directional light,
  // its color/intensity/position are re-driven every frame by the time-of-day.
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.28);
  fill.position.set(-5, 3, -4);
  scene.add(fill);
  const hemi = new THREE.HemisphereLight(0x8fc6f0, 0x8f887e, 0.4);
  scene.add(hemi);

  // ---- Sky backdrop — a plane whose color is driven by real local time ----
  const bgGeo = new THREE.PlaneGeometry(120, 60);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x8fc6f0, depthWrite: false, fog: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 10, -26);
  scene.add(bgMesh);

  // ---- Stars: small white points that fade in at night only ----
  const STAR_COUNT = isSmallScreen ? 160 : 320;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = (Math.random() - 0.5) * 70;
    const y = 2.5 + Math.random() * 8; // keep inside the visible sky band
    const z = -24 - Math.random() * 10;
    starPositions.set([x, y, z], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- Sun disc with soft glow halo ----
  const sunGeo = new THREE.CircleGeometry(1.7, 40);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  const sunHaloGeo = new THREE.CircleGeometry(3.8, 40);
  const sunHaloMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
  sunHalo.position.z = -0.05;
  sunDisc.add(sunHalo);
  scene.add(sunDisc);

  // ---- Moon disc with cool glow halo ----
  const moonGeo = new THREE.CircleGeometry(1.35, 40);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf3f6ff, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const moonDisc = new THREE.Mesh(moonGeo, moonMat);
  const moonHaloGeo = new THREE.CircleGeometry(3.0, 40);
  const moonHaloMat = new THREE.MeshBasicMaterial({ color: 0xaebeff, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
  const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
  moonHalo.position.z = -0.05;
  moonDisc.add(moonHalo);
  scene.add(moonDisc);

  // ---- Street / ground plane ----
  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Street strip down the middle with faint crosswalk hints — subtle, not cartoonish.
  const streetGeo = new THREE.PlaneGeometry(6, 40);
  const streetMat = new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.95 });
  const street = new THREE.Mesh(streetGeo, streetMat);
  street.rotation.x = -Math.PI / 2;
  street.position.y = 0.002;
  scene.add(street);

  const crosswalkGroup = new THREE.Group();
  const crosswalkStripeGeo = new THREE.PlaneGeometry(0.5, 4.2);
  const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.55 });
  for (let i = -2; i <= 2; i++) {
    const stripe = new THREE.Mesh(crosswalkStripeGeo, crosswalkMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 0.7, 0.003, -3);
    crosswalkGroup.add(stripe);
  }
  scene.add(crosswalkGroup);

  // Faint sidewalk-seam grid lines on top of the ground.
  const gridHelper = new THREE.GridHelper(40, 20, 0xbdb6a8, 0xcfc9bd);
  gridHelper.position.y = 0.001;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.4;
  scene.add(gridHelper);

  // ---- Downtown skyline flanking the street, both sides ----
  const buildingRowZ = [-7, -11];
  const buildingEdgeMaterials = [];
  const buildingFacadeMaterials = [];
  const allWindowDots = [];
  let paletteCounter = 0;
  [-1, 1].forEach((side) => {
    buildingRowZ.forEach((z, i) => {
      for (let j = 0; j < BUILDINGS_PER_ROW; j++) {
        const w = 2.2 + Math.random() * 1.6;
        const h = 3 + Math.random() * (5 + i * 2.5);
        const d = 2.2 + Math.random() * 1.6;
        const building = createBuilding(w, h, d, paletteCounter++);
        building.mesh.position.x = side * (5.5 + j * 3.2 + Math.random() * 0.4);
        building.mesh.position.z = z + (Math.random() - 0.5) * 1.2;
        scene.add(building.mesh);
        buildingFacadeMaterials.push(building.facadeMaterial);
        allWindowDots.push(...building.windowDots);

        // Subtle edge line per building for crisp definition against the sky.
        const edgeGeo = new THREE.EdgesGeometry(building.mesh.geometry);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.25 });
        const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        building.mesh.add(edgeLines);
        buildingEdgeMaterials.push(edgeMat);
      }
    });
  });

  // ---------------------------------------------------------------------
  // Human figures: try to load the real rigged Soldier.glb model; each clone
  // gets its own AnimationMixer playing "Walk" and a tee plane parented to a
  // spine bone. If the GLTFLoader fails for any reason, fall back to the
  // stylized procedural figure so the hero never shows a blank/broken scene.
  // ---------------------------------------------------------------------
  const npcs = [];
  const clock = new THREE.Clock();
  let usingGLTFHumans = false;
  window.__EV_DEBUG = {};

  // ---- Real human characters (Mixamo, provided by the founder) ----
  // Each rig uses the same Mixamo skeleton but with a numbered name prefix,
  // so any clip can drive any character after prefix remapping.
  // tee: where the product design gets composited into the shirt's texture
  // (pixel coords in 1024-texture space, found by UV grid probing).
  const PEOPLE = {
    remy: {
      url: "models/people/remy.glb",
      prefix: "mixamorig",
      shirtMesh: "Tops",
      tee: { x: 150, y: 310, w: 210, h: 300, rot: 0, whiten: true },
      height: 1.78,
    },
    woman: {
      url: "models/people/woman.glb",
      prefix: "mixamorig2",
      shirtMesh: "Ch22_Shirt",
      tee: { x: 285, y: 135, w: 180, h: 115, rot: Math.PI, whiten: false },
      height: 1.65,
    },
    dancer: {
      url: "models/people/dancer.glb",
      prefix: "mixamorig9",
      height: 1.75,
    },
  };
  const ANIM_URLS = {
    trip: "models/people/anim-tripping.glb",
    sing: "models/people/anim-singing.glb",
  };
  const ANIM_SOURCE_PREFIX = "mixamorig"; // donor clips use the base prefix

  // Remap a clip's tracks from one rig prefix to another, dropping tracks
  // whose target bone doesn't exist on the destination rig.
  function retargetClip(clip, fromPrefix, toPrefix, targetRoot) {
    const names = new Set();
    targetRoot.traverse((o) => names.add(o.name));
    const tracks = [];
    clip.tracks.forEach((tr) => {
      const dot = tr.name.lastIndexOf(".");
      const node = tr.name.slice(0, dot);
      const prop = tr.name.slice(dot);
      if (!node.startsWith(fromPrefix)) return;
      const newNode = toPrefix + node.slice(fromPrefix.length);
      if (!names.has(newNode)) return;
      const t2 = tr.clone();
      t2.name = newNode + prop;
      tracks.push(t2);
    });
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  // Pin the hips' X/Z to the first keyframe so clips play "in place" — path
  // code owns world movement; root motion in the clip would cause sliding.
  function stripRootMotion(clip) {
    clip.tracks.forEach((tr) => {
      if (!/\.position$/.test(tr.name) || !/hips/i.test(tr.name)) return;
      const v = tr.values;
      const x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    });
    return clip;
  }

  function findBoneByName(root, needle) {
    let found = null;
    root.traverse((obj) => {
      if (found) return;
      if (obj.isBone && obj.name.toLowerCase().includes(needle.toLowerCase())) found = obj;
    });
    return found;
  }

  // Composite a product tee design into a character's shirt texture.
  function makeTeeTexture(baseImage, teeImage, spec) {
    const size = (baseImage && baseImage.width) || 1024;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    if (spec.whiten) {
      // Turn the whole garment white so it matches the product tees.
      g.fillStyle = "#f2f1ee";
      g.fillRect(0, 0, size, size);
    } else if (baseImage) {
      g.drawImage(baseImage, 0, 0, size, size);
    }
    if (teeImage) {
      const k = size / 1024; // spec coords are in 1024-space
      const rw = spec.w * k, rh = spec.h * k;
      // Zoom into the print area of the product photo (the graphic sits in
      // the middle of the flat-lay shot) so the design reads clearly on the
      // chest instead of shrinking the whole tee photo into the rect.
      const sx = teeImage.width * 0.24, sy = teeImage.height * 0.2;
      const sw = teeImage.width * 0.52, sh = teeImage.height * 0.58;
      const s = Math.min(rw / sw, rh / sh);
      const dw = sw * s, dh = sh * s;
      g.save();
      g.translate((spec.x + spec.w / 2) * k, (spec.y + spec.h / 2) * k);
      if (spec.rot) g.rotate(spec.rot);
      g.drawImage(teeImage, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.flipY = false; // match glTF texture convention
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Ground + size a rig: measure toe and head-top bones in the loaded pose to
  // normalize height and plant feet at y=0. (Box3 on skinned meshes returns
  // bind-pose geometry bounds, so bones are the only reliable ruler.)
  function fitHuman(root, group, desiredHeight) {
    root.updateMatrixWorld(true);
    const toe = findBoneByName(root, "toebase") || findBoneByName(root, "foot");
    const headTop = findBoneByName(root, "headtop") || findBoneByName(root, "head");
    const toeY = toe ? toe.getWorldPosition(new THREE.Vector3()).y : 0;
    const headY = headTop ? headTop.getWorldPosition(new THREE.Vector3()).y : 1.7;
    const rigHeight = Math.max(0.01, headY - toeY);
    const s = desiredHeight / rigHeight;
    group.scale.setScalar(s);
    // Feet flat on pavement: toe bone sits ~2cm above the sole.
    root.position.y = -(toeY - 0.02 * rigHeight) ;
    return s;
  }

  const gltfLoader = new GLTFLoader();
  const imageLoader = new THREE.ImageLoader();
  function loadGLB(url) {
    return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
  }
  function loadImage(url) {
    return new Promise((resolve) => imageLoader.load(url, resolve, undefined, () => resolve(null)));
  }

  function buildHuman(spec, base, walkClip, teeImage, baseShirtImage) {
    const cloned = skeletonClone(base.scene);
    const group = new THREE.Group();
    group.add(cloned);
    fitHuman(cloned, group, spec.height);

    // Swap the shirt texture for one carrying the product design.
    if (spec.shirtMesh && spec.tee) {
      cloned.traverse((o) => {
        if (o.isMesh && o.name === spec.shirtMesh) {
          const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
          m.map = makeTeeTexture(baseShirtImage, teeImage, spec.tee);
          m.needsUpdate = true;
          o.material = m;
        }
      });
    }

    const mixer = new THREE.AnimationMixer(cloned);
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    if (walkAction) {
      walkAction.play();
      walkAction.time = Math.random() * (walkClip.duration || 1);
      mixer.update(0);
    }
    return { group, mixer, cloned, walkAction, isStylized: false };
  }

  function spawnNpcCommon(fig, index, opts) {
    const product = SHIRT_PRODUCTS[index % SHIRT_PRODUCTS.length];
    scene.add(fig.group);
    const npc = {
      ...fig,
      ...opts,
      productId: product.id,
      pathRadiusX: (isSmallScreen ? 0.9 : 1.6) + Math.random() * (isSmallScreen ? 1.0 : 1.8),
      pathRadiusZ: 1.0 + Math.random() * 1.2,
      pathSpeed: (0.1 + Math.random() * 0.12),
      pathPhase: Math.random() * Math.PI * 2,
      centerX: (index - (FIGURE_COUNT - 1) / 2) * (isSmallScreen ? 1.15 : 1.6) + (Math.random() - 0.5) * 0.6,
      centerZ: -1 + (Math.random() - 0.5) * 1.5,
      walkPhase: Math.random() * Math.PI * 2,
      scale: 1,
      paused: false,
      pauseUntil: 0,
      pausedAtPathT: 0,
      eventUntil: 0,
      eventCooldownUntil: 8 + Math.random() * 20,
    };
    npcs.push(npc);
    window.__EV_DEBUG.npcs = npcs;
    return npc;
  }

  function spawnStylizedFallbackCrowd() {
    npcs.length = 0;
    for (let i = 0; i < FIGURE_COUNT; i++) {
      const product = SHIRT_PRODUCTS[i % SHIRT_PRODUCTS.length];
      const fig = createStylizedFigure(product.image);
      fig.group.scale.setScalar(0.85 + Math.random() * 0.3);
      spawnNpcCommon(fig, i, { isStylized: true });
    }
  }

  // Occasional "street life" clips: a walker may briefly trip, or stop and
  // sing. One-shot, then back to walking. Chosen rarely so it stays charming.
  let eventClips = {}; // per-prefix retargeted { trip, sing }
  function maybeStartEvent(npc, t) {
    if (npc.static || npc.isStylized || !npc.walkAction) return;
    if (t < npc.eventCooldownUntil || npc.eventUntil > t) return;
    if (Math.random() > 0.003) return; // ~once per ~5.5min per figure at 60fps
    const lib = eventClips[npc.rigPrefix];
    if (!lib) return;
    const clip = Math.random() < 0.5 ? lib.trip : lib.sing;
    if (!clip) return;
    const action = npc.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    npc.walkAction.crossFadeTo(action, 0.25, false);
    action.play();
    npc.eventUntil = t + clip.duration - 0.25;
    npc.eventAction = action;
    npc.eventCooldownUntil = t + clip.duration + 30 + Math.random() * 60;
    // Freeze the walker's path while the event plays out.
    npc.paused = true;
    npc.pausedAtPathT = t * npc.pathSpeed + npc.pathPhase;
    npc.pauseUntil = npc.eventUntil;
  }
  function endEventIfDue(npc, t) {
    if (!npc.eventAction || t < npc.eventUntil) return;
    npc.walkAction.reset();
    npc.eventAction.crossFadeTo(npc.walkAction, 0.25, false);
    npc.walkAction.play();
    npc.eventAction = null;
  }

  Promise.all([
    loadGLB(PEOPLE.remy.url),
    loadGLB(PEOPLE.woman.url),
    loadGLB(PEOPLE.dancer.url),
    loadGLB(ANIM_URLS.trip).catch(() => null),
    loadGLB(ANIM_URLS.sing).catch(() => null),
    Promise.all(SHIRT_PRODUCTS.map((p) => loadImage(p.image))),
  ]).then(([remyG, womanG, dancerG, tripG, singG, teeImages]) => {
    usingGLTFHumans = true;

    const walkRemy = stripRootMotion(remyG.animations[0]);

    // Base shirt image for the woman (drawn under the design); Remy's shirt
    // is whitened so his base image is only used for canvas sizing.
    const getShirtImage = (gltf, meshName) => {
      let img = null;
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.name === meshName) {
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (m && m.map && m.map.image) img = m.map.image;
        }
      });
      return img;
    };
    const remyShirtImg = getShirtImage(remyG, PEOPLE.remy.shirtMesh);
    const womanShirtImg = getShirtImage(womanG, PEOPLE.woman.shirtMesh);

    // Event clip library, retargeted per rig prefix.
    const tripClip = tripG && stripRootMotion(tripG.animations[0]);
    const singClip = singG && stripRootMotion(singG.animations[0]);
    const buildLib = (root, prefix) => ({
      trip: tripClip && retargetClip(tripClip, ANIM_SOURCE_PREFIX, prefix, root),
      sing: singClip && retargetClip(singClip, ANIM_SOURCE_PREFIX, prefix, root),
    });

    // Walker mix: alternate Remy and the woman, each wearing a different tee.
    const walkerCount = Math.max(2, FIGURE_COUNT - 1);
    for (let i = 0; i < walkerCount; i++) {
      const useWoman = i % 3 === 2; // every third walker is the woman
      const spec = useWoman ? PEOPLE.woman : PEOPLE.remy;
      const src = useWoman ? womanG : remyG;
      const shirtImg = useWoman ? womanShirtImg : remyShirtImg;
      const walk = useWoman
        ? retargetClip(walkRemy, PEOPLE.remy.prefix, PEOPLE.woman.prefix, src.scene)
        : walkRemy;
      const fig = buildHuman(spec, src, walk, teeImages[i % teeImages.length], shirtImg);
      const npc = spawnNpcCommon(fig, i, { rigPrefix: spec.prefix });
      if (!eventClips[spec.prefix]) eventClips[spec.prefix] = buildLib(fig.cloned, spec.prefix);
      void npc;
    }

    // Street performer: loops the hip-hop clip at the street's edge.
    const danceClip = stripRootMotion(dancerG.animations[0]);
    const dancerFig = buildHuman(PEOPLE.dancer, dancerG, danceClip, null, null);
    const dNpc = spawnNpcCommon(dancerFig, walkerCount, {
      rigPrefix: PEOPLE.dancer.prefix,
      static: true,
      alwaysAnimate: true,
    });
    dNpc.group.position.set(isSmallScreen ? 1.7 : 2.6, 0, isSmallScreen ? 1.6 : 1.2);
    dNpc.group.rotation.y = Math.PI * 0.9; // face the camera, slightly angled
  }).catch((err) => {
    console.warn("EL VYNCE hero: human models failed to load, using stylized fallback:", err);
    spawnStylizedFallbackCrowd();
  });

  // ---- Cursor-driven camera parallax ----
  let pointerX = 0;
  let pointerY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  window.addEventListener("mousemove", (e) => {
    const rect = mount.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  });

  // ---- Scroll-linked camera pull-back ----
  let scrollProgress = 0;
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

  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.addEventListener("click", (e) => {
    const hit = npcUnderPointer(e.clientX, e.clientY);
    if (hit) window.location.href = `product-detail.html?id=${hit.productId}`;
  });
  let lastHoverCheck = 0;
  renderer.domElement.addEventListener("mousemove", (e) => {
    const now = performance.now();
    if (now - lastHoverCheck < 66) return;
    lastHoverCheck = now;
    const hit = npcUnderPointer(e.clientX, e.clientY);
    renderer.domElement.style.cursor = hit ? "pointer" : "default";
  });

  // Pause the render loop entirely once the hero scrolls out of view.
  let isVisible = true;
  if ("IntersectionObserver" in window && heroHeader) {
    new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(heroHeader);
  }

  // Also pause on background tabs.
  let tabHidden = document.hidden;
  document.addEventListener("visibilitychange", () => {
    tabHidden = document.hidden;
  });

  // ---- Day/night cycle state (real local clock driven) ----
  const skyColor = new THREE.Color();
  const groundColor = new THREE.Color();
  const lightColor = new THREE.Color();
  let isNightNow = false;

  function updateDayNightCycle() {
    const hour = getLocalDayFraction(); // 0..24, visitor's real local time
    const nightAmount = nightAmountFor(hour);
    const sunAlt = sunAltitude01(hour);
    const moonAlt = moonAltitude01(hour);

    skyColor.copy(sampleStops(SKY_STOPS, hour));
    bgMat.color.copy(skyColor);
    // Slight fog-like tint on hemisphere light ground color keeps buildings
    // grounded in the same palette as the sky at each hour.
    hemi.color.copy(skyColor);

    groundColor.copy(sampleStops(GROUND_STOPS, hour));
    groundMat.color.copy(groundColor);

    // Sun arcs from horizon (east, sunrise) up and over to horizon (west, sunset);
    // moon arcs oppositely through the night. Arc angle maps each body's altitude
    // window to a 0..PI sweep across the visible sky.
    const sunArc = THREE.MathUtils.clamp((hour - 6) / (18.5 - 6), 0, 1) * Math.PI;
    // Arc peak stays inside the camera frustum (45° FOV, slight downward tilt
    // → sky is only visible up to y≈9 at z=-22; higher and the sun vanishes).
    sunDisc.position.set(Math.cos(sunArc) * -CELESTIAL_X, 1.5 + Math.sin(sunArc) * 6.5, -22);
    sunDisc.visible = sunAlt > 0.001;
    sunDisc.material.opacity = Math.min(1, sunAlt * 2.2);
    sunHaloMat.opacity = 0.3 + sunAlt * 0.25;

    let moonHour = hour < 6 ? hour + 24 : hour;
    const moonArc = THREE.MathUtils.clamp((moonHour - 18.5) / (30 - 18.5), 0, 1) * Math.PI;
    moonDisc.position.set(Math.cos(moonArc) * -CELESTIAL_X, 1.5 + Math.sin(moonArc) * 6.5, -22);
    moonDisc.visible = moonAlt > 0.001;
    moonDisc.material.opacity = Math.min(1, moonAlt * 2.2);
    moonHaloMat.opacity = 0.22 + moonAlt * 0.2;

    // Stars fade in only once night is well underway (keeps a clean transition
    // through dusk before they appear).
    starMat.opacity = Math.max(0, (nightAmount - 0.55) / 0.45) * 0.85;

    // Directional "sun" light re-purposes as moonlight at night: warm color +
    // higher intensity by day, cool blue + dim by night, smooth blend between.
    lightColor.copy(sampleStops(SUN_LIGHT_COLOR_STOPS, hour));
    sun.color.copy(lightColor);
    sun.position.set(sunDisc.position.x * 0.3, Math.max(2, sunDisc.position.y * 0.6 + moonDisc.position.y * 0.4 * moonAlt), 6);
    sun.intensity = 0.35 + sunAlt * 0.85 + moonAlt * 0.25;
    fill.intensity = 0.18 + sunAlt * 0.14;
    ambient.intensity = 0.28 + sunAlt * 0.32 + moonAlt * 0.12;
    hemi.intensity = 0.25 + sunAlt * 0.25;

    // Window dots: invisible by day, glow warm amber once dusk sets in.
    const windowGlow = Math.max(0, (nightAmount - 0.45) / 0.55);
    allWindowDots.forEach((dot) => {
      dot.material.opacity = windowGlow * 0.95;
    });

    // Building edge lines darken/lighten subtly with time of day for definition
    // against both bright sky and deep night.
    const edgeOpacity = 0.2 + nightAmount * 0.25;
    buildingEdgeMaterials.forEach((m) => { m.opacity = edgeOpacity; });

    // Toggle the header's is-night class only on real state changes, driving
    // CSS transitions in style.css for wordmark/paragraph/CTA legibility.
    const shouldBeNight = nightAmount > 0.55;
    if (shouldBeNight !== isNightNow) {
      isNightNow = shouldBeNight;
      if (heroHeader) heroHeader.classList.toggle("is-night", isNightNow);
    }
  }

  // ---- Walk cycle constants (stylized fallback only — GLTF humans use their
  // own baked "Walk" animation clip via AnimationMixer) ----
  const WALK_SPEED = 3.2;
  const SWING_HIP = 0.55;
  const SWING_KNEE = 0.7;
  const SWING_SHOULDER = 0.35;
  const SWING_ELBOW = 0.4;
  const PAUSE_CHANCE_PER_SEC = 0.04;
  const PAUSE_DURATION = [1.2, 2.8];

  function stepNpcMovement(npc, t, dt) {
    if (npc.static) return 1; // the dancer holds their spot

    if (npc.paused) {
      if (t > npc.pauseUntil && !npc.eventAction) npc.paused = false;
    } else if (npc.isStylized && Math.random() < PAUSE_CHANCE_PER_SEC * dt) {
      // Random window-shopping pauses suit the stylized fallback; real humans
      // pause only for street-life events (handled in maybeStartEvent) so the
      // baked walk clip never freezes mid-stride.
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
    // Soldier.glb is authored facing -Z, so flip the heading by PI to make the
    // body face the direction of travel (otherwise the crowd moonwalks).
    const heading = Math.atan2(nx - x, nz - z) + (npc.isStylized ? 0 : Math.PI);

    npc.group.position.set(x, 0, z);
    if (!npc.paused) npc.group.rotation.y = heading;

    return npc.paused ? 0 : 1;
  }

  // ---- Reduced motion: render a single static frame at the visitor's actual
  // current time of day, no animation loop ----
  if (prefersReducedMotion) {
    updateDayNightCycle();
    renderer.render(scene, camera);
  } else {
    function animate() {
      requestAnimationFrame(animate);
      if (!isVisible || tabHidden) return;
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();

      npcs.forEach((npc) => {
        maybeStartEvent(npc, t);
        endEventIfDue(npc, t);
        const walkActive = stepNpcMovement(npc, t, dt);

        if (npc.isStylized) {
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
        } else if (npc.mixer) {
          // Events and the dancer always animate; plain walkers freeze the
          // clip only while path movement is held.
          const rate = npc.eventAction || npc.alwaysAnimate ? 1 : walkActive;
          npc.mixer.update(dt * rate);
        }
      });

      updateDayNightCycle();

      // Cursor parallax: ease toward the target offset rather than snapping.
      parallaxX += (pointerX - parallaxX) * 0.04;
      parallaxY += (pointerY - parallaxY) * 0.04;

      // Slow cinematic drift.
      const driftX = Math.sin(t * DRIFT_SPEED) * DRIFT_AMPLITUDE_X;
      const driftY = Math.sin(t * DRIFT_SPEED * 0.7) * DRIFT_AMPLITUDE_Y;

      const camPos = BASE_CAM_POS.clone().lerp(SCROLL_CAM_POS, scrollProgress);
      const camTarget = BASE_CAM_TARGET.clone().lerp(SCROLL_CAM_TARGET, scrollProgress);

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
    if (prefersReducedMotion) {
      updateDayNightCycle();
      renderer.render(scene, camera);
    }
  }
  window.addEventListener("resize", onResize);
}

document.addEventListener("DOMContentLoaded", initHeroSilhouette);
