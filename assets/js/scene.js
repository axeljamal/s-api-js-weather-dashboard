// 3D weather scene behind the dashboard, built with Three.js.
// It watches body[data-condition], [data-night] and [data-wind] (set by script.js)
// and animates clouds, sun/moon, stars, rain, snow, lightning and fog to match.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("scene");
const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// How each weather condition looks
const SETTINGS = {
  default: { clouds: 6, cloudColor: 0xffffff, sun: 0.8, rain: 0, snow: 0, fog: 160, stars: 1 },
  clear: { clouds: 3, cloudColor: 0xffffff, sun: 1, rain: 0, snow: 0, fog: 170, stars: 1 },
  clouds: { clouds: 12, cloudColor: 0xf1f4f9, sun: 0.5, rain: 0, snow: 0, fog: 140, stars: 0.6 },
  rain: { clouds: 13, cloudColor: 0xb9c3d1, sun: 0, rain: 0.55, snow: 0, fog: 110, stars: 0 },
  storm: { clouds: 15, cloudColor: 0x7d8399, sun: 0, rain: 0.75, snow: 0, fog: 100, stars: 0, lightning: true },
  snow: { clouds: 10, cloudColor: 0xffffff, sun: 0.25, rain: 0, snow: 0.95, fog: 120, stars: 0.2 },
  mist: { clouds: 8, cloudColor: 0xe3e7ed, sun: 0.3, rain: 0, snow: 0, fog: 50, stars: 0.2 },
};

const BOUND_X = 48;
const MAX_CLOUDS = 15;
const RAIN_COUNT = 1600;
const SNOW_COUNT = 1000;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
} catch (err) {
  console.warn("WebGL unavailable, keeping the flat background", err);
}

if (renderer) {
  body.classList.add("has-3d");
  init();
}

function init() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x3a6ea5, 10, 160);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  camera.position.set(0, 1, 30);
  scene.add(camera);

  const soft = softTexture();
  const rand = (min, max) => min + Math.random() * (max - min);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f8fb0, 2);
  const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.5);
  sunLight.position.set(15, 20, 10);
  scene.add(hemi, sunLight);

  // ---------- Sun ----------
  const sun = new THREE.Group();
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(3, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })
  );
  const sunGlow = glowSprite(0xffc04d, 24);
  const sunHalo = glowSprite(0xfff0b0, 40);
  sunHalo.material.opacity = 0.35;
  sun.add(sunHalo, sunGlow, sunCore);
  sun.position.set(22, 24, -28);
  scene.add(sun);

  // ---------- Moon ----------
  const moon = new THREE.Group();
  const moonCore = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xe9edf7,
      emissive: 0x8e9cc4,
      emissiveIntensity: 0.7,
      roughness: 0.95,
      fog: false,
    })
  );
  moon.add(glowSprite(0x9fb6ff, 14), moonCore);
  moon.position.set(-20, 22, -28);
  scene.add(moon);

  // ---------- Stars ----------
  const starPositions = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    starPositions.set([rand(-110, 110), rand(-15, 70), rand(-100, -70)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 0.7,
      map: soft,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    })
  );
  scene.add(stars);

  // ---------- Clouds (low-poly puffs that grow in and out) ----------
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    flatShading: true,
  });
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const clouds = [];
  for (let i = 0; i < MAX_CLOUDS; i++) {
    const cloud = new THREE.Group();
    const puffs = 5 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMaterial);
      const centre = 1 - Math.abs(p - (puffs - 1) / 2) / puffs;
      const s = rand(1.2, 1.8) + centre * 1.4;
      puff.scale.set(s, s * 0.85, s);
      puff.position.set((p - (puffs - 1) / 2) * 1.7 + rand(-0.4, 0.4), centre * rand(0.3, 1.2), rand(-0.8, 0.8));
      cloud.add(puff);
    }
    cloud.userData = { speed: rand(0.5, 1.2), size: rand(1.5, 2.6), grow: 0, target: 0 };
    cloud.position.set(rand(-BOUND_X, BOUND_X), rand(-2, 16), rand(-40, -6));
    cloud.scale.setScalar(0.001);
    clouds.push(cloud);
    scene.add(cloud);
  }

  // ---------- Rain (line segments) ----------
  const rainPositions = new Float32Array(RAIN_COUNT * 6);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    resetDrop(i, rand(-20, 35));
    rainSpeed[i] = rand(28, 42);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xd2e2ff, transparent: true, opacity: 0, depthWrite: false })
  );
  scene.add(rain);

  function resetDrop(i, y) {
    const x = rand(-BOUND_X, BOUND_X);
    const z = rand(-25, 18);
    rainPositions.set([x, y, z, x, y + 1.1, z], i * 6);
  }

  // ---------- Snow (soft points) ----------
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowPhase = new Float32Array(SNOW_COUNT);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions.set([rand(-BOUND_X, BOUND_X), rand(-20, 35), rand(-25, 18)], i * 3);
    snowPhase[i] = rand(0, Math.PI * 2);
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({
      size: 0.6,
      map: soft,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  scene.add(snow);

  // ---------- Lightning flash (plane stuck to the camera) ----------
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({
      color: 0xeef2ff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
  );
  flash.position.z = -2;
  flash.renderOrder = 999;
  camera.add(flash);

  // ---------- State from the page ----------
  let target = {};
  const fogColor = new THREE.Color();
  const cloudColor = new THREE.Color();
  const nightCloud = new THREE.Color(0x3b4466);

  function readState() {
    const condition = body.dataset.condition || "default";
    const s = SETTINGS[condition] || SETTINGS.default;
    const night = body.dataset.night === "true";
    const css = getComputedStyle(body);
    target = {
      ...s,
      night,
      wind: parseFloat(body.dataset.wind) || 3,
      sun: night ? 0 : s.sun,
      moon: night && !s.rain ? 1 : 0,
      stars: night ? s.stars : 0,
      light: night ? 0.45 : s.rain ? 0.7 : 1,
    };
    fogColor.set(css.getPropertyValue("--bg-2").trim() || "#3a6ea5");
    cloudColor.set(s.cloudColor);
    if (night) cloudColor.lerp(nightCloud, 0.65);
    clouds.forEach((cloud, i) => (cloud.userData.target = i < s.clouds ? 1 : 0));
    rain.geometry.setDrawRange(0, (condition === "storm" ? RAIN_COUNT : RAIN_COUNT * 0.6) * 2);
  }
  new MutationObserver(readState).observe(body, {
    attributes: true,
    attributeFilter: ["data-condition", "data-night", "data-wind", "data-theme"],
  });
  readState();

  // ---------- Pointer parallax ----------
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  // ---------- Resize ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // pull the camera back on narrow screens so the scene still fills it
    camera.position.z = w < h ? 38 : 30;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Animation loop ----------
  const clock = new THREE.Clock();
  const motion = reducedMotion ? 0 : 1;
  let sunStrength = 0;
  let moonStrength = 0;
  let sunRise = 0;
  let moonRise = 0;
  let flashLevel = 0;
  let nextFlash = 2;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const ease = 1 - Math.pow(0.02, dt); // smooth, frame-rate independent

    // fog, light and colours drift toward the current weather
    scene.fog.color.lerp(fogColor, ease);
    scene.fog.far = lerp(scene.fog.far, target.fog, ease);
    cloudMaterial.color.lerp(cloudColor, ease);
    hemi.intensity = lerp(hemi.intensity, 2 * target.light, ease);
    sunLight.intensity = lerp(sunLight.intensity, 2.5 * target.light * (0.4 + target.sun), ease);

    // sun and moon rise and set
    sunStrength = lerp(sunStrength, target.sun, ease * 0.7);
    moonStrength = lerp(moonStrength, target.moon, ease * 0.7);
    // rise fully whenever visible; weaker sun (e.g. cloudy) just glows less
    sunRise = lerp(sunRise, target.sun > 0 ? 1 : 0, ease * 0.7);
    moonRise = lerp(moonRise, target.moon > 0 ? 1 : 0, ease * 0.7);
    sun.position.y = 24 - (1 - sunRise) * 34;
    sun.scale.setScalar(0.6 + sunRise * 0.4);
    sunGlow.material.opacity = sunStrength;
    sunHalo.material.opacity = sunStrength * (0.3 + Math.sin(t * 1.5) * 0.08 * motion);
    sun.visible = sunRise > 0.01;
    moon.position.y = 22 - (1 - moonRise) * 34;
    moon.children[0].material.opacity = moonStrength;
    moon.visible = moonRise > 0.01;
    moonCore.rotation.y += dt * 0.05 * motion;

    stars.material.opacity = lerp(stars.material.opacity, target.stars, ease);
    stars.visible = stars.material.opacity > 0.01;
    stars.rotation.z = Math.sin(t * 0.02) * 0.03 * motion;

    // clouds drift with the wind and wrap around
    const windDrift = 0.4 + Math.min(target.wind, 15) * 0.15;
    clouds.forEach((cloud) => {
      const d = cloud.userData;
      d.grow = lerp(d.grow, d.target, ease * 0.8);
      cloud.visible = d.grow > 0.01;
      cloud.scale.setScalar(Math.max(d.grow * d.size, 0.001));
      cloud.position.x += d.speed * windDrift * dt * motion;
      cloud.position.y += Math.sin(t * 0.3 + d.speed * 10) * 0.004 * motion;
      if (cloud.position.x > BOUND_X + 10) {
        cloud.position.x = -BOUND_X - 10;
        cloud.position.y = rand(-2, 16);
      }
    });

    // rain falls at a slant set by the wind
    rain.material.opacity = lerp(rain.material.opacity, target.rain, ease);
    rain.visible = rain.material.opacity > 0.01;
    if (rain.visible && motion) {
      const slant = Math.min(target.wind, 15) * 0.06;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const o = i * 6;
        const fall = rainSpeed[i] * dt;
        rainPositions[o + 1] -= fall;
        rainPositions[o + 4] -= fall;
        rainPositions[o] += slant * fall;
        rainPositions[o + 3] = rainPositions[o] - slant * 1.1;
        if (rainPositions[o + 1] < -20) resetDrop(i, 35);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // snow drifts down and sways
    snow.material.opacity = lerp(snow.material.opacity, target.snow, ease);
    snow.visible = snow.material.opacity > 0.01;
    if (snow.visible && motion) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const o = i * 3;
        snowPositions[o] += Math.sin(t + snowPhase[i]) * 0.6 * dt;
        snowPositions[o + 1] -= (2 + (i % 5) * 0.4) * dt;
        if (snowPositions[o + 1] < -20) snowPositions[o + 1] = 35;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // lightning: a quick double flicker every few seconds
    if (target.lightning && motion) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flashLevel = 0.75;
        nextFlash = rand(2.5, 7);
        setTimeout(() => (flashLevel = 0.5), 120);
      }
    }
    flashLevel = Math.max(0, flashLevel - dt * 3);
    flash.material.opacity = flashLevel;
    flash.visible = flashLevel > 0.01;

    // camera follows the pointer a little
    const camX = pointer.x * 3 + Math.sin(t * 0.08) * 1.5 * motion;
    const camY = 1 + pointer.y * 1.6;
    camera.position.x = lerp(camera.position.x, camX * motion, ease * 0.5);
    camera.position.y = lerp(camera.position.y, motion ? camY : 1, ease * 0.5);
    camera.lookAt(0, 4, -12);

    renderer.render(scene, camera);
  });

  function glowSprite(color, size) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: soft,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    sprite.scale.setScalar(size);
    return sprite;
  }
}

// Soft round texture used for glows, stars and snowflakes
function softTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
