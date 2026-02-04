import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const canvas = document.getElementById("camera-canvas");
const fallback = document.querySelector(".canvas-fallback");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (!prefersReducedMotion && canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  // Enable tone mapping for realistic lighting
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // No background color, let it be transparent or set later if needed
  // scene.background = new THREE.Color(0xf3efe7); 

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas.parentElement;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.2); // Low ambient, rely on HDRI
  const keyLight = new THREE.DirectionalLight(0xfff1da, 2.0);
  keyLight.position.set(5, 5, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.001;
  scene.add(ambient, keyLight);

  const fillLight = new THREE.DirectionalLight(0xd6e3df, 1.0);
  fillLight.position.set(-5, 0, 2);
  scene.add(fillLight);

  const rimLight = new THREE.SpotLight(0xffffff, 5);
  rimLight.position.set(0, 5, -5);
  rimLight.lookAt(0, 0, 0);
  scene.add(rimLight);

  // Group for the camera model
  const group = new THREE.Group();
  scene.add(group);

  // Load HDRI for realistic reflections
  new RGBELoader()
    .setPath("https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/")
    .load("studio_small_09_1k.hdr", function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      // scene.background = texture; // Optional: show HDRI as background
      
      initCameraModel();
      animate();
      fallback.style.display = "none";
    });

  function initCameraModel() {
    // --- Materials ---
    // Leather body: Textured dark material
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Silver metal: High metalness, low roughness
    const silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e5e5,
      roughness: 0.25,
      metalness: 1.0,
    });

    // Lens body: Black metal
    const lensBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Glass: Physical material with transmission
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.98, // Glass-like
      thickness: 1.5,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
    });

    const redAccent = new THREE.MeshStandardMaterial({
      color: 0xaa0000,
      roughness: 0.3,
      metalness: 0.2,
    });

    // --- Geometry Construction ---

    // 1. Main Body (Leather grip area)
    const mainBodyGeo = new RoundedBoxGeometry(3.6, 2.1, 1.1, 8, 0.1); // W, H, D, segments, radius
    const mainBody = new THREE.Mesh(mainBodyGeo, bodyMaterial);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    group.add(mainBody);

    // 2. Top Plate (Silver)
    const topPlateGeo = new RoundedBoxGeometry(3.6, 0.8, 1.1, 8, 0.05);
    const topPlate = new THREE.Mesh(topPlateGeo, silverMaterial);
    topPlate.position.set(0, 1.45, 0); // (2.1/2) + (0.8/2) = 1.05 + 0.4 = 1.45
    topPlate.castShadow = true;
    topPlate.receiveShadow = true;
    group.add(topPlate);

    // 3. Bottom Plate (Silver)
    const bottomPlateGeo = new RoundedBoxGeometry(3.6, 0.3, 1.1, 8, 0.05);
    const bottomPlate = new THREE.Mesh(bottomPlateGeo, silverMaterial);
    bottomPlate.position.set(0, -1.2, 0);
    bottomPlate.receiveShadow = true;
    group.add(bottomPlate);

    // 4. Grip (Right side ergonomic bump)
    const gripGeo = new THREE.CapsuleGeometry(0.35, 1.6, 4, 8);
    const grip = new THREE.Mesh(gripGeo, bodyMaterial);
    grip.position.set(1.4, 0.2, 0.6); // Front right
    grip.rotation.x = 0; // Vertical capsule
    grip.castShadow = true;
    group.add(grip);

    // 5. Viewfinder Hump (Prism)
    const viewfinderGeo = new RoundedBoxGeometry(1.2, 0.6, 1.2, 4, 0.05);
    const viewfinder = new THREE.Mesh(viewfinderGeo, silverMaterial);
    viewfinder.position.set(0, 1.9, 0); // On top of top plate (1.45 + 0.4 + 0.3) -> approx 1.9
    viewfinder.castShadow = true;
    group.add(viewfinder);

    // Viewfinder Eyepiece
    const eyepieceGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
    const eyepiece = new THREE.Mesh(eyepieceGeo, new THREE.MeshStandardMaterial({color: 0x111111}));
    eyepiece.rotation.x = Math.PI / 2;
    eyepiece.position.set(0, 1.9, -0.65);
    group.add(eyepiece);

    // 6. Lens Mount
    const mountGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.15, 64);
    const mount = new THREE.Mesh(mountGeo, silverMaterial);
    mount.rotation.x = Math.PI / 2;
    mount.position.set(0, 0.1, 0.6);
    group.add(mount);

    // 7. Lens Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.8, 64);
    const barrel = new THREE.Mesh(barrelGeo, lensBodyMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, 1.05); // 0.6 + 0.075 + 0.4 = 1.075
    barrel.castShadow = true;
    group.add(barrel);

    // 8. Focus Ring (Textured)
    const focusRingGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.4, 64);
    const focusRingMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        bumpScale: 0.02
        // If we had a texture map, we'd apply it here. For now, dark matte.
    });
    const focusRing = new THREE.Mesh(focusRingGeo, focusRingMat);
    focusRing.rotation.x = Math.PI / 2;
    focusRing.position.set(0, 0.1, 1.15);
    group.add(focusRing);

    // 9. Front Lens Element
    const frontRingGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.1, 64);
    const frontRing = new THREE.Mesh(frontRingGeo, lensBodyMaterial); // front ring
    frontRing.rotation.x = Math.PI / 2;
    frontRing.position.set(0, 0.1, 1.5);
    group.add(frontRing);

    // Glass
    const glassGeo = new THREE.SphereGeometry(0.8, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const glass = new THREE.Mesh(glassGeo, glassMaterial);
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(0, 0.1, 1.4);
    group.add(glass);

    // 10. Dials and Buttons
    // Shutter Speed Dial (Right)
    const dialGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
    const dial = new THREE.Mesh(dialGeo, silverMaterial);
    dial.position.set(1.2, 1.95, 0.0);
    dial.castShadow = true;
    group.add(dial);

    // Shutter Button
    const shutterGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const shutter = new THREE.Mesh(shutterGeo, silverMaterial);
    shutter.position.set(1.0, 1.9, 0.4); // slightly forward
    group.add(shutter);

    // ISO Dial (Left)
    const isoGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 32);
    const isoDial = new THREE.Mesh(isoGeo, silverMaterial);
    isoDial.position.set(-1.2, 1.95, 0.0);
    isoDial.castShadow = true;
    group.add(isoDial);

    // Logo / Red Dot
    const logoGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
    const logo = new THREE.Mesh(logoGeo, redAccent);
    logo.position.set(1.2, 1.4, 0.56);
    group.add(logo);
  }

  camera.position.set(0, 0.5, 7.5);

  // Interaction Logic
  let targetRotation = { x: 0, y: 0 };
  let currentRotation = { x: 0, y: 0 };

  const onMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    
    // Increased rotation range: ~70 degrees
    targetRotation = { x: y * 2.5, y: x * 2.5 };
  };

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", () => {
    targetRotation = { x: 0, y: 0 };
  });

  function animate() {
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;
    
    group.rotation.x = currentRotation.x;
    group.rotation.y = currentRotation.y;
    // Gentle floating
    group.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
}

// Initialize Lenis for smooth scrolling
if (window.Lenis) {
  const lenis = new Lenis({
    lerp: 0.12, // Increased from 0.08 for faster response
    wheelMultiplier: 1.2, // Added multiplier to increase scroll speed per wheel tick
    smooth: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}

// Lightbox Logic
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.querySelector(".lightbox-caption");
const lightboxClose = document.querySelector(".lightbox-close");
const workImages = document.querySelectorAll(".work-card img");

if (lightbox && lightboxImg) {
  workImages.forEach((img) => {
    img.addEventListener("click", () => {
      const highRes = img.src.replace("&w=900", "&w=2400").replace("&w=1200", "&w=2400");
      lightboxImg.src = highRes;
      
      // Get caption from card
      const card = img.closest(".work-card");
      const title = card.querySelector("h3")?.innerText || "";
      const year = card.querySelector("p")?.innerText || "";
      lightboxCaption.innerText = `${title} — ${year}`;
      
      lightbox.classList.add("active");
      document.body.style.overflow = "hidden"; // Lock scroll
    });
  });

  const closeLightbox = () => {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
    setTimeout(() => {
      lightboxImg.src = ""; // Clear for next time
    }, 400);
  };

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("active")) closeLightbox();
  });
}

// GSAP Reveal Animations
const revealElements = document.querySelectorAll(
  ".section-header, .work-card, .service-card, .about-grid"
);

if (window.gsap && revealElements.length) {
  gsap.set(revealElements, { opacity: 0, y: 40 });
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          gsap.to(entry.target, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealElements.forEach((el) => observer.observe(el));
}
