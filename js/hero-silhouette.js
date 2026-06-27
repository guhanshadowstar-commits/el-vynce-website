/* EL VYNCE — abstract black wireframe humanoid hero (replaces real-human photography).
   Procedural low-poly figure built from primitives, walk-cycle animation in place,
   t-shirt CanvasTexture crossfading through brand taglines. ES module (three.js r0.160). */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TAGLINES = ["STYLE PAYS OFF", "JUST BE RESILIENT", "DARE TO BE DIFFERENT", "BUILT DIFFERENT"];
const TAGLINE_HOLD_MS = 3200;
const TAGLINE_FADE_MS = 900;

function initHeroSilhouette() {
  const mount = document.getElementById("hero-silhouette");
  if (!mount) return;

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  // Tight/close-up framing on the upper body so the shirt print reads clearly.
  camera.position.set(0, 1.35, 3.4);
  camera.lookAt(0, 1.15, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.appendChild(renderer.domElement);

  // Subtle gray-to-white gradient backdrop (plane), not a photo.
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
  const bgGeo = new THREE.PlaneGeometry(40, 40);
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTexture, depthWrite: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 1, -6);
  scene.add(bgMesh);

  // ---- T-shirt CanvasTexture (crossfading taglines) ----
  const shirtCanvasA = document.createElement("canvas");
  shirtCanvasA.width = 512;
  shirtCanvasA.height = 512;
  const shirtCanvasB = document.createElement("canvas");
  shirtCanvasB.width = 512;
  shirtCanvasB.height = 512;

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
    // Wrap to multiple lines if the line is too wide.
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

  const textureA = new THREE.CanvasTexture(shirtCanvasA);
  const textureB = new THREE.CanvasTexture(shirtCanvasB);
  paintTagline(shirtCanvasA, TAGLINES[0]);
  textureA.needsUpdate = true;

  const shirtGeo = new THREE.PlaneGeometry(0.62, 0.62);
  const shirtMatA = new THREE.MeshBasicMaterial({ map: textureA, transparent: true, opacity: 1, depthWrite: false });
  const shirtMatB = new THREE.MeshBasicMaterial({ map: textureB, transparent: true, opacity: 0, depthWrite: false });
  const shirtMeshA = new THREE.Mesh(shirtGeo, shirtMatA);
  const shirtMeshB = new THREE.Mesh(shirtGeo, shirtMatB);
  shirtMeshA.position.set(0, 0.05, 0.205);
  shirtMeshB.position.set(0, 0.05, 0.206);

  // ---- Low-poly humanoid built from primitives ----
  const blackWire = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
  const blackSolid = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const figure = new THREE.Group();

  // Torso (capsule-ish via cylinder)
  const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.66, 4, 8);
  const torso = new THREE.Mesh(torsoGeo, blackWire);
  torso.position.set(0, 1.05, 0);
  figure.add(torso);
  torso.add(shirtMeshA, shirtMeshB);

  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 12, 12);
  const head = new THREE.Mesh(headGeo, blackWire);
  head.position.set(0, 1.66, 0);
  figure.add(head);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8);
  const neck = new THREE.Mesh(neckGeo, blackWire);
  neck.position.set(0, 1.47, 0);
  figure.add(neck);

  // Hips pivot (for leg swing)
  const hips = new THREE.Group();
  hips.position.set(0, 0.72, 0);
  figure.add(hips);

  function makeLimbPair(upperLen, upperRadius, lowerLen, lowerRadius, originY, sideOffset, isLeg) {
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

  // Arms (shoulder pivots on torso top)
  const shoulderY = 1.32;
  const armSpan = 0.4;
  const leftArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, -armSpan, false);
  const rightArm = makeLimbPair(0.34, 0.06, 0.32, 0.05, shoulderY, armSpan, false);
  figure.add(leftArm.upperGroup, rightArm.upperGroup);

  // Legs (hip pivots)
  const legSpan = 0.16;
  const leftLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, -legSpan, true);
  const rightLeg = makeLimbPair(0.42, 0.09, 0.42, 0.07, 0, legSpan, true);
  hips.add(leftLeg.upperGroup, rightLeg.upperGroup);

  scene.add(figure);

  // ---- Walk-cycle animation (stationary, sine-driven joint rotations) ----
  const clock = new THREE.Clock();
  const WALK_SPEED = 3.2;
  const SWING_HIP = 0.55;
  const SWING_KNEE = 0.7;
  const SWING_SHOULDER = 0.35;
  const SWING_ELBOW = 0.4;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const phase = t * WALK_SPEED;

    // Legs: opposite phase, hip swings forward/back, knee bends on the back-swing.
    leftLeg.upperGroup.rotation.x = Math.sin(phase) * SWING_HIP;
    rightLeg.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_HIP;
    leftLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 0.5)) * SWING_KNEE;
    rightLeg.lowerGroup.rotation.x = Math.max(0, Math.sin(phase + Math.PI * 1.5)) * SWING_KNEE;

    // Arms: opposite to same-side leg for a natural counter-swing.
    leftArm.upperGroup.rotation.x = Math.sin(phase + Math.PI) * SWING_SHOULDER;
    rightArm.upperGroup.rotation.x = Math.sin(phase) * SWING_SHOULDER;
    leftArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW;
    rightArm.lowerGroup.rotation.x = (Math.sin(phase + Math.PI * 0.5) * 0.5 + 0.5) * SWING_ELBOW;

    // Gentle torso bob + sway so the figure feels alive while walking "on the spot".
    figure.position.y = Math.abs(Math.sin(phase)) * 0.025;
    torso.rotation.z = Math.sin(phase) * 0.025;
    head.rotation.y = Math.sin(phase * 0.5) * 0.06;

    renderer.render(scene, camera);
  }
  animate();

  // ---- Crossfade tagline cycle ----
  let activeIsA = true;
  let taglineIndex = 0;

  function cycleTagline() {
    const nextCanvas = activeIsA ? shirtCanvasB : shirtCanvasA;
    const nextTexture = activeIsA ? textureB : textureA;
    const nextMesh = activeIsA ? shirtMeshB : shirtMeshA;
    const prevMesh = activeIsA ? shirtMeshA : shirtMeshB;

    const fadeOutStart = performance.now();
    const HALF = TAGLINE_FADE_MS / 2;

    // Phase 1: fade the current text fully out (next mesh stays hidden the whole time).
    function fadeOut() {
      const elapsed = performance.now() - fadeOutStart;
      const progress = Math.min(elapsed / HALF, 1);
      prevMesh.material.opacity = 1 - progress;
      if (progress < 1) {
        requestAnimationFrame(fadeOut);
      } else {
        // Phase 2: swap in the new tagline only once the old one is fully gone, then fade in.
        taglineIndex = (taglineIndex + 1) % TAGLINES.length;
        paintTagline(nextCanvas, TAGLINES[taglineIndex]);
        nextTexture.needsUpdate = true;
        nextMesh.material.opacity = 0;
        const fadeInStart = performance.now();
        function fadeIn() {
          const elapsed2 = performance.now() - fadeInStart;
          const progress2 = Math.min(elapsed2 / HALF, 1);
          nextMesh.material.opacity = progress2;
          if (progress2 < 1) {
            requestAnimationFrame(fadeIn);
          } else {
            activeIsA = !activeIsA;
          }
        }
        fadeIn();
      }
    }
    fadeOut();
  }
  setInterval(cycleTagline, TAGLINE_HOLD_MS);

  // ---- Resize handling ----
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
