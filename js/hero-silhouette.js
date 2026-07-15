/* EL VYNCE — "Rush Hour, 8:59 AM" cinematic city hero.
   A premium business district at morning rush: slim glass towers with
   sky-reflection facades, real sidewalks + curbs + streetlamps + planters,
   a working pedestrian signal that gathers commuters at the curb and releases
   them across the road in waves, real Mixamo humans wearing the actual product
   tees (fabric-dyed + chest print composited), a street dancer, a bench
   sitter, a sidewalk conversation pair. Time of day AND crowd density are
   driven by the visitor's real local clock — morning/evening rush is full,
   midday lighter, night sparse with lit windows and lamp pools. Desktop gets
   true directional sun shadows + ACES film tone mapping; phones get soft
   contact shadows and trimmed counts. Falls back to stylized procedural
   figures if the GLBs fail, so the hero never breaks. Interactive: click a
   figure to open its product, cursor parallax, scroll camera pull-back.
   ES module (three.js r0.160). No build step. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Real product photography — front print of each tee. Cycled across every figure
// so, over time, the full catalogue is represented walking the street.
// Real product photography — front print of each tee. femaleOnly designs are
// never composited onto the male rig (wardrobe logic in the walker loop).
// ids match js/products.js so clicking a figure opens the exact tee worn.
const SHIRT_PRODUCTS = [
  { image: "images/products/built-different-front.jpg", id: "ev-006b" },
  { image: "images/products/dare-to-be-different-front.jpg", id: "ev-006" },
  { image: "images/products/frequency-front.jpg", id: "ev-003" },
  { image: "images/products/im-just-a-girl-front.jpg", id: "ev-006c", femaleOnly: true },
  { image: "images/products/inner-noise-front.jpg", id: "ev-003b" },
  { image: "images/products/just-be-resilient-front.jpg", id: "ev-005" },
  { image: "images/products/rebel-soul-front.jpg", id: "ev-002" },
  { image: "images/products/style-pays-off-front.jpg", id: "ev-004" },
];

const SMALL_SCREEN_WIDTH = 768; // below this, trim figure/building counts for perf.
const isSmallScreen = window.innerWidth < SMALL_SCREEN_WIDTH;
// Commuter walkers (the rush-hour stream). Dancer, bench sitter and the
// conversation pair are added on top of these.
const WALKER_COUNT = isSmallScreen ? 6 : 10;
const FIGURE_COUNT = isSmallScreen ? 6 : 8; // stylized fallback crowd size
// Horizontal reach of the sun/moon arc: the narrow portrait frustum can only
// see ~±8 world units at the sky plane, so the arc is tightened on phones.
const CELESTIAL_X = isSmallScreen ? 6 : 15;

// ---- District ground plan (world units, street runs along Z) ----
const ROAD_HALF = 2.2;            // road spans x ∈ [-2.2, 2.2]
const SIDEWALK_H = 0.06;          // raised pavement height
const LANE_MIN = 2.7;             // walkers keep to the sidewalk band
const LANE_MAX = isSmallScreen ? 3.6 : 4.3;
const CROSS_Z = 2.0;              // crosswalk position along the street
const CURB_WAIT_X = 2.55;         // where waiters gather before crossing
// Phones: don't let walkers reach as far back — beyond z≈-9 the portrait
// framing flattens depth so much that distant figures visually overlap the
// far tower facades and read as "walking on the buildings".
const WALK_Z_MIN = isSmallScreen ? -9 : -13;
// Phones turn walkers around at z=5: past that they'd be beside/behind the
// closer mobile camera — outside the frame, an empty-feeling street.
const WALK_Z_MAX = 5;
// Pedestrian signal: 10s walk, 16s wait — long enough for a crowd to gather
// at the curb, so each green releases a satisfying crossing wave.
const SIGNAL_CYCLE = 26;
const SIGNAL_GREEN = 10;

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

// Crowd density across the day — the district lives on the visitor's clock:
// full streams at morning/evening rush, calmer midday, sparse late night.
function crowdDensityFor(hour) {
  if (hour >= 6.5 && hour < 10) return 1; // morning rush — the signature look
  if (hour >= 10 && hour < 16.5) return 0.6; // working day
  if (hour >= 16.5 && hour < 20) return 1; // evening exit
  if (hour >= 20 && hour < 23) return 0.45; // dinner hours
  return 0.3; // late night / pre-dawn
}

function shortestAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
function smoothstep01(k) {
  return k * k * (3 - 2 * k);
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
// Fallback stylized human figure (used only if the GLBs fail to load) —
// proper head/shoulders/arms/legs with a natural walk swing.
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
  const clothing = new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.85, metalness: 0.05 });
  const skinTone = new THREE.MeshStandardMaterial({ color: 0xc79a75, roughness: 0.7, metalness: 0 });

  const figure = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.5, 4, 8);
  const torsoMesh = new THREE.Mesh(torsoGeo, clothing);
  const torso = addEdges(torsoMesh).mesh;
  torso.position.set(0, 1.05, 0);
  figure.add(torso);

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

// ---------------------------------------------------------------------------
// Premium tower builder — slim glass office towers with a vertical sky-
// reflection gradient, per-floor spandrel bands, mullion lines, a dark lobby
// band with a lit entrance, parapet caps and optional upper setbacks. Facade
// is a generated canvas (no downloads); night windows are sparse emissive
// dots merged into ONE mesh per tower (per-dot meshes cost a draw call each).
// ---------------------------------------------------------------------------
const TOWER_PALETTES = [
  { glassTop: "#c5d8e8", glassBottom: "#7d94a8", mullion: "#3f4a54", spandrel: "#5a6773", lobby: "#20262c" }, // blue glass
  { glassTop: "#aab3bd", glassBottom: "#565f6a", mullion: "#333a41", spandrel: "#454d56", lobby: "#191d21" }, // charcoal
  { glassTop: "#d6ccba", glassBottom: "#a3937c", mullion: "#5d5347", spandrel: "#7d7161", lobby: "#241f18" }, // greige stone
  { glassTop: "#c8b494", glassBottom: "#8d7758", mullion: "#4a3b28", spandrel: "#63523a", lobby: "#1d160d" }, // bronze
];

function makeFacadeTexture(palette, floors, bays, withLobby) {
  const W = 192, H = 384;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");

  // Glass body: brighter at the top where it reflects sky — the single detail
  // that makes a flat box read as a glass tower.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, palette.glassTop);
  grad.addColorStop(1, palette.glassBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const lobbyH = withLobby ? Math.round(H * 0.085) : 0;
  const bodyH = H - lobbyH;
  const floorH = bodyH / floors;
  const bayW = W / bays;

  // Per-floor spandrel band + per-bay reflection variance (some panes catch
  // more sky, some less — uniform glass looks like plastic).
  for (let r = 0; r < floors; r++) {
    const y0 = r * floorH;
    for (let c = 0; c < bays; c++) {
      const v = Math.random();
      g.fillStyle = v < 0.5
        ? "rgba(255,255,255," + (Math.random() * 0.13).toFixed(3) + ")"
        : "rgba(10,16,22," + (Math.random() * 0.13).toFixed(3) + ")";
      g.fillRect(c * bayW + 1, y0, bayW - 2, floorH * 0.74);
    }
    g.fillStyle = palette.spandrel;
    g.globalAlpha = 0.92;
    g.fillRect(0, y0 + floorH * 0.74, W, floorH * 0.26);
    g.globalAlpha = 1;
  }

  // Vertical mullions — the fine lines that give the facade its rhythm.
  g.fillStyle = palette.mullion;
  for (let c = 0; c <= bays; c++) {
    g.fillRect(Math.min(W - 2, c * bayW), 0, 2, bodyH);
  }

  if (withLobby) {
    g.fillStyle = palette.lobby;
    g.fillRect(0, bodyH, W, lobbyH);
    // Cornice line above the lobby.
    g.fillStyle = palette.mullion;
    g.fillRect(0, bodyH - 2, W, 3);
    // Softly lit entrance in the center bay — barely-there, like glass
    // catching the lobby light, not a billboard.
    g.fillStyle = "rgba(255,236,205,0.11)";
    g.fillRect(W * 0.42, bodyH + lobbyH * 0.2, W * 0.16, lobbyH * 0.72);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// innerFaceSign: which ±X face of the tower looks onto the street (gets night
// window dots); pass 0 to skip the side dots (far skyline row).
function createTower(w, h, d, paletteIndex, innerFaceSign) {
  const palette = TOWER_PALETTES[paletteIndex % TOWER_PALETTES.length];
  const group = new THREE.Group();

  const hasSetback = h > 7.5 && Math.random() < 0.55;
  const mainH = hasSetback ? h * 0.68 : h;
  const floors = THREE.MathUtils.clamp(Math.round(mainH * 2.4), 8, 26);
  const bays = 6;
  const tex = makeFacadeTexture(palette, floors, bays, true);
  const facadeMaterial = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(w, mainH, d), facadeMaterial);
  main.position.y = mainH / 2;
  main.castShadow = main.receiveShadow = !isSmallScreen;
  group.add(main);

  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x272b30, roughness: 0.8 });
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), parapetMat);
  parapet.position.y = mainH + 0.05;
  group.add(parapet);

  if (hasSetback) {
    const uw = w * 0.72, ud = d * 0.72, uh = h * 0.34;
    const upperTex = makeFacadeTexture(palette, Math.max(6, Math.round(uh * 2.4)), 5, false);
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(uw, uh, ud),
      new THREE.MeshStandardMaterial({ map: upperTex, roughness: 0.55, metalness: 0.2 })
    );
    upper.position.y = mainH + uh / 2;
    upper.castShadow = upper.receiveShadow = !isSmallScreen;
    group.add(upper);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(uw + 0.06, 0.08, ud + 0.06), parapetMat);
    cap.position.y = mainH + uh + 0.04;
    group.add(cap);
  } else if (Math.random() < 0.5) {
    // Rooftop plant unit — real skylines are never perfectly clean boxes.
    const unit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 0.16, d * 0.26), parapetMat);
    unit.position.set(w * 0.2, mainH + 0.18, -d * 0.15);
    group.add(unit);
  }

  // Night windows: sparse warm dots on the camera-facing ±Z faces and the
  // street-facing ±X face, merged into a single mesh.
  const litFraction = 0.34;
  const maxDots = 26;
  let dotsPlaced = 0;
  const dotGeos = [];
  for (let r = 1; r < floors - 1 && dotsPlaced < maxDots; r++) {
    for (let c = 0; c < bays && dotsPlaced < maxDots; c++) {
      if (Math.random() > litFraction) continue;
      const py = ((floors - r - 0.5) / floors) * mainH;
      const px = ((c + 0.5) / bays) * w - w / 2;
      const front = new THREE.PlaneGeometry(w * 0.07, mainH * 0.028);
      front.translate(px, py, d / 2 + 0.012);
      dotGeos.push(front);
      const back = new THREE.PlaneGeometry(w * 0.07, mainH * 0.028);
      back.rotateY(Math.PI);
      back.translate(-px, py, -d / 2 - 0.012);
      dotGeos.push(back);
      if (innerFaceSign) {
        const pz = ((c + 0.5) / bays) * d - d / 2;
        const sideDot = new THREE.PlaneGeometry(d * 0.07, mainH * 0.028);
        sideDot.rotateY(innerFaceSign > 0 ? Math.PI / 2 : -Math.PI / 2);
        sideDot.translate(innerFaceSign * (w / 2 + 0.012), py, pz);
        dotGeos.push(sideDot);
      }
      dotsPlaced++;
    }
  }
  let windowDotMaterial = null;
  if (dotGeos.length) {
    const merged = mergeGeometries(dotGeos);
    windowDotMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0 });
    windowDotMaterial.toneMapped = false;
    group.add(new THREE.Mesh(merged, windowDotMaterial));
  }

  // Crisp edge line so towers stay defined against both bright and night sky.
  const edgeGeo = new THREE.EdgesGeometry(main.geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x20242a, transparent: true, opacity: 0.2 });
  main.add(new THREE.LineSegments(edgeGeo, edgeMaterial));

  return { group, facadeMaterial, windowDotMaterial, edgeMaterial };
}

// Soft radial blob texture — reused for phone contact shadows and the warm
// light pools under streetlamps at night.
function makeRadialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Light-stone pavement with paving joints for the sidewalks.
function makePavementTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#cfc9bd";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.05)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
  }
  g.strokeStyle = "rgba(0,0,0,0.10)";
  g.lineWidth = 2;
  for (let p = 0; p <= 256; p += 64) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#3a3c42";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.05)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pavement height under a figure: 0 on the road, SIDEWALK_H on the sidewalks,
// with a short ramp at the curb so crossers visibly step down/up.
function pavementY(x) {
  const a = Math.abs(x);
  if (a >= 2.5) return SIDEWALK_H;
  if (a <= ROAD_HALF) return 0;
  return ((a - ROAD_HALF) / 0.3) * SIDEWALK_H;
}

function initHeroSilhouette() {
  const mount = document.getElementById("hero-silhouette");
  const heroHeader = mount ? mount.closest("header") : null;
  if (!mount) return;
  // Marks the homepage so the brand stamp can stay hidden over the hero and
  // fade in after scroll (style.css: body.ev-has-hero rules).
  document.body.classList.add("ev-has-hero");

  // ---- Fail-safe poster fallback -----------------------------------------
  // The scene must be INCAPABLE of showing a broken canvas. If WebGL is
  // unavailable, the renderer throws, the GPU kills the context (routine on
  // iPhones under memory pressure), or a frame crashes, the hero swaps to a
  // full-bleed brand photograph.
  //   persist=true (hard failures: no WebGL / renderer threw / context lost /
  //     render exception) remembers the swap for the session so a device that
  //     genuinely can't run WebGL doesn't crash-loop.
  //   persist=false (soft FPS demotion) does NOT remember — a slow first load
  //     (asset decode blocking the main thread) must not lock a capable
  //     machine onto the photo for the whole session; each load re-measures.
  // Debug: ?evposter=1 forces the poster path for testing.
  let posterActive = false;
  // Versioned key — bumping this clears all stuck poster flags from prior deploys.
  const POSTER_KEY = "ev-hero-poster-v3";
  function activatePosterFallback(reason, persist) {
    if (posterActive) return;
    posterActive = true;
    if (persist) {
      try { sessionStorage.setItem(POSTER_KEY, "1"); } catch (e) { /* private mode */ }
    }
    console.warn("EL VYNCE hero: poster fallback —", reason);
    mount.innerHTML = "";
    mount.style.cssText =
      "background:#f4f3f1 url('images/hero-real-3.jpg') center 30%/cover no-repeat;" +
      "filter:grayscale(1) contrast(1.04);";
    if (heroHeader) heroHeader.classList.remove("is-night");
  }
  const params = new URLSearchParams(window.location.search);
  const bootPoster = (() => {
    try { return sessionStorage.getItem(POSTER_KEY) === "1"; } catch (e) { return false; }
  })();
  if (params.get("evposter") === "1" || bootPoster) {
    activatePosterFallback(bootPoster ? "hard failure earlier this session" : "forced via ?evposter=1", true);
    return;
  }
  const glProbe = document.createElement("canvas");
  if (!glProbe.getContext("webgl2") && !glProbe.getContext("webgl")) {
    activatePosterFallback("WebGL not available", true);
    return;
  }
  // -------------------------------------------------------------------------

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  // Background color matches sky — updated each frame via updateDayNightCycle.
  // Setting a real Color (not null) makes the canvas opaque immediately on
  // first render, before models load, so the hero never shows as transparent.
  scene.background = new THREE.Color(0x8fc6f0); // default morning sky
  // Morning haze: distant towers melt into the sky color (updated per frame).
  // Mobile fog is TIGHTER than desktop (the camera sits further back on
  // phones, so equal fog distances would leave the far skyline crisper than
  // on desktop) — hazier far towers = clean depth separation from walkers.
  scene.fog = new THREE.Fog(0x8fc6f0, 20, isSmallScreen ? 52 : 55);

  // Base camera pose (before parallax/scroll offsets are applied each frame).
  // Desktop: eye-level-ish documentary framing that sees both sidewalks and
  // the crosswalk. Portrait phones get a pulled-back, wider-angle framing.
  // Mobile reframe: the old phone pose (y=4.2, z=16, FOV 60) was a high,
  // pulled-back wide shot — right for landscape, but a portrait frustum is
  // so narrow horizontally that the near sidewalk band fell OUTSIDE the view
  // and distant figures rendered tiny ("humans are not visible"). Street-
  // level camera, closer and lower, wider lens: figures read ~40% larger and
  // the crosswalk sits center-frame as the focal event.
  const BASE_CAM_POS = isSmallScreen
    ? new THREE.Vector3(0, 2.6, 11.5)
    : new THREE.Vector3(0, 2.7, 9.2);
  const BASE_CAM_TARGET = isSmallScreen
    ? new THREE.Vector3(0, 1.6, -3)
    : new THREE.Vector3(0, 1.15, -0.5);
  // Scroll-pulled-back pose — camera rises and retreats as the visitor scrolls past the hero.
  const SCROLL_CAM_POS = isSmallScreen
    ? new THREE.Vector3(0, 7, 19)
    : new THREE.Vector3(0, 6.5, 16);
  const SCROLL_CAM_TARGET = new THREE.Vector3(0, 2, 0);
  // Slow cinematic drift added on top of the base pose.
  const DRIFT_AMPLITUDE_X = 0.6;
  const DRIFT_AMPLITUDE_Y = 0.18;
  const DRIFT_SPEED = 0.06;

  const camera = new THREE.PerspectiveCamera(isSmallScreen ? 66 : 45, width / height, 0.1, 120);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_CAM_TARGET);

  // Mobile: antialias OFF and DPR capped at 1.25 — the two biggest fill-rate
  // costs on phone GPUs (roughly doubles headroom on older iPhones); at
  // street-scene distances the visual difference is negligible.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isSmallScreen, powerPreference: "high-performance" });
  } catch (err) {
    activatePosterFallback("WebGLRenderer threw: " + err.message, true);
    return;
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.25 : 2));
  // GPU killed our context (memory pressure — routine on iPhones): the canvas
  // would otherwise silently freeze or go blank. Swap to the poster instead.
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    activatePosterFallback("WebGL context lost", true);
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Film-look grading; sky/sun/moon/star materials opt out (toneMapped=false)
  // so the calibrated day/night color stops stay exact.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  // True directional shadows on desktop — the single biggest realism upgrade.
  // Phones use per-figure contact blobs instead (shadow pass + skinned crowd
  // is too heavy for mobile GPUs).
  renderer.shadowMap.enabled = !isSmallScreen;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cursor = "default";
  mount.appendChild(renderer.domElement);

  // ---- Lighting ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  // "sun" doubles as the moonlight source at night — same directional light,
  // its color/intensity/position are re-driven every frame by the time-of-day.
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(4, 8, 6);
  if (!isSmallScreen) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.28);
  fill.position.set(-5, 3, -4);
  scene.add(fill);
  const hemi = new THREE.HemisphereLight(0x8fc6f0, 0x8f887e, 0.4);
  scene.add(hemi);

  // ---- Sky backdrop — a plane whose color is driven by real local time ----
  const bgGeo = new THREE.PlaneGeometry(140, 70);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x8fc6f0, depthWrite: false, fog: false });
  bgMat.toneMapped = false;
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 12, -30);
  scene.add(bgMesh);

  // ---- Stars: small white points that fade in at night only ----
  const STAR_COUNT = isSmallScreen ? 160 : 320;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = (Math.random() - 0.5) * 70;
    const y = 2.5 + Math.random() * 9; // keep inside the visible sky band
    const z = -24 - Math.random() * 10;
    starPositions.set([x, y, z], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0, depthWrite: false, fog: false });
  starMat.toneMapped = false;
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Soft radial texture shared by celestial halos, contact shadows and lamp
  // pools — a feathered gradient, never a hard-edged disc.
  const radialTex = makeRadialTexture();

  // ---- Sun disc — small hot core + feathered atmospheric glow ----
  const sunGeo = new THREE.CircleGeometry(1.05, 40);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 1, depthWrite: false, fog: false });
  sunMat.toneMapped = false;
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  const sunHaloMat = new THREE.MeshBasicMaterial({ map: radialTex, color: 0xffd98a, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  sunHaloMat.toneMapped = false;
  const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), sunHaloMat);
  sunHalo.position.z = -0.05;
  sunDisc.add(sunHalo);
  // Phones: 1.4x — sized for the narrow portrait frame so the sun/moon stay
  // readable celestial anchors instead of distant dots.
  if (isSmallScreen) sunDisc.scale.setScalar(1.4);
  scene.add(sunDisc);

  // ---- Moon disc with feathered cool glow ----
  const moonGeo = new THREE.CircleGeometry(0.95, 40);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf3f6ff, transparent: true, opacity: 1, depthWrite: false, fog: false });
  moonMat.toneMapped = false;
  const moonDisc = new THREE.Mesh(moonGeo, moonMat);
  const moonHaloMat = new THREE.MeshBasicMaterial({ map: radialTex, color: 0xaebeff, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  moonHaloMat.toneMapped = false;
  const moonHalo = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), moonHaloMat);
  moonHalo.position.z = -0.05;
  moonDisc.add(moonHalo);
  if (isSmallScreen) moonDisc.scale.setScalar(1.4);
  scene.add(moonDisc);

  // ---- Ground / road / sidewalks / curbs ----
  const groundGeo = new THREE.PlaneGeometry(70, 70);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !isSmallScreen;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(), roughness: 0.98 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 44), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.002;
  road.receiveShadow = !isSmallScreen;
  scene.add(road);

  // Center dashed lane line — merged into one mesh.
  const dashGeos = [];
  for (let z = -14; z <= 10; z += 3) {
    const dash = new THREE.PlaneGeometry(0.08, 1.2);
    dash.rotateX(-Math.PI / 2);
    dash.translate(0, 0.004, z);
    dashGeos.push(dash);
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xdad5c8, transparent: true, opacity: 0.32 });
  scene.add(new THREE.Mesh(mergeGeometries(dashGeos), dashMat));

  const pavementMat = new THREE.MeshStandardMaterial({ map: makePavementTexture(), roughness: 0.95 });
  [-1, 1].forEach((side) => {
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.8, SIDEWALK_H, 44), pavementMat);
    walkway.position.set(side * (ROAD_HALF + 0.12 + 1.4), SIDEWALK_H / 2, 0);
    walkway.receiveShadow = !isSmallScreen;
    scene.add(walkway);
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, SIDEWALK_H + 0.02, 44),
      new THREE.MeshStandardMaterial({ color: 0x9a958b, roughness: 0.9 })
    );
    curb.position.set(side * (ROAD_HALF + 0.07), (SIDEWALK_H + 0.02) / 2, 0);
    curb.receiveShadow = !isSmallScreen;
    scene.add(curb);
  });

  // ---- Crosswalk (zebra bars span the road at CROSS_Z) ----
  const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.6 });
  const zebraGeos = [];
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.PlaneGeometry(ROAD_HALF * 2 - 0.2, 0.42);
    bar.rotateX(-Math.PI / 2);
    bar.translate(0, 0.006, CROSS_Z + i * 0.78);
    zebraGeos.push(bar);
  }
  scene.add(new THREE.Mesh(mergeGeometries(zebraGeos), crosswalkMat));

  // ---- Pedestrian signals: one pole each side of the crosswalk ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.7, metalness: 0.3 });
  const signalRedMats = [];
  const signalGreenMats = [];
  [[CURB_WAIT_X + 0.25, CROSS_Z - 1.35], [-(CURB_WAIT_X + 0.25), CROSS_Z + 1.35]].forEach(([px, pz]) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 8), poleMat);
    pole.position.y = 1.3;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.14), poleMat);
    head.position.y = 2.55;
    g.add(head);
    const mkLight = (color, y) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 });
      m.toneMapped = false;
      // Small light plate on both faces so it reads from every angle.
      [1, -1].forEach((f) => {
        const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), m);
        dot.position.set(0, y, f * 0.075);
        if (f < 0) dot.rotation.y = Math.PI;
        g.add(dot);
      });
      return m;
    };
    signalRedMats.push(mkLight(0xff5449, 2.66));
    signalGreenMats.push(mkLight(0x4dff88, 2.45));
    g.position.set(px, SIDEWALK_H, pz);
    scene.add(g);
  });

  // ---- Streetlamps: slim poles with warm heads + night light pools ----
  const lampGlowMats = [];
  const lampPoolMats = [];
  [-9, -3, 3].forEach((lz) => {
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.1, 8), poleMat);
      pole.position.y = 1.55;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.05), poleMat);
      arm.position.set(-side * 0.25, 3.08, 0);
      g.add(arm);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0 });
      bulbMat.toneMapped = false;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), bulbMat);
      bulb.position.set(-side * 0.5, 3.02, 0);
      g.add(bulb);
      lampGlowMats.push(bulbMat);
      const poolMat = new THREE.MeshBasicMaterial({
        map: radialTex, color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false,
      });
      poolMat.toneMapped = false;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(-side * 0.5, 0.012 - SIDEWALK_H, 0);
      g.add(pool);
      lampPoolMats.push(poolMat);
      g.position.set(side * 2.6, SIDEWALK_H, lz);
      scene.add(g);
    });
  });

  // ---- Planters with clipped dark shrubs along the sidewalk back edge ----
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.9 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1 });
  [-6, 0, 6].forEach((pz) => {
    [-1, 1].forEach((side) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.7), planterMat);
      box.position.set(side * 4.7, SIDEWALK_H + 0.17, pz);
      box.castShadow = !isSmallScreen;
      scene.add(box);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), bushMat);
      bush.scale.y = 0.72;
      bush.position.set(side * 4.7, SIDEWALK_H + 0.5, pz);
      bush.castShadow = !isSmallScreen;
      scene.add(bush);
    });
  });

  // ---- Traffic: cars in two lanes, yielding to the pedestrian signal ----
  // Achromatic bodies (brand palette). Cars brake for the crosswalk while
  // pedestrians cross (signal green) and go on red; they follow each other so
  // they never overlap; headlights/taillights glow from dusk on the same
  // curve as the streetlamps. Spawned synchronously so traffic is present
  // even before the human GLBs finish loading.
  const carHeadlightMats = [];
  const carTaillightMats = [];
  const cars = [];
  const CAR_LANES = [{ x: 1.05, dir: 1 }, { x: -1.05, dir: -1 }];
  const CAR_BODY_COLORS = [0x111111, 0x2b2f36, 0xe8e8e8, 0x9aa0a6];
  const CW_LO = 0.2, CW_HI = 3.8;            // crosswalk footprint along z
  const CAR_HALF = 0.95;                      // half the car's length
  const CAR_Z_BACK = -20, CAR_Z_FRONT = 12;  // loop range along the street
  const CAR_PER_LANE = isSmallScreen ? 1 : 2;

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 });
  const carGlassMat = new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.25, metalness: 0.4 });
  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12);
  wheelGeo.rotateZ(Math.PI / 2); // axle along X so mesh.rotation.x rolls the wheel

  function createCar(bodyColor) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.35 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 1.9), paint);
    body.position.y = 0.36;
    body.castShadow = !isSmallScreen;
    group.add(body);
    body.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    ));

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.3, 0.95), carGlassMat);
    cabin.position.set(0, 0.62, -0.05);
    cabin.castShadow = !isSmallScreen;
    group.add(cabin);

    const wheels = [];
    [[-0.46, 0.6], [0.46, 0.6], [-0.46, -0.6], [0.46, -0.6]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.17, wz);
      w.castShadow = !isSmallScreen;
      group.add(w);
      wheels.push(w);
    });

    // Headlights face +Z (front, travel direction); taillights face -Z (rear).
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 });
    hlMat.toneMapped = false;
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.2 });
    tlMat.toneMapped = false;
    [-0.28, 0.28].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), hlMat);
      hl.position.set(hx, 0.34, 0.96);
      group.add(hl);
      const tl = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), tlMat);
      tl.position.set(hx, 0.36, -0.96);
      tl.rotation.y = Math.PI;
      group.add(tl);
    });
    carHeadlightMats.push(hlMat);
    carTaillightMats.push(tlMat);

    return { group, wheels };
  }

  CAR_LANES.forEach(({ x, dir }) => {
    for (let i = 0; i < CAR_PER_LANE; i++) {
      const car = createCar(CAR_BODY_COLORS[cars.length % CAR_BODY_COLORS.length]);
      car.group.rotation.y = dir > 0 ? 0 : Math.PI;
      const span = CAR_Z_FRONT - CAR_Z_BACK;
      car.z = CAR_Z_BACK + ((i + Math.random() * 0.6) / CAR_PER_LANE) * span;
      car.lane = x;
      car.dir = dir;
      car.cruise = (isSmallScreen ? 3.2 : 3.6) + Math.random() * 1.2;
      car.speed = car.cruise;
      car.group.position.set(x, 0.01, car.z);
      scene.add(car.group);
      cars.push(car);
    }
  });

  function stepCars(t, dt, sig) {
    const green = sig.green; // pedestrians crossing -> cars must yield
    cars.forEach((car) => {
      let target = car.cruise;

      // Yield to the crosswalk: ease down over the last 5 units, stop at the line.
      if (green) {
        if (car.dir > 0 && car.z < CW_LO) {
          const dist = (CW_LO - CAR_HALF - 0.1) - car.z;
          if (dist < 5) target = Math.min(target, car.cruise * Math.max(0, dist / 5));
          if (dist < 0.3) target = 0;
        } else if (car.dir < 0 && car.z > CW_HI) {
          const dist = car.z - (CW_HI + CAR_HALF + 0.1);
          if (dist < 5) target = Math.min(target, car.cruise * Math.max(0, dist / 5));
          if (dist < 0.3) target = 0;
        }
      }

      // Car-following: never rear-end the car ahead in the same lane.
      let leadGap = Infinity;
      cars.forEach((o) => {
        if (o === car || o.dir !== car.dir || Math.abs(o.lane - car.lane) > 0.1) return;
        const ahead = (o.z - car.z) * car.dir;
        if (ahead > 0) leadGap = Math.min(leadGap, ahead);
      });
      if (leadGap < 2.6) target = Math.min(target, car.cruise * Math.max(0, (leadGap - 2.2) / 0.4));
      if (leadGap < 2.2) target = 0;

      car.speed += (target - car.speed) * Math.min(1, 3 * dt);
      car.z += car.dir * car.speed * dt;

      // Hard clamp at the stop line so a car never rolls onto the zebra on green.
      if (green) {
        if (car.dir > 0 && car.z < CW_LO) car.z = Math.min(car.z, CW_LO - CAR_HALF - 0.1);
        else if (car.dir < 0 && car.z > CW_HI) car.z = Math.max(car.z, CW_HI + CAR_HALF + 0.1);
      }

      // Loop back to the far end once it drives off frame.
      if (car.dir > 0 && car.z > CAR_Z_FRONT) car.z = CAR_Z_BACK - Math.random() * 3;
      else if (car.dir < 0 && car.z < CAR_Z_BACK) car.z = CAR_Z_FRONT + Math.random() * 3;

      car.group.position.z = car.z;
      const roll = (car.speed * dt) / 0.17;
      car.wheels.forEach((w) => { w.rotation.x += roll; });
    });
  }

  // ---- The towers: two near rows flanking the street + a far skyline row ----
  const buildingEdgeMaterials = [];
  const buildingFacadeMaterials = [];
  const allWindowDots = [];
  let paletteCounter = 0;
  [-1, 1].forEach((side) => {
    [[-7, 4.5, 3.5], [-11, 7, 4.5]].forEach(([z, hBase, hVar]) => {
      for (let j = 0; j < 2; j++) {
        const w = 2.4 + Math.random() * 1.2;
        const h = hBase + Math.random() * hVar;
        const d = 2.4 + Math.random() * 0.9;
        const tower = createTower(w, h, d, paletteCounter++, -side);
        tower.group.position.x = side * (6.0 + j * 3.5 + Math.random() * 0.4);
        tower.group.position.z = z + (Math.random() - 0.5) * 1.2;
        scene.add(tower.group);
        buildingFacadeMaterials.push(tower.facadeMaterial);
        buildingEdgeMaterials.push(tower.edgeMaterial);
        if (tower.windowDotMaterial) allWindowDots.push(tower.windowDotMaterial);
      }
    });
  });
  // Far skyline slabs — fogged silhouettes that give the district depth.
  // Every slot keeps |x| ≥ 5: the street corridor (road x ∈ [-2.2, 2.2])
  // visually runs to the horizon, so a tower near x=0 reads as standing in
  // the middle of the road. Jitter is outward-only for the same reason.
  [-12.5, -8, -5, 5, 9.5].forEach((fx) => {
    const h = 9 + Math.random() * 5;
    const tower = createTower(2.2 + Math.random() * 1.4, h, 2.4, paletteCounter++, 0);
    tower.group.position.set(fx + Math.sign(fx) * Math.random() * 0.6, 0, -17 - Math.random() * 2.5);
    scene.add(tower.group);
    buildingFacadeMaterials.push(tower.facadeMaterial);
    buildingEdgeMaterials.push(tower.edgeMaterial);
    if (tower.windowDotMaterial) allWindowDots.push(tower.windowDotMaterial);
  });

  // ---------------------------------------------------------------------
  // Human cast. Real rigged Mixamo humans; stylized procedural fallback if
  // any GLB fails so the hero never shows a blank scene.
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

  // Measure how fast the walk clip's root motion covers ground (world
  // units/sec at the rig's native scale) by sampling the hips bone at the
  // clip's start and end. Must run BEFORE stripRootMotion pins the hips.
  // Movement code drives walkers at exactly this speed (times the figure's
  // world scale) so feet grip the pavement instead of sliding.
  function measureStrideSpeed(gltfScene, clip) {
    const hips = findBoneByName(gltfScene, "hips");
    if (!hips || !clip.duration) return 0;
    const mixer = new THREE.AnimationMixer(gltfScene);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(0);
    gltfScene.updateMatrixWorld(true);
    const p0 = hips.getWorldPosition(new THREE.Vector3());
    mixer.setTime(clip.duration - 0.001);
    gltfScene.updateMatrixWorld(true);
    const p1 = hips.getWorldPosition(new THREE.Vector3());
    mixer.stopAllAction();
    mixer.setTime(0);
    gltfScene.updateMatrixWorld(true);
    return Math.hypot(p1.x - p0.x, p1.z - p0.z) / clip.duration;
  }

  // Pin the hips' X/Z to the first keyframe so clips play "in place" — path
  // code owns world movement; root motion in the clip would cause sliding.
  // Y is ALWAYS clamped to a safe band around the first keyframe (default
  // ±0.5 raw units — generous enough for any natural bob/bounce/fall, but a
  // hard ceiling against a figure's hips ever drifting far from the ground).
  // This exists because the trip clip's un-stripped Y motion once launched
  // figures into a floating mid-air pose; rather than special-case just that
  // one clip, every clip gets the same guarantee so this class of bug (any
  // clip, any browser/engine quirk) is structurally prevented, not patched
  // one incident at a time. Pass a tighter/asymmetric [min, max] to allow a
  // specific clip more room in one direction (e.g. trip's fall).
  function stripRootMotion(clip, yRange) {
    const [lo, hi] = yRange || [-0.5, 0.5];
    clip.tracks.forEach((tr) => {
      if (!/\.position$/.test(tr.name) || !/hips/i.test(tr.name)) return;
      const v = tr.values;
      const x0 = v[0], y0 = v[1], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
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

  // Dress a character in a product tee: dye the whole shirt the tee's actual
  // fabric color (sampled from the product photo), then print the photo's
  // graphic region onto the chest with feathered edges — so the figure is
  // wearing the tee, not displaying a picture of one.
  function sampleFabricColor(teeImage) {
    const s = document.createElement("canvas");
    s.width = 3;
    s.height = 1;
    const sg = s.getContext("2d");
    // Three fabric points well away from the center print; average them.
    const pts = [[0.25, 0.7], [0.75, 0.7], [0.5, 0.85]];
    pts.forEach(([fx, fy], i) => {
      sg.drawImage(teeImage, teeImage.width * fx - 4, teeImage.height * fy - 4, 8, 8, i, 0, 1, 1);
    });
    const d = sg.getImageData(0, 0, 3, 1).data;
    const r = Math.round((d[0] + d[4] + d[8]) / 3);
    const gch = Math.round((d[1] + d[5] + d[9]) / 3);
    const b = Math.round((d[2] + d[6] + d[10]) / 3);
    return "rgb(" + r + "," + gch + "," + b + ")";
  }

  function makeTeeTexture(baseImage, teeImage, spec) {
    const size = (baseImage && baseImage.width) || 1024;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = teeImage ? sampleFabricColor(teeImage) : "#f2f1ee";
    g.fillRect(0, 0, size, size);
    if (teeImage) {
      // Print patch: the graphic band in the middle of the flat-lay photo,
      // edges feathered so it melts into the same-colored fabric fill.
      const sx = Math.round(teeImage.width * 0.25);
      const sy = Math.round(teeImage.height * 0.3);
      const sw = Math.round(teeImage.width * 0.5);
      const sh = Math.round(teeImage.height * 0.34);
      const patch = document.createElement("canvas");
      patch.width = sw;
      patch.height = sh;
      const pg = patch.getContext("2d");
      pg.drawImage(teeImage, sx, sy, sw, sh, 0, 0, sw, sh);
      pg.globalCompositeOperation = "destination-in";
      const grad = pg.createRadialGradient(sw / 2, sh / 2, Math.min(sw, sh) * 0.3, sw / 2, sh / 2, Math.max(sw, sh) * 0.6);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      pg.fillStyle = grad;
      pg.fillRect(0, 0, sw, sh);

      const k = size / 1024; // spec coords are in 1024-space
      const rw = spec.w * k, rh = spec.h * k;
      const s = Math.min(rw / sw, rh / sh) * 1.15; // slight overshoot; feathered edges tolerate it
      const dw = sw * s, dh = sh * s;
      g.save();
      g.translate((spec.x + spec.w / 2) * k, (spec.y + spec.h / 2) * k);
      if (spec.rot) g.rotate(spec.rot);
      g.drawImage(patch, -dw / 2, -dh / 2, dw, dh);
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
    let s = desiredHeight / rigHeight;
    // Safety clamp: if bone-name matching ever grabs the wrong bone (e.g. an
    // ambiguous "head"/"foot" substring match) the measured rigHeight can
    // collapse toward the 0.01 floor above, exploding this scale to 100x+
    // normal — a giant figure towering over the whole street. Real Mixamo
    // exports (cm, m, or inch unit conventions) all land well inside
    // [0.05, 3.0], so anything outside that is treated as a bad measurement.
    if (s < 0.05 || s > 3.0) {
      console.warn("EL VYNCE hero: fitHuman got an implausible scale (" + s.toFixed(3) + "), clamping — check bone names on this rig.");
      s = THREE.MathUtils.clamp(s, 0.05, 3.0);
    }
    group.scale.setScalar(s);
    // Feet flat on pavement: toe bone sits ~2cm above the sole.
    root.position.y = -(toeY - 0.02 * rigHeight);
    return s;
  }

  // Models are Draco-compressed (8.9MB → 4.0MB — the single biggest mobile
  // load-time win). Decoder comes from the same CDN as the import-map three.
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const imageLoader = new THREE.ImageLoader();
  function loadGLB(url) {
    return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
  }
  function loadImage(url) {
    return new Promise((resolve) => imageLoader.load(url, resolve, undefined, () => resolve(null)));
  }

  const contactShadowMats = [];

  function buildHuman(spec, base, walkClip, teeImage, baseShirtImage) {
    const cloned = skeletonClone(base.scene);
    const group = new THREE.Group();
    group.add(cloned);
    const sizeScale = fitHuman(cloned, group, spec.height);

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

    if (!isSmallScreen) {
      // Desktop: figures cast true sun shadows.
      cloned.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) o.castShadow = true;
      });
    } else {
      // Mobile: soft contact blob grounds the figure without a shadow pass.
      const blobMat = new THREE.MeshBasicMaterial({
        map: radialTex, color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false,
      });
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.015;
      blob.scale.setScalar(1 / Math.max(0.0001, sizeScale));
      group.add(blob);
      contactShadowMats.push(blobMat);
    }

    const mixer = new THREE.AnimationMixer(cloned);
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
    if (walkAction) {
      walkAction.play();
      walkAction.time = Math.random() * (walkClip.duration || 1);
      mixer.update(0);
    }
    return { group, mixer, cloned, walkAction, sizeScale, isStylized: false };
  }

  function randomLane(side) {
    return side * (LANE_MIN + Math.random() * (LANE_MAX - LANE_MIN));
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

  // ---- Rush-hour behavior engine ----
  // Every walker runs a state machine (walk / pause / turn / event /
  // waitSignal / cross) with eased acceleration so nobody starts or stops
  // like a machine. The walk clip's playback rate is slaved to actual ground
  // speed, keeping stride physically glued to the pavement at every velocity.
  let eventClips = {}; // per-prefix retargeted { trip }

  function startEvent(npc, t, kind) {
    const lib = eventClips[npc.rigPrefix];
    const clip = lib && lib[kind];
    if (!clip) return false;
    const action = npc.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    npc.walkAction.crossFadeTo(action, 0.35, false);
    action.play();
    npc.state = "event";
    npc.eventType = kind;
    npc.eventStart = t;
    npc.eventUntil = t + clip.duration - 0.35; // plays its full stumble-fall-recover arc
    npc.eventAction = action;
    npc.eventCooldownUntil = npc.eventUntil + 25 + Math.random() * 40;
    return true;
  }

  function endEvent(npc) {
    if (npc.eventAction) {
      npc.walkAction.reset();
      npc.walkAction.play();
      npc.eventAction.crossFadeTo(npc.walkAction, 0.35, false);
      npc.eventAction = null;
    }
    npc.state = "walk";
    npc.targetSpeed = npc.cruise;
  }

  function beginCross(npc) {
    npc.state = "cross";
    npc.crossDirX = -npc.side;
    npc.targetSpeed = npc.cruise * 1.12; // people cross briskly
    npc.zCrossDrift = (Math.random() - 0.5) * 0.15;
  }

  function stepHuman(npc, t, dt, sig) {
    // Eased speed — nobody snaps between standing and full stride.
    npc.speed += (npc.targetSpeed - npc.speed) * Math.min(1, 3.2 * dt);
    // Stride sync: clip rate follows true ground speed (physics, not loops).
    npc.walkAction.timeScale = THREE.MathUtils.clamp(npc.speed / npc.strideSpeed, 0.05, 2.2);

    if (npc.state === "walk") {
      npc.targetSpeed = npc.cruise;
      npc.zPos += npc.dir * npc.speed * dt;
      // Drift back to the personal lane (also re-blends after a crossing).
      npc.xPos += ((npc.lane + Math.sin(npc.zPos * 0.5 + npc.walkPhase) * 0.16) - npc.xPos) * Math.min(1, 4 * dt);

      // Crosswalk decision: commuters near the crosswalk may head across —
      // immediately on a fresh green, or gather at the curb through a red.
      if (npc.canCross && t > npc.crossCooldownUntil && Math.abs(npc.zPos - CROSS_Z) < 0.5) {
        npc.crossCooldownUntil = t + 20 + Math.random() * 30;
        if (Math.random() < 0.55) {
          if (sig.green && sig.timeLeft > 4.5) {
            beginCross(npc);
          } else {
            npc.state = "waitSignal";
            npc.waitStart = t;
            npc.waitFromRot = npc.group.rotation.y;
            // Spread the waiting cluster: along the curb AND a step back for
            // some — a loose human huddle, not a stacked queue.
            npc.crossJitter = (Math.random() - 0.5) * 2.2;
            npc.waitX = CURB_WAIT_X + Math.random() * 0.55;
            npc.targetSpeed = 0;
          }
        }
      }

      // Reached the end of the block: slow down and turn around like a person.
      if (npc.state === "walk" && ((npc.dir > 0 && npc.zPos > WALK_Z_MAX) || (npc.dir < 0 && npc.zPos < WALK_Z_MIN))) {
        npc.state = "turn";
        npc.turnStart = t;
        npc.turnFrom = npc.dir > 0 ? 0 : Math.PI;
        npc.turnTo = npc.dir > 0 ? Math.PI : 0;
        npc.dir *= -1;
        npc.targetSpeed = npc.cruise * 0.3;
      } else if (npc.state === "walk" && t > npc.eventCooldownUntil) {
        // Street-life moments, framerate-independent probabilities. Office
        // crowds are graceful: trips are rare; pauses (a phone buzz, a
        // thought) are the everyday beat.
        if (Math.random() < dt / 90) startEvent(npc, t, "trip");
        else if (Math.random() < dt * npc.pauseChance) {
          npc.state = "pause";
          npc.pauseUntil = t + npc.pauseDur[0] + Math.random() * (npc.pauseDur[1] - npc.pauseDur[0]);
          npc.targetSpeed = 0;
          npc.eventCooldownUntil = npc.pauseUntil + 15 + Math.random() * 20;
        }
      }
      if (npc.state === "walk" || npc.state === "pause") {
        // Rigs face +Z at rotation 0 (verified empirically — do NOT flip).
        npc.group.rotation.y = (npc.dir > 0 ? 0 : Math.PI) + Math.sin(t * 0.7 + npc.walkPhase) * 0.05;
      }
    } else if (npc.state === "turn") {
      const k = Math.min(1, (t - npc.turnStart) / 0.8);
      // Ease the body around; keep drifting forward slightly mid-turn.
      npc.group.rotation.y = npc.turnFrom + (npc.turnTo - npc.turnFrom) * smoothstep01(k);
      npc.zPos += npc.dir * npc.speed * dt * 0.4;
      npc.xPos += (npc.lane - npc.xPos) * Math.min(1, 2 * dt);
      if (k >= 1) {
        npc.state = "walk";
        npc.targetSpeed = npc.cruise;
      }
    } else if (npc.state === "pause") {
      if (t > npc.pauseUntil) {
        npc.state = "walk";
        npc.targetSpeed = npc.cruise;
      }
      npc.group.rotation.y = (npc.dir > 0 ? 0 : Math.PI) + Math.sin(t * 0.7 + npc.walkPhase) * 0.05;
    } else if (npc.state === "waitSignal") {
      // Turn to face the road, shuffle up to the curb, wait for the green.
      npc.targetSpeed = 0;
      const k = Math.min(1, (t - npc.waitStart) / 0.7);
      const face = npc.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const to = npc.waitFromRot + shortestAngle(face - npc.waitFromRot);
      npc.group.rotation.y = npc.waitFromRot + (to - npc.waitFromRot) * smoothstep01(k);
      npc.xPos += (npc.side * npc.waitX - npc.xPos) * Math.min(1, 1.6 * dt);
      npc.zPos += ((CROSS_Z + npc.crossJitter) - npc.zPos) * Math.min(1, 1.6 * dt);
      // Green: release with a small random stagger — a human wave, not a drill.
      if (sig.green && k >= 1 && Math.random() < dt * 3) beginCross(npc);
    } else if (npc.state === "cross") {
      npc.targetSpeed = npc.cruise * 1.12;
      npc.xPos += npc.crossDirX * npc.speed * dt;
      npc.zPos += npc.zCrossDrift * dt;
      npc.group.rotation.y = (npc.crossDirX > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(t * 0.9 + npc.walkPhase) * 0.04;
      if (npc.xPos * npc.crossDirX >= LANE_MIN) {
        // Reached the far sidewalk: adopt it and rejoin the stream.
        npc.side = -npc.side;
        npc.lane = randomLane(npc.side);
        npc.dir = Math.random() < 0.5 ? 1 : -1;
        npc.state = "turn";
        npc.turnStart = t;
        npc.turnFrom = npc.group.rotation.y;
        const to = npc.dir > 0 ? 0 : Math.PI;
        npc.turnTo = npc.turnFrom + shortestAngle(to - npc.turnFrom);
        npc.targetSpeed = npc.cruise * 0.5;
      }
    } else if (npc.state === "event") {
      if (npc.eventType === "trip") {
        // Stumble physics: momentum carries the body forward hard for the
        // first half-second, bleeds off as they go down, dead stop while
        // fallen, then they get up (walk state resumes with eased speed).
        const et = t - npc.eventStart;
        npc.targetSpeed = et < 0.5 ? npc.cruise * 1.45 : et < 1.0 ? npc.cruise * 0.4 : 0;
        npc.zPos += npc.dir * npc.speed * dt;
      } else {
        npc.targetSpeed = 0;
      }
      if (t > npc.eventUntil) endEvent(npc);
    }

    npc.group.position.set(npc.xPos, pavementY(npc.xPos), npc.zPos);
  }

  // Personal space: same-sidewalk walkers drift apart when they'd overlap.
  function resolveCrowding(walkers, dt) {
    for (let i = 0; i < walkers.length; i++) {
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j];
        if (a.side !== b.side) continue;
        const dz = Math.abs(a.zPos - b.zPos);
        const dx = a.lane - b.lane;
        if (dz < 1.0 && Math.abs(dx) < 0.7) {
          const push = (dx >= 0 ? 1 : -1) * 0.6 * dt;
          const lo = a.side > 0 ? LANE_MIN : -LANE_MAX;
          const hi = a.side > 0 ? LANE_MAX : -LANE_MIN;
          a.lane = THREE.MathUtils.clamp(a.lane + push, lo, hi);
          b.lane = THREE.MathUtils.clamp(b.lane - push, lo, hi);
        }
      }
    }
  }

  Promise.all([
    loadGLB(PEOPLE.remy.url),
    loadGLB(PEOPLE.woman.url),
    loadGLB(PEOPLE.dancer.url),
    loadGLB(ANIM_URLS.trip).catch(() => null),
    Promise.all(SHIRT_PRODUCTS.map((p) => loadImage(p.image))),
  ]).then(([remyG, womanG, dancerG, tripG, teeImages]) => {
    usingGLTFHumans = true;

    // Ground speed baked into the walk clip, measured before pinning the hips.
    const strideRaw = measureStrideSpeed(remyG.scene, remyG.animations[0]);
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

    // Event clip library, retargeted per rig prefix. Trip gets a wider,
    // asymmetric band so the stumble's downward "falling" dip still reads,
    // while still forbidding any upward float.
    const tripClip = tripG && stripRootMotion(tripG.animations[0], [-0.5, 0.08]);
    const buildLib = (root, prefix) => ({
      trip: tripClip && retargetClip(tripClip, ANIM_SOURCE_PREFIX, prefix, root),
    });

    // Wardrobe logic: a design marked femaleOnly (the crop top) must never be
    // composited onto the male rig. Men draw from the unisex list; women draw
    // from a list with the female-only pieces FIRST so those designs still
    // appear on the street (there are fewer women than men in the cast).
    const outfits = SHIRT_PRODUCTS.map((p, idx) => ({ ...p, teeImage: teeImages[idx] }));
    const maleOutfits = outfits.filter((o) => !o.femaleOnly);
    const femaleOutfits = [...outfits.filter((o) => o.femaleOnly), ...outfits.filter((o) => !o.femaleOnly)];
    let maleCursor = 0;
    let femaleCursor = 0;

    // ---- The commuter stream ----
    for (let i = 0; i < WALKER_COUNT; i++) {
      const useWoman = i % 3 === 2; // every third commuter is the woman
      const spec = useWoman ? PEOPLE.woman : PEOPLE.remy;
      const src = useWoman ? womanG : remyG;
      const shirtImg = useWoman ? womanShirtImg : remyShirtImg;
      const walk = useWoman
        ? retargetClip(walkRemy, PEOPLE.remy.prefix, PEOPLE.woman.prefix, src.scene)
        : walkRemy;
      const outfit = useWoman
        ? femaleOutfits[femaleCursor++ % femaleOutfits.length]
        : maleOutfits[maleCursor++ % maleOutfits.length];
      const fig = buildHuman(spec, src, walk, outfit.teeImage, shirtImg);
      const baseSpeed = strideRaw > 0.01
        ? strideRaw * fig.sizeScale
        : 1.25 * (spec.height / 1.75); // fallback if the clip was exported in-place

      // Archetypes: the coffee walker owns the morning at 60% pace; the
      // phone-checker keeps stopping to read something important; everyone
      // else strides with purpose at their own pace.
      const isCoffee = i === 1;
      const isPhone = i === 4;
      const pace = isCoffee ? 0.58 : 0.92 + Math.random() * 0.28;
      const side = i % 2 === 0 ? 1 : -1;
      const npc = spawnNpcCommon(fig, i, {
        rigPrefix: spec.prefix,
        strideSpeed: baseSpeed, // ground speed the clip covers at timeScale 1
        cruise: baseSpeed * pace, // this person's preferred walking speed
        speed: 0, // everyone eases in from standstill
        targetSpeed: baseSpeed * pace,
        state: "walk",
        side,
        lane: randomLane(side),
        dir: (i >> 1) % 2 === 0 ? 1 : -1,
        zPos: WALK_Z_MIN + Math.random() * (WALK_Z_MAX - WALK_Z_MIN),
        canCross: !isCoffee && !isPhone && i % 2 === 0,
        crossCooldownUntil: Math.random() * 25,
        pauseChance: isPhone ? 1 / 12 : 1 / 45,
        pauseDur: isPhone ? [4, 9] : [1.2, 3.2],
        commuterIndex: i,
      });
      npc.xPos = npc.lane;
      npc.productId = outfit.id; // click-through matches the tee actually worn
      if (!eventClips[spec.prefix]) eventClips[spec.prefix] = buildLib(fig.cloned, spec.prefix);
    }
    window.__EV_DEBUG.strideRaw = strideRaw;

    // ---- Street performer: every district has one artist ----
    const danceClip = stripRootMotion(dancerG.animations[0]);
    const dancerFig = buildHuman(PEOPLE.dancer, dancerG, danceClip, null, null);
    const dNpc = spawnNpcCommon(dancerFig, WALKER_COUNT, {
      rigPrefix: PEOPLE.dancer.prefix,
      static: true,
      alwaysAnimate: true,
    });
    // z=0 sits squarely between the streetlamps at z=-3 and z=3 (3 units of
    // clearance from each) so the dancer's arm swing never clips a pole.
    dNpc.group.position.set(isSmallScreen ? 2.7 : 3.1, SIDEWALK_H, 0);
    dNpc.group.rotation.y = Math.PI * 0.9; // face the camera, slightly angled

    // ---- Bench sitter: laughing at something on her phone ----
    const sitClip = stripRootMotion(womanG.animations[0]);
    const sitterOutfit = outfits[7]; // Style Pays Off — unisex, matches her click-through
    const sitterFig = buildHuman(PEOPLE.woman, womanG, sitClip, sitterOutfit.teeImage, womanShirtImg);
    const sitter = spawnNpcCommon(sitterFig, WALKER_COUNT + 1, {
      rigPrefix: PEOPLE.woman.prefix,
      static: true,
      alwaysAnimate: true,
    });
    sitter.productId = sitterOutfit.id;
    // Mobile bench sits nearer the curb and crosswalk so the sitter stays
    // inside the reframed portrait view.
    const benchX = isSmallScreen ? -2.6 : -3.8;
    const benchZ = isSmallScreen ? 2.0 : 1.6;
    sitter.group.position.set(benchX, SIDEWALK_H + 0.02, benchZ);
    sitter.group.rotation.y = Math.PI * 0.55; // angled toward the street

    // Minimal dark bench under her — matches the district furniture.
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.9 });
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.5), benchMat);
    seat.position.y = 0.42;
    seat.castShadow = !isSmallScreen;
    bench.add(seat);
    [-0.6, 0.6].forEach((bx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.42), benchMat);
      leg.position.set(bx, 0.21, 0);
      bench.add(leg);
    });
    bench.position.set(benchX, SIDEWALK_H, benchZ);
    bench.rotation.y = sitter.group.rotation.y;
    scene.add(bench);
    window.__EV_DEBUG.sitter = sitter;
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

  // ---- Scroll-linked camera pull-back + brand stamp reveal ----
  let scrollProgress = 0;
  function updateScrollProgress() {
    if (!heroHeader) return;
    const rect = heroHeader.getBoundingClientRect();
    const total = rect.height || window.innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / total));
    scrollProgress = p;
    // The spinning stamp stays out of the hero's way; it fades in once the
    // visitor scrolls into the catalogue.
    document.body.classList.toggle("ev-stamp-in", p > 0.55);
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
    const visibleNpcs = npcs.filter((n) => !n.hidden);
    const targets = visibleNpcs.map((n) => n.group);
    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !visibleNpcs.find((n) => n.group === obj)) obj = obj.parent;
    return obj ? visibleNpcs.find((n) => n.group === obj) : null;
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

  // ---- Pedestrian signal state (time-based, drives lights + crossings) ----
  function signalStateAt(t) {
    const c = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    return {
      green: c < SIGNAL_GREEN,
      timeLeft: c < SIGNAL_GREEN ? SIGNAL_GREEN - c : SIGNAL_CYCLE - c,
    };
  }
  function updateSignalLights(sig) {
    signalGreenMats.forEach((m) => { m.opacity = sig.green ? 1 : 0.12; });
    signalRedMats.forEach((m) => { m.opacity = sig.green ? 0.12 : 1; });
  }

  // ---- Day/night cycle state (real local clock driven) ----
  const skyColor = new THREE.Color();
  const groundColor = new THREE.Color();
  const lightColor = new THREE.Color();
  const pavementTint = new THREE.Color();
  const WHITE = new THREE.Color(0xffffff);
  let isNightNow = false;
  // Lite mode: set by the FPS watchdog on struggling devices; read by the
  // day/night cycle (crowd cap, stars off). Lives here at scene scope because
  // the watchdog runs inside the animation branch below.
  let liteMode = false;
  const heroLite = () => liteMode;

  function updateDayNightCycle() {
    const hour = getLocalDayFraction(); // 0..24, visitor's real local time
    const nightAmount = nightAmountFor(hour);
    const sunAlt = sunAltitude01(hour);
    const moonAlt = moonAltitude01(hour);

    skyColor.copy(sampleStops(SKY_STOPS, hour));
    bgMat.color.copy(skyColor);
    scene.background.copy(skyColor); // keep canvas background in sync with sky
    // Haze matches the sky so distant towers melt into the morning air.
    scene.fog.color.copy(skyColor);
    // Slight fog-like tint on hemisphere light ground color keeps buildings
    // grounded in the same palette as the sky at each hour.
    hemi.color.copy(skyColor);

    groundColor.copy(sampleStops(GROUND_STOPS, hour));
    groundMat.color.copy(groundColor);
    // Sidewalks read a step lighter than raw ground at every hour.
    pavementTint.copy(groundColor).lerp(WHITE, 0.42);
    pavementMat.color.copy(pavementTint);

    // Sun arcs from horizon (east, sunrise) up and over to horizon (west, sunset);
    // moon arcs oppositely through the night. Arc angle maps each body's altitude
    // window to a 0..PI sweep across the visible sky.
    const sunArc = THREE.MathUtils.clamp((hour - 6) / (18.5 - 6), 0, 1) * Math.PI;
    // Arc peak stays inside the camera frustum (45° FOV, slight downward tilt
    // → sky is only visible up to y≈9 at z=-22; higher and the sun vanishes).
    // Phones lift the arc base: near the horizon the sun/moon sit in the fog
    // band and behind tower rows in the narrow frame — invisible for the
    // first/last hour of their arc.
    sunDisc.position.set(Math.cos(sunArc) * -CELESTIAL_X, (isSmallScreen ? 2.6 : 1.5) + Math.sin(sunArc) * 6.5, -22);
    sunDisc.visible = sunAlt > 0.001;
    sunDisc.material.opacity = Math.min(1, sunAlt * 2.2);
    sunHaloMat.opacity = 0.45 + sunAlt * 0.3;

    let moonHour = hour < 6 ? hour + 24 : hour;
    const moonArc = THREE.MathUtils.clamp((moonHour - 18.5) / (30 - 18.5), 0, 1) * Math.PI;
    moonDisc.position.set(Math.cos(moonArc) * -CELESTIAL_X, (isSmallScreen ? 2.6 : 1.5) + Math.sin(moonArc) * 6.5, -22);
    moonDisc.visible = moonAlt > 0.001;
    moonDisc.material.opacity = Math.min(1, moonAlt * 2.2);
    moonHaloMat.opacity = 0.35 + moonAlt * 0.3;

    // Stars fade in only once night is well underway (keeps a clean transition
    // through dusk before they appear). Lite mode drops them entirely.
    starMat.opacity = heroLite() ? 0 : Math.max(0, (nightAmount - 0.55) / 0.45) * 0.85;

    // Directional "sun" light re-purposes as moonlight at night: warm color +
    // higher intensity by day, cool blue + dim by night, smooth blend between.
    // Its position also drives the true shadow direction on desktop, so
    // morning shadows stretch long and swing across the day.
    lightColor.copy(sampleStops(SUN_LIGHT_COLOR_STOPS, hour));
    sun.color.copy(lightColor);
    sun.position.set(sunDisc.position.x * 0.45, Math.max(3, sunDisc.position.y * 0.9 + moonDisc.position.y * 0.4 * moonAlt), 8);
    sun.intensity = 0.35 + sunAlt * 0.85 + moonAlt * 0.25;
    fill.intensity = 0.18 + sunAlt * 0.14;
    ambient.intensity = 0.28 + sunAlt * 0.32 + moonAlt * 0.12;
    hemi.intensity = 0.25 + sunAlt * 0.25;

    // Window dots: invisible by day, glow warm amber once dusk sets in.
    const windowGlow = Math.max(0, (nightAmount - 0.45) / 0.55);
    allWindowDots.forEach((m) => {
      m.opacity = windowGlow * 0.95;
    });

    // Streetlamps wake at dusk: warm heads + soft pools on the pavement.
    const lampGlow = Math.max(0, (nightAmount - 0.35) / 0.65);
    lampGlowMats.forEach((m) => { m.opacity = lampGlow; });
    lampPoolMats.forEach((m) => { m.opacity = lampGlow * 0.3; });

    // Car lamps wake with the streetlamps; taillights stay faintly lit by day.
    carHeadlightMats.forEach((m) => { m.opacity = lampGlow; });
    carTaillightMats.forEach((m) => { m.opacity = 0.18 + lampGlow * 0.8; });

    // Contact blobs (mobile) soften as the sun drops.
    const blobOpacity = 0.13 + sunAlt * 0.16;
    contactShadowMats.forEach((m) => { m.opacity = blobOpacity; });

    // Building edge lines darken/lighten subtly with time of day for definition
    // against both bright sky and deep night.
    const edgeOpacity = 0.16 + nightAmount * 0.25;
    buildingEdgeMaterials.forEach((m) => { m.opacity = edgeOpacity; });

    // The district breathes on the real clock: rush-hour streams at 6:30-10
    // and 16:30-20, calmer midday, sparse late night.
    if (usingGLTFHumans) {
      const density = crowdDensityFor(hour);
      // Phones keep a floor of 3 — the narrow frame shows a slice of the
      // street, so late-night density that reads "calm" on desktop reads
      // "abandoned" on mobile.
      let active = Math.max(isSmallScreen ? 3 : 2, Math.round(WALKER_COUNT * density));
      if (heroLite()) active = Math.min(active, 3); // skinned crowd is the frame cost
      npcs.forEach((npc) => {
        if (npc.commuterIndex === undefined) return;
        const hide = npc.commuterIndex >= active;
        if (hide !== !!npc.hidden) {
          npc.hidden = hide;
          npc.group.visible = !hide;
        }
      });
    }

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
    const heading = Math.atan2(nx - x, nz - z) + (npc.isStylized ? 0 : Math.PI);

    npc.group.position.set(x, 0, z);
    if (!npc.paused) npc.group.rotation.y = heading;

    return npc.paused ? 0 : 1;
  }

  // ---- Reduced motion: render a single static frame at the visitor's actual
  // current time of day, no animation loop ----
  if (prefersReducedMotion) {
    updateDayNightCycle();
    updateSignalLights(signalStateAt(0));
    renderer.render(scene, camera);
  } else {
    // ---- FPS watchdog: degrade before we die ----
    // CRITICAL timing: only judge STEADY-STATE fps. The first seconds after
    // load are dominated by one-time work that blocks the main thread and
    // tanks the frame rate regardless of GPU power — Draco decode, cloning 8
    // skeletons, compositing 8 tee textures, first-render shader compile. A
    // watchdog that measures that window falsely demotes fast machines. So we
    // don't start counting until the humans are BUILT (usingGLTFHumans) plus a
    // 1.5s settle, and we require TWO consecutive bad windows before acting so
    // a lone GC pause / tab-throttle spike can't trip it.
    //   <22fps sustained -> lite mode (crowd capped at 3, stars off)
    //   <10fps twice     -> retire to poster (NON-persistent: a slow first
    //                       load must not lock a capable laptop onto the photo
    //                       for the whole session — each reload re-measures)
    let fpsWindowStart = 0;
    let fpsFrames = 0;
    let warmStamp = 0;
    let badWindows = 0;

    function watchdogTick(t) {
      if (!usingGLTFHumans) return;      // crowd not built yet — main thread busy
      if (!warmStamp) { warmStamp = t; return; }
      if (t - warmStamp < 1.5) return;   // settle after build (GPU uploads / compile)
      if (!fpsWindowStart) { fpsWindowStart = t; fpsFrames = 0; return; }
      fpsFrames++;
      const span = t - fpsWindowStart;
      if (span < 4) return;
      const fps = fpsFrames / span;
      fpsFrames = 0;
      fpsWindowStart = t;
      if (fps < 10) {
        badWindows++;
        if (badWindows >= 2) activatePosterFallback("sustained " + fps.toFixed(1) + " fps over 2 windows", false);
      } else if (fps < 22) {
        badWindows = 0;
        if (!liteMode) {
          liteMode = true;
          window.__EV_DEBUG.liteMode = true;
          console.warn("EL VYNCE hero: lite mode — sustained " + fps.toFixed(1) + " fps");
        }
      } else {
        badWindows = 0;
      }
    }

    function animate() {
      if (posterActive) return; // poster took over — stop scheduling frames
      requestAnimationFrame(animate);
      if (!isVisible || tabHidden) return;
      try {
        animateFrame();
      } catch (err) {
        // A crashing frame must not strand a frozen canvas on screen.
        activatePosterFallback("render error: " + (err && err.message), true);
      }
    }

    function animateFrame() {
      // Order matters: getElapsedTime() internally consumes the delta, so
      // getDelta() must run first or every animation advances at ~0 speed.
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      watchdogTick(t);

      const sig = signalStateAt(t);
      updateSignalLights(sig);
      window.__EV_DEBUG.signal = sig;

      stepCars(t, dt, sig);

      resolveCrowding(
        npcs.filter((n) => !n.isStylized && !n.static && !n.hidden && n.state === "walk"),
        dt
      );
      npcs.forEach((npc) => {
        if (npc.hidden) return;
        let walkActive = 1;
        if (!npc.isStylized && !npc.static && npc.walkAction) {
          // Real humans: behavior state machine + stride-synced physics.
          stepHuman(npc, t, dt, sig);
        } else if (npc.isStylized) {
          walkActive = stepNpcMovement(npc, t, dt);
        }

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
          // Humans always tick: ground speed is expressed through the walk
          // action's timeScale (stepHuman); events/dancer/sitter run at 1.
          npc.mixer.update(dt);
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
      updateSignalLights(signalStateAt(0));
      renderer.render(scene, camera);
    }
  }
  window.addEventListener("resize", onResize);
}

document.addEventListener("DOMContentLoaded", initHeroSilhouette);
