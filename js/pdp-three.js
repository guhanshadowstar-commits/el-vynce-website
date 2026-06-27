/* EL VYNCE — subtle, slow 3D rotating garment-silhouette accent for product-detail.html.
   Adapted from the Stitch three.js export. Toggled on/off, low contrast, quiet rotation. */

function evToggleThreeJS() {
  const container = document.getElementById("three-container");
  if (!container) return;
  const isVisible = container.style.opacity === "1";
  if (isVisible) {
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
  } else {
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
    evInitThreeScene();
  }
}

let evThreeInitialized = false;

function evInitThreeScene() {
  if (evThreeInitialized) return;
  if (typeof THREE === "undefined") return;
  evThreeInitialized = true;

  const container = document.getElementById("threejs-container-pdp");
  if (!container) return;

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 400;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(renderer.domElement);

  // Quiet garment silhouette: body block + sleeves, low-opacity monochrome material.
  const bodyGeometry = new THREE.BoxGeometry(1, 1.4, 0.4);
  const sleeveLGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8);
  const sleeveRGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8);

  const material = new THREE.MeshBasicMaterial({
    color: 0x111111,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });

  const body = new THREE.Mesh(bodyGeometry, material);
  const sleeveL = new THREE.Mesh(sleeveLGeometry, material);
  const sleeveR = new THREE.Mesh(sleeveRGeometry, material);

  sleeveL.position.set(-0.6, 0.3, 0);
  sleeveL.rotation.z = Math.PI / 4;
  sleeveR.position.set(0.6, 0.3, 0);
  sleeveR.rotation.z = -Math.PI / 4;

  const garment = new THREE.Group();
  garment.add(body, sleeveL, sleeveR);
  scene.add(garment);

  camera.position.z = 3;

  function animate() {
    requestAnimationFrame(animate);
    garment.rotation.y += 0.0025; // slow rotation
    garment.position.y = Math.sin(Date.now() * 0.0004) * 0.04;
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  animate();
}
