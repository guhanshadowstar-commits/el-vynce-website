/* EL VYNCE — abstract black wireframe humanoid "NPCs" hero (replaces real-human photography).
   Several procedural low-poly figures wander a ground plane on independent loose paths,
   each wearing a static Warrior Drop tagline. ES module (three.js r0.160). */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TAGLINES = ["STYLE PAYS OFF", "JUST BE RESILIENT", "DARE TO BE DIFFERENT", "BUILT DIFFERENT"];
const FIGURE_COUNT = 5;

function paintTagline(canvas, text) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 46px 'Bodoni Moda', serif";
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const words = text.split(" ");
  const maxWidth = canvas.width * 0.82;
  const lines = [];
  let current = "";
  words.forEach((w) => {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  const lineHeight = 56;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineHeight);
  });
}

function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, blackWire) {
  const upperGroup = new THREE.Group();
  upperGroup.position.set(sideOffset, originY, 0);

  const upperGeo = new THREE.CylinderGeometry(upperRadius, upperRadius * 0.85, upperLen, 8);
  const upperMesh = new THREE.Mesh(upperGeo, blackWire);
  upperMesh.position.set(0, -upperLen / 2, 0);
  upperGroup.add(upperMesh);

  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(0, -upperLen, 0);
  const lowerGeo = new THREE.CylinderGeometry(lowerRadius, lowerRadius * 0.8, lowerLen, 8);
  const lowerMesh = new THREE.Mesh(lowerGeo, blackWire);
  lowerMesh.position.set(0, -lowerLen / 2, 0);
  lowerGroup.add(lowerMesh);
  upperGroup.add(lowerGroup);

  return { upperGroup, lowerGroup };
}

function createFigure(taglineText) {
  const blackWire = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });

  const figure = new THREE.Group();

  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.66, 4, 8);
  const torso = new THREE.Mesh(torsoGeo, blackWire);
  torso.position.set(0, 1.05, 0);
  figure.add(torso);

  const shirtCanvas = document.createElement("canvas");
  shirtCanvas.width = 512;
  shirtCanvas.height = 512;
  paintTagline(shirtCanvas, taglineText);
  const shirtTexture = new THREE.CanvasTexture(shirtCanvas);
  const shirtGeo = new THREE.PlaneGeometry(0.62, 0.62);
  const shirtMat = new THREE.MeshBasicMaterial({ map: shirtTexture, transparent: true, depthWrite: false });
  const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
  shirtMesh.position.set(0, 0.05, 0.205);
  torso.add(shirtMesh);

  const headGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const head = new THREE.Mesh(headGeo, blackWire);
  head.position.set(0, 1.66, 0);
  figure.add(head);

  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8);
  const neck = new THREE.Mesh(neckGeo, blackWire);
  neck.position.set(0, 1.47, 0);
  figure.add(neck);

  const hips = new THREE.Group();
  hips.position.set(0, 0.72, 0);
  figure.add(hips);

  const shoulderY = 1.32;
  const armSpan = 0.4;
  const leftArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, -armSpan, blackWire);
  const rightArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, armSpan, blackWire);
  figure.add(leftArm.upperGroup, rightArm.upperGroup);

  const legSpan = 0.16;
  const leftLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, -legSpan, blackWire);
  const rightLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, legSpan, blackWire);
  hips.add(leftLeg.upperGroup, rightLeg.upperGroup);

  return { group: figure, torso, head, leftArm, rightArm, leftLeg, rightLeg, hips };
}

function initHeroSilhouette() {
  const mount = document.getElementById("hero-silhouette");
  if (!mount) return;

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null;

  // Pulled back/wider framing to read the whole ground area with several figures.
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2.6, 7.2);
  camera.lookAt(0, 0.9, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.appendChild(renderer.domElement);

  // Subtle gray-to-white gradient backdrop, not a photo.
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = 2;
  bgCanvas.height = 256;
  const bgCtx = bgCanvas.getContext("2d");
  const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#f5f5f5");
  grad.addColorStop(1, "#ffffff");
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, 2, 256);
  const bgTexture = new THREE.CanvasTexture(bgCanvas);
  const bgGeo = new THREE.PlaneGeometry(60, 40);
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 5, -10);
  scene.add(bgMesh);

  // Ground plane — faint hairline grid, consistent with the monochrome/glass design system.
  const groundGeo = new THREE.PlaneGeometry(30, 30, 24, 24);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, wireframe: true, transparent: true, opacity: 0.35 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // ---- Spawn NPC figures on independent wandering paths ----
  const WALK_SPEED = 3.2;
  const SWING_HIP = 0.55;
  const SWING_KNEE = 0.7;
  const SWING_SHOULDER = 0.35;
  const SWING_ELBOW = 0.4;

  const npcs = [];
  for (let i = 0; i < FIGURE_COUNT; i++) {
    const tagline = TAGLINES[i % TAGLINES.length];
    const fig = createFigure(tagline);
    scene.add(fig.group);

    npcs.push({
      ...fig,
      // Each figure loops a loose elliptical wander path at its own radius, speed, phase and center.
      pathRadiusX: 1.6 + Math.random() * 1.8,
      pathRadiusZ: 1.0 + Math.random() * 1.4,
      pathSpeed: 0.12 + Math.random() * 0.08,
      pathPhase: Math.random() * Math.PI * 2,
      centerX: (i - (FIGURE_COUNT - 1) / 2) * 1.6 + (Math.random() - 0.5) * 0.6,
      centerZ: (Math.random() - 0.5) * 1.5,
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
      // Face the direction of travel.
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
