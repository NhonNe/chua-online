// ==========================================
// CHÙA ONLINE — 3D Client & Realtime Movement
// Chuẩn phong cách Sansa Temple & Video Viral Chánh Điện
// ==========================================

const State = {
  self: null,
  players: new Map(), // id -> { data, mesh, bones, currentAction, actionTimer, isMoving, isSitting, walkCycle, targetPos, targetRot, baseRotations }
  seats: [],          // index -> { index, position, mesh, occupiedBy }
  audioEnabled: false,
  beadCount: 0,
  roundCount: 0,
  ws: null,
  monkTemplate: null,
  buddhaMesh: null,
  mySeatIndex: 14,
  isSitting: true,
  moveVector: { x: 0, z: 0 },
  moveSpeed: 2.2,
  keys: {},
  destination: null, // Vector3 for Tap-to-move
  destinationSeat: null,
  isAutoWalking: false
};

// 1. Âm thanh Mõ gỗ & Chuông khánh
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

// 2. Khởi tạo Three.js Scene
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15120e);
scene.fog = new THREE.FogExp2(0x15120e, 0.042);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
// Góc nhìn nghiêng trên cao chuẩn theo video viral Sansa Temple
camera.position.set(0, 3.8, 6.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minPolarAngle = Math.PI / 6.0;
controls.minDistance = 2.0;
controls.maxDistance = 15;
controls.target.set(0, 1.1, -1.0);

// Ánh sáng Chánh Điện
const ambientLight = new THREE.AmbientLight(0xffeedd, 0.75);
scene.add(ambientLight);

const buddhaSpotLight = new THREE.SpotLight(0xffdf88, 3.8, 30, Math.PI / 4.2, 0.45, 1.2);
buddhaSpotLight.position.set(0, 9.5, -2.0);
buddhaSpotLight.target.position.set(0, 2.2, -6.5);
buddhaSpotLight.castShadow = true;
scene.add(buddhaSpotLight);
scene.add(buddhaSpotLight.target);

const candleLeft = new THREE.PointLight(0xff9431, 2.0, 11);
candleLeft.position.set(-2.5, 1.6, -5.5);
scene.add(candleLeft);

const candleRight = new THREE.PointLight(0xff9431, 2.0, 11);
candleRight.position.set(2.5, 1.6, -5.5);
scene.add(candleRight);

// Sàn gỗ Chánh điện bóng mờ
const floorGeo = new THREE.PlaneGeometry(32, 32);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x221a14,
  roughness: 0.38,
  metalness: 0.12
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Vòng tròn chỉ thị điểm chạm đến (Target Destination Ring)
const ringGeo = new THREE.RingGeometry(0.08, 0.32, 32);
ringGeo.rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xffd152,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide
});
const targetRing = new THREE.Mesh(ringGeo, ringMat);
targetRing.position.set(0, 0.015, 0);
scene.add(targetRing);
let ringPulseTime = 0;

function showTargetMarker(x, z) {
  targetRing.position.set(x, 0.015, z);
  targetRing.scale.set(1.4, 1.4, 1.4);
  ringMat.opacity = 0.95;
  ringPulseTime = 1.0;
}

// Bục Tam Bảo
const altarGeo = new THREE.BoxGeometry(8, 0.8, 4);
const altarMat = new THREE.MeshStandardMaterial({ color: 0x2c2017, roughness: 0.45 });
const altar = new THREE.Mesh(altarGeo, altarMat);
altar.position.set(0, 0.4, -6.5);
altar.receiveShadow = true;
altar.castShadow = true;
scene.add(altar);

// Tấm thảm đỏ bục sen
const rugGeo = new THREE.BoxGeometry(4.6, 0.05, 2.8);
const rugMat = new THREE.MeshStandardMaterial({ color: 0x6e1b1b, roughness: 0.8 });
const rug = new THREE.Mesh(rugGeo, rugMat);
rug.position.set(0, 0.82, -6.5);
scene.add(rug);

// Vách gỗ sau Chánh điện
const wallGeo = new THREE.BoxGeometry(18, 8, 0.6);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b140f, roughness: 0.85 });
const backWall = new THREE.Mesh(wallGeo, wallMat);
backWall.position.set(0, 4, -9);
scene.add(backWall);

// ==========================================
// 3. BỒ ĐOÀN HÌNH VUÔNG (Chuẩn xác theo video viral TikTok)
// Đệm vuông phẳng màu xám tro vải thô 0x343638
// ==========================================
const cushionGeo = new THREE.BoxGeometry(0.72, 0.05, 0.72);
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x333538, roughness: 0.9 });
const cushionMatActive = new THREE.MeshStandardMaterial({ color: 0x8a6a2c, roughness: 0.75 });

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
    mesh.position.set(posX, 0.025, posZ);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData = { seatIndex: seatIndexCounter };

    scene.add(mesh);
    seatMeshes.push(mesh);

    State.seats.push({
      index: seatIndexCounter,
      position: new THREE.Vector3(posX, 0.05, posZ),
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
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (loadingText) loadingText.textContent = msg;
}

function sanitizeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geo = obj.geometry;
      if (geo.attributes) {
        for (const k in geo.attributes) {
          if (!geo.attributes[k]) delete geo.attributes[k];
        }
      }
      if (geo.morphAttributes) {
        for (const k in geo.morphAttributes) {
          if (Array.isArray(geo.morphAttributes[k])) {
            geo.morphAttributes[k] = geo.morphAttributes[k].filter((attr) => attr != null);
            if (geo.morphAttributes[k].length === 0) delete geo.morphAttributes[k];
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
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => (loadingScreen.style.display = 'none'), 600);
    }
    // Tạo không khí đông đúc (12 đồng tu ngồi tịnh tâm như video viral)
    spawnTempleCrowd();
    connectWebSocket();
  }, 400);
}

if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder.ready) {
  MeshoptDecoder.ready.then(() => startLoading());
} else {
  startLoading();
}

// 5. Tạo Chú tiểu cho người chơi & Đồng tu
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
  if (ctx.roundRect) ctx.roundRect(10, 8, 236, 48, 16);
  else ctx.fillRect(10, 8, 236, 48);
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
    clone.position.set(playerData.x, playerData.isSitting ? 0.05 : 0.0, playerData.z);
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

// ==========================================
// 6. TẠO KHÔNG KHÍ ĐỒNG TU ĐÔNG ĐÚC (Chuẩn video viral "7749 người tới tụng kinh")
// ==========================================
const CROWD_NAMES = [
  'Thích Tuệ Giác', 'Thích Minh Tuệ', 'Thích An Nhiên', 'Thích Giác Ngộ',
  'Thích Thiện Tâm', 'Thích Viên Minh', 'Thích Tịnh Không', 'Thích Pháp Tạng',
  'Thích Từ Quang', 'Thích Diệu Thiện', 'Thích Trí Dũng', 'Thích Quảng Đức'
];
const CROWD_SEATS = [0, 1, 4, 5, 6, 11, 18, 23, 24, 29, 30, 35];

function spawnTempleCrowd() {
  CROWD_SEATS.forEach((seatIdx, i) => {
    const seat = State.seats[seatIdx];
    if (!seat) return;
    const botId = `bot_${seatIdx}`;
    if (State.players.has(botId)) return;

    const botData = {
      id: botId,
      name: CROWD_NAMES[i % CROWD_NAMES.length],
      seatIndex: seatIdx,
      isSitting: true,
      action: 'idle'
    };

    const botMonk = createMonkInstance(botData);
    if (botMonk) {
      State.players.set(botId, { data: botData, ...botMonk, isBot: true });
    }
  });
}

// ==========================================
// 7. XỬ LÝ CHUYỂN ĐỘNG THEO VIDEO VIRAL SANSA TEMPLE
// - Dáng đi Kinh Hành: 2 tay chắp/xếp gọn trước bụng trong tà áo tràng
// - Chân bước ngắn, nhịp nhàng, thân lắc nhẹ chibi waddle
// ==========================================
function updateMonkAnimation(monkData, delta, time) {
  if (!monkData || !monkData.bones) return;
  const b = monkData.bones;
  const base = monkData.baseRotations;
  const action = monkData.currentAction;

  monkData.actionTimer += delta;

  // Cập nhật cao độ êm ái giữa ngồi thiền (y=0.05 trên bồ đoàn) và đi bộ (y=0.0 trên sàn)
  if (monkData.mesh) {
    const targetY = monkData.isSitting ? 0.05 : 0.0;
    monkData.mesh.position.y = THREE.MathUtils.lerp(monkData.mesh.position.y, targetY, 0.15);
  }

  // 1. DÁNG ĐI BỘ / KINH HÀNH CHUẨN XÁC THEO VIDEO TIKTOK
  if (monkData.isMoving) {
    // Tần số bước chân ngắn, nhanh nhẹn, thanh thoát (~9.5 rad/s)
    monkData.walkCycle = (monkData.walkCycle || 0) + delta * 9.5;
    const wc = monkData.walkCycle;
    const stride = Math.sin(wc);

    // 1.1. Chân bước sải ngắn dưới tà áo
    if (b['thigh.L'] && base['thigh.L']) {
      b['thigh.L'].rotation.x = base['thigh.L'].x - stride * 0.28;
    }
    if (b['thigh.R'] && base['thigh.R']) {
      b['thigh.R'].rotation.x = base['thigh.R'].x + stride * 0.28;
    }

    // 1.2. Đầu gối hơi nhấc nhẹ
    if (b['shin.L'] && base['shin.L']) {
      b['shin.L'].rotation.x = base['shin.L'].x + Math.max(0, -stride) * 0.38;
    }
    if (b['shin.R'] && base['shin.R']) {
      b['shin.R'].rotation.x = base['shin.R'].x + Math.max(0, stride) * 0.38;
    }

    // 1.3. HAI TAY XẾP GỌN TRƯỚC BỤNG (KHÔNG ĐÁNH TAY TÙNG PHÈNG)
    // Tay áo tràng thủ lễ cung kính
    if (b['upper_arm.L'] && base['upper_arm.L']) {
      b['upper_arm.L'].rotation.x = base['upper_arm.L'].x + 0.42;
      b['upper_arm.L'].rotation.y = base['upper_arm.L'].y - 0.25;
      b['upper_arm.L'].rotation.z = base['upper_arm.L'].z - 0.40;
    }
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = base['upper_arm.R'].x + 0.42;
      b['upper_arm.R'].rotation.y = base['upper_arm.R'].y + 0.25;
      b['upper_arm.R'].rotation.z = base['upper_arm.R'].z + 0.40;
    }
    if (b['forearm.L'] && base['forearm.L']) {
      b['forearm.L'].rotation.y = 0.85;
      b['forearm.L'].rotation.z = -0.32;
    }
    if (b['forearm.R'] && base['forearm.R']) {
      b['forearm.R'].rotation.y = -0.85;
      b['forearm.R'].rotation.z = 0.32;
    }

    // 1.4. Nhấp nhô xương chậu (Pelvis vertical bounce)
    if (b['hips']) {
      b['hips'].position.y = 0.70 + Math.abs(Math.sin(wc)) * 0.024;
    }

    // 1.5. Lắc lư thân mình chibi waddle nhẹ nhàng sang 2 bên
    if (b['spine'] && base['spine']) {
      b['spine'].rotation.z = Math.sin(wc) * 0.065;
      b['spine'].rotation.x = base['spine'].x + 0.05;
    }

    // 1.6. Đầu nghiêng đối trọng cực đáng yêu
    if (b['head'] && base['head']) {
      b['head'].rotation.z = -Math.sin(wc) * 0.048;
      b['head'].rotation.x = base['head'].x - 0.02 + Math.sin(wc * 2) * 0.012;
    }

    return;
  }

  // 2. CÁC HÀNH ĐỘNG TƯƠNG TÁC (Chắp tay, Lạy Phật)
  // Chắp tay búp sen (Gassho)
  if (action === 'gassho') {
    const t = Math.min(monkData.actionTimer * 4.0, 1.0);
    if (b['upper_arm.L']) b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.L']?.z || 0, -0.65, t);
    if (b['upper_arm.R']) b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.R']?.z || 0, 0.65, t);
    if (b['forearm.L']) b['forearm.L'].rotation.y = THREE.MathUtils.lerp(base['forearm.L']?.y || 0, 1.15, t);
    if (b['forearm.R']) b['forearm.R'].rotation.y = THREE.MathUtils.lerp(base['forearm.R']?.y || 0, -1.15, t);
    if (b['head']) b['head'].rotation.x = THREE.MathUtils.lerp(base['head']?.x || 0, 0.16, t);
    return;
  }
  // Lạy Phật (Kowtow / Cúi lạy sát đất)
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
    return;
  }

  // 3. TRẠNG THÁI TĨNH TÂM / TỌA THIỀN (Nhịp thở thanh tịnh)
  const breath = Math.sin(time * 2.2 + (monkData.data?.seatIndex || 0)) * 0.022;
  if (b['spine'] && base['spine']) {
    b['spine'].rotation.x = THREE.MathUtils.lerp(b['spine'].rotation.x, base['spine'].x + breath * 0.4, 0.1);
    b['spine'].rotation.z = THREE.MathUtils.lerp(b['spine'].rotation.z, 0, 0.1);
  }
  if (b['head'] && base['head']) {
    b['head'].rotation.x = THREE.MathUtils.lerp(b['head'].rotation.x, base['head'].x - breath * 0.3, 0.1);
    b['head'].rotation.z = THREE.MathUtils.lerp(b['head'].rotation.z, 0, 0.1);
  }

  // Hồi phục các xương tay chân
  for (let k in base) {
    if (b[k] && !k.includes('spine') && !k.includes('head')) {
      b[k].rotation.x = THREE.MathUtils.lerp(b[k].rotation.x, base[k].x, 0.12);
      b[k].rotation.y = THREE.MathUtils.lerp(b[k].rotation.y, base[k].y, 0.12);
      b[k].rotation.z = THREE.MathUtils.lerp(b[k].rotation.z, base[k].z, 0.12);
    }
  }
  if (b['hips']) {
    b['hips'].position.y = THREE.MathUtils.lerp(b['hips'].position.y, 0.70, 0.1);
  }
}

// 8. Kết nối WebSocket Realtime
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
    updateBowButtonLabel();

    const nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.textContent = msg.self.name;
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = msg.totalOnline;

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
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = msg.totalOnline;
    const monk = createMonkInstance(msg.player);
    State.players.set(msg.player.id, { data: msg.player, ...monk });
    showToast(`Đồng tu ${msg.player.name} vừa bước vào Chánh điện 🙏`);
    updateSeatVisuals();
  }

  if (msg.type === 'player_moved_pos') {
    const p = State.players.get(msg.id);
    if (p) {
      p.targetPos = new THREE.Vector3(msg.x, msg.isSitting ? 0.05 : 0.0, msg.z);
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
      if (p.targetPos) p.targetPos.y = 0.0;
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
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = msg.totalOnline;
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

function updateBowButtonLabel() {
  const bowIcon = document.getElementById('bow-icon');
  const bowLabel = document.getElementById('bow-label');
  if (!bowIcon || !bowLabel) return;
  if (State.isSitting) {
    bowIcon.textContent = '🙇';
    bowLabel.textContent = 'Lạy Phật';
  } else {
    bowIcon.textContent = '🧘';
    bowLabel.textContent = 'Tọa thiền';
  }
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

function standUp() {
  State.isSitting = false;
  State.mySeatIndex = -1;
  updateBowButtonLabel();
  updateSeatVisuals();

  const myP = State.players.get(State.self?.id);
  if (myP) {
    myP.isSitting = false;
  }
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ type: 'stand_up' }));
  }
}

function sitDownAt(seatIndex) {
  const myP = State.players.get(State.self?.id);
  const seat = State.seats[seatIndex];
  if (!myP || !seat) return;

  myP.mesh.position.copy(seat.position);
  myP.mesh.rotation.y = Math.PI;
  State.mySeatIndex = seatIndex;
  State.isSitting = true;
  myP.isSitting = true;
  State.destination = null;
  State.destinationSeat = null;
  State.isAutoWalking = false;

  updateBowButtonLabel();
  updateSeatVisuals();
  playTempleBellSound();

  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ type: 'change_seat', seatIndex: seatIndex }));
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
    sitDownAt(nearestSeat);
  }
}

// Toast Thông báo
const toastEl = document.getElementById('action-toast');
const toastTextEl = document.getElementById('toast-text');
let toastTimeout = null;

function showToast(text) {
  if (!toastTextEl || !toastEl) return;
  toastTextEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

// ==========================================
// 9. ĐIỀU KHIỂN: TAP-TO-MOVE (Chuẩn Video Sansa Temple) + NÚT CAPSULE
// ==========================================
const floorRaycaster = new THREE.Raycaster();

window.addEventListener('pointerdown', (e) => {
  // Bỏ qua nếu chạm vào UI hoặc nút bấm
  if (e.target.tagName === 'BUTTON' || e.target.closest('.bottom-bar') || e.target.closest('.top-nav') || e.target.closest('.modal-overlay') || e.target.closest('.user-info-card')) {
    return;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  floorRaycaster.setFromCamera(mouse, camera);

  // 1. Kiểm tra xem người dùng có chạm vào Bồ đoàn không
  const seatHits = floorRaycaster.intersectObjects(seatMeshes);
  if (seatHits.length > 0) {
    const seatIdx = seatHits[0].object.userData.seatIndex;
    const seat = State.seats[seatIdx];
    if (seat) {
      showTargetMarker(seat.position.x, seat.position.z);
      const myP = State.players.get(State.self?.id);
      if (myP) {
        if (State.isSitting) standUp();
        // Cho chú tiểu bước tới bồ đoàn đó rồi tự động ngồi xuống
        State.destination = seat.position.clone();
        State.destinationSeat = seatIdx;
        State.isAutoWalking = true;
      }
      return;
    }
  }

  // 2. Chạm vào sàn gỗ để di chuyển (Tap-to-Move)
  const floorHits = floorRaycaster.intersectObject(floor);
  if (floorHits.length > 0) {
    const pt = floorHits[0].point;
    // Giới hạn biên sàn Chánh điện
    pt.x = THREE.MathUtils.clamp(pt.x, -6.5, 6.5);
    pt.z = THREE.MathUtils.clamp(pt.z, -4.5, 6.5);

    showTargetMarker(pt.x, pt.z);

    if (State.isSitting) {
      standUp();
    }
    State.destination = pt;
    State.destinationSeat = null;
    State.isAutoWalking = true;
  }
});

// Điều khiển Bàn phím (WASD)
window.addEventListener('keydown', (e) => {
  State.keys[e.key.toLowerCase()] = true;
  State.keys[e.code] = true;
  // Khi ấn phím thì hủy tap-to-move
  State.isAutoWalking = false;
  State.destination = null;
});
window.addEventListener('keyup', (e) => {
  State.keys[e.key.toLowerCase()] = false;
  State.keys[e.code] = false;
});

// Nút Capsule: Chắp tay
const btnGassho = document.getElementById('btn-gassho');
if (btnGassho) {
  btnGassho.addEventListener('click', () => {
    sendAction('gassho');
    playTempleBellSound();
  });
}

// Nút Capsule: Lạy Phật / Tọa thiền
const btnBow = document.getElementById('btn-bow');
if (btnBow) {
  btnBow.addEventListener('click', () => {
    if (State.isSitting) {
      sendAction('bow');
      playTempleBellSound();
    } else {
      sitDownNearest();
    }
  });
}

// Nút Capsule: Tràng Hạt Bồ Đề
const beadsModal = document.getElementById('beads-modal');
const beadSwipeZone = document.getElementById('bead-swipe-zone');
const currentBead = document.getElementById('current-bead');
const beadsCountedEl = document.getElementById('beads-counted');
const roundsCountedEl = document.getElementById('rounds-counted');

const btnBeads = document.getElementById('btn-beads');
if (btnBeads && beadsModal) {
  btnBeads.addEventListener('click', () => {
    beadsModal.classList.remove('hidden');
  });
}

const closeBeads = document.getElementById('close-beads');
if (closeBeads && beadsModal) {
  closeBeads.addEventListener('click', () => {
    beadsModal.classList.add('hidden');
  });
}

function advanceBead() {
  State.beadCount++;
  if (currentBead) {
    currentBead.classList.add('clicked');
    setTimeout(() => currentBead.classList.remove('clicked'), 120);
  }

  if (State.beadCount >= 108) {
    State.beadCount = 0;
    State.roundCount++;
    playTempleBellSound();
    showToast('Hoàn thành 1 vòng 108 hạt bồ đề. Công đức vô lượng! 📿');
  } else {
    playWoodblockSound();
  }

  if (beadsCountedEl) beadsCountedEl.textContent = State.beadCount;
  if (roundsCountedEl) roundsCountedEl.textContent = State.roundCount;
}

if (beadSwipeZone) beadSwipeZone.addEventListener('click', advanceBead);

const btnResetBead = document.getElementById('btn-reset-bead');
if (btnResetBead) {
  btnResetBead.addEventListener('click', () => {
    State.beadCount = 0;
    State.roundCount = 0;
    if (beadsCountedEl) beadsCountedEl.textContent = 0;
    if (roundsCountedEl) roundsCountedEl.textContent = 0;
  });
}

// Bật/Tắt âm thanh tụng kinh
const chantAudio = document.getElementById('chant-audio');
const btnAudio = document.getElementById('btn-audio');
const audioIcon = document.getElementById('audio-icon');

if (btnAudio && chantAudio) {
  btnAudio.addEventListener('click', () => {
    getAudioContext();
    if (State.audioEnabled) {
      chantAudio.pause();
      State.audioEnabled = false;
      if (audioIcon) audioIcon.textContent = '🔇';
    } else {
      chantAudio.play().then(() => {
        State.audioEnabled = true;
        if (audioIcon) audioIcon.textContent = '🔊';
      }).catch(() => {});
    }
  });
}

// Hướng dẫn Cài App
const infoModal = document.getElementById('info-modal');
const btnInfo = document.getElementById('btn-info');
const closeInfo = document.getElementById('close-info');

if (btnInfo && infoModal) {
  btnInfo.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
  });
}
if (closeInfo && infoModal) {
  closeInfo.addEventListener('click', () => {
    infoModal.classList.add('hidden');
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 10. VÒNG LẶP RENDER (60 FPS) & XỬ LÝ DI CHUYỂN
// ==========================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const time = clock.getElapsedTime();

  // Đèn nến lung linh
  candleLeft.intensity = 1.8 + Math.sin(time * 8) * 0.25 + Math.cos(time * 15) * 0.15;
  candleRight.intensity = 1.8 + Math.cos(time * 7) * 0.25 + Math.sin(time * 13) * 0.15;

  // Hiệu ứng vòng chỉ thị điểm đến (Ring pulse & fade)
  if (ringPulseTime > 0) {
    ringPulseTime -= delta * 1.5;
    ringMat.opacity = Math.max(0, ringPulseTime);
    targetRing.scale.addScalar(-delta * 0.4);
  }

  // Cập nhật di chuyển cho người chơi
  const myPlayer = State.players.get(State.self?.id);
  if (myPlayer && myPlayer.mesh) {
    let isMovingNow = false;

    // 1. Xử lý Tap-to-move
    if (State.isAutoWalking && State.destination) {
      const curPos = myPlayer.mesh.position;
      const dx = State.destination.x - curPos.x;
      const dz = State.destination.z - curPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.12) {
        isMovingNow = true;
        const dirX = dx / dist;
        const dirZ = dz / dist;
        const step = Math.min(State.moveSpeed * delta, dist);

        curPos.x += dirX * step;
        curPos.z += dirZ * step;

        const targetAngle = Math.atan2(dirX, dirZ);
        let diff = targetAngle - myPlayer.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        myPlayer.mesh.rotation.y += diff * 0.25;

        myPlayer.isMoving = true;
        sendMoveThrottled(curPos.x, curPos.z, myPlayer.mesh.rotation.y, true);
      } else {
        // Đã đến nơi
        State.isAutoWalking = false;
        myPlayer.isMoving = false;
        sendMoveThrottled(curPos.x, curPos.z, myPlayer.mesh.rotation.y, false);

        if (State.destinationSeat !== null && State.destinationSeat !== undefined) {
          sitDownAt(State.destinationSeat);
        }
      }
    }

    // 2. Xử lý Bàn phím (WASD)
    let inputX = 0;
    let inputZ = 0;
    if (State.keys['w'] || State.keys['arrowup'] || State.keys['keyw']) inputZ -= 1;
    if (State.keys['s'] || State.keys['arrowdown'] || State.keys['keys']) inputZ += 1;
    if (State.keys['a'] || State.keys['arrowleft'] || State.keys['keya']) inputX -= 1;
    if (State.keys['d'] || State.keys['arrowright'] || State.keys['keyd']) inputX += 1;

    const inputLen = Math.hypot(inputX, inputZ);
    if (inputLen > 0.1) {
      if (State.isSitting) standUp();
      isMovingNow = true;

      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const camSide = new THREE.Vector3(-camDir.z, 0, camDir.x);

      const moveDir = new THREE.Vector3()
        .addScaledVector(camDir, -inputZ / inputLen)
        .addScaledVector(camSide, inputX / inputLen);

      const moveStep = moveDir.clone().multiplyScalar(State.moveSpeed * delta);
      const newPos = myPlayer.mesh.position.clone().add(moveStep);

      newPos.x = THREE.MathUtils.clamp(newPos.x, -6.5, 6.5);
      newPos.z = THREE.MathUtils.clamp(newPos.z, -4.5, 6.5);
      newPos.y = 0.0;

      myPlayer.mesh.position.copy(newPos);

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - myPlayer.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      myPlayer.mesh.rotation.y += diff * 0.25;

      myPlayer.isMoving = true;
      sendMoveThrottled(newPos.x, newPos.z, myPlayer.mesh.rotation.y, true);
    }

    if (!isMovingNow && myPlayer.isMoving && !State.isAutoWalking) {
      myPlayer.isMoving = false;
      sendMoveThrottled(myPlayer.mesh.position.x, myPlayer.mesh.position.z, myPlayer.mesh.rotation.y, false);
    }

    // Camera 3rd-person mượt mà theo sau chú tiểu
    const prevTarget = controls.target.clone();
    const desiredTarget = new THREE.Vector3(myPlayer.mesh.position.x, 0.95, myPlayer.mesh.position.z);
    controls.target.lerp(desiredTarget, 0.08);
    const deltaTarget = controls.target.clone().sub(prevTarget);
    camera.position.add(deltaTarget);
  }

  // Cập nhật tất cả người chơi & đồng tu
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
