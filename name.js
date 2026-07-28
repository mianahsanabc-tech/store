// HIGH STAKES 3D POOL ENGINE (Three.js + Cannon.js)
let scene, camera, renderer, world;
let balls = [], cueBall, cueStick, aimLine;
let aimAngle = 0;
let isCharging = false, power = 0;
let turn = 1; // Player 1 or Player 2

// Web Audio Sound Synthesizer for Realist Impacts
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playStrikeSound(volume = 1) {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch(e){}
}

function initGame() {
  // 1. Three.js Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d16);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 18, 14);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const light1 = new THREE.SpotLight(0xffffff, 0.8);
  light1.position.set(-5, 15, 0);
  light1.castShadow = true;
  scene.add(light1);

  const light2 = new THREE.SpotLight(0xffffff, 0.8);
  light2.position.set(5, 15, 0);
  light2.castShadow = true;
  scene.add(light2);

  // 2. Cannon.js Physics Engine
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);

  createTable();
  createBalls();
  createCueStick();
  createAimLine();

  // Event Listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', (e) => { if (e.code === 'Space') isCharging = true; });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') shootCue(); });

  animate();
}

// 3. TABLE & CUSHIONS
function createTable() {
  // Felt Surface
  const feltGeo = new THREE.BoxGeometry(10, 0.2, 5);
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.4 });
  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  feltMesh.receiveShadow = true;
  scene.add(feltMesh);

  const tableBody = new CANNON.Body({ mass: 0 });
  tableBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 0.1, 2.5)));
  tableBody.position.set(0, -0.1, 0);
  world.addBody(tableBody);

  // Cushions Borders
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.2 });
  const borders = [
    { size: [10.8, 0.6, 0.4], pos: [0, 0.3, 2.7] },
    { size: [10.8, 0.6, 0.4], pos: [0, 0.3, -2.7] },
    { size: [0.4, 0.6, 5.8], pos: [5.2, 0.3, 0] },
    { size: [0.4, 0.6, 5.8], pos: [-5.2, 0.3, 0] },
  ];

  borders.forEach(b => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size), borderMat);
    mesh.position.set(...b.pos);
    mesh.castShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(b.size[0]/2, b.size[1]/2, b.size[2]/2)));
    body.position.set(...b.pos);
    world.addBody(body);
  });
}

// 4. BALLS & PHYSICS RACK
function createBalls() {
  const ballRadius = 0.18;
  const sphereGeo = new THREE.SphereGeometry(ballRadius, 32, 32);

  const colors = [
    0xffffff, // 0: Cue
    0xfacc15, 0x1d4ed8, 0xb91c1c, 0x6b21a8, 0xc2410c, 0x15803d, 0x881337, 0x000000, // 1-8
    0xfacc15, 0x1d4ed8, 0xb91c1c, 0x6b21a8, 0xc2410c, 0x15803d, 0x881337 // 9-15
  ];

  // Spawn Cue Ball
  spawnBall(0, -2, 0, colors[0], true);

  // Triangle Rack (15 Object Balls)
  let idx = 1;
  const startX = 2;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row <= col; row++) {
      let x = startX + col * (ballRadius * 1.9);
      let z = (row - col / 2) * (ballRadius * 2.1);
      spawnBall(x, z, idx, colors[idx], false);
      idx++;
    }
  }
}

function spawnBall(x, z, num, color, isCue) {
  const ballRadius = 0.18;
  const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.1, metalness: 0.1 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 32, 32), mat);
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Sphere(ballRadius);
  const body = new CANNON.Body({ mass: 0.2, shape: shape });
  body.position.set(x, ballRadius, z);
  body.linearDamping = 0.35;
  body.angularDamping = 0.35;
  world.addBody(body);

  const ballObj = { mesh, body, isCue, num };
  balls.push(ballObj);
  if (isCue) cueBall = ballObj;

  // Collision Sound Callback
  body.addEventListener("collide", (e) => {
    const relativeVelocity = e.contact.getImpactVelocityAlongNormal();
    if (relativeVelocity > 0.5) playStrikeSound(Math.min(relativeVelocity / 10, 1));
  });
}

// 5. CUE STICK & AIMING
function createCueStick() {
  const geo = new THREE.CylinderGeometry(0.03, 0.06, 6, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });
  cueStick = new THREE.Mesh(geo, mat);
  cueStick.rotation.z = Math.PI / 2;
  scene.add(cueStick);
}

function createAimLine() {
  const mat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.2, gapSize: 0.1 });
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(5,0,0)]);
  aimLine = new THREE.Line(geo, mat);
  aimLine.computeLineDistances();
  scene.add(aimLine);
}

function onMouseMove(e) {
  if (!cueBall) return;
  // Calculate Aim Angle relative to Mouse Position
  const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  aimAngle = mouseX * Math.PI;
}

function shootCue() {
  if (!cueBall || power <= 0) return;
  
  const force = power * 0.4;
  const vx = Math.cos(aimAngle) * force;
  const vz = Math.sin(aimAngle) * force;

  cueBall.body.velocity.set(vx, 0, vz);
  playStrikeSound(1);

  power = 0;
  isCharging = false;
  document.getElementById('powerBar').style.width = '0%';

  // Switch Turns
  turn = turn === 1 ? 2 : 1;
  updateHUD();
}

function updateHUD() {
  document.getElementById('turn-txt').textContent = `PLAYER ${turn}'S TURN`;
  document.getElementById('p1-hud').classList.toggle('active', turn === 1);
  document.getElementById('p2-hud').classList.toggle('active', turn === 2);
}

// 6. ANIMATION LOOP
function animate() {
  requestAnimationFrame(animate);

  // Update Cannon Physics
  world.step(1 / 60);

  // Sync Three.js Meshes with Physics Bodies
  balls.forEach(b => {
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);

    // Pocket Fall Check
    if (Math.abs(b.mesh.position.x) > 4.8 || Math.abs(b.mesh.position.z) > 2.4) {
      if (b.isCue) {
        // Scratch - Respawn Cue
        b.body.position.set(-2, 0.18, 0);
        b.body.velocity.set(0, 0, 0);
      }
    }
  });

  // Charging Power Bar Logic
  if (isCharging) {
    power = Math.min(power + 0.8, 30);
    document.getElementById('powerBar').style.width = `${(power / 30) * 100}%`;
  }

  // Update Aim Guide & Cue Stick Position
  if (cueBall) {
    const isMoving = balls.some(b => b.body.velocity.length() > 0.05);

    if (!isMoving) {
      cueStick.visible = true;
      aimLine.visible = true;

      const cuePos = cueBall.mesh.position;
      aimLine.position.set(cuePos.x, cuePos.y, cuePos.z);
      aimLine.rotation.y = -aimAngle;

      // Position Cue Stick behind Cue Ball
      const offset = 3.2 + (power * 0.05);
      cueStick.position.set(
        cuePos.x - Math.cos(aimAngle) * offset,
        cuePos.y + 0.1,
        cuePos.z - Math.sin(aimAngle) * offset
      );
      cueStick.rotation.y = -aimAngle;
    } else {
      cueStick.visible = false;
      aimLine.visible = false;
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = initGame;
