// ==========================================
// CHÙA ONLINE — 3D Client & Realtime System
// ==========================================

const State = {
  self: null,
  players: new Map(), // id -> { data, mesh, bones, currentAction, actionTimer }
  seats: [],          // index -> { position, mesh, occupiedBy }
  audioEnabled: false,
  beadCount: 0,
  roundCount: 0,
  mokoCount: 0,
  ws: null,
  monkTemplate: null,
  buddhaMesh: null,
  mySeatIndex: -1
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

    // Rung điện thoại (Haptic feedback)
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
controls.maxPolarAngle = Math.PI / 2.05; // Không cho camera chìm dưới sàn
controls.minPolarAngle = Math.PI / 4.5;
controls.minDistance = 2.5;
controls.maxDistance = 14;
controls.target.set(0, 1.2, 0);

// Ánh sáng Chánh Điện
const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.7);
scene.add(ambientLight);

// Luồng sáng vàng ấm chiếu rọi tượng Phật từ trên cao
const buddhaSpotLight = new THREE.SpotLight(0xffdf88, 3.5, 25, Math.PI / 4.5, 0.4, 1.2);
buddhaSpotLight.position.set(0, 9, -2);
buddhaSpotLight.target.position.set(0, 2.2, -6.5);
buddhaSpotLight.castShadow = true;
scene.add(buddhaSpotLight);
scene.add(buddhaSpotLight.target);

// Đèn nến / dầu chập chờn hai bên ban thờ
const candleLeft = new THREE.PointLight(0xff9933, 1.8, 10);
candleLeft.position.set(-2.4, 1.6, -5.5);
scene.add(candleLeft);

const candleRight = new THREE.PointLight(0xff9933, 1.8, 10);
candleRight.position.set(2.4, 1.6, -5.5);
scene.add(candleRight);

// Sàn gỗ Chánh điện bóng bẩy
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

// Tạo 36 Bồ đoàn (Đệm ngồi thiền hình tròn xếp thành 6x6)
const cushionGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.12, 24);
const cushionMat = new THREE.MeshStandardMaterial({
  color: 0x3d2b20,
  roughness: 0.85
});
const cushionMatActive = new THREE.MeshStandardMaterial({
  color: 0xa87d32,
  roughness: 0.7
});

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
const loadingText = document.getElementById('loading-text');
const progressFill = document.getElementById('progress-fill');
const loadingScreen = document.getElementById('loading-screen');

function updateProgress(percent, msg) {
  progressFill.style.width = `${percent}%`;
  loadingText.textContent = msg;
}

updateProgress(20, 'Đang tải Tôn tượng Đức Bổn Sư Thích Ca Mâu Ni...');

gltfLoader.load('/assets/models/buddha.glb', (gltf) => {
  const buddha = gltf.scene;
  buddha.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      // Tăng ánh vàng cho tượng Phật
      if (child.material) {
        child.material.metalness = 0.55;
        child.material.roughness = 0.35;
      }
    }
  });

  // Căn chỉnh kích thước và vị trí tượng Phật trên bục Tam Bảo
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
});

function loadMonkModel() {
  gltfLoader.load('/assets/models/monk.glb', (gltf) => {
    State.monkTemplate = gltf.scene;

    // Chuẩn hóa tỷ lệ chú tiểu
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

    updateProgress(100, 'Tịnh tâm thanh tịnh...');
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => loadingScreen.style.display = 'none', 600);
      connectWebSocket();
    }, 400);
  });
}

// 5. Tạo Chú tiểu cho người chơi (Bản thân hoặc Đồng tu khác)
function createMonkInstance(playerData) {
  if (!State.monkTemplate) return null;

  const clone = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(State.monkTemplate) : State.monkTemplate.clone(true);
  
  // Thu thập xương để tạo chuyển động
  const bones = {};
  clone.traverse((obj) => {
    if (obj.isBone || obj.type === 'Bone' || (obj.name && (obj.name.includes('arm') || obj.name.includes('hand') || obj.name.includes('spine') || obj.name.includes('head') || obj.name.includes('hips')))) {
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

  // Đặt vị trí theo số bồ đoàn
  const seat = State.seats[playerData.seatIndex];
  if (seat) {
    clone.position.copy(seat.position);
    clone.rotation.y = Math.PI; // Hướng mặt về phía Tượng Phật
  }

  return {
    mesh: clone,
    bones: bones,
    currentAction: playerData.action || 'idle',
    actionTimer: 0,
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

// 6. Xử lý Chuyển động (Animations: Ngồi thiền, Chắp tay, Cúi lạy, Gõ mõ)
function updateMonkAnimation(monkData, delta, time) {
  if (!monkData || !monkData.bones) return;
  const b = monkData.bones;
  const base = monkData.baseRotations;
  const action = monkData.currentAction;

  monkData.actionTimer += delta;

  // Nhịp thở nhấp nhô nhẹ lúc ngồi thiền
  const breath = Math.sin(time * 2.2) * 0.03;
  if (b['spine'] && base['spine']) {
    b['spine'].rotation.x = base['spine'].x + breath * 0.5;
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
  // Hành động Lạy Phật (Cúi rạp người đảnh lễ)
  else if (action === 'bow') {
    const progress = (monkData.actionTimer % 3.0) / 3.0;
    // Cúi xuống (0 -> 0.4), giữ (0.4 -> 0.7), nâng lên (0.7 -> 1.0)
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

    // Tự động trở về trạng thái idle sau 3 giây
    if (monkData.actionTimer >= 3.0) {
      monkData.currentAction = 'idle';
      monkData.actionTimer = 0;
    }
  }
  // Trạng thái nghỉ / ngồi thiền tĩnh lặng
  else {
    for (let k in base) {
      if (b[k]) {
        b[k].rotation.x = THREE.MathUtils.lerp(b[k].rotation.x, base[k].x, 0.1);
        b[k].rotation.y = THREE.MathUtils.lerp(b[k].rotation.y, base[k].y, 0.1);
        b[k].rotation.z = THREE.MathUtils.lerp(b[k].rotation.z, base[k].z, 0.1);
      }
    }
    if (b['hips']) b['hips'].position.y = 0.7;
  }
}

// 7. Kết nối WebSocket Realtime
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  State.ws = new WebSocket(wsUrl);

  State.ws.onopen = () => {
    console.log('Đã kết nối với máy chủ Chùa Online!');
    // Gửi ping giữ kết nối mỗi 20s
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
    console.log('Mất kết nối, đang thử kết nối lại...');
    setTimeout(connectWebSocket, 3000);
  };
}

function handleServerMessage(msg) {
  if (msg.type === 'welcome') {
    State.self = msg.self;
    State.mySeatIndex = msg.self.seatIndex;
    document.getElementById('user-display-name').textContent = msg.self.name;
    document.getElementById('online-count').textContent = msg.totalOnline;

    // Dựng bản thân
    const myMonk = createMonkInstance(msg.self);
    State.players.set(msg.self.id, { data: msg.self, ...myMonk });

    // Tiêu điểm camera nhìn về phía mình và tượng Phật
    if (myMonk) {
      controls.target.copy(myMonk.mesh.position).add(new THREE.Vector3(0, 0.8, -1.5));
    }

    // Dựng tất cả người chơi khác đang trong phòng
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
      if (p.data && p.data.seatIndex === seat.index) isOccupied = true;
    });
    seat.mesh.material = (seat.index === State.mySeatIndex) ? cushionMatActive : cushionMat;
  });
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

// 8. Đăng ký Sự kiện Tương tác (UI & Cảm ứng)
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

// Chọn bồ đoàn khác bằng cách chạm vào đệm
window.addEventListener('pointerdown', (e) => {
  // Chỉ nhận chạm vào canvas, bỏ qua các nút bấm UI
  if (e.target.tagName === 'BUTTON' || e.target.closest('.bottom-bar') || e.target.closest('.top-nav') || e.target.closest('.modal-card')) {
    return;
  }
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  cushionRaycaster.setFromCamera(mouse, camera);
  const intersects = cushionRaycaster.intersectObjects(seatMeshes);

  if (intersects.length > 0) {
    const clickedSeat = intersects[0].object.userData.seatIndex;
    if (clickedSeat !== undefined && clickedSeat !== State.mySeatIndex) {
      if (State.ws && State.ws.readyState === WebSocket.OPEN) {
        State.ws.send(JSON.stringify({ type: 'change_seat', seatIndex: clickedSeat }));
        State.mySeatIndex = clickedSeat;
        const myP = State.players.get(State.self?.id);
        if (myP) myP.mesh.position.copy(State.seats[clickedSeat].position);
        updateSeatVisuals();
        playTempleBellSound();
      }
    }
  }
});

// Resize cửa sổ
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 9. Vòng lặp Render (60 FPS)
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Đèn nến chập chờn tự nhiên
  candleLeft.intensity = 1.6 + Math.sin(time * 8) * 0.25 + Math.cos(time * 15) * 0.15;
  candleRight.intensity = 1.6 + Math.cos(time * 7) * 0.25 + Math.sin(time * 13) * 0.15;

  // Cập nhật chuyển động cho tất cả các Chú tiểu
  State.players.forEach((p) => {
    updateMonkAnimation(p, delta, time);
  });

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Đăng ký Service Worker cho PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
