// ==========================================
// CHÙA ONLINE — 3D Client & Realtime Movement
// ==========================================

const State = {
  self: null,
  players: new Map(), // id -> { data, mesh, bones, currentAction, actionTimer, isMoving, isSitting, walkCycle, targetPos, targetRot }
  seats: [],          // index -> { position, mesh, occupiedBy }
  audioEnabled: false,
  beadCount: 0,
  roundCount: 0,
  mokoCount: 0,
  ws: null,
  monkTemplate: null,
  buddhaMesh: null,
  mySeatIndex: -1,
  isSitting: true,
  moveVector: { x: 0, z: 0 },
  moveSpeed: 2.3,
  keys: {}
};

// Khởi tạo Audio Context cho tiếng chuông và mõ
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. Âm thanh Mõ gỗ (Synthesized Woodblock)
function playWoodblockSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.Q.setValueAtTime(4, ctx.currentTime);

    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);

    if (navigator.vibrate) navigator.vibrate(25);
  } catch (e) {}
}

// 2. Âm thanh Chuông khánh (Synthesized Temple Bell)
function playTempleBellSound() {
  try {
    const ctx = getAudioContext();
    const baseFreqs = [528, 1056, 1584, 2112];
    const decays = [3.0, 2.0, 1.2, 0.8];
    const gains = [0.6, 0.3, 0.15, 0.08];

    baseFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gains[i], ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decays[i]);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + decays[i]);
    });

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  } catch (e) {}
}

// 3. Khởi tạo Three.js Scene
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141210);
scene.fog = new THREE.FogExp2(0x141210, 0.045);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.2, 5.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minPolarAngle = Math.PI / 5.0;
controls.minDistance = 2.0;
controls.maxDistance = 14;
controls.target.set(0, 1.0, 0);

// Ánh sáng Chánh Điện
const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.7);
scene.add(ambientLight);

const buddhaSpotLight = new THREE.SpotLight(0xffdf88, 3.5, 25, Math.PI / 4.5, 0.4, 1.2);
buddhaSpotLight.position.set(0, 9, -2);
buddhaSpotLight.target.position.set(0, 2.2, -6.5);
buddhaSpotLight.castShadow = true;
scene.add(buddhaSpotLight);
scene.add(buddhaSpotLight.target);

const candleLeft = new THREE.PointLight(0xff9933, 1.8, 10);
candleLeft.position.set(-2.4, 1.6, -5.5);
scene.add(candleLeft);

const candleRight = new THREE.PointLight(0xff9933, 1.8, 10);
candleRight.position.set(2.4, 1.6, -5.5);
scene.add(candleRight);

// Sàn gỗ Chánh điện
const floorGeo = new THREE.PlaneGeometry(30, 30);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x221a14,
  roughness: 0.35,
  metalness: 0.1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Bục Tam Bảo (Altar Platform)
const altarGeo = new THREE.BoxGeometry(8, 0.8, 4);
const altarMat = new THREE.MeshStandardMaterial({ color: 0x2c2017, roughness: 0.4 });
const altar = new THREE.Mesh(altarGeo, altarMat);
altar.position.set(0, 0.4, -6.5);
altar.receiveShadow = true;
altar.castShadow = true;
scene.add(altar);

// Tấm thảm đỏ bục sen
const rugGeo = new THREE.BoxGeometry(4.5, 0.05, 2.8);
const rugMat = new THREE.MeshStandardMaterial({ color: 0x6e1b1b, roughness: 0.8 });
const rug = new THREE.Mesh(rugGeo, rugMat);
rug.position.set(0, 0.82, -6.5);
scene.add(rug);

// Hàng rào cột gỗ phía sau
const wallGeo = new THREE.BoxGeometry(18, 8, 0.6);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b140f, roughness: 0.8 });
const backWall = new THREE.Mesh(wallGeo, wallMat);
backWall.position.set(0, 4, -9);
scene.add(backWall);

// 36 Bồ đoàn (Đệm ngồi thiền hình tròn xếp thành 6x6)
const cushionGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.12, 24);
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x3d2b20, roughness: 0.85 });
const cushionMatActive = new THREE.MeshStandardMaterial({ color: 0xa87d32, roughness: 0.7 });

const cushionRaycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const seatMeshes = [];

const COLS = 6;
const ROWS = 6;
const SPACING_X = 1.35;
const SPACING_Z = 1.25;
const START_X = -((COLS - 1) * SPACING_X) / 2;
const START_Z = -2.8;

let seatIndexCounter = 0;
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const mesh = new THREE.Mesh(cushionGeo, cushionMat.clone());
    const posX = START_X + c * SPACING_X;
    const posZ = START_Z + r * SPACING_Z;
    mesh.position.set(posX, 0.06, posZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData = { seatIndex: seatIndexCounter };

    scene.add(mesh);
    seatMeshes.push(mesh);

    State.seats.push({
      index: seatIndexCounter,
      position: new THREE.Vector3(posX, 0.12, posZ),
      mesh: mesh,
      occupiedBy: null
    });

    seatIndexCounter++;
  }
}

// 4. Tải Mô hình 3D (Tượng Phật & Chú tiểu)
const gltfLoader = new THREE.GLTFLoader();
if (typeof MeshoptDecoder !== 'undefined') {
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
}

const loadingText = document.getElementById('loading-text');
const progressFill = document.getElementById('progress-fill');
const loadingScreen = document.getElementById('loading-screen');

function updateProgress(percent, msg) {
  progressFill.style.width = `${percent}%`;
  loadingText.textContent = msg;
}

function sanitizeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geo = obj.geometry;
      if (geo.attributes) {
        for (const k in geo.attributes) {
          if (!geo.attributes[k]) {
            delete geo.attributes[k];
          }
        }
      }
      if (geo.morphAttributes) {
        for (const k in geo.morphAttributes) {
          if (Array.isArray(geo.morphAttributes[k])) {
            geo.morphAttributes[k] = geo.morphAttributes[k].filter((attr) => attr != null);
            if (geo.morphAttributes[k].length === 0) {
              delete geo.morphAttributes[k];
            }
          }
        }
      }
    }
  });
}

function startLoading() {
  updateProgress(20, 'Đang tải Tôn tượng Đức Bổn Sư Thích Ca Mâu Ni...');

  gltfLoader.load(
    '/assets/models/buddha.glb',
    (gltf) => {
      const buddha = gltf.scene;
      sanitizeObject(buddha);
      buddha.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.metalness = 0.55;
            child.material.roughness = 0.35;
          }
        }
      });

      const box = new THREE.Box3().setFromObject(buddha);
      const size = box.getSize(new THREE.Vector3());
      const scale = 3.6 / size.y;
      buddha.scale.set(scale, scale, scale);
      buddha.position.set(0, 0.85, -6.6);
      buddha.rotation.y = 0;

      scene.add(buddha);
      State.buddhaMesh = buddha;

      updateProgress(60, 'Đang khởi tạo nhân vật Chú tiểu Chibi...');
      loadMonkModel();
    },
    undefined,
    (err) => {
      console.warn('Lỗi tải tượng Phật:', err);
      loadMonkModel();
    }
  );
}

function loadMonkModel() {
  gltfLoader.load(
    '/assets/models/monk.glb',
    (gltf) => {
      State.monkTemplate = gltf.scene;
      sanitizeObject(State.monkTemplate);

      const box = new THREE.Box3().setFromObject(State.monkTemplate);
      const size = box.getSize(new THREE.Vector3());
      const monkScale = 1.1 / size.y;
      State.monkTemplate.scale.set(monkScale, monkScale, monkScale);

      State.monkTemplate.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      finishLoading();
    },
    undefined,
    (err) => {
      console.warn('Lỗi tải chú tiểu:', err);
      finishLoading();
    }
  );
}

function finishLoading() {
  updateProgress(100, 'Tịnh tâm thanh tịnh...');
  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => (loadingScreen.style.display = 'none'), 600);
    connectWebSocket();
  }, 400);
}

if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder.ready) {
  MeshoptDecoder.ready.then(() => startLoading());
} else {
  startLoading();
}

// 5. Tạo Chú tiểu cho người chơi
function createMonkInstance(playerData) {
  if (!State.monkTemplate) return null;

  const clone = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(State.monkTemplate) : State.monkTemplate.clone(true);
  sanitizeObject(clone);

  const bones = {};
  clone.traverse((obj) => {
    if (obj.isBone || obj.type === 'Bone' || (obj.name && (obj.name.includes('arm') || obj.name.includes('hand') || obj.name.includes('spine') || obj.name.includes('head') || obj.name.includes('hips') || obj.name.includes('thigh') || obj.name.includes('shin')))) {
      bones[obj.name] = obj;
    }
  });

  // Bảng tên pháp danh trên đầu chú tiểu
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(25, 22, 18, 0.75)';
  ctx.roundRect ? ctx.roundRect(10, 8, 236, 48, 16) : ctx.fillRect(10, 8, 236, 48);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 187, 88, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#f5ede0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerData.name, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const nameSprite = new THREE.Sprite(spriteMat);
  nameSprite.position.set(0, 1.45, 0);
  nameSprite.scale.set(1.4, 0.35, 1);
  clone.add(nameSprite);

  scene.add(clone);

  // Vị trí xuất phát
  if (playerData.seatIndex !== undefined && playerData.seatIndex >= 0 && State.seats[playerData.seatIndex]) {
    clone.position.copy(State.seats[playerData.seatIndex].position);
    clone.rotation.y = Math.PI;
  } else if (playerData.x !== undefined && playerData.z !== undefined) {
    clone.position.set(playerData.x, 0.06, playerData.z);
    clone.rotation.y = playerData.rot || Math.PI;
  }

  return {
    mesh: clone,
    bones: bones,
    currentAction: playerData.action || 'idle',
    actionTimer: 0,
    isMoving: !!playerData.isMoving,
    isSitting: playerData.isSitting !== undefined ? playerData.isSitting : true,
    walkCycle: 0,
    targetPos: clone.position.clone(),
    targetRot: clone.rotation.y,
    baseRotations: captureBaseRotations(bones)
  };
}

function captureBaseRotations(bones) {
  const bases = {};
  for (let k in bones) {
    bases[k] = bones[k].rotation.clone();
  }
  return bases;
}

// 6. Xử lý Chuyển động (Animations: Đi bộ, Ngồi thiền, Chắp tay, Lạy Phật)
function updateMonkAnimation(monkData, delta, time) {
  if (!monkData || !monkData.bones) return;
  const b = monkData.bones;
  const base = monkData.baseRotations;
  const action = monkData.currentAction;

  monkData.actionTimer += delta;

  // 1. Chuyển động Đi bộ (Walking Waddle)
  if (monkData.isMoving) {
    monkData.walkCycle = (monkData.walkCycle || 0) + delta * 11;
    const wc = monkData.walkCycle;

    // Đánh chân so le
    if (b['thigh.L'] && base['thigh.L']) b['thigh.L'].rotation.x = base['thigh.L'].x + Math.sin(wc) * 0.45;
    if (b['thigh.R'] && base['thigh.R']) b['thigh.R'].rotation.x = base['thigh.R'].x - Math.sin(wc) * 0.45;

    // Gập gối khi nhấc chân
    if (b['shin.L'] && base['shin.L']) b['shin.L'].rotation.x = base['shin.L'].x + Math.max(0, -Math.sin(wc)) * 0.4;
    if (b['shin.R'] && base['shin.R']) b['shin.R'].rotation.x = base['shin.R'].x + Math.max(0, Math.sin(wc)) * 0.4;

    // Đánh tay tự nhiên ngược chiều chân
    if (b['upper_arm.L'] && base['upper_arm.L']) b['upper_arm.L'].rotation.x = base['upper_arm.L'].x - Math.sin(wc) * 0.35;
    if (b['upper_arm.R'] && base['upper_arm.R']) b['upper_arm.R'].rotation.x = base['upper_arm.R'].x + Math.sin(wc) * 0.35;

    // Nhấp nhô hông và lắc lư dễ thương
    if (b['hips']) b['hips'].position.y = 0.7 + Math.abs(Math.sin(wc)) * 0.04;
    if (b['spine'] && base['spine']) b['spine'].rotation.z = Math.sin(wc * 0.5) * 0.08;
    return;
  }

  // 2. Chuyển động Tọa thiền / Đảnh lễ
  // Nhịp thở tĩnh lặng
  const breath = Math.sin(time * 2.2) * 0.03;
  if (b['spine'] && base['spine']) {
    b['spine'].rotation.x = base['spine'].x + breath * 0.5;
    b['spine'].rotation.z = 0;
  }
  if (b['head'] && base['head']) {
    b['head'].rotation.x = base['head'].x - breath * 0.4;
  }

  // Hành động Chắp tay (Gassho)
  if (action === 'gassho') {
    const t = Math.min(monkData.actionTimer * 4.0, 1.0);
    if (b['upper_arm.L']) b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.L']?.z || 0, -0.65, t);
    if (b['upper_arm.R']) b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.R']?.z || 0, 0.65, t);
    if (b['forearm.L']) b['forearm.L'].rotation.y = THREE.MathUtils.lerp(base['forearm.L']?.y || 0, 1.1, t);
    if (b['forearm.R']) b['forearm.R'].rotation.y = THREE.MathUtils.lerp(base['forearm.R']?.y || 0, -1.1, t);
  }
  // Hành động Lạy Phật (Kowtow)
  else if (action === 'bow') {
    const progress = (monkData.actionTimer % 3.0) / 3.0;
    let bowFactor = 0;
    if (progress < 0.4) {
      bowFactor = Math.sin((progress / 0.4) * (Math.PI / 2));
    } else if (progress < 0.7) {
      bowFactor = 1.0;
    } else {
      bowFactor = Math.cos(((progress - 0.7) / 0.3) * (Math.PI / 2));
    }

    if (b['spine']) b['spine'].rotation.x = THREE.MathUtils.lerp(base['spine']?.x || 0, 0.95, bowFactor);
    if (b['head']) b['head'].rotation.x = THREE.MathUtils.lerp(base['head']?.x || 0, 0.6, bowFactor);
    if (b['hips']) b['hips'].position.y = THREE.MathUtils.lerp(0.7, 0.35, bowFactor);

    if (monkData.actionTimer >= 3.0) {
      monkData.currentAction = 'idle';
      monkData.actionTimer = 0;
    }
  }
  // Trạng thái nghỉ (Tọa thiền hoặc Đứng thẳng)
  else {
    for (let k in base) {
      if (b[k] && !k.includes('spine') && !k.includes('head')) {
        b[k].rotation.x = THREE.MathUtils.lerp(b[k].rotation.x, base[k].x, 0.1);
        b[k].rotation.y = THREE.MathUtils.lerp(b[k].rotation.y, base[k].y, 0.1);
        b[k].rotation.z = THREE.MathUtils.lerp(b[k].rotation.z, base[k].z, 0.1);
      }
    }
    if (b['hips']) b['hips'].position.y = monkData.isSitting ? 0.7 : 0.74;
  }
}

// 7. Kết nối WebSocket Realtime
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  State.ws = new WebSocket(wsUrl);

  State.ws.onopen = () => {
    console.log('Đã kết nối với máy chủ Chùa Online!');
    setInterval(() => {
      if (State.ws.readyState === WebSocket.OPEN) {
        State.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  };

  State.ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch (e) {}
  };

  State.ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function handleServerMessage(msg) {
  if (msg.type === 'welcome') {
    State.self = msg.self;
    State.mySeatIndex = msg.self.seatIndex;
    State.isSitting = msg.self.isSitting !== undefined ? msg.self.isSitting : true;
    updateSitButtonUI();

    document.getElementById('user-display-name').textContent = msg.self.name;
    document.getElementById('online-count').textContent = msg.totalOnline;

    const myMonk = createMonkInstance(msg.self);
    State.players.set(msg.self.id, { data: msg.self, ...myMonk });

    if (myMonk) {
      controls.target.copy(myMonk.mesh.position).add(new THREE.Vector3(0, 0.9, 0));
    }

    msg.players.forEach((p) => {
      if (p.id !== msg.self.id) {
        const monk = createMonkInstance(p);
        State.players.set(p.id, { data: p, ...monk });
      }
    });

    updateSeatVisuals();
  }

  if (msg.type === 'player_joined') {
    document.getElementById('online-count').textContent = msg.totalOnline;
    const monk = createMonkInstance(msg.player);
    State.players.set(msg.player.id, { data: msg.player, ...monk });
    showToast(`Đồng tu ${msg.player.name} vừa bước vào Chánh điện 🙏`);
    updateSeatVisuals();
  }

  if (msg.type === 'player_moved_pos') {
    const p = State.players.get(msg.id);
    if (p) {
      p.targetPos = new THREE.Vector3(msg.x, 0.06, msg.z);
      p.targetRot = msg.rot;
      p.isMoving = msg.isMoving;
      p.isSitting = msg.isSitting;
      p.data.seatIndex = msg.seatIndex;
    }
  }

  if (msg.type === 'player_stood_up') {
    const p = State.players.get(msg.id);
    if (p) {
      p.isSitting = false;
      p.data.seatIndex = -1;
    }
    updateSeatVisuals();
  }

  if (msg.type === 'player_action') {
    const p = State.players.get(msg.id);
    if (p) {
      p.currentAction = msg.action;
      p.actionTimer = 0;
    }
    if (msg.action === 'gassho' && msg.id !== State.self?.id) {
      showToast(`${msg.name} vừa chắp tay đảnh lễ 🙏`);
    } else if (msg.action === 'bow' && msg.id !== State.self?.id) {
      showToast(`${msg.name} vừa kính cẩn lạy Phật 🙇`);
    }
  }

  if (msg.type === 'player_moved') {
    const p = State.players.get(msg.id);
    if (p) {
      p.data.seatIndex = msg.seatIndex;
      p.isSitting = true;
      const seat = State.seats[msg.seatIndex];
      if (seat) p.mesh.position.copy(seat.position);
    }
    updateSeatVisuals();
  }

  if (msg.type === 'player_left') {
    document.getElementById('online-count').textContent = msg.totalOnline;
    const p = State.players.get(msg.id);
    if (p) {
      scene.remove(p.mesh);
      State.players.delete(msg.id);
    }
    updateSeatVisuals();
  }
}

function updateSeatVisuals() {
  State.seats.forEach((seat) => {
    let isOccupied = false;
    State.players.forEach((p) => {
      if (p.data && p.data.seatIndex === seat.index && p.isSitting) isOccupied = true;
    });
    seat.mesh.material = (seat.index === State.mySeatIndex && State.isSitting) ? cushionMatActive : cushionMat;
  });
}

// Gửi di chuyển throttled
let lastMoveSend = 0;
function sendMoveThrottled(x, z, rot, isMoving) {
  const now = performance.now();
  if (now - lastMoveSend > 60 || !isMoving) {
    lastMoveSend = now;
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({
        type: 'move',
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        rot: Math.round(rot * 100) / 100,
        isMoving: isMoving,
        isSitting: State.isSitting,
        seatIndex: State.mySeatIndex
      }));
    }
  }
}

function sendAction(actionName) {
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ type: 'action', action: actionName }));
  }
  const myPlayer = State.players.get(State.self?.id);
  if (myPlayer) {
    myPlayer.currentAction = actionName;
    myPlayer.actionTimer = 0;
  }
}

// 8. Điều khiển Bàn phím & Cần điều khiển ảo (Virtual Joystick)
window.addEventListener('keydown', (e) => {
  State.keys[e.key.toLowerCase()] = true;
  State.keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  State.keys[e.key.toLowerCase()] = false;
  State.keys[e.code] = false;
});

// Joystick Cảm ứng
const joystickContainer = document.getElementById('joystick-container');
const joystickThumb = document.getElementById('joystick-thumb');
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
const JOYSTICK_RADIUS = 38;

if (joystickContainer && joystickThumb) {
  joystickContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    const rect = joystickContainer.getBoundingClientRect();
    joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    handleJoystickMove(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        handleJoystickMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }, { passive: false });

  function resetJoystick() {
    joystickTouchId = null;
    State.moveVector.x = 0;
    State.moveVector.z = 0;
    joystickThumb.style.transform = `translate(0px, 0px)`;
  }

  window.addEventListener('touchend', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        resetJoystick();
        break;
      }
    }
  });
  window.addEventListener('touchcancel', resetJoystick);

  function handleJoystickMove(clientX, clientY) {
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    State.moveVector.x = dx / JOYSTICK_RADIUS;
    State.moveVector.z = dy / JOYSTICK_RADIUS;
  }
}

// Nút Tọa thiền / Đứng dậy
const btnToggleSit = document.getElementById('btn-toggle-sit');
const sitIcon = document.getElementById('sit-icon');
const sitLabel = document.getElementById('sit-label');

function updateSitButtonUI() {
  if (!sitIcon || !sitLabel) return;
  if (State.isSitting) {
    sitIcon.textContent = '🚶';
    sitLabel.textContent = 'Đứng dậy';
  } else {
    sitIcon.textContent = '🧘';
    sitLabel.textContent = 'Tọa thiền';
  }
}

if (btnToggleSit) {
  btnToggleSit.addEventListener('click', () => {
    if (State.isSitting) {
      standUp();
    } else {
      sitDownNearest();
    }
  });
}

function standUp() {
  State.isSitting = false;
  State.mySeatIndex = -1;
  updateSitButtonUI();
  updateSeatVisuals();

  const myP = State.players.get(State.self?.id);
  if (myP) {
    myP.isSitting = false;
  }
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ type: 'stand_up' }));
  }
}

function sitDownNearest() {
  const myP = State.players.get(State.self?.id);
  if (!myP) return;

  let nearestSeat = -1;
  let minDist = Infinity;
  State.seats.forEach((seat) => {
    let occupied = false;
    State.players.forEach((p) => {
      if (p.data && p.data.seatIndex === seat.index && p.isSitting && p.data.id !== State.self?.id) {
        occupied = true;
      }
    });
    if (!occupied) {
      const d = myP.mesh.position.distanceTo(seat.position);
      if (d < minDist) {
        minDist = d;
        nearestSeat = seat.index;
      }
    }
  });

  if (nearestSeat !== -1) {
    const seat = State.seats[nearestSeat];
    myP.mesh.position.copy(seat.position);
    myP.mesh.rotation.y = Math.PI;
    State.mySeatIndex = nearestSeat;
    State.isSitting = true;
    myP.isSitting = true;
    updateSitButtonUI();
    updateSeatVisuals();
    playTempleBellSound();

    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ type: 'change_seat', seatIndex: nearestSeat }));
    }
  }
}

// Toast Thông báo
const toastEl = document.getElementById('action-toast');
const toastTextEl = document.getElementById('toast-text');
let toastTimeout = null;

function showToast(text) {
  toastTextEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// Đăng ký Sự kiện Tương tác (UI & Cảm ứng)
document.getElementById('btn-gassho').addEventListener('click', () => {
  sendAction('gassho');
  playTempleBellSound();
});

document.getElementById('btn-bow').addEventListener('click', () => {
  sendAction('bow');
  playTempleBellSound();
});

document.getElementById('btn-woodblock').addEventListener('click', () => {
  State.mokoCount++;
  document.getElementById('moko-count').textContent = State.mokoCount;
  playWoodblockSound();
  sendAction('woodblock');
});

// Tràng Hạt Bồ Đề
const beadsModal = document.getElementById('beads-modal');
const beadSwipeZone = document.getElementById('bead-swipe-zone');
const currentBead = document.getElementById('current-bead');
const beadsCountedEl = document.getElementById('beads-counted');
const roundsCountedEl = document.getElementById('rounds-counted');

document.getElementById('btn-beads').addEventListener('click', () => {
  beadsModal.classList.remove('hidden');
});

document.getElementById('close-beads').addEventListener('click', () => {
  beadsModal.classList.add('hidden');
});

function advanceBead() {
  State.beadCount++;
  currentBead.classList.add('clicked');
  setTimeout(() => currentBead.classList.remove('clicked'), 120);

  if (State.beadCount >= 108) {
    State.beadCount = 0;
    State.roundCount++;
    playTempleBellSound();
    showToast('Hoàn thành 1 vòng 108 hạt bồ đề. Công đức vô lượng! 📿');
  } else {
    playWoodblockSound();
  }

  beadsCountedEl.textContent = State.beadCount;
  roundsCountedEl.textContent = State.roundCount;
}

beadSwipeZone.addEventListener('click', advanceBead);
document.getElementById('btn-reset-bead').addEventListener('click', () => {
  State.beadCount = 0;
  State.roundCount = 0;
  beadsCountedEl.textContent = 0;
  roundsCountedEl.textContent = 0;
});

// Bật/Tắt âm thanh tụng kinh
const chantAudio = document.getElementById('chant-audio');
const btnAudio = document.getElementById('btn-audio');
const audioIcon = document.getElementById('audio-icon');

btnAudio.addEventListener('click', () => {
  getAudioContext();
  if (State.audioEnabled) {
    chantAudio.pause();
    State.audioEnabled = false;
    audioIcon.textContent = '🔇';
  } else {
    chantAudio.play().then(() => {
      State.audioEnabled = true;
      audioIcon.textContent = '🔊';
    }).catch(() => {});
  }
});

// Hướng dẫn Cài App
const infoModal = document.getElementById('info-modal');
document.getElementById('btn-info').addEventListener('click', () => {
  infoModal.classList.remove('hidden');
});
document.getElementById('close-info').addEventListener('click', () => {
  infoModal.classList.add('hidden');
});

// Chọn bồ đoàn bằng cách chạm
window.addEventListener('pointerdown', (e) => {
  if (e.target.tagName === 'BUTTON' || e.target.closest('.bottom-bar') || e.target.closest('.top-nav') || e.target.closest('.modal-card') || e.target.closest('.joystick-container') || e.target.closest('.toggle-sit-btn')) {
    return;
  }
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  cushionRaycaster.setFromCamera(mouse, camera);
  const intersects = cushionRaycaster.intersectObjects(seatMeshes);

  if (intersects.length > 0) {
    const clickedSeat = intersects[0].object.userData.seatIndex;
    if (clickedSeat !== undefined) {
      const seat = State.seats[clickedSeat];
      const myP = State.players.get(State.self?.id);
      if (myP && seat) {
        myP.mesh.position.copy(seat.position);
        myP.mesh.rotation.y = Math.PI;
        State.mySeatIndex = clickedSeat;
        State.isSitting = true;
        myP.isSitting = true;
        updateSitButtonUI();
        updateSeatVisuals();
        playTempleBellSound();

        if (State.ws && State.ws.readyState === WebSocket.OPEN) {
          State.ws.send(JSON.stringify({ type: 'change_seat', seatIndex: clickedSeat }));
        }
      }
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 9. Vòng lặp Render (60 FPS) & Cập nhật Di chuyển
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const time = clock.getElapsedTime();

  // Đèn nến lung linh
  candleLeft.intensity = 1.6 + Math.sin(time * 8) * 0.25 + Math.cos(time * 15) * 0.15;
  candleRight.intensity = 1.6 + Math.cos(time * 7) * 0.25 + Math.sin(time * 13) * 0.15;

  // Cập nhật di chuyển cho nhân vật của người chơi
  const myPlayer = State.players.get(State.self?.id);
  if (myPlayer && myPlayer.mesh) {
    let inputX = State.moveVector.x;
    let inputZ = State.moveVector.z;

    if (State.keys['w'] || State.keys['arrowup'] || State.keys['keyw']) inputZ -= 1;
    if (State.keys['s'] || State.keys['arrowdown'] || State.keys['keys']) inputZ += 1;
    if (State.keys['a'] || State.keys['arrowleft'] || State.keys['keya']) inputX -= 1;
    if (State.keys['d'] || State.keys['arrowright'] || State.keys['keyd']) inputX += 1;

    const inputLen = Math.hypot(inputX, inputZ);

    if (inputLen > 0.08) {
      if (State.isSitting) {
        standUp();
      }

      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      const camSide = new THREE.Vector3(-camDir.z, 0, camDir.x);

      const moveDir = new THREE.Vector3()
        .addScaledVector(camDir, -inputZ / Math.max(1, inputLen))
        .addScaledVector(camSide, inputX / Math.max(1, inputLen));

      const moveStep = moveDir.clone().multiplyScalar(State.moveSpeed * delta);
      const newPos = myPlayer.mesh.position.clone().add(moveStep);

      // Giới hạn biên Chánh điện
      newPos.x = THREE.MathUtils.clamp(newPos.x, -7.0, 7.0);
      newPos.z = THREE.MathUtils.clamp(newPos.z, -4.6, 6.8);

      myPlayer.mesh.position.copy(newPos);

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      // Xoay góc mặt mượt
      let diff = targetAngle - myPlayer.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      myPlayer.mesh.rotation.y += diff * 0.2;

      myPlayer.isMoving = true;
      sendMoveThrottled(newPos.x, newPos.z, myPlayer.mesh.rotation.y, true);
    } else {
      if (myPlayer.isMoving) {
        myPlayer.isMoving = false;
        sendMoveThrottled(myPlayer.mesh.position.x, myPlayer.mesh.position.z, myPlayer.mesh.rotation.y, false);
      }
    }

    // Camera 3rd-person mượt mà theo sau chú tiểu
    controls.target.lerp(new THREE.Vector3(myPlayer.mesh.position.x, 0.9, myPlayer.mesh.position.z), 0.08);
  }

  // Cập nhật người chơi khác (nội suy vị trí)
  State.players.forEach((p, id) => {
    if (id !== State.self?.id && p.targetPos) {
      p.mesh.position.lerp(p.targetPos, 0.2);
      if (p.targetRot !== undefined) {
        let diff = p.targetRot - p.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.mesh.rotation.y += diff * 0.2;
      }
    }
    updateMonkAnimation(p, delta, time);
  });

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
