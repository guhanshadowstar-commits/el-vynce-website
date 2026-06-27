/* EL VYNCE — stylized monochrome city hero (replaces real-human photography).
   Solid-shaded (non-wireframe) procedural figures wander a street between simple
   geometric buildings, each wearing a static Warrior Drop tagline. Lit scene,
   architectural black edge-outlines on buildings to match the "Achromatic Luxury"
   design system. ES module (three.js r0.160). No external 3D asset files. */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Real Warrior Drop product photography — front print of each tee, mapped onto the figures.
const SHIRT_IMAGES = [
  "images/products/style-pays-off-front.png",
  "images/products/just-be-resilient-front.png",
  "images/products/dare-to-be-different-front.png",
  "images/products/built-different-front.png",
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
  if (!mount) return;

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2.4, 7.6);
  camera.lookAt(0, 1.1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

  const npcs = [];
  for (let i = 0; i < FIGURE_COUNT; i++) {
    const shirtUrl = SHIRT_IMAGES[i % SHIRT_IMAGES.length];
    const fig = createFigure(shirtUrl);
    scene.add(fig.group);

    npcs.push({
      ...fig,
      pathRadiusX: 1.6 + Math.random() * 1.8,
      pathRadiusZ: 1.0 + Math.random() * 1.2,
      pathSpeed: 0.12 + Math.random() * 0.08,
      pathPhase: Math.random() * Math.PI * 2,
      centerX: (i - (FIGURE_COUNT - 1) / 2) * 1.6 + (Math.random() - 0.5) * 0.6,
      centerZ: -1 + (Math.random() - 0.5) * 1.5,
      walkPhase: Math.random() * Math.PI * 2,
      scale: 0.85 + Math.random() * 0.3,
    });
    fig.group.scale.setScalar(npcs[npcs.length - 1].scale);
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    npcs.forEach((npc) => {
      const pathT = t * npc.pathSpeed + npc.pathPhase;
      const x = npc.centerX + Math.cos(pathT) * npc.pathRadiusX;
      const z = npc.centerZ + Math.sin(pathT * 1.3) * npc.pathRadiusZ;
      const nextPathT = pathT + 0.05;
      const nx = npc.centerX + Math.cos(nextPathT) * npc.pathRadiusX;
      const nz = npc.centerZ + Math.sin(nextPathT * 1.3) * npc.pathRadiusZ;
      const heading = Math.atan2(nx - x, nz - z);

      npc.group.position.set(x, 0, z);
      npc.group.rotation.y = heading;

      const phase = t * WALK_SPEED + npc.walkPhase;
      npc.leftLeg.upperGroup.rotation.x = Math.sin(phase) * SWING_HIP;
      npc.rightLeg.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_HIP;
      npc.leftLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 0.5)) * SWING_KNEE;
      npc.rightLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 1.5)) * SWING_KNEE;

      npc.leftArm.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_SHOULDER;
      npc.rightArm.upperGroup.rotation.x = Math.sin(phase) * SWING_SHOULDER;
      npc.leftArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW;
      npc.rightArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW;

      npc.hips.position.y = 0.72 + Math.abs(Math.sin(phase)) * 0.02;
      npc.torso.rotation.z = Math.sin(phase) * 0.02;
      npc.head.rotation.y = Math.sin(phase * 0.5) * 0.05;
    });

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
