/* EL VYNCE — "Late-Night Café" cinematic hero.
   Dark interior: two patrons working late (one with a laptop, one with coffee)
   and a barista behind the counter. Rain streaks the window glass on the left;
   KOPI/24H/CHAI neon signs glow in the wet street outside. Three Edison pendant
   lights cast warm amber pools. Every figure wears an actual EL VYNCE product tee
   — click any NPC to open that product. Poster fallback if WebGL unavailable.
   ES module (three.js r0.160). No build step. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Real product photography — front print of each tee. Cycled across every figure
// so the full catalogue is represented. femaleOnly = crop-top designs never
// composited onto a male rig.
const SHIRT_PRODUCTS = [
  { image: "images/products/built-different-front.jpg",         id: "ev-006b" },
  { image: "images/products/dare-to-be-different-front.jpg",    id: "ev-006"  },
  { image: "images/products/frequency-front.jpg",               id: "ev-003"  },
  { image: "images/products/im-just-a-girl-front.jpg",          id: "ev-006c", femaleOnly: true },
  { image: "images/products/inner-noise-front.jpg",             id: "ev-003b" },
  { image: "images/products/just-be-resilient-front.jpg",       id: "ev-005"  },
  { image: "images/products/rebel-soul-front.jpg",              id: "ev-002"  },
  { image: "images/products/style-pays-off-front.jpg",          id: "ev-004"  },
];

const SMALL_SCREEN_WIDTH = 768;
const isSmallScreen = window.innerWidth < SMALL_SCREEN_WIDTH;
const prefersReducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const textureLoader = new THREE.TextureLoader();

// ---- Shared utility helpers ----

function addEdges(mesh, color = 0x000000, opacity = 0.35) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const mat   = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  mesh.add(new THREE.LineSegments(edges, mat));
  return { mesh, edgeMaterial: mat };
}

function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, material) {
  const upperGroup = new THREE.Group();
  upperGroup.position.set(sideOffset, originY, 0);
  const upperMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(upperRadius, upperLen - upperRadius * 1.4, 4, 8), material
  );
  upperMesh.position.set(0, -upperLen / 2, 0);
  upperGroup.add(upperMesh);
  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(0, -upperLen, 0);
  const lowerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(lowerRadius, lowerLen - lowerRadius * 1.4, 4, 8), material
  );
  lowerMesh.position.set(0, -lowerLen / 2, 0);
  lowerGroup.add(lowerMesh);
  upperGroup.add(lowerGroup);
  return { upperGroup, lowerGroup };
}

function attachShirtPlane(parent, shirtImageUrl, yOffset = 0.05, z = 0.40) {
  const geo  = new THREE.PlaneGeometry(0.60, 0.65);
  const mat  = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, yOffset, z);
  parent.add(mesh);
  textureLoader.load(shirtImageUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  });
  return mesh;
}

// Stylized procedural fallback — used if GLBs fail so the hero never shows empty.
function createStylizedFigure(shirtImageUrl) {
  const clothing = new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.85 });
  const skin     = new THREE.MeshStandardMaterial({ color: 0xc79a75, roughness: 0.70 });
  const figure   = new THREE.Group();
  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.5, 4, 8), clothing);
  const torso = addEdges(torsoMesh).mesh;
  torso.position.set(0, 1.05, 0);
  figure.add(torso);
  attachShirtPlane(torso, shirtImageUrl);
  const head = addEdges(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), skin)).mesh;
  head.position.set(0, 1.66, 0);
  figure.add(head);
  const neck = addEdges(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8), skin)).mesh;
  neck.position.set(0, 1.47, 0);
  figure.add(neck);
  const hips = new THREE.Group();
  hips.position.set(0, 0.72, 0);
  figure.add(hips);
  const lA = makeLimbPair(0.34, 0.06, 0.32, 0.05, 1.32, -0.4, skin);
  const rA = makeLimbPair(0.34, 0.06, 0.32, 0.05, 1.32,  0.4, skin);
  figure.add(lA.upperGroup, rA.upperGroup);
  const lL = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, -0.16, clothing);
  const rL = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0,  0.16, clothing);
  hips.add(lL.upperGroup, rL.upperGroup);
  return { group: figure, torso, head, lA, rA, lL, rL, hips, isStylized: true };
}

// Geometry seated patron — laptop / coffee / idle role.
// Returns { group, animatables:[{update(t)}], headGrp }.
function createSeatedFigure({ role = 'idle', shirtImageUrl } = {}) {
  const clothing = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 0.86 });
  const skin     = new THREE.MeshStandardMaterial({ color: 0xc79a75, roughness: 0.70 });
  const pants    = new THREE.MeshStandardMaterial({ color: 0x1e2030, roughness: 0.88 });
  const hairMat  = new THREE.MeshStandardMaterial({ color: 0x150c06, roughness: 1.0 });
  const root = new THREE.Group();
  const animatables = [];

  // Torso
  const torsoGrp = new THREE.Group();
  torsoGrp.position.set(0, 0.79, 0);
  torsoGrp.rotation.x = 0.12;
  torsoGrp.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 8), clothing));
  root.add(torsoGrp);
  if (shirtImageUrl) attachShirtPlane(torsoGrp, shirtImageUrl, 0.03, 0.21);

  // Head + hair
  const headGrp = new THREE.Group();
  headGrp.position.set(0, 1.16, 0.02);
  headGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.152, 12, 10), skin));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.160, 10, 8), hairMat);
  hair.scale.y = 0.74; hair.position.y = 0.055;
  headGrp.add(hair);
  root.add(headGrp);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.110, 8), skin);
  neck.position.set(0, 1.035, 0.015);
  root.add(neck);

  // Thighs (horizontal → +Z)
  [-0.115, 0.115].forEach(sx => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.058, 0.37, 8), pants);
    t.rotation.x = Math.PI / 2;
    t.position.set(sx, 0.545, 0.185);
    root.add(t);
  });
  // Shins
  [-0.115, 0.115].forEach(sx => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.040, 0.44, 8), pants);
    s.position.set(sx, 0.30, 0.37);
    root.add(s);
  });
  // Feet
  [-0.115, 0.115].forEach(sx => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.046, 0.16), pants);
    f.position.set(sx, 0.07, 0.43);
    root.add(f);
  });

  // Arms — pivot at shoulder
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.215, 1.005, 0.02);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.040, 0.25, 8), skin);
    upper.position.y = -0.125;
    pivot.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.25;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.030, 0.23, 8), skin);
    fore.position.y = -0.115;
    elbow.add(fore);
    pivot.add(elbow);
    root.add(pivot);
    return { pivot, elbow, fore };
  };
  const lArm = makeArm(-1);
  const rArm = makeArm( 1);

  if (role === 'laptop') {
    lArm.pivot.rotation.set(1.08, 0, 0.12);  lArm.elbow.rotation.x = -0.40;
    rArm.pivot.rotation.set(1.08, 0,-0.12);  rArm.elbow.rotation.x = -0.40;
    headGrp.rotation.x = 0.24;
    animatables.push({ update(t) {
      lArm.fore.position.y = -0.115 + Math.sin(t * 4.4)       * 0.007;
      rArm.fore.position.y = -0.115 + Math.sin(t * 4.4 + 1.9) * 0.007;
      headGrp.rotation.x = 0.24 + Math.sin(t * 0.31) * 0.07;
      headGrp.rotation.y = Math.sin(t * 0.20) * 0.10;
    }});
  } else if (role === 'coffee') {
    lArm.pivot.rotation.set(1.05, 0, 0.10);  lArm.elbow.rotation.x = -0.38;
    rArm.pivot.rotation.set(0.45, 0, 0);      rArm.elbow.rotation.x = -0.25;
    animatables.push({ update(t) {
      const cy = (t % 9.0) / 9.0;
      let px = 0.45, ex = -0.25;
      if      (cy < 0.22) { const p = cy / 0.22;         px = 0.45 + p*0.85; ex = -0.25 - p*0.60; }
      else if (cy < 0.40) {                               px = 1.30;          ex = -0.85; }
      else if (cy < 0.58) { const p = (cy-0.40)/0.18;   px = 1.30 - p*0.85; ex = -0.85 + p*0.60; }
      rArm.pivot.rotation.x = px;
      rArm.elbow.rotation.x = ex;
      headGrp.rotation.y = Math.sin(t * 0.24) * 0.20;
      headGrp.rotation.x = 0.05 + Math.sin(t * 0.18) * 0.06;
    }});
  } else {
    lArm.pivot.rotation.x = 0.30;
    rArm.pivot.rotation.x = 0.30;
    animatables.push({ update(t) {
      headGrp.rotation.y = Math.sin(t * 0.19) * 0.22;
      headGrp.rotation.x = Math.sin(t * 0.13) * 0.06;
    }});
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = !isSmallScreen; o.receiveShadow = !isSmallScreen; } });
  return { group: root, animatables, headGrp };
}

function makeRadialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Warm honey-wood floor — light planks with subtle grain.
function makeWoodTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#b07840";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(0, i * 17, 256, 2);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,200,100,0.06)" : "rgba(0,0,0,0.04)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 20, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Warm cream plaster wall.
function makeWallTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#d4b882";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Chalkboard canvas texture with "COFFEE" menu.
function makeChalkboardTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#1c2a1c";
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = "#e8eed8";
  g.font = "bold 52px serif";
  g.textAlign = "center";
  g.fillText("COFFEE", 256, 68);
  g.strokeStyle = "#c0c8a8";
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(40, 82); g.lineTo(472, 82); g.stroke();
  g.font = "28px serif";
  const items = ["Espresso   ₹120", "Latte      ₹150", "Cold Brew  ₹160", "Chai       ₹80"];
  items.forEach((txt, i) => g.fillText(txt, 256, 128 + i * 48));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- GLB / animation helpers (unchanged from street scene) ----

function retargetClip(clip, fromPrefix, toPrefix, targetRoot) {
  const names = new Set();
  targetRoot.traverse((o) => names.add(o.name));
  const tracks = [];
  clip.tracks.forEach((tr) => {
    const dot  = tr.name.lastIndexOf(".");
    const node = tr.name.slice(0, dot);
    const prop = tr.name.slice(dot);
    if (!node.startsWith(fromPrefix)) return;
    const newNode = toPrefix + node.slice(fromPrefix.length);
    if (!names.has(newNode)) return;
    const t2   = tr.clone();
    t2.name    = newNode + prop;
    tracks.push(t2);
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function stripRootMotion(clip, yRange) {
  const [lo, hi] = yRange || [-0.5, 0.5];
  clip.tracks.forEach((tr) => {
    if (!/\.position$/.test(tr.name) || !/hips/i.test(tr.name)) return;
    const v = tr.values;
    const x0 = v[0], y0 = v[1], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i]     = x0;
      v[i + 2] = z0;
      v[i + 1] = y0 + THREE.MathUtils.clamp(v[i + 1] - y0, lo, hi);
    }
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

function sampleFabricColor(teeImage) {
  const s = document.createElement("canvas");
  s.width = 3; s.height = 1;
  const sg = s.getContext("2d");
  [[0.25, 0.7], [0.75, 0.7], [0.5, 0.85]].forEach(([fx, fy], i) => {
    sg.drawImage(teeImage, teeImage.width * fx - 4, teeImage.height * fy - 4, 8, 8, i, 0, 1, 1);
  });
  const d  = sg.getImageData(0, 0, 3, 1).data;
  const r  = Math.round((d[0] + d[4] + d[8])  / 3);
  const gc = Math.round((d[1] + d[5] + d[9])  / 3);
  const b  = Math.round((d[2] + d[6] + d[10]) / 3);
  return "rgb(" + r + "," + gc + "," + b + ")";
}

function makeTeeTexture(baseImage, teeImage, spec) {
  const size = (baseImage && baseImage.width) || 1024;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = teeImage ? sampleFabricColor(teeImage) : "#f2f1ee";
  g.fillRect(0, 0, size, size);
  if (teeImage) {
    const sx = Math.round(teeImage.width  * 0.25);
    const sy = Math.round(teeImage.height * 0.3);
    const sw = Math.round(teeImage.width  * 0.5);
    const sh = Math.round(teeImage.height * 0.34);
    const patch = document.createElement("canvas");
    patch.width = sw; patch.height = sh;
    const pg = patch.getContext("2d");
    pg.drawImage(teeImage, sx, sy, sw, sh, 0, 0, sw, sh);
    pg.globalCompositeOperation = "destination-in";
    const gr = pg.createRadialGradient(
      sw / 2, sh / 2, Math.min(sw, sh) * 0.3,
      sw / 2, sh / 2, Math.max(sw, sh) * 0.6
    );
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    pg.fillStyle = gr;
    pg.fillRect(0, 0, sw, sh);
    const k  = size / 1024;
    const rw = spec.w * k, rh = spec.h * k;
    const s  = Math.min(rw / sw, rh / sh) * 1.15;
    const dw = sw * s, dh = sh * s;
    g.save();
    g.translate((spec.x + spec.w / 2) * k, (spec.y + spec.h / 2) * k);
    if (spec.rot) g.rotate(spec.rot);
    g.drawImage(patch, -dw / 2, -dh / 2, dw, dh);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fitHuman(root, group, desiredHeight) {
  root.updateMatrixWorld(true);
  const toe     = findBoneByName(root, "toebase") || findBoneByName(root, "foot");
  const headTop = findBoneByName(root, "headtop")  || findBoneByName(root, "head");
  const toeY    = toe     ? toe.getWorldPosition(new THREE.Vector3()).y     : 0;
  const headY   = headTop ? headTop.getWorldPosition(new THREE.Vector3()).y : 1.7;
  const rigH    = Math.max(0.01, headY - toeY);
  let s = desiredHeight / rigH;
  if (s < 0.05 || s > 3.0) s = THREE.MathUtils.clamp(s, 0.05, 3.0);
  group.scale.setScalar(s);
  root.position.y = -(toeY - 0.02 * rigH);
  return s;
}

// ============================================================
// initHeroSilhouette — builds and runs the café scene
// ============================================================

function initHeroSilhouette() {
  const mount      = document.getElementById("hero-silhouette");
  const heroHeader = mount ? mount.closest("header") : null;
  if (!mount) return;
  document.body.classList.add("ev-has-hero");

  // ---- Poster fallback -----------------------------------------------
  let posterActive = false;
  const POSTER_KEY = "ev-hero-poster-v4";
  function activatePosterFallback(reason, persist) {
    if (posterActive) return;
    posterActive = true;
    if (persist) { try { sessionStorage.setItem(POSTER_KEY, "1"); } catch (_) {} }
    console.warn("EL VYNCE hero: poster fallback —", reason);
    mount.innerHTML = "";
    mount.style.cssText =
      "background:#0c0804 url('images/hero-real-3.jpg') center 30%/cover no-repeat;" +
      "filter:grayscale(1) contrast(1.04);";
    if (heroHeader) heroHeader.classList.remove("is-night");
  }
  const bootPoster = (() => {
    try { return sessionStorage.getItem(POSTER_KEY) === "1"; } catch (_) { return false; }
  })();
  if (new URLSearchParams(window.location.search).get("evposter") === "1" || bootPoster) {
    activatePosterFallback(bootPoster ? "hard failure earlier this session" : "forced via ?evposter=1", true);
    return;
  }
  const probe = document.createElement("canvas");
  if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
    activatePosterFallback("WebGL not available", true);
    return;
  }
  // --------------------------------------------------------------------

  const W = mount.clientWidth  || window.innerWidth;
  const H = mount.clientHeight || window.innerHeight;

  // ---- Scene & renderer ----------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0804);
  scene.fog = new THREE.FogExp2(0x0c0804, 0.028);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isSmallScreen, powerPreference: "high-performance" });
  } catch (err) {
    activatePosterFallback("WebGLRenderer threw: " + err.message, true);
    return;
  }
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.25 : 2));
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    activatePosterFallback("WebGL context lost", true);
  });
  renderer.outputColorSpace    = THREE.SRGBColorSpace;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 4.5;
  renderer.shadowMap.enabled   = !isSmallScreen;
  renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;  // rain clipping planes
  mount.appendChild(renderer.domElement);

  // ---- Camera --------------------------------------------------------
  // Eye-level view from the doorway: counter left, tables right, window far-left.
  // Matches the reference café composition — warm and inviting, not overhead.
  const BASE_CAM_POS    = isSmallScreen
    ? new THREE.Vector3( 0.5, 1.7, 5.5)
    : new THREE.Vector3( 0.5, 1.7, 5.0);
  const BASE_CAM_TARGET = isSmallScreen
    ? new THREE.Vector3(-0.5, 1.0, -1.5)
    : new THREE.Vector3(-0.5, 1.0, -1.5);
  const SCROLL_CAM_POS    = new THREE.Vector3( 0.5, 4.5, 9.0);
  const SCROLL_CAM_TARGET = new THREE.Vector3(-1.0, 1.0, -2.0);
  const DRIFT_X = 0.12, DRIFT_Y = 0.05, DRIFT_SPD = 0.04;

  const camera = new THREE.PerspectiveCamera(isSmallScreen ? 60 : 52, W / H, 0.1, 60);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_CAM_TARGET);

  // ---- Lighting ------------------------------------------------------
  // Three Edison PointLights are the key light. Ambient is very dim so the
  // warmth reads as coming purely from the pendants.
  const ambient = new THREE.AmbientLight(0xffd080, 6.0);
  scene.add(ambient);
  const fill = new THREE.DirectionalLight(0xffe0a0, 4.0);
  fill.position.set(2, 6, 8);
  scene.add(fill);

  const radialTex = makeRadialTexture();

  const PENDANT_DEFS  = [
    { x: -2.0, z: -0.5 },   // above laptop table
    { x:  1.2, z: -2.8 },   // above coffee table
    { x:  3.0, z: -4.0 },   // above 3rd table
    { x:  4.5, z: -4.6 },   // above counter
  ];
  const pendantLights    = [];
  const pendantFloorMats = [];
  const CORD_Y = 4.0;

  PENDANT_DEFS.forEach(({ x, z }) => {
    const light = new THREE.PointLight(0xffb040, isSmallScreen ? 14.0 : 18.0, 12.0, 1.1);
    light.position.set(x, CORD_Y - 0.18, z);
    if (!isSmallScreen) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = 0.2;
      light.shadow.camera.far  = 7;
      light.shadow.bias        = -0.002;
    }
    scene.add(light);
    pendantLights.push(light);

    // Pendant cord
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, CORD_Y - 0.18, 4),
      new THREE.MeshBasicMaterial({ color: 0x1e1008 })
    );
    cord.position.set(x, (CORD_Y - 0.18) / 2, z);
    scene.add(cord);

    // Conical shade
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.21, 0.24, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a1006, roughness: 0.9, side: THREE.DoubleSide })
    );
    shade.position.set(x, CORD_Y - 0.18 - 0.12, z);
    scene.add(shade);

    // Edison bulb glow sphere
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.92 });
    bulbMat.toneMapped = false;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), bulbMat);
    bulb.position.set(x, CORD_Y - 0.18, z);
    scene.add(bulb);

    // Soft warm pool on the floor
    const poolMat = new THREE.MeshBasicMaterial({
      map: radialTex, color: 0xff9840, transparent: true, opacity: 0.55, depthWrite: false,
    });
    poolMat.toneMapped = false;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.008, z);
    scene.add(pool);
    pendantFloorMats.push(poolMat);
  });

  // ---- Room geometry -------------------------------------------------
  const floorMat   = new THREE.MeshStandardMaterial({ map: makeWoodTexture(), roughness: 0.88 });
  const wallMat    = new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 0.88 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 1.0 });

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 20), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = !isSmallScreen;
  scene.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(18, 20), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 4.2;
  scene.add(ceiling);

  // Back wall (z = -8; default PlaneGeometry faces +Z = toward camera ✓)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.2), wallMat);
  backWall.position.set(0, 2.1, -8);
  scene.add(backWall);

  // Right wall split around door opening at z=0..1, y=0..2.5
  const DOOR_X = 7.0, DOOR_Z_MID = 0.50, DOOR_W = 1.05, DOOR_H = 2.50;
  const rw = (zc, zw, yc, yh) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(zw, yh), wallMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(DOOR_X, yc, zc);
    scene.add(m);
  };
  rw(-4.5,  9.0, 2.1, 4.2);          // far side (away from door)
  rw( 3.5,  5.0, 2.1, 4.2);          // near side (toward camera)
  rw(DOOR_Z_MID, DOOR_W, DOOR_H+(4.2-DOOR_H)/2, 4.2-DOOR_H); // above door
  rw(DOOR_Z_MID - DOOR_W*0.5 - 0.1, 0.2, 2.1, 4.2); // thin fill left of door
  rw(DOOR_Z_MID + DOOR_W*0.5 + 0.1, 0.2, 2.1, 4.2); // thin fill right of door

  // Door frame + swinging panel
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.80 });
  const doorPanelMat = new THREE.MeshStandardMaterial({ color: 0x7a5430, roughness: 0.72 });
  const doorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x8899aa, transparent: true, opacity: 0.22, roughness: 0.08,
  });
  // Posts
  const dz0 = DOOR_Z_MID - DOOR_W / 2, dz1 = DOOR_Z_MID + DOOR_W / 2;
  [dz0, dz1].forEach(pz => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, DOOR_H + 0.2, 0.08), doorFrameMat);
    post.position.set(DOOR_X, (DOOR_H + 0.2) / 2, pz);
    scene.add(post);
  });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, DOOR_W + 0.16), doorFrameMat);
  lintel.position.set(DOOR_X, DOOR_H + 0.04, DOOR_Z_MID);
  scene.add(lintel);

  // Swinging door pivot (hinge at dz0 side)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(DOOR_X, 0, dz0);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.05, DOOR_H - 0.04, DOOR_W - 0.06), doorPanelMat);
  doorPanel.position.set(0, (DOOR_H - 0.04) / 2, (DOOR_W - 0.06) / 2);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W * 0.52, DOOR_H * 0.32), doorGlassMat);
  doorGlass.rotation.y = -Math.PI / 2;
  doorGlass.position.set(-0.028, DOOR_H * 0.68, (DOOR_W - 0.06) / 2);
  doorPivot.add(doorPanel, doorGlass);
  scene.add(doorPivot);
  let doorAngle = 0, doorTargetAngle = 0;

  // Left wall split around window opening.
  // Window: z ∈ [winZlo, winZhi],  y ∈ [winYlo, winYhi]
  // Left wall faces +X → rotation.y = -PI/2
  const winZlo = -4.8, winZhi = 2.2;
  const winYlo = 0.30, winYhi = 3.60;
  const winZspan = winZhi - winZlo;
  const winYspan = winYhi - winYlo;
  const winZmid  = (winZlo + winZhi) / 2;
  const winYmid  = (winYlo + winYhi) / 2;

  function addLeftWallPanel(zCenter, zWidth, yCenter, yHeight) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(zWidth, yHeight), wallMat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(-6.5, yCenter, zCenter);
    scene.add(m);
  }
  addLeftWallPanel(winZmid, winZspan, winYlo / 2,            winYlo);            // below window
  addLeftWallPanel(winZmid, winZspan, winYhi + (4.2 - winYhi) / 2, 4.2 - winYhi); // above window
  addLeftWallPanel(winZhi + 2,   4,  2.1, 4.2);  // panel toward camera
  addLeftWallPanel(winZlo - 3,   6,  2.1, 4.2);  // panel toward back wall

  // ---- Window --------------------------------------------------------
  // Night-sky backdrop behind the glass
  const nightSky = new THREE.Mesh(
    new THREE.PlaneGeometry(winZspan + 2, 5),
    new THREE.MeshBasicMaterial({ color: 0x010305 })
  );
  nightSky.rotation.y = -Math.PI / 2;
  nightSky.position.set(-8.0, winYmid + 0.2, winZmid);
  scene.add(nightSky);

  // Glass pane — dark tinted, slightly reflective
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c14, transparent: true, opacity: 0.50,
    roughness: 0.04, metalness: 0.12,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winZspan - 0.06, winYspan - 0.06), glassMat);
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(-6.42, winYmid, winZmid);
  scene.add(glass);

  // Window frame — 7 flat bars, all face +X (rotation.y = -PI/2)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c0e04, roughness: 0.88 });
  const FT = 0.10; // frame thickness
  [
    [winZmid, winZspan + FT * 2, winYhi + FT / 2,       FT        ],  // top rail
    [winZmid, winZspan + FT * 2, winYlo - FT / 2,       FT        ],  // bottom rail
    [winZhi + FT / 2, FT,        winYmid,                winYspan  ],  // right upright
    [winZlo - FT / 2, FT,        winYmid,                winYspan  ],  // left upright
    [winZmid, winZspan,          winYmid,                FT * 0.7  ],  // horizontal mid
    [(winZlo + winZmid) / 2, winZspan / 2 - 0.02, winYmid, FT * 0.6 ], // left vertical
    [(winZmid + winZhi) / 2, winZspan / 2 - 0.02, winYmid, FT * 0.6 ], // right vertical
  ].forEach(([zc, zw, yc, yh]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(zw, yh), frameMat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(-6.44, yc, zc);
    scene.add(m);
  });

  // ---- Neon signs outside the glass ----------------------------------
  const neonSignMats = [];
  function makeNeonTex(text, hex) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 80;
    const g = c.getContext("2d");
    g.fillStyle = "#04040a";
    g.fillRect(0, 0, 256, 80);
    g.shadowColor = hex; g.shadowBlur = 32;
    g.fillStyle = hex;
    g.font = "bold 52px Arial,sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 42);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  [
    { text: "KOPI", hex: "#ff6b35", z: -0.4, y: 1.90 },
    { text: "24H",  hex: "#00e5ff", z:  1.4, y: 2.65 },
    { text: "CHAI", hex: "#ffd234", z: -2.8, y: 1.50 },
  ].forEach(({ text, hex, z, y }) => {
    const m = new THREE.MeshBasicMaterial({
      map: makeNeonTex(text, hex), transparent: true, opacity: 0.90, depthWrite: false,
    });
    m.toneMapped = false;
    m._buzzNext = 8 + Math.random() * 18;
    m._buzzing  = false;
    m._buzzEnd  = 0;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.40, 0.44), m);
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(-7.4, y, z);
    scene.add(sign);
    neonSignMats.push(m);
  });

  // Subtle colour bleed from neons onto the night-sky backdrop
  [
    { hex: 0xff3d10, z: -0.4, y: 0.9, sw: 1.8, sh: 1.6 },
    { hex: 0x00aadd, z:  1.4, y: 0.9, sw: 1.6, sh: 1.4 },
    { hex: 0xbb9900, z: -2.8, y: 0.9, sw: 1.6, sh: 1.4 },
  ].forEach(({ hex, z, y, sw, sh }) => {
    const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.06, depthWrite: false });
    m.toneMapped = false;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(sh, sw), m);
    q.rotation.y = -Math.PI / 2;
    q.position.set(-7.6, y, z);
    scene.add(q);
  });

  // ---- Rain ----------------------------------------------------------
  // LineSegments clipped to the glass pane area.
  const RAIN_COUNT = isSmallScreen ? 48 : 88;
  const rainPosArr = new Float32Array(RAIN_COUNT * 6);

  const rainClipPlanes = [
    new THREE.Plane(new THREE.Vector3( 0,  1,  0), -winYlo),           // y ≥ winYlo
    new THREE.Plane(new THREE.Vector3( 0, -1,  0),  winYhi),           // y ≤ winYhi
    new THREE.Plane(new THREE.Vector3( 0,  0,  1),  Math.abs(winZlo)), // z ≥ winZlo
    new THREE.Plane(new THREE.Vector3( 0,  0, -1),  winZhi),           // z ≤ winZhi
    new THREE.Plane(new THREE.Vector3( 1,  0,  0),  7.8),              // x ≥ -7.8
    new THREE.Plane(new THREE.Vector3(-1,  0,  0), -6.43),             // x ≤ -6.43
  ];
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPosArr, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x90b8d8, transparent: true, opacity: 0.30,
    clippingPlanes: rainClipPlanes,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainLines);

  const rainDrops = Array.from({ length: RAIN_COUNT }, (_, i) => ({
    y:     winYlo + Math.random() * (winYhi - winYlo),
    spd:   1.4 + Math.random() * 2.5,
    len:   0.07 + Math.random() * 0.18,
    z:     winZlo + (i / RAIN_COUNT) * (winZhi - winZlo),
    drift: (Math.random() - 0.5) * 0.3,
  }));

  function updateRain(dt) {
    const pos = rainGeo.attributes.position;
    rainDrops.forEach((d, i) => {
      d.y -= d.spd * dt;
      if (d.y < winYlo - 0.2) {
        d.y   = winYhi + Math.random() * 0.4;
        d.spd = 1.4 + Math.random() * 2.5;
        d.z   = winZlo + (i / RAIN_COUNT) * (winZhi - winZlo) + (Math.random() - 0.5) * 0.3;
      }
      pos.setXYZ(i * 2,     -7.0, d.y,         d.z);
      pos.setXYZ(i * 2 + 1, -7.0, d.y - d.len, d.z + d.drift * d.len);
    });
    pos.needsUpdate = true;
  }

  // ---- Steam particles above coffee cup ------------------------------
  const STEAM_COUNT  = isSmallScreen ? 8 : 15;
  const steamPosArr  = new Float32Array(STEAM_COUNT * 3);
  const steamGeo     = new THREE.BufferGeometry();
  steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPosArr, 3));
  const steamMat = new THREE.PointsMaterial({
    color: 0xfff0e0, size: 0.06, transparent: true, opacity: 0.50,
    depthWrite: false, sizeAttenuation: true,
  });
  steamMat.toneMapped = false;
  scene.add(new THREE.Points(steamGeo, steamMat));

  // Coffee cup top (table 2 at x=1.2, z=-2.8, bar-table top y=1.05)
  const STEAM_ORIGIN = new THREE.Vector3(1.0, 1.10, -3.02);
  const steamData = Array.from({ length: STEAM_COUNT }, (_, i) => ({
    phase:    (i / STEAM_COUNT),
    spd:      0.30 + Math.random() * 0.45,
    wobPhase: Math.random() * Math.PI * 2,
  }));

  function updateSteam(t) {
    const pos = steamGeo.attributes.position;
    steamData.forEach((s, i) => {
      s.phase = (s.phase + s.spd / 60) % 1;
      const life = s.phase;
      pos.setXYZ(
        i,
        STEAM_ORIGIN.x + Math.sin(t * 1.6 + s.wobPhase) * 0.022 * life,
        STEAM_ORIGIN.y + life * 0.32,
        STEAM_ORIGIN.z + Math.cos(t * 1.3 + s.wobPhase) * 0.018 * life
      );
    });
    pos.needsUpdate = true;
    steamMat.opacity = 0.30 + Math.sin(t * 0.8) * 0.10;
  }

  // ---- Furniture & props ---------------------------------------------
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x7a4c22, roughness: 0.78 });
  const chairWoodMat= new THREE.MeshStandardMaterial({ color: 0x6a3c18, roughness: 0.82 });
  const metalMat    = new THREE.MeshStandardMaterial({ color: 0x5a5050, roughness: 0.55, metalness: 0.50 });

  // Regular-height rectangular tables — top at y=0.76.
  function buildTable(x, z, ry = 0) {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.038, 0.60), darkWoodMat);
    top.position.y = 0.76;
    top.castShadow = !isSmallScreen;
    grp.add(top);
    [[-0.36,-0.24],[0.36,-0.24],[-0.36,0.24],[0.36,0.24]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.026,0.74,6), chairWoodMat);
      leg.position.set(lx, 0.37, lz);
      grp.add(leg);
    });
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    scene.add(grp);
  }

  // Ladder-back wooden chair — seat at y=0.45.
  function buildChair(x, z, ry = 0) {
    const grp = new THREE.Group();
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.030, 0.36), chairWoodMat);
    seat.position.y = 0.45;
    grp.add(seat);
    // 4 legs
    [[-0.15,-0.14],[0.15,-0.14],[-0.15,0.13],[0.15,0.13]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.45,6), chairWoodMat);
      leg.position.set(lx, 0.225, lz);
      grp.add(leg);
    });
    // Back posts
    [-0.13, 0.13].forEach(bx => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.44,6), chairWoodMat);
      post.position.set(bx, 0.67, -0.14);
      grp.add(post);
    });
    // Back rails
    [0.60, 0.75].forEach(by => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.022, 0.020), chairWoodMat);
      rail.position.set(0, by, -0.14);
      grp.add(rail);
    });
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    grp.traverse(o => { if (o.isMesh) o.castShadow = !isSmallScreen; });
    scene.add(grp);
  }

  // Table 1 — laptop patron area
  buildTable(-2.0, -0.5);
  buildChair(-2.0 + 0.62, -0.5 + 0.05, Math.PI * 0.94);
  buildChair(-2.0 - 0.60, -0.5 - 0.05, Math.PI * 0.06);

  // Table 2 — coffee patron area
  buildTable(1.2, -2.8);
  buildChair( 1.2 + 0.60, -2.8 + 0.05, Math.PI * 0.90);
  buildChair( 1.2 - 0.58, -2.8 - 0.05, Math.PI * 0.10);

  // Table 3 — dynamic customer slot
  buildTable(3.0, -4.0);
  buildChair(3.0 + 0.62, -4.0 + 0.05, Math.PI * 0.80);
  buildChair(3.0 - 0.60, -4.0 - 0.05, Math.PI * 0.15);

  // Counter surface and body
  const cTopMat   = new THREE.MeshStandardMaterial({ color: 0x6a3c16, roughness: 0.70 });
  const cFrontMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.82 });

  const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 6.5), cTopMat);
  ctop.position.set(4.7, 0.97, -4.6);
  ctop.castShadow = ctop.receiveShadow = !isSmallScreen;
  scene.add(ctop);

  const cbody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.97, 6.5), cFrontMat);
  cbody.position.set(4.2, 0.485, -4.6);
  scene.add(cbody);

  // Warm LED strip on counter edge
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xff9040, transparent: true, opacity: 0.22 });
  stripMat.toneMapped = false;
  const cstrip = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.022, 6.5), stripMat);
  cstrip.position.set(4.21, 0.97, -4.6);
  scene.add(cstrip);

  // Wall section behind counter — warm cream tile
  const cwall = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 0.88 })
  );
  cwall.rotation.y = -Math.PI / 2;
  cwall.position.set(6.98, 2.1, -4.6);
  scene.add(cwall);

  // Chalkboard menu on back wall
  const cbFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.40, 0.040),
    new THREE.MeshStandardMaterial({ color: 0x3a2810, roughness: 0.90 })
  );
  cbFrame.position.set(1.8, 2.90, -7.94);
  scene.add(cbFrame);
  const cbBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.20),
    new THREE.MeshBasicMaterial({ map: makeChalkboardTexture() })
  );
  cbBoard.position.set(1.8, 2.90, -7.91);
  scene.add(cbBoard);

  // Shelf on counter wall
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 4.0), darkWoodMat);
  shelf.position.set(6.85, 2.18, -4.8);
  scene.add(shelf);
  // Cups on shelf
  const shelfCupMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.65 });
  for (let i = 0; i < 5; i++) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.10, 10), shelfCupMat);
    sc.position.set(6.82, 2.26, -3.0 - i * 0.55);
    scene.add(sc);
  }

  // Coffee machine
  const machMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.55, metalness: 0.28 });
  const mach = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.50, 0.36), machMat);
  mach.position.set(4.52, 1.22, -5.4);
  mach.castShadow = !isSmallScreen;
  scene.add(mach);
  const machScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x002814 })
  );
  machScreen.rotation.y = -Math.PI / 2;
  machScreen.position.set(4.295, 1.22, -5.22);
  scene.add(machScreen);

  // Machine LED (animated in loop)
  const machLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff50, transparent: true, opacity: 0.85 });
  machLedMat.toneMapped = false;
  const machLed = new THREE.Mesh(new THREE.CircleGeometry(0.016, 8), machLedMat);
  machLed.rotation.y = -Math.PI / 2;
  machLed.position.set(4.285, 1.30, -5.22);
  scene.add(machLed);

  // ---- Laptop prop on table 1 ----------------------------------------
  const laptopMetal = new THREE.MeshStandardMaterial({ color: 0x1e2028, roughness: 0.45, metalness: 0.45 });

  const laptopGroup = new THREE.Group();
  const lbase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 0.24), laptopMetal);
  laptopGroup.add(lbase);

  const hingeGrp = new THREE.Group();
  hingeGrp.position.set(0, 0, -0.11);
  const lscreen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.012), laptopMetal);
  lscreen.position.y = 0.11;
  hingeGrp.add(lscreen);

  const screenFaceMat = new THREE.MeshBasicMaterial({ color: 0x2244aa, transparent: true, opacity: 0.88 });
  screenFaceMat.toneMapped = false;
  const lscreenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.305, 0.195), screenFaceMat);
  lscreenFace.position.set(0, 0.11, 0.007);
  hingeGrp.add(lscreenFace);

  hingeGrp.rotation.x = -1.72; // ≈ 99° open
  laptopGroup.add(hingeGrp);
  // On bar table 1 (top y=1.05; base half-height = 0.007)
  laptopGroup.position.set(-2.05, 0.768, -0.52);
  laptopGroup.rotation.y = -0.25;
  scene.add(laptopGroup);

  // Soft blue screen-glow + warm accent above laptop so it reads clearly
  const screenGlowLight = new THREE.PointLight(0x3355cc, 1.2, 2.2);
  screenGlowLight.position.set(-2.2, 1.50, -0.55);
  scene.add(screenGlowLight);
  const laptopAccent = new THREE.PointLight(0xffc87a, 3.5, 2.8);
  laptopAccent.position.set(-2.05, 1.9, -0.52);
  scene.add(laptopAccent);

  // ---- Coffee cup prop on table 2 ------------------------------------
  const coffeeMat = new THREE.MeshStandardMaterial({ color: 0xede5d5, roughness: 0.62 });
  const coffeeGroup = new THREE.Group();
  const ccBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.098, 12), coffeeMat);
  const ccSaucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.007, 12),
    new THREE.MeshStandardMaterial({ color: 0xe5ddd0, roughness: 0.60 })
  );
  ccSaucer.position.y = -0.052;
  const ccTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshBasicMaterial({ color: 0x3a1b08 })
  );
  ccTop.rotation.x = -Math.PI / 2;
  ccTop.position.y = 0.050;
  // Cup handle (half-torus)
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.006, 8, 14, Math.PI),
    coffeeMat
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.042, 0, 0);
  coffeeGroup.add(ccBody, ccSaucer, ccTop, handle);
  coffeeGroup.position.set(STEAM_ORIGIN.x, 0.768, STEAM_ORIGIN.z);
  scene.add(coffeeGroup);

  // Warm accent above coffee cup so it reads clearly
  const coffeeAccent = new THREE.PointLight(0xffc87a, 3.5, 2.6);
  coffeeAccent.position.set(1.0, 1.9, -3.02);
  scene.add(coffeeAccent);

  // Small notepad beside the coffee
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.008, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.95 })
  );
  pad.position.set(1.34, 0.768, -2.62);
  pad.rotation.y = 0.4;
  scene.add(pad);

  // ---- Human cast ----------------------------------------------------
  const npcs = [];
  const clock = new THREE.Clock();
  let usingGLTFHumans = false;
  window.__EV_DEBUG = {};

  // Patron table slots — seated geometry figures with lifecycle.
  const CUSTOMER_SLOTS = [
    { x: -2.0, z: -0.5,  ry: Math.PI * 0.87,  role: 'laptop', femaleOnly: false },
    { x:  1.2, z: -2.8,  ry: Math.PI * 0.82,  role: 'coffee', femaleOnly: true  },
    { x:  3.0, z: -4.0,  ry: Math.PI * 0.75,  role: 'idle',   femaleOnly: false },
  ];
  // Barista stays as GLB at the counter.
  const BARISTA_SPOT = { x: 4.8, z: -4.8, ry: -Math.PI * 0.42, gender: "remy" };

  // Door position (spawn / despawn point for walking customers)
  const DOOR_SPAWN = new THREE.Vector3(6.2, 0, DOOR_Z_MID);
  const WALK_SPEED = 0.90; // units per second

  // --- Seat customer state machine ---
  // States: OCCUPIED → LEAVING → EMPTY → ARRIVING
  const customerSlots = CUSTOMER_SLOTS.map((slot, i) => ({
    slot,
    state: 'OCCUPIED',
    seatedFig: null,
    seatedAnimatables: [],
    walkFig: null,
    walkStFig: null,       // ref to stylized fig for limb animation
    walkFrom: new THREE.Vector3(),
    walkTo:   new THREE.Vector3(),
    walkDuration: 3.0,
    walkProgress: 0,
    stayTimer: 38 + i * 14 + Math.random() * 20,
    emptyTimer: 0,
    productIdx: i % SHIRT_PRODUCTS.length,
  }));

  function pickProduct(femaleOnly) {
    const pool = femaleOnly
      ? SHIRT_PRODUCTS.filter(p => p.femaleOnly)
      : SHIRT_PRODUCTS.filter(p => !p.femaleOnly);
    return (pool.length ? pool : SHIRT_PRODUCTS)[Math.floor(Math.random() * (pool.length || SHIRT_PRODUCTS.length))];
  }

  function spawnSeated(cs) {
    const product = pickProduct(cs.slot.femaleOnly);
    const roles   = cs.slot.role === 'idle'
      ? (Math.random() < 0.5 ? 'laptop' : 'coffee')
      : cs.slot.role;
    const fig = createSeatedFigure({ role: roles, shirtImageUrl: product.image });
    fig.group.position.set(cs.slot.x, 0, cs.slot.z);
    fig.group.rotation.y = cs.slot.ry;
    scene.add(fig.group);
    cs.seatedFig        = fig.group;
    cs.seatedAnimatables = fig.animatables;
    cs.productId         = product.id;
    npcs.push({ group: fig.group, productId: product.id });
  }

  function removeSeated(cs) {
    if (!cs.seatedFig) return;
    scene.remove(cs.seatedFig);
    const idx = npcs.findIndex(n => n.group === cs.seatedFig);
    if (idx !== -1) npcs.splice(idx, 1);
    cs.seatedFig = null;
    cs.seatedAnimatables = [];
  }

  function spawnWalker(cs, fromPos, toPos) {
    const product = pickProduct(cs.slot.femaleOnly);
    const sf = createStylizedFigure(product.image);
    const dx = toPos.x - fromPos.x, dz = toPos.z - fromPos.z;
    sf.group.position.copy(fromPos);
    sf.group.rotation.y = Math.atan2(dx, dz);
    scene.add(sf.group);
    cs.walkFig      = sf.group;
    cs.walkStFig    = sf;
    cs.walkFrom.copy(fromPos);
    cs.walkTo.copy(toPos);
    cs.walkDuration = fromPos.distanceTo(toPos) / WALK_SPEED;
    cs.walkProgress = 0;
  }

  function removeWalker(cs) {
    if (!cs.walkFig) return;
    scene.remove(cs.walkFig);
    cs.walkFig = null; cs.walkStFig = null;
  }

  function updateCustomers(dt, t) {
    let anyoneAtDoor = false;
    customerSlots.forEach((cs, i) => {
      switch (cs.state) {

        case 'OCCUPIED':
          cs.seatedAnimatables.forEach(a => a.update(t + i * 3.7));
          cs.stayTimer -= dt;
          if (cs.stayTimer <= 0) {
            removeSeated(cs);
            const toPos = DOOR_SPAWN.clone();
            spawnWalker(cs, new THREE.Vector3(cs.slot.x, 0, cs.slot.z), toPos);
            cs.state = 'LEAVING';
          }
          break;

        case 'LEAVING':
          anyoneAtDoor = true;
          cs.walkProgress += dt / cs.walkDuration;
          if (cs.walkProgress >= 1) {
            removeWalker(cs);
            cs.state      = 'EMPTY';
            cs.emptyTimer = 6 + Math.random() * 10;
          } else {
            cs.walkFig.position.lerpVectors(cs.walkFrom, cs.walkTo, cs.walkProgress);
            animateWalkLimbs(cs, t);
          }
          break;

        case 'EMPTY':
          cs.emptyTimer -= dt;
          if (cs.emptyTimer <= 0) {
            spawnWalker(cs, DOOR_SPAWN.clone(), new THREE.Vector3(cs.slot.x, 0, cs.slot.z));
            cs.state = 'ARRIVING';
          }
          break;

        case 'ARRIVING':
          anyoneAtDoor = true;
          cs.walkProgress += dt / cs.walkDuration;
          if (cs.walkProgress >= 1) {
            removeWalker(cs);
            spawnSeated(cs);
            cs.state     = 'OCCUPIED';
            cs.stayTimer = 35 + Math.random() * 45;
          } else {
            cs.walkFig.position.lerpVectors(cs.walkFrom, cs.walkTo, cs.walkProgress);
            animateWalkLimbs(cs, t);
          }
          break;
      }
    });

    // Door swings open when anyone is near it
    doorTargetAngle = anyoneAtDoor ? -Math.PI * 0.55 : 0;
    doorAngle += (doorTargetAngle - doorAngle) * Math.min(1, dt * 3.5);
    doorPivot.rotation.y = doorAngle;
  }

  function animateWalkLimbs(cs, t) {
    if (!cs.walkStFig) return;
    const sf = cs.walkStFig;
    const ph = cs.walkProgress * cs.walkDuration * 3.8;
    if (sf.lL) sf.lL.upperGroup.rotation.x = Math.sin(ph)         * 0.50;
    if (sf.rL) sf.rL.upperGroup.rotation.x = Math.sin(ph + Math.PI) * 0.50;
    if (sf.lA) sf.lA.upperGroup.rotation.x = Math.sin(ph + Math.PI) * 0.28;
    if (sf.rA) sf.rA.upperGroup.rotation.x = Math.sin(ph)         * 0.28;
  }

  // Initialise seats immediately (no waiting for GLBs)
  customerSlots.forEach(cs => spawnSeated(cs));

  // ---- GLB barista only -----------------------------------------------
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
  };

  const contactShadowMats = [];

  function buildHuman(spec, base, walkClip, teeImage, baseShirtImage) {
    const cloned    = skeletonClone(base.scene);
    const group     = new THREE.Group();
    group.add(cloned);
    const sizeScale = fitHuman(cloned, group, spec.height);
    if (spec.shirtMesh && spec.tee) {
      cloned.traverse((o) => {
        if (o.isMesh && o.name === spec.shirtMesh) {
          if (o.name === "Tops") { o.scale.set(1.18, 1.0, 1.12); o.position.y -= 0.015; }
          const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
          m.map = makeTeeTexture(baseShirtImage, teeImage, spec.tee);
          m.needsUpdate = true;
          o.material = m;
        }
      });
    }
    if (!isSmallScreen) {
      cloned.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = true; });
    } else {
      const blobMat = new THREE.MeshBasicMaterial({
        map: radialTex, color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false,
      });
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.015;
      blob.scale.setScalar(1 / Math.max(0.0001, sizeScale));
      group.add(blob);
      contactShadowMats.push(blobMat);
    }
    const mixer    = new THREE.AnimationMixer(cloned);
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    if (walkAction) {
      walkAction.play();
      walkAction.time      = Math.random() * (walkClip.duration || 1);
      walkAction.timeScale = 0.07;
      mixer.update(0);
    }
    return { group, mixer, cloned, walkAction, sizeScale, isStylized: false };
  }

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const imageLoader = new THREE.ImageLoader();
  function loadGLB(url)   { return new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej)); }
  function loadImage(url) { return new Promise((res) => imageLoader.load(url, res, undefined, () => res(null))); }

  Promise.all([
    loadGLB(PEOPLE.remy.url),
    Promise.all(SHIRT_PRODUCTS.map((p) => loadImage(p.image))),
  ]).then(([remyG, teeImages]) => {
    usingGLTFHumans = true;
    const walkRemy = stripRootMotion(remyG.animations[0]);
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
    const maleOutfits  = SHIRT_PRODUCTS
      .map((p, i) => ({ ...p, teeImage: teeImages[i] }))
      .filter(o => !o.femaleOnly);
    const baristaOutfit = maleOutfits[maleOutfits.length - 1];
    const fig = buildHuman(PEOPLE.remy, remyG, walkRemy, baristaOutfit.teeImage, remyShirtImg);
    fig.group.position.set(BARISTA_SPOT.x, 0, BARISTA_SPOT.z);
    fig.group.rotation.y = BARISTA_SPOT.ry;
    scene.add(fig.group);
    npcs.push({ ...fig, productId: baristaOutfit.id });
    window.__EV_DEBUG.npcs = npcs;
  }).catch((err) => {
    console.warn("EL VYNCE hero: barista GLB failed:", err);
    // Barista falls back silently — seated patrons already showing.
  });

  // ---- Interaction ---------------------------------------------------
  let pointerX = 0, pointerY = 0, parallaxX = 0, parallaxY = 0;
  window.addEventListener("mousemove", (e) => {
    const r = mount.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width)  * 2 - 1;
    pointerY = ((e.clientY - r.top)  / r.height) * 2 - 1;
  });

  let scrollProgress = 0;
  function updateScrollProgress() {
    if (!heroHeader) return;
    const r = heroHeader.getBoundingClientRect();
    scrollProgress = Math.min(1, Math.max(0, -r.top / (r.height || window.innerHeight)));
    document.body.classList.toggle("ev-stamp-in", scrollProgress > 0.55);
  }
  window.addEventListener("scroll", updateScrollProgress, { passive: true });
  updateScrollProgress();

  const raycaster = new THREE.Raycaster();
  const pvec      = new THREE.Vector2();
  function npcUnderPointer(cx, cy) {
    const r = mount.getBoundingClientRect();
    pvec.x =  ((cx - r.left) / r.width)  * 2 - 1;
    pvec.y = -((cy - r.top)  / r.height) * 2 + 1;
    raycaster.setFromCamera(pvec, camera);
    const hits = raycaster.intersectObjects(npcs.map((n) => n.group), true);
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

  let isVisible = true;
  if ("IntersectionObserver" in window && heroHeader) {
    new IntersectionObserver((e) => { isVisible = e[0].isIntersecting; }, { threshold: 0 })
      .observe(heroHeader);
  }
  let tabHidden = document.hidden;
  document.addEventListener("visibilitychange", () => { tabHidden = document.hidden; });

  // Café is permanently "night" — CSS drives white text immediately
  if (heroHeader) heroHeader.classList.add("is-night");

  // ---- FPS watchdog --------------------------------------------------
  let sceneT = 0, liteMode = false;
  let fpsWinStart = 0, fpsFrames = 0, warmStamp = 0, badWindows = 0;

  function watchdogTick(t) {
    if (!usingGLTFHumans) return;
    if (!warmStamp) { warmStamp = t; return; }
    if (t - warmStamp < 1.5) return;
    if (!fpsWinStart) { fpsWinStart = t; fpsFrames = 0; return; }
    fpsFrames++;
    const span = t - fpsWinStart;
    if (span < 4) return;
    const fps = fpsFrames / span;
    fpsFrames = 0; fpsWinStart = t;
    if (fps < 10) {
      badWindows++;
      if (badWindows >= 2) activatePosterFallback("sustained " + fps.toFixed(1) + " fps", false);
    } else if (fps < 22) {
      badWindows = 0; liteMode = true;
    } else {
      badWindows = 0;
    }
  }

  // ---- Main animation loop -------------------------------------------
  function animateFrame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t  = clock.elapsedTime;
    sceneT = t;
    watchdogTick(t);

    updateRain(dt);
    updateSteam(t);

    // Neon buzz flicker
    neonSignMats.forEach((m) => {
      if (t >= m._buzzNext) {
        m._buzzing = true;
        m._buzzEnd  = t + 0.08 + Math.random() * 0.20;
        m._buzzNext = t + 9   + Math.random() * 24;
      }
      if (m._buzzing && t >= m._buzzEnd) m._buzzing = false;
      m.opacity = m._buzzing ? 0.07 + Math.random() * 0.38 : 0.90;
    });

    // Edison pendant flicker
    pendantLights.forEach((light, i) => {
      const f = 1 + Math.sin(t * 2.4 + i * 4.3) * 0.04;
      light.intensity = (isSmallScreen ? 14.0 : 18.0) * f;
    });

    // Screen glow pulse
    screenGlowLight.intensity = 0.45 + Math.sin(t * 0.65) * 0.07;

    // Machine LED pulse
    machLedMat.opacity = 0.55 + Math.sin(t * 1.4) * 0.35;

    // Seated figure animations + customer lifecycle
    updateCustomers(dt, t);

    // Barista GLB idle sway
    npcs.forEach((npc) => { if (npc.mixer) npc.mixer.update(dt); });

    // Cursor parallax (eased)
    parallaxX += (pointerX - parallaxX) * 0.04;
    parallaxY += (pointerY - parallaxY) * 0.04;

    // Slow cinematic drift
    const driftX = Math.sin(t * DRIFT_SPD)        * DRIFT_X;
    const driftY = Math.sin(t * DRIFT_SPD * 0.72) * DRIFT_Y;

    const camPos    = BASE_CAM_POS.clone().lerp(SCROLL_CAM_POS,    scrollProgress);
    const camTarget = BASE_CAM_TARGET.clone().lerp(SCROLL_CAM_TARGET, scrollProgress);
    const pStr      = 0.32 * (1 - scrollProgress);
    camPos.x +=  parallaxX * pStr + driftX * (1 - scrollProgress);
    camPos.y += -parallaxY * pStr * 0.5 + driftY * (1 - scrollProgress);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
  }

  if (prefersReducedMotion) {
    renderer.render(scene, camera);
  } else {
    function animate() {
      if (posterActive) return;
      requestAnimationFrame(animate);
      if (!isVisible || tabHidden) return;
      try {
        animateFrame();
      } catch (err) {
        activatePosterFallback("render error: " + (err && err.message), true);
      }
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
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(onResize).observe(mount);
  requestAnimationFrame(() => requestAnimationFrame(onResize));
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    initHeroSilhouette();
  } catch (err) {
    console.error("EL VYNCE hero: init threw:", err);
    const m = document.getElementById("hero-silhouette");
    if (m) m.style.cssText =
      "background:#0c0804 url('images/hero-real-3.jpg') center 30%/cover no-repeat;" +
      "filter:grayscale(1) contrast(1.04);";
  }
});
