/* EL VYNCE — cinematic full-color city hero, real-time day/night cycle.
   A downtown street scene (colored sky, glowing sun/moon, muted-color buildings,
   warm/cool directional light) populated by real rigged human figures (three.js
   Soldier.glb, walking on the built-in "Walk" clip) each wearing a real product
   tee texture-mapped onto a plane parented to the chest bone. Falls back to
   stylized procedural humans if the GLB fails to load, so the hero never breaks.
   Time of day is driven by the visitor's actual local clock, not a fake loop.
   Interactive: click a figure to jump to its product, cursor parallax,
   scroll-linked camera pull-back. ES module (three.js r0.160). No build step. */

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

const SOLDIER_GLB_URL = "models/Soldier.glb";

const SMALL_SCREEN_WIDTH = 768; // below this, trim figure/building counts for perf.
const isSmallScreen = window.innerWidth < SMALL_SCREEN_WIDTH;
const FIGURE_COUNT = isSmallScreen ? 5 : 8;
const BUILDINGS_PER_ROW = isSmallScreen ? 1 : 2;

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const textureLoader = new THREE.TextureLoader();

// ---------------------------------------------------------------------------
// Real-time day/night math
// ---------------------------------------------------------------------------
// dayFraction: a continuous 0..24 value built from the visitor's actual local
// hours + minutes (+ seconds, for smooth sub-minute motion) — NOT a fake sped
// up loop. Someone loading the hero at 17:55 sees the sun already low and the
// sky already warming toward sunset, and it keeps drifting in real time.
function getLocalDayFraction() {
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
  const BASE_CAM_POS = new THREE.Vector3(0, 2.6, 8.2);
  const BASE_CAM_TARGET = new THREE.Vector3(0, 1.1, 0);
  // Scroll-pulled-back pose — camera rises and retreats as the visitor scrolls past the hero.
  const SCROLL_CAM_POS = new THREE.Vector3(0, 6.5, 16);
  const SCROLL_CAM_TARGET = new THREE.Vector3(0, 2, 0);
  // Slow cinematic drift added on top of the base pose.
  const DRIFT_AMPLITUDE_X = 0.6;
  const DRIFT_AMPLITUDE_Y = 0.18;
  const DRIFT_SPEED = 0.06;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
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
    const x = (Math.random() - 0.5) * 100;
    const y = 6 + Math.random() * 30;
    const z = -25 - Math.random() * 15;
    starPositions.set([x, y, z], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- Sun disc with soft glow halo ----
  const sunGeo = new THREE.CircleGeometry(1.3, 40);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  const sunHaloGeo = new THREE.CircleGeometry(3.2, 40);
  const sunHaloMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
  sunHalo.position.z = -0.05;
  sunDisc.add(sunHalo);
  scene.add(sunDisc);

  // ---- Moon disc with cool glow halo ----
  const moonGeo = new THREE.CircleGeometry(1.0, 40);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf3f6ff, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const moonDisc = new THREE.Mesh(moonGeo, moonMat);
  const moonHaloGeo = new THREE.CircleGeometry(2.4, 40);
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
  let baseSoldierGLTF = null;

  // Neutral/darkened uniform materials so the tee plane on the chest stays the
  // visual focal point rather than competing with the model's own camo/gear.
  const NEUTRAL_UNIFORM_COLOR = new THREE.Color(0x232323);

  function neutralizeSoldierMaterials(root) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        // Keep the map (fabric texture detail) but recolor toward neutral
        // charcoal and flatten shininess so it doesn't read as camo/military.
        if ("color" in m) m.color.copy(NEUTRAL_UNIFORM_COLOR);
        if ("roughness" in m) m.roughness = 0.9;
        if ("metalness" in m) m.metalness = 0.0;
        m.needsUpdate = true;
      });
      obj.castShadow = false;
      obj.receiveShadow = false;
    });
  }

  // Find a bone by fuzzy name match (case-insensitive substring) — used to
  // locate a chest/spine bone to parent the tee plane to. Soldier.glb's rig
  // uses "mixamorig:SpineN" naming (colon-delimited, not "mixamorigSpineN").
  function findBoneByName(root, needle) {
    let found = null;
    root.traverse((obj) => {
      if (found) return;
      if (obj.isBone && obj.name.toLowerCase().includes(needle.toLowerCase())) {
        found = obj;
      }
    });
    return found;
  }

  function buildGLTFHuman(shirtImageUrl) {
    const cloned = skeletonClone(baseSoldierGLTF.scene);
    neutralizeSoldierMaterials(cloned);

    const mixer = new THREE.AnimationMixer(cloned);
    const walkClip = THREE.AnimationClip.findByName(baseSoldierGLTF.animations, "Walk")
      || baseSoldierGLTF.animations[0];
    const action = walkClip ? mixer.clipAction(walkClip) : null;
    if (action) {
      action.play();
      // Randomize phase/speed slightly per figure so a crowd of clones doesn't
      // move in obvious lockstep.
      action.time = Math.random() * (walkClip.duration || 1);
      mixer.update(0);
    }

    // Chest bone: prefer Spine2 (upper chest), fall back to Spine1, then Spine.
    const chestBone =
      findBoneByName(cloned, "spine2") ||
      findBoneByName(cloned, "spine1") ||
      findBoneByName(cloned, "spine");

    const group = new THREE.Group();
    group.add(cloned);

    if (chestBone) {
      // A slightly curved plane (subtle bend) so the tee reads naturally
      // against the torso rather than as a flat sticker.
      const shirtGeo = new THREE.PlaneGeometry(38, 46, 6, 6);
      const posAttr = shirtGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        posAttr.setZ(i, Math.cos((x / 38) * Math.PI * 0.5) * 3.2 - 3.2);
      }
      shirtGeo.computeVertexNormals();
      const shirtMat = new THREE.MeshBasicMaterial({
        color: 0x555555, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
      // Soldier.glb is authored in centimeters-ish scale (the whole scene is
      // scaled down elsewhere); position empirically sits the plane on the
      // chest facing forward (+Z in bone-local space for this rig).
      shirtMesh.position.set(0, 14, 6);
      shirtMesh.rotation.y = Math.PI;
      chestBone.add(shirtMesh);

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
          console.warn("EL VYNCE hero: tee texture failed to load (GLTF human), using gray fallback:", shirtImageUrl);
        }
      );
    }

    return { group, mixer, isStylized: false };
  }

  function spawnNpcCommon(fig, index) {
    const product = SHIRT_PRODUCTS[index % SHIRT_PRODUCTS.length];
    scene.add(fig.group);
    const npc = {
      ...fig,
      productId: product.id,
      pathRadiusX: 1.6 + Math.random() * 1.8,
      pathRadiusZ: 1.0 + Math.random() * 1.2,
      pathSpeed: (0.1 + Math.random() * 0.12),
      pathPhase: Math.random() * Math.PI * 2,
      centerX: (index - (FIGURE_COUNT - 1) / 2) * 1.6 + (Math.random() - 0.5) * 0.6,
      centerZ: -1 + (Math.random() - 0.5) * 1.5,
      walkPhase: Math.random() * Math.PI * 2,
      scale: 0.85 + Math.random() * 0.3,
      paused: false,
      pauseUntil: 0,
      pausedAtPathT: 0,
    };
    fig.group.scale.setScalar(npc.scale * (fig.isStylized ? 1 : 0.011));
    npcs.push(npc);
    return npc;
  }

  function spawnStylizedFallbackCrowd() {
    npcs.length = 0;
    for (let i = 0; i < FIGURE_COUNT; i++) {
      const product = SHIRT_PRODUCTS[i % SHIRT_PRODUCTS.length];
      const fig = createStylizedFigure(product.image);
      spawnNpcCommon(fig, i);
    }
  }

  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    SOLDIER_GLB_URL,
    (gltf) => {
      baseSoldierGLTF = gltf;
      usingGLTFHumans = true;
      for (let i = 0; i < FIGURE_COUNT; i++) {
        const product = SHIRT_PRODUCTS[i % SHIRT_PRODUCTS.length];
        const fig = buildGLTFHuman(product.image);
        spawnNpcCommon(fig, i);
      }
    },
    undefined,
    (err) => {
      console.warn("EL VYNCE hero: Soldier.glb failed to load, using stylized fallback figures:", err);
      spawnStylizedFallbackCrowd();
    }
  );

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
    sunDisc.position.set(Math.cos(sunArc) * -18, 2 + Math.sin(sunArc) * 15, -22);
    sunDisc.visible = sunAlt > 0.001;
    sunDisc.material.opacity = Math.min(1, sunAlt * 2.2);
    sunHaloMat.opacity = 0.3 + sunAlt * 0.25;

    let moonHour = hour < 6 ? hour + 24 : hour;
    const moonArc = THREE.MathUtils.clamp((moonHour - 18.5) / (30 - 18.5), 0, 1) * Math.PI;
    moonDisc.position.set(Math.cos(moonArc) * -16, 2 + Math.sin(moonArc) * 14, -22);
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
          // Slow down/stop the baked walk clip while paused so a "window
          // shopping" beat doesn't look like moonwalking in place.
          npc.mixer.update(dt * walkActive);
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
