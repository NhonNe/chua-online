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
  mokoCount: 0,
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
    osc.frequency.setValueAtTime(640, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, ctx.currentTime);
    filter.Q.setValueAtTime(4.5, ctx.currentTime);

    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.11);

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
// ==========================================
const cushionGeo = new THREE.BoxGeometry(0.72, 0.05, 0.72);
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x333538, roughness: 0.9 });
const cushionMatActive = new THREE.MeshStandardMaterial({ color: 0x8a6a2c, roughness: 0.75 });

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
    if (obj.isBone || obj.type === 'Bone' || (obj.name && (obj.name.includes('arm') || obj.name.includes('hand') || obj.name.includes('spine') || obj.name.includes('head') || obj.name.includes('hips') || obj.name.includes('thigh') || obj.name.includes('shin') || obj.name.includes('foot')))) {
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

  // Vị trí xuất phát (mặt luôn hướng về tượng Phật z < 0)
  if (playerData.seatIndex !== undefined && playerData.seatIndex >= 0 && State.seats[playerData.seatIndex]) {
    clone.position.copy(State.seats[playerData.seatIndex].position);
    clone.rotation.y = 0;
  } else if (playerData.x !== undefined && playerData.z !== undefined) {
    clone.position.set(playerData.x, playerData.isSitting ? 0.05 : 0.0, playerData.z);
    clone.rotation.y = playerData.rot || 0;
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

// 6. Đồng tu tụng kinh trong Chánh điện
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
// - Dáng đi Kinh Hành: 2 tay xếp gọn trước bụng trong áo tràng
// - Chân bước sải sải nhịp nhàng, 2 chân cử động rõ rệt
// - Tọa thiền: Xếp bằng tĩnh tọa, 2 tay kết ấn thiền trên đùi
// - Gõ mõ: Tay phải nhấc dùi gõ mõ theo nhịp
// - Chắp tay & Lạy Phật: Trang nghiêm, thanh tịnh
// ==========================================
function updateMonkAnimation(monkData, delta, time) {
  if (!monkData || !monkData.bones) return;
  const b = monkData.bones;
  const base = monkData.baseRotations;
  const action = monkData.currentAction;

  monkData.actionTimer += delta;

  // Cập nhật cao độ êm dịu giữa ngồi thiền (y=0.05) và đi bộ (y=0.0)
  if (monkData.mesh) {
    const targetY = monkData.isSitting ? 0.05 : 0.0;
    monkData.mesh.position.y = THREE.MathUtils.lerp(monkData.mesh.position.y, targetY, 0.15);
  }

  // 1. DÁNG ĐI BỘ / KINH HÀNH CHUẨN XÁC THEO VIDEO TIKTOK
  if (monkData.isMoving) {
    monkData.walkCycle = (monkData.walkCycle || 0) + delta * 9.2;
    const wc = monkData.walkCycle;
    const stride = Math.sin(wc);

    // 1.1. Chân bước sải sải rõ rệt (Đùi vung tới trước / lùi sau)
    if (b['thigh.L'] && base['thigh.L']) {
      b['thigh.L'].rotation.x = base['thigh.L'].x + stride * 0.65;
      b['thigh.L'].rotation.z = base['thigh.L'].z;
    }
    if (b['thigh.R'] && base['thigh.R']) {
      b['thigh.R'].rotation.x = base['thigh.R'].x - stride * 0.65;
      b['thigh.R'].rotation.z = base['thigh.R'].z;
    }

    // 1.2. Đầu gối gập tự nhiên về sau khi nhấc gót
    if (b['shin.L'] && base['shin.L']) {
      b['shin.L'].rotation.x = base['shin.L'].x - Math.max(0, -stride) * 0.85;
    }
    if (b['shin.R'] && base['shin.R']) {
      b['shin.R'].rotation.x = base['shin.R'].x - Math.max(0, stride) * 0.85;
    }

    // 1.3. Uốn bàn chân (Foot roll) để mũi chân và gót chân cử động sống động
    if (b['foot.L'] && base['foot.L']) {
      const flexL = stride > 0 ? stride * 0.35 : -Math.max(0, -stride) * 0.45;
      b['foot.L'].rotation.x = base['foot.L'].x + flexL;
    }
    if (b['foot.R'] && base['foot.R']) {
      const flexR = stride < 0 ? -stride * 0.35 : -Math.max(0, stride) * 0.45;
      b['foot.R'].rotation.x = base['foot.R'].x + flexR;
    }

    // 1.4. Hai tay khép gọn gàng trước bụng trong vạt áo tràng thủ lễ
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
    if (b['forearm.L']) {
      b['forearm.L'].rotation.y = 0.85;
      b['forearm.L'].rotation.z = -0.32;
    }
    if (b['forearm.R']) {
      b['forearm.R'].rotation.y = -0.85;
      b['forearm.R'].rotation.z = 0.32;
    }

    // 1.5. Nhấp nhô xương chậu (Pelvis vertical bounce) và chuyển trọng tâm
    if (b['hips']) {
      b['hips'].position.y = 0.70 + Math.abs(Math.sin(wc)) * 0.038;
      b['hips'].position.x = Math.sin(wc) * 0.028;
    }

    // 1.6. Thân mình lắc lư chibi waddle sang 2 bên
    if (b['spine'] && base['spine']) {
      b['spine'].rotation.z = Math.sin(wc) * 0.085;
      b['spine'].rotation.x = base['spine'].x - 0.05;
    }

    // 1.7. Đầu nghiêng đối trọng cực đáng yêu
    if (b['head'] && base['head']) {
      b['head'].rotation.z = -Math.sin(wc) * 0.06;
      b['head'].rotation.x = base['head'].x - 0.02 + Math.sin(wc * 2) * 0.015;
    }

    return;
  }

  // 2. CÁC HÀNH ĐỘNG TƯƠNG TÁC: GÕ MÕ, CHẮP TAY, LẠY PHẬT
  // 2.1. Hành động Gõ Mõ (Woodblock)
  if (action === 'woodblock') {
    const tapProgress = Math.min(monkData.actionTimer * 6.0, 1.0);
    const tapFactor = Math.sin(tapProgress * Math.PI);

    // Tay phải nhấc dùi gõ mõ nhịp nhàng
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = THREE.MathUtils.lerp(base['upper_arm.R'].x + 0.5, base['upper_arm.R'].x + 0.2, tapFactor);
      b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.R'].z + 0.2, base['upper_arm.R'].z + 0.4, tapFactor);
    }
    if (b['forearm.R']) {
      b['forearm.R'].rotation.y = THREE.MathUtils.lerp(-0.8, -1.25, tapFactor);
      b['forearm.R'].rotation.z = THREE.MathUtils.lerp(0.3, 0.65, tapFactor);
    }
    if (b['head']) {
      b['head'].rotation.x = THREE.MathUtils.lerp(base['head']?.x || 0, (base['head']?.x || 0) - 0.18, tapFactor);
    }

    if (monkData.actionTimer >= 0.4) {
      monkData.currentAction = 'idle';
      monkData.actionTimer = 0;
    }
    return;
  }

  // 2.2. Chắp tay búp sen đảnh lễ (Gassho - Hai tay nâng cao trước ngực chắp búp sen rõ nét)
  if (action === 'gassho') {
    const progress = Math.min(monkData.actionTimer / 2.5, 1.0);
    let gasshoFactor = 0;
    if (progress < 0.25) {
      gasshoFactor = progress / 0.25;
    } else if (progress < 0.75) {
      gasshoFactor = 1.0;
    } else {
      gasshoFactor = (1.0 - progress) / 0.25;
    }

    // Hai cánh tay nâng cao lên trước ngực, khuỷu tay mở rộng tạo dáng chắp tay búp sen uyển chuyển
    if (b['upper_arm.L'] && base['upper_arm.L']) {
      b['upper_arm.L'].rotation.x = THREE.MathUtils.lerp(base['upper_arm.L'].x, base['upper_arm.L'].x + 0.92, gasshoFactor);
      b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.L'].z, -0.78, gasshoFactor);
    }
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = THREE.MathUtils.lerp(base['upper_arm.R'].x, base['upper_arm.R'].x + 0.92, gasshoFactor);
      b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.R'].z, 0.78, gasshoFactor);
    }
    // Cẳng tay hướng vào trong, hai bàn tay áp vào nhau ngay trước ngực
    if (b['forearm.L']) {
      b['forearm.L'].rotation.y = THREE.MathUtils.lerp(base['forearm.L']?.y || 0, 1.38, gasshoFactor);
      b['forearm.L'].rotation.z = THREE.MathUtils.lerp(base['forearm.L']?.z || 0, -0.42, gasshoFactor);
    }
    if (b['forearm.R']) {
      b['forearm.R'].rotation.y = THREE.MathUtils.lerp(base['forearm.R']?.y || 0, -1.38, gasshoFactor);
      b['forearm.R'].rotation.z = THREE.MathUtils.lerp(base['forearm.R']?.z || 0, 0.42, gasshoFactor);
    }
    // Đầu và thân mình cúi nhẹ cung kính
    if (b['spine'] && base['spine']) {
      b['spine'].rotation.x = THREE.MathUtils.lerp(base['spine'].x, base['spine'].x - 0.20, gasshoFactor);
    }
    if (b['head'] && base['head']) {
      b['head'].rotation.x = THREE.MathUtils.lerp(base['head'].x, base['head'].x - 0.32, gasshoFactor);
    }

    if (monkData.actionTimer >= 2.5) {
      monkData.currentAction = 'idle';
      monkData.actionTimer = 0;
    }
    return;
  }

  // 2.3. Lạy Phật ngũ thể đầu địa (Full Prostration: Quỳ gối, cúi rạp người trán chạm sàn)
  if (action === 'bow') {
    const progress = (monkData.actionTimer % 3.2) / 3.2;
    let bowFactor = 0;
    if (progress < 0.35) {
      bowFactor = Math.sin((progress / 0.35) * (Math.PI / 2));
    } else if (progress < 0.7) {
      bowFactor = 1.0;
    } else {
      bowFactor = Math.cos(((progress - 0.7) / 0.3) * (Math.PI / 2));
    }

    // 1. Hai chân quỳ gập sát sàn (Kneel down)
    if (b['thigh.L'] && base['thigh.L']) {
      b['thigh.L'].rotation.x = THREE.MathUtils.lerp(base['thigh.L'].x, base['thigh.L'].x + 1.45, bowFactor);
    }
    if (b['thigh.R'] && base['thigh.R']) {
      b['thigh.R'].rotation.x = THREE.MathUtils.lerp(base['thigh.R'].x, base['thigh.R'].x + 1.45, bowFactor);
    }
    if (b['shin.L'] && base['shin.L']) {
      b['shin.L'].rotation.x = THREE.MathUtils.lerp(base['shin.L'].x, base['shin.L'].x - 1.60, bowFactor);
    }
    if (b['shin.R'] && base['shin.R']) {
      b['shin.R'].rotation.x = THREE.MathUtils.lerp(base['shin.R'].x, base['shin.R'].x - 1.60, bowFactor);
    }
    // 2. Xương chậu hạ thấp xuống mặt sàn (Hông chạm gót)
    if (b['hips']) {
      b['hips'].position.y = THREE.MathUtils.lerp(0.70, 0.20, bowFactor);
    }
    // 3. Toàn thân gập sâu xuống, trán chạm đất
    if (b['spine'] && base['spine']) {
      b['spine'].rotation.x = THREE.MathUtils.lerp(base['spine'].x, base['spine'].x - 1.35, bowFactor);
    }
    if (b['head'] && base['head']) {
      b['head'].rotation.x = THREE.MathUtils.lerp(base['head'].x, base['head'].x - 0.65, bowFactor);
    }
    // 4. Hai tay vươn ra chạm đất cung kính trước mặt
    if (b['upper_arm.L'] && base['upper_arm.L']) {
      b['upper_arm.L'].rotation.x = THREE.MathUtils.lerp(base['upper_arm.L'].x, base['upper_arm.L'].x + 1.25, bowFactor);
      b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.L'].z, -0.35, bowFactor);
    }
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = THREE.MathUtils.lerp(base['upper_arm.R'].x, base['upper_arm.R'].x + 1.25, bowFactor);
      b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(base['upper_arm.R'].z, 0.35, bowFactor);
    }
    if (b['forearm.L']) b['forearm.L'].rotation.y = THREE.MathUtils.lerp(base['forearm.L']?.y || 0, 0.60, bowFactor);
    if (b['forearm.R']) b['forearm.R'].rotation.y = THREE.MathUtils.lerp(base['forearm.R']?.y || 0, -0.60, bowFactor);

    if (monkData.actionTimer >= 3.2) {
      monkData.currentAction = 'idle';
      monkData.actionTimer = 0;
    }
    return;
  }

  // 3. TƯ THẾ TỌA THIỀN (Khi isSitting = true: Xếp bằng kiết già, 2 tay kết ấn trên đùi)
  if (monkData.isSitting && !monkData.isMoving && action === 'idle') {
    const breath = Math.sin(time * 2.2 + (monkData.data?.seatIndex || 0)) * 0.02;

    // Chân xếp bằng tọa thiền kiết già rõ rệt
    if (b['thigh.L'] && base['thigh.L']) {
      b['thigh.L'].rotation.x = THREE.MathUtils.lerp(b['thigh.L'].rotation.x, base['thigh.L'].x + 1.35, 0.2);
      b['thigh.L'].rotation.z = THREE.MathUtils.lerp(b['thigh.L'].rotation.z, base['thigh.L'].z - 0.48, 0.2);
    }
    if (b['thigh.R'] && base['thigh.R']) {
      b['thigh.R'].rotation.x = THREE.MathUtils.lerp(b['thigh.R'].rotation.x, base['thigh.R'].x + 1.35, 0.2);
      b['thigh.R'].rotation.z = THREE.MathUtils.lerp(b['thigh.R'].rotation.z, base['thigh.R'].z + 0.48, 0.2);
    }
    if (b['shin.L'] && base['shin.L']) {
      b['shin.L'].rotation.x = THREE.MathUtils.lerp(b['shin.L'].rotation.x, base['shin.L'].x - 1.55, 0.2);
    }
    if (b['shin.R'] && base['shin.R']) {
      b['shin.R'].rotation.x = THREE.MathUtils.lerp(b['shin.R'].rotation.x, base['shin.R'].x - 1.55, 0.2);
    }
    if (b['foot.L'] && base['foot.L']) {
      b['foot.L'].rotation.x = THREE.MathUtils.lerp(b['foot.L'].rotation.x, base['foot.L'].x, 0.2);
    }
    if (b['foot.R'] && base['foot.R']) {
      b['foot.R'].rotation.x = THREE.MathUtils.lerp(b['foot.R'].rotation.x, base['foot.R'].x, 0.2);
    }
    if (b['hips']) {
      b['hips'].position.y = THREE.MathUtils.lerp(b['hips'].position.y, 0.36, 0.2);
      b['hips'].position.x = THREE.MathUtils.lerp(b['hips'].position.x, 0, 0.2);
    }

    // Hai tay đặt nhẹ nhàng kết ấn thiền trên đùi (Dhyana Mudra)
    if (b['upper_arm.L'] && base['upper_arm.L']) {
      b['upper_arm.L'].rotation.x = THREE.MathUtils.lerp(b['upper_arm.L'].rotation.x, base['upper_arm.L'].x + 0.38, 0.2);
      b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(b['upper_arm.L'].rotation.z, base['upper_arm.L'].z - 0.25, 0.2);
    }
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = THREE.MathUtils.lerp(b['upper_arm.R'].rotation.x, base['upper_arm.R'].x + 0.38, 0.2);
      b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(b['upper_arm.R'].rotation.z, base['upper_arm.R'].z + 0.25, 0.2);
    }
    if (b['forearm.L']) b['forearm.L'].rotation.y = THREE.MathUtils.lerp(b['forearm.L'].rotation.y, 0.95, 0.2);
    if (b['forearm.R']) b['forearm.R'].rotation.y = THREE.MathUtils.lerp(b['forearm.R'].rotation.y, -0.95, 0.2);

    // Lưng thẳng, nhịp thở tĩnh tại
    if (b['spine'] && base['spine']) {
      b['spine'].rotation.x = THREE.MathUtils.lerp(b['spine'].rotation.x, base['spine'].x + breath * 0.4, 0.1);
      b['spine'].rotation.z = THREE.MathUtils.lerp(b['spine'].rotation.z, 0, 0.1);
    }
    if (b['head'] && base['head']) {
      b['head'].rotation.x = THREE.MathUtils.lerp(b['head'].rotation.x, base['head'].x - breath * 0.3, 0.1);
      b['head'].rotation.z = THREE.MathUtils.lerp(b['head'].rotation.z, 0, 0.1);
    }
    return;
  }

  // 4. TƯ THẾ ĐỨNG TĨNH TÂM (Khi !isSitting && !isMoving && action === 'idle')
  if (!monkData.isSitting && !monkData.isMoving && action === 'idle') {
    const breath = Math.sin(time * 2.2) * 0.02;

    // Chân đứng thẳng vững chãi
    for (let k of ['thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R']) {
      if (b[k] && base[k]) {
        b[k].rotation.x = THREE.MathUtils.lerp(b[k].rotation.x, base[k].x, 0.15);
        b[k].rotation.y = THREE.MathUtils.lerp(b[k].rotation.y, base[k].y, 0.15);
        b[k].rotation.z = THREE.MathUtils.lerp(b[k].rotation.z, base[k].z, 0.15);
      }
    }
    if (b['hips']) {
      b['hips'].position.y = THREE.MathUtils.lerp(b['hips'].position.y, 0.70, 0.15);
      b['hips'].position.x = THREE.MathUtils.lerp(b['hips'].position.x, 0, 0.15);
    }

    // Hai tay thủ lễ nhẹ nhàng trước bụng
    if (b['upper_arm.L'] && base['upper_arm.L']) {
      b['upper_arm.L'].rotation.x = THREE.MathUtils.lerp(b['upper_arm.L'].rotation.x, base['upper_arm.L'].x + 0.42, 0.15);
      b['upper_arm.L'].rotation.z = THREE.MathUtils.lerp(b['upper_arm.L'].rotation.z, base['upper_arm.L'].z - 0.40, 0.15);
    }
    if (b['upper_arm.R'] && base['upper_arm.R']) {
      b['upper_arm.R'].rotation.x = THREE.MathUtils.lerp(b['upper_arm.R'].rotation.x, base['upper_arm.R'].x + 0.42, 0.15);
      b['upper_arm.R'].rotation.z = THREE.MathUtils.lerp(b['upper_arm.R'].rotation.z, base['upper_arm.R'].z + 0.40, 0.15);
    }
    if (b['forearm.L']) b['forearm.L'].rotation.y = THREE.MathUtils.lerp(b['forearm.L'].rotation.y, 0.85, 0.15);
    if (b['forearm.R']) b['forearm.R'].rotation.y = THREE.MathUtils.lerp(b['forearm.R'].rotation.y, -0.85, 0.15);

    if (b['spine'] && base['spine']) {
      b['spine'].rotation.x = THREE.MathUtils.lerp(b['spine'].rotation.x, base['spine'].x + breath * 0.4, 0.1);
      b['spine'].rotation.z = THREE.MathUtils.lerp(b['spine'].rotation.z, 0, 0.1);
    }
    if (b['head'] && base['head']) {
      b['head'].rotation.x = THREE.MathUtils.lerp(b['head'].rotation.x, base['head'].x - breath * 0.3, 0.1);
      b['head'].rotation.z = THREE.MathUtils.lerp(b['head'].rotation.z, 0, 0.1);
    }
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
    updateSitButtonUI();

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
    } else if (msg.action === 'woodblock' && msg.id !== State.self?.id) {
      playWoodblockSound();
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
    sitLabel.textContent = 'Ngồi thiền';
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

function sitDownAt(seatIndex) {
  const myP = State.players.get(State.self?.id);
  const seat = State.seats[seatIndex];
  if (!myP || !seat) return;

  myP.mesh.position.copy(seat.position);
  myP.mesh.rotation.y = 0; // Hướng mặt về Đức Phật Bổn Sư
  State.mySeatIndex = seatIndex;
  State.isSitting = true;
  myP.isSitting = true;
  State.destination = null;
  State.destinationSeat = null;
  State.isAutoWalking = false;

  updateSitButtonUI();
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
  let minDist = 2.5;
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
  } else {
    // Tĩnh tọa xếp bằng kiết già ngay tại vị trí hiện tại
    State.mySeatIndex = -1;
    State.isSitting = true;
    myP.isSitting = true;
    State.destination = null;
    State.destinationSeat = null;
    State.isAutoWalking = false;
    updateSitButtonUI();
    updateSeatVisuals();
    playTempleBellSound();
    showToast('Tĩnh tọa niệm Phật thanh tịnh 🧘');
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ type: 'change_seat', seatIndex: -1 }));
    }
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
// 9. ĐIỀU KHIỂN: TAP-TO-MOVE + JOYSTICK + BÀN PHÍM + NÚT BẤM
// ==========================================
// 9.1. Tap-to-move
const floorRaycaster = new THREE.Raycaster();

window.addEventListener('pointerdown', (e) => {
  if (e.target.tagName === 'BUTTON' || e.target.closest('.bottom-bar') || e.target.closest('.top-nav') || e.target.closest('.modal-overlay') || e.target.closest('.user-info-card') || e.target.closest('.joystick-container') || e.target.closest('.toggle-sit-btn')) {
    return;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  floorRaycaster.setFromCamera(mouse, camera);

  // 1. Kiểm tra chạm bồ đoàn trực tiếp
  let targetSeatIndex = null;
  const seatHits = floorRaycaster.intersectObjects(seatMeshes);
  if (seatHits.length > 0) {
    targetSeatIndex = seatHits[0].object.userData.seatIndex;
  }

  // 2. Chạm sàn gỗ
  const floorHits = floorRaycaster.intersectObject(floor);
  if (floorHits.length > 0) {
    const pt = floorHits[0].point;
    pt.x = THREE.MathUtils.clamp(pt.x, -6.5, 6.5);
    pt.z = THREE.MathUtils.clamp(pt.z, -4.5, 6.5);

    // Nếu chưa trúng bồ đoàn trực tiếp, kiểm tra xem có chạm gần bồ đoàn nào trong bán kính 0.65m không
    if (targetSeatIndex === null) {
      let closestDist = 0.65;
      State.seats.forEach((seat) => {
        const d = Math.hypot(pt.x - seat.position.x, pt.z - seat.position.z);
        if (d < closestDist) {
          closestDist = d;
          targetSeatIndex = seat.index;
        }
      });
    }

    const myP = State.players.get(State.self?.id);

    // Xử lý chạm bồ đoàn
    if (targetSeatIndex !== null && State.seats[targetSeatIndex]) {
      const seat = State.seats[targetSeatIndex];
      showTargetMarker(seat.position.x, seat.position.z);

      if (myP) {
        const curDist = Math.hypot(myP.mesh.position.x - seat.position.x, myP.mesh.position.z - seat.position.z);
        if (curDist < 0.35) {
          sitDownAt(targetSeatIndex);
        } else {
          if (State.isSitting) standUp();
          State.destination = seat.position.clone();
          State.destinationSeat = targetSeatIndex;
          State.isAutoWalking = true;
        }
      }
      return;
    }

    // Xử lý chạm sàn gỗ trống: đi tới điểm đó
    showTargetMarker(pt.x, pt.z);
    if (myP) {
      if (State.isSitting) {
        standUp();
      }
      State.destination = pt;
      State.destinationSeat = null;
      State.isAutoWalking = true;
    }
  }
});

// 9.2. Virtual Joystick Cảm ứng cho Mobile
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

    if (State.isSitting) {
      standUp();
    }
    State.isAutoWalking = false;
    State.destination = null;
  }
}

// 9.3. Điều khiển Bàn phím (WASD)
window.addEventListener('keydown', (e) => {
  State.keys[e.key.toLowerCase()] = true;
  State.keys[e.code] = true;
  State.isAutoWalking = false;
  State.destination = null;
});
window.addEventListener('keyup', (e) => {
  State.keys[e.key.toLowerCase()] = false;
  State.keys[e.code] = false;
});

// 9.4. Nút bấm tương tác
// Nút: Chắp tay
const btnGassho = document.getElementById('btn-gassho');
if (btnGassho) {
  btnGassho.addEventListener('click', () => {
    sendAction('gassho');
    playTempleBellSound();
    showToast('Chắp tay búp sen đảnh lễ Tam Bảo 🙏');
  });
}

// Nút: Lạy Phật
const btnBow = document.getElementById('btn-bow');
if (btnBow) {
  btnBow.addEventListener('click', () => {
    sendAction('bow');
    playTempleBellSound();
    showToast('Kính cẩn lạy Phật tiêu trừ nghiệp chướng 🙇');
  });
}

// Nút: Gõ mõ
const btnWoodblock = document.getElementById('btn-woodblock');
const mokoCountEl = document.getElementById('moko-count');
if (btnWoodblock) {
  btnWoodblock.addEventListener('click', () => {
    State.mokoCount++;
    if (mokoCountEl) mokoCountEl.textContent = State.mokoCount;
    playWoodblockSound();
    sendAction('woodblock');
  });
}

// Nút: Tràng Hạt Bồ Đề
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

        const targetAngle = Math.atan2(-dirX, -dirZ);
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

    // 2. Xử lý Joystick và Bàn phím (WASD)
    let inputX = State.moveVector.x;
    let inputZ = State.moveVector.z;
    if (State.keys['w'] || State.keys['arrowup'] || State.keys['keyw']) inputZ -= 1;
    if (State.keys['s'] || State.keys['arrowdown'] || State.keys['keys']) inputZ += 1;
    if (State.keys['a'] || State.keys['arrowleft'] || State.keys['keya']) inputX -= 1;
    if (State.keys['d'] || State.keys['arrowright'] || State.keys['keyd']) inputX += 1;

    const inputLen = Math.hypot(inputX, inputZ);
    if (inputLen > 0.08) {
      if (State.isSitting) standUp();
      State.isAutoWalking = false;
      State.destination = null;
      isMovingNow = true;

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

      newPos.x = THREE.MathUtils.clamp(newPos.x, -6.5, 6.5);
      newPos.z = THREE.MathUtils.clamp(newPos.z, -4.5, 6.5);
      newPos.y = 0.0;

      myPlayer.mesh.position.copy(newPos);

      const targetAngle = Math.atan2(-moveDir.x, -moveDir.z);
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

  // Cập nhật tất cả người chơi & đồng tu (bao gồm cả nhân vật của chính mình)
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
