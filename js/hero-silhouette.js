/* EL VYNCE — stylized monochrome city hero (replaces real-human photography).
   Solid-shaded (non-wireframe) procedural figures wander a street between simple
   geometric buildings, each wearing a real Warrior Drop tee. Interactive: click a
   figure to jump to its product, cursor-driven camera parallax, scroll-linked
   camera pull-back, ambient pace/pause variety, slow lighting drift.
   ES module (three.js r0.160). No external 3D asset files. */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Real Warrior Drop product photography — front print of each tee, mapped onto the figures,
// paired with the matching product id so a click can jump straight to that product.
const SHIRT_PRODUCTS = [
  { image: "images/products/style-pays-off-front.jpg", id: "ev-004" },
  { image: "images/products/just-be-resilient-front.jpg", id: "ev-005" },
  { image: "images/products/dare-to-be-different-front.jpg", id: "ev-006" },
  { image: "images/products/built-different-front.jpg", id: "ev-006b" },
];
const FIGURE_COUNT = 5;
const textureLoader = new THREE.TextureLoader();

function addEdges(mesh, color = 0x000000) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 1 }));
  mesh.add(line);
  return mesh;
}

function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, material) {
  const upperGroup = new THREE.Group();
  upperGroup.position.set(sideOffset, originY, 0);

  const upperGeo = new THREE.CapsuleGeometry(upperRadius, upperLen - upperRadius * 1.4, 4, 8);
  const upperMesh = addEdges(new THREE.Mesh(upperGeo, material));
  upperMesh.position.set(0, -upperLen / 2, 0);
  upperGroup.add(upperMesh);

  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(0, -upperLen, 0);
  const lowerGeo = new THREE.CapsuleGeometry(lowerRadius, lowerLen - lowerRadius * 1.4, 4, 8);
  const lowerMesh = addEdges(new THREE.Mesh(lowerGeo, material));
  lowerMesh.position.set(0, -lowerLen / 2, 0);
  lowerGroup.add(lowerMesh);
  upperGroup.add(lowerGroup);

  return { upperGroup, lowerGroup };
}

function createFigure(shirtImageUrl) {
  // Solid-shaded matte material (not wireframe) — needs real lights in the scene to read.
  const skin = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.05 });

  const figure = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.5, 4, 8);
  const torso = addEdges(new THREE.Mesh(torsoGeo, skin));
  torso.position.set(0, 1.05, 0);
  figure.add(torso);

  // Real product photo (front of the tee) mapped onto a plane on the chest.
  const shirtTexture = textureLoader.load(shirtImageUrl);
  shirtTexture.colorSpace = THREE.SRGBColorSpace;
  const shirtGeo = new THREE.PlaneGeometry(0.46, 0.6);
  const shirtMat = new THREE.MeshBasicMaterial({ map: shirtTexture, transparent: true, depthWrite: false });
  const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
  shirtMesh.position.set(0, 0.05, 0.345);
  torso.add(shirtMesh);

  const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const head = addEdges(new THREE.Mesh(headGeo, skin));
  head.position.set(0, 1.66, 0);
  figure.add(head);

  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8);
  const neck = addEdges(new THREE.Mesh(neckGeo, skin));
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

function createBuilding(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  // Faint window-grid texture so the solid white facades read as buildings, not blank boxes.
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
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillRect(c * cellW + cellW * 0.22, r * cellH + cellH * 0.22, cellW * 0.56, cellH * 0.56);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.95, metalness: 0 });
  const mesh = addEdges(new THREE.Mesh(geo, mat), 0x111111);
  mesh.position.set(0, h / 2, 0);
  return mesh;
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
  const BASE_CAM_POS = new THREE.Vector3(0, 2.4, 7.6);
  const BASE_CAM_TARGET = new THREE.Vector3(0, 1.1, 0);
  // Scroll-pulled-back pose — camera rises and retreats as the visitor scrolls past the hero.
  const SCROLL_CAM_POS = new THREE.Vector3(0, 6.5, 16);
  const SCROLL_CAM_TARGET = new THREE.Vector3(0, 2, 0);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_CAM_TARGET);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.cursor = "default";
  mount.appendChild(renderer.domElement);

  // ---- Lighting (required for solid MeshStandardMaterial shading) ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  // Subtle gray-to-white gradient sky backdrop, not a photo.
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = 2;
  bgCanvas.height = 256;
  const bgCtx = bgCanvas.getContext("2d");
  const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#eeeeee");
  grad.addColorStop(1, "#ffffff");
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, 2, 256);
  const bgTexture = new THREE.CanvasTexture(bgCanvas);
  const bgGeo = new THREE.PlaneGeometry(80, 40);
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 8, -22);
  scene.add(bgMesh);

  // ---- Street / ground plane ----
  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e4, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Faint sidewalk-seam grid lines on top of the ground.
  const gridHelper = new THREE.GridHelper(40, 20, 0xcccccc, 0xd9d9d9);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  // ---- Simple geometric city skyline flanking the street, both sides ----
  const buildingRowZ = [-7, -10.5, -14];
  [-1, 1].forEach((side) => {
    buildingRowZ.forEach((z, i) => {
      const count = 3;
      for (let j = 0; j < count; j++) {
        const w = 2.2 + Math.random() * 1.6;
        const h = 3 + Math.random() * (5 + i * 2.5);
        const d = 2.2 + Math.random() * 1.6;
        const building = createBuilding(w, h, d);
        building.position.x = side * (5.5 + j * 3.2 + Math.random() * 0.4);
        building.position.z = z + (Math.random() - 0.5) * 1.2;
        scene.add(building);
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
      pathSpeed: (0.1 + Math.random() * 0.12), // wider per-figure pace variety than before
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

  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.addEventListener("click", (e) => {
    const hit = npcUnderPointer(e.clientX, e.clientY);
    if (hit) window.location.href = `product-detail.html?id=${hit.productId}`;
  });
  renderer.domElement.addEventListener("mousemove", (e) => {
    const hit = npcUnderPointer(e.clientX, e.clientY);
    renderer.domElement.style.cursor = hit ? "pointer" : "default";
  });

  function animate() {
    requestAnimationFrame(animate);
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

    // Slow, near-imperceptible lighting drift — like a sundial, pure atmosphere.
    const sunDrift = t * 0.02;
    sun.position.set(4 + Math.sin(sunDrift) * 2, 8 + Math.cos(sunDrift * 0.7) * 1, 6 + Math.cos(sunDrift) * 2);
    sun.intensity = 0.85 + Math.sin(sunDrift * 0.5) * 0.08;

    // Cursor parallax: ease toward the target offset rather than snapping.
    parallaxX += (pointerX - parallaxX) * 0.04;
    parallaxY += (pointerY - parallaxY) * 0.04;

    // Blend base camera pose toward the scroll-pulled-back pose as the visitor scrolls past the hero.
    const camPos = BASE_CAM_POS.clone().lerp(SCROLL_CAM_POS, scrollProgress);
    const camTarget = BASE_CAM_TARGET.clone().lerp(SCROLL_CAM_TARGET, scrollProgress);

    // Parallax offset shrinks as we pull back, so it doesn't fight the scroll motion.
    const parallaxStrength = 0.5 * (1 - scrollProgress);
    camPos.x += parallaxX * parallaxStrength;
    camPos.y += -parallaxY * parallaxStrength * 0.5;

    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
}

document.addEventListener("DOMContentLoaded", initHeroSilhouette);
