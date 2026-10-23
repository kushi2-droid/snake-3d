// src/renderer.js
// Manages the Three.js 3D scene, grid arena, snake meshes, glowing food orb, object-pooled particles, and camera.

import * as THREE from 'three';

export class ArenaRenderer {
  /**
   * @param {HTMLElement} container - DOM element to mount the WebGL canvas inside
   * @param {number} gridSize - Number of cells per side (e.g., 17)
   */
  constructor(container, gridSize = 17) {
    this.container = container;
    this.gridSize = gridSize;
    this.halfGrid = (gridSize - 1) / 2;

    this.segmentMeshes = [];
    this.particles = [];
    this.growthPulse = 0;
    this.clockTime = 0;

    this.initScene();
    this.initLights();
    this.initArena();
    this.initSnakeObjects();
    this.initFoodObject();
    this.initParticlePool();
    this.initAmbientDust();

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  /**
   * Convert logical grid coordinate (0 .. gridSize-1) to 3D world space (-halfGrid .. +halfGrid).
   */
  gridToWorld(gx, gz) {
    return {
      x: gx - this.halfGrid,
      z: gz - this.halfGrid
    };
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.018);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    this.baseCameraPos = new THREE.Vector3(0, 21.5, 16.5);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(0, -0.5, 0.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x1e3a5f, 1.35);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.85);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.6);
    dirLight.position.set(12, 24, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    const d = this.gridSize * 0.75;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Subtle cyan rim lights at arena corners
    const rimLight1 = new THREE.PointLight(0x00f0ff, 1.2, 26);
    rimLight1.position.set(-this.halfGrid - 2, 4, -this.halfGrid - 2);
    this.scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(0x06b6d4, 1.0, 26);
    rimLight2.position.set(this.halfGrid + 2, 4, this.halfGrid + 2);
    this.scene.add(rimLight2);
  }

  initArena() {
    this.arenaGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);

    // 1. Dark Navy/Charcoal Floor Base
    const floorGeo = new THREE.BoxGeometry(this.gridSize + 0.4, 0.6, this.gridSize + 0.4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1324,
      roughness: 0.35,
      metalness: 0.45
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.3;
    floorMesh.receiveShadow = true;
    this.arenaGroup.add(floorMesh);

    // 2. Subtle Alternating Checkerboard Tiles for Crystal-Clear Grid Readability
    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    const tileMatLight = new THREE.MeshStandardMaterial({
      color: 0x111e36,
      roughness: 0.5,
      metalness: 0.25
    });
    const tileMatDark = new THREE.MeshStandardMaterial({
      color: 0x0d172a,
      roughness: 0.6,
      metalness: 0.2
    });

    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const isEven = (x + z) % 2 === 0;
        const tile = new THREE.Mesh(tileGeo, isEven ? tileMatLight : tileMatDark);
        const worldPos = this.gridToWorld(x, z);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(worldPos.x, 0.01, worldPos.z);
        tile.receiveShadow = true;
        this.arenaGroup.add(tile);
      }
    }

    // 3. Crisp Glowing Cyan Grid Lines
    const gridHelper = new THREE.GridHelper(
      this.gridSize,
      this.gridSize,
      0x00f0ff,
      0x1e3a5f
    );
    gridHelper.position.y = 0.02;
    if (Array.isArray(gridHelper.material)) {
      gridHelper.material.forEach(m => {
        m.transparent = true;
        m.opacity = 0.45;
      });
    } else {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.45;
    }
    this.arenaGroup.add(gridHelper);

    // 4. Raised 3D Boundary Walls with Neon Trim
    const wallThickness = 0.55;
    const wallHeight = 0.85;
    const totalSpan = this.gridSize + wallThickness * 2;
    const offset = this.gridSize / 2 + wallThickness / 2;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x16243d,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0x06152d,
      emissiveIntensity: 0.5
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    const walls = [
      { w: totalSpan, d: wallThickness, x: 0, z: -offset }, // North
      { w: totalSpan, d: wallThickness, x: 0, z: offset },  // South
      { w: wallThickness, d: this.gridSize, x: -offset, z: 0 }, // West
      { w: wallThickness, d: this.gridSize, x: offset, z: 0 }   // East
    ];

    walls.forEach(({ w, d, x, z }) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.arenaGroup.add(mesh);

      // Glowing top neon strip along each wall
      const stripGeo = new THREE.BoxGeometry(w * 0.98, 0.08, d * 0.45);
      const strip = new THREE.Mesh(stripGeo, trimMat);
      strip.position.set(x, wallHeight + 0.04, z);
      this.arenaGroup.add(strip);
    });
  }

  initSnakeObjects() {
    this.snakeGroup = new THREE.Group();
    this.scene.add(this.snakeGroup);

    // Shared geometries and materials for efficiency
    this.bodyGeo = new THREE.BoxGeometry(0.84, 0.72, 0.84);
    this.headGeo = new THREE.BoxGeometry(0.92, 0.82, 0.92);

    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.3
    });

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0.35
    });

    this.tailMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.3
    });

    // Head group with directional eyes
    this.headGroup = new THREE.Group();
    const headCore = new THREE.Mesh(this.headGeo, this.headMat);
    headCore.castShadow = true;
    headCore.receiveShadow = true;
    this.headGroup.add(headCore);

    const eyeGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.06, 10, 10);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050811 });

    // Left & Right Eyes facing +X by default (rotated dynamically based on snake direction)
    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(0.38, 0.22, -0.22);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0.45, 0.22, -0.22);

    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.38, 0.22, 0.22);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.45, 0.22, 0.22);

    this.headGroup.add(leftEye, leftPupil, rightEye, rightPupil);
    this.snakeGroup.add(this.headGroup);
  }

  initFoodObject() {
    this.foodGroup = new THREE.Group();
    this.scene.add(this.foodGroup);

    // Glowing octahedral/icosahedral energy core
    const orbGeo = new THREE.IcosahedronGeometry(0.38, 1);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xff2a85,
      emissive: 0xff1e78,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.25
    });
    this.foodOrb = new THREE.Mesh(orbGeo, orbMat);
    this.foodOrb.castShadow = true;
    this.foodGroup.add(this.foodOrb);

    // Outer halo ring around food
    const ringGeo = new THREE.TorusGeometry(0.46, 0.04, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff85b3,
      transparent: true,
      opacity: 0.7
    });
    this.foodRing = new THREE.Mesh(ringGeo, ringMat);
    this.foodRing.rotation.x = Math.PI / 2;
    this.foodGroup.add(this.foodRing);

    // Dedicated point light so food illuminates nearby grid cells and snake segments
    this.foodLight = new THREE.PointLight(0xff2a85, 1.6, 5.5);
    this.foodLight.position.set(0, 0.6, 0);
    this.foodGroup.add(this.foodLight);
  }

  initParticlePool() {
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const poolSize = 28;

    for (let i = 0; i < poolSize; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff2a85 : 0x00f0ff,
        transparent: true,
        opacity: 0
      });
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.55
      });
    }
  }

  initAmbientDust() {
    const count = 45;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (this.gridSize + 8);
      positions[i * 3 + 1] = 0.5 + Math.random() * 6.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (this.gridSize + 8);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.14,
      transparent: true,
      opacity: 0.45
    });
    this.ambientDust = new THREE.Points(geo, mat);
    this.scene.add(this.ambientDust);
  }

  /**
   * Trigger a particle burst at grid cell (gx, gz) when food is collected.
   */
  triggerCollectionBurst(gx, gz) {
    const world = this.gridToWorld(gx, gz);
    this.growthPulse = 1.0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.mesh.position.set(world.x, 0.45, world.z);
      const angle = (Math.PI * 2 * i) / this.particles.length + Math.random() * 0.4;
      const speed = 1.8 + Math.random() * 2.8;
      p.vel.set(
        Math.cos(angle) * speed,
        2.2 + Math.random() * 2.5,
        Math.sin(angle) * speed
      );
      p.life = p.maxLife;
      p.mesh.visible = true;
      p.mesh.scale.setScalar(1);
    }
  }

  /**
   * Synchronize and position 3D snake meshes from interpolated segment positions.
   */
  updateSnakeVisuals(interpolatedSegments, direction) {
    const bodyCount = Math.max(0, interpolatedSegments.length - 1);

    // Grow mesh pool if snake grew longer
    while (this.segmentMeshes.length < bodyCount) {
      const mesh = new THREE.Mesh(this.bodyGeo, this.bodyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.snakeGroup.add(mesh);
      this.segmentMeshes.push(mesh);
    }

    // Hide excess pooled meshes after game restart
    for (let i = 0; i < this.segmentMeshes.length; i++) {
      this.segmentMeshes[i].visible = i < bodyCount;
    }

    // Position Head (index 0)
    if (interpolatedSegments.length > 0) {
      const headSeg = interpolatedSegments[0];
      const headWorld = this.gridToWorld(headSeg.x, headSeg.z);
      const pulseScale = 1 + this.growthPulse * 0.16;
      this.headGroup.position.set(headWorld.x, 0.42, headWorld.z);
      this.headGroup.scale.set(pulseScale, pulseScale, pulseScale);

      // Rotate head to face movement direction
      if (direction.x === 1) this.headGroup.rotation.y = 0;
      else if (direction.x === -1) this.headGroup.rotation.y = Math.PI;
      else if (direction.z === 1) this.headGroup.rotation.y = -Math.PI / 2;
      else if (direction.z === -1) this.headGroup.rotation.y = Math.PI / 2;
    }

    // Position Body & Tail segments
    for (let i = 1; i < interpolatedSegments.length; i++) {
      const seg = interpolatedSegments[i];
      const mesh = this.segmentMeshes[i - 1];
      const world = this.gridToWorld(seg.x, seg.z);

      const isTail = i === interpolatedSegments.length - 1;
      mesh.material = isTail ? this.tailMat : this.bodyMat;

      // Subtle taper toward the tail and ripple wave when growing
      const taper = isTail ? 0.78 : Math.max(0.84, 1 - (i / (interpolatedSegments.length + 6)) * 0.18);
      const ripple = 1 + Math.sin(this.clockTime * 10 - i * 0.7) * (this.growthPulse * 0.12);
      const scale = taper * ripple;

      mesh.position.set(world.x, 0.36 * scale, world.z);
      mesh.scale.set(scale, scale, scale);
    }
  }

  /**
   * Update food position, floating bob, and rotation.
   */
  updateFoodVisuals(foodPos, dt) {
    if (!foodPos) {
      this.foodGroup.visible = false;
      return;
    }
    this.foodGroup.visible = true;
    const world = this.gridToWorld(foodPos.x, foodPos.z);
    const bobOffset = Math.sin(this.clockTime * 4.2) * 0.12;
    const pulse = 1 + Math.sin(this.clockTime * 6.5) * 0.08;

    this.foodGroup.position.set(world.x, 0.48 + bobOffset, world.z);
    this.foodOrb.rotation.y += dt * 2.2;
    this.foodOrb.rotation.x += dt * 1.4;
    this.foodOrb.scale.setScalar(pulse);

    this.foodRing.rotation.z -= dt * 1.8;
    this.foodRing.scale.setScalar(1 + Math.sin(this.clockTime * 4.2) * 0.1);
  }

  /**
   * Update active burst particles and ambient background motion.
   */
  updateEffects(dt, gameState) {
    this.clockTime += dt;
    if (this.growthPulse > 0) {
      this.growthPulse = Math.max(0, this.growthPulse - dt * 2.8);
    }

    // Update burst particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.vel, dt);
          p.vel.y -= 6.5 * dt; // Gravity
          p.mesh.rotation.x += 5 * dt;
          p.mesh.rotation.y += 5 * dt;
          const ratio = p.life / p.maxLife;
          p.mesh.scale.setScalar(ratio);
          p.mesh.material.opacity = ratio;
        }
      }
    }

    // Gently rotate ambient dust
    if (this.ambientDust) {
      this.ambientDust.rotation.y = this.clockTime * 0.04;
    }

    // Subtle camera orbit in Main Menu, steady tactical framing during gameplay
    if (gameState === 'MENU') {
      const angle = Math.sin(this.clockTime * 0.35) * 0.28;
      this.camera.position.x = Math.sin(angle) * 17.5;
      this.camera.position.z = Math.cos(angle) * 17.5;
      this.camera.position.y = 20.5 + Math.sin(this.clockTime * 0.5) * 0.6;
      this.camera.lookAt(0, -0.4, 0);
    } else {
      // Smoothly return camera to optimal overhead angled perspective
      this.camera.position.lerp(this.baseCameraPos, Math.min(1, dt * 6));
      this.camera.lookAt(0, -0.5, 0.8);
    }
  }

  render(snake, food, alpha, dt, gameState) {
    const interpolated = snake.getInterpolatedSegments(alpha);
    this.updateSnakeVisuals(interpolated, snake.direction);
    this.updateFoodVisuals(food.position, dt);
    this.updateEffects(dt, gameState);
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(1, height);

    this.camera.aspect = aspect;
    // Dynamically adjust camera distance on narrow portrait mobile screens so the entire square arena stays visible
    if (aspect < 0.85) {
      const zoomOut = (0.85 - aspect) * 16;
      this.baseCameraPos.set(0, 21.5 + zoomOut * 1.15, 16.5 + zoomOut);
    } else {
      this.baseCameraPos.set(0, 21.5, 16.5);
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
