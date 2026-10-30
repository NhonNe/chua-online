const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Danh sách pháp danh Phật tử ngẫu nhiên
const BUDDHIST_NAMES = [
  "Tâm An", "Thanh Tịnh", "Diệu Âm", "Tuệ Minh", "An Lạc", 
  "Minh Đức", "Từ Bi", "Bảo Quang", "Chân Tâm", "Trí Huệ", 
  "Thiện Duyên", "Phúc An", "Liên Hoa", "Tịnh Niệm", "Quang Minh", 
  "Tâm Thiện", "Diệu Pháp", "Thường Lạc", "Vô Vi", "Tịnh Tâm",
  "Như Ý", "Minh Triết", "Hỷ Xả", "Đại Từ", "Viên Mãn"
];

// Quản lý phòng Chánh điện
const rooms = new Map();

function getRoom(roomId = 'chanh-dien-01') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomId === 'chanh-dien-01' ? 'Chánh Điện 01' : 'Đại Hùng Bảo Điện',
      clients: new Map(), // clientId -> { ws, id, name, seatIndex, action }
      seats: new Array(36).fill(null) // 36 bồ đoàn trong chánh điện
    });
  }
  return rooms.get(roomId);
}

function getRandomName() {
  const base = BUDDHIST_NAMES[Math.floor(Math.random() * BUDDHIST_NAMES.length)];
  const suffix = Math.floor(10 + Math.random() * 90);
  return `${base} ${suffix}`;
}

// Phục vụ file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route cho PWA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Xử lý kết nối WebSocket Realtime
wss.on('connection', (ws, req) => {
  const clientId = 'user_' + Math.random().toString(36).substr(2, 9);
  const clientName = getRandomName();
  let currentRoomId = 'chanh-dien-01';
  let clientSeat = -1;

  const room = getRoom(currentRoomId);

  // Tìm bồ đoàn còn trống gần trung tâm nhất
  for (let i = 0; i < room.seats.length; i++) {
    if (room.seats[i] === null) {
      clientSeat = i;
      room.seats[i] = clientId;
      break;
    }
  }

  const clientData = {
    id: clientId,
    name: clientName,
    seatIndex: clientSeat,
    action: 'idle',
    x: 0,
    z: 0,
    rot: 0,
    isMoving: false,
    isSitting: true
  };

  room.clients.set(clientId, { ws, ...clientData });

  console.log(`[+] Người chơi tham gia: ${clientName} (${clientId}) - Ghế số: ${clientSeat}`);

  // Gửi thông tin chào mừng và toàn bộ người đang ngồi trong phòng cho người mới
  const currentPlayers = [];
  room.clients.forEach((c) => {
    currentPlayers.push({
      id: c.id,
      name: c.name,
      seatIndex: c.seatIndex,
      action: c.action,
      x: c.x,
      z: c.z,
      rot: c.rot,
      isMoving: c.isMoving,
      isSitting: c.isSitting
    });
  });

  ws.send(JSON.stringify({
    type: 'welcome',
    self: clientData,
    roomId: currentRoomId,
    roomName: room.name,
    totalOnline: room.clients.size,
    players: currentPlayers
  }));

  // Báo cho mọi người khác trong phòng biết có người mới vào
  broadcastToRoom(currentRoomId, {
    type: 'player_joined',
    player: clientData,
    totalOnline: room.clients.size
  }, clientId);

  // Nhận tin nhắn từ client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'action') {
        // data: { action: 'gassho' | 'bow' | 'idle' | 'beads' | 'woodblock' }
        clientData.action = data.action;
        const c = room.clients.get(clientId);
        if (c) c.action = data.action;

        // Broadcast hành động tới tất cả người khác trong chánh điện
        broadcastToRoom(currentRoomId, {
          type: 'player_action',
          id: clientId,
          name: clientName,
          action: data.action,
          seatIndex: clientSeat
        });
      }

      if (data.type === 'move') {
        clientData.x = data.x;
        clientData.z = data.z;
        clientData.rot = data.rot;
        clientData.isMoving = data.isMoving;
        clientData.isSitting = data.isSitting;
        clientData.seatIndex = data.seatIndex;

        const c = room.clients.get(clientId);
        if (c) {
          c.x = data.x;
          c.z = data.z;
          c.rot = data.rot;
          c.isMoving = data.isMoving;
          c.isSitting = data.isSitting;
          c.seatIndex = data.seatIndex;
        }

        broadcastToRoom(currentRoomId, {
          type: 'player_moved_pos',
          id: clientId,
          x: data.x,
          z: data.z,
          rot: data.rot,
          isMoving: data.isMoving,
          isSitting: data.isSitting,
          seatIndex: data.seatIndex
        }, clientId);
      }

      if (data.type === 'stand_up') {
        if (clientSeat !== -1 && room.seats[clientSeat] === clientId) {
          room.seats[clientSeat] = null;
        }
        clientSeat = -1;
        clientData.seatIndex = -1;
        clientData.isSitting = false;

        broadcastToRoom(currentRoomId, {
          type: 'player_stood_up',
          id: clientId
        });
      }

      if (data.type === 'change_seat') {
        const newSeat = parseInt(data.seatIndex);
        if (newSeat >= 0 && newSeat < room.seats.length && room.seats[newSeat] === null) {
          // Trả lại ghế cũ
          if (clientSeat !== -1) room.seats[clientSeat] = null;
          // Nhận ghế mới
          clientSeat = newSeat;
          room.seats[clientSeat] = clientId;
          clientData.seatIndex = clientSeat;

          broadcastToRoom(currentRoomId, {
            type: 'player_moved',
            id: clientId,
            name: clientName,
            seatIndex: clientSeat
          });
        }
      }

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      console.error('Lỗi phân tích tin nhắn WebSocket:', e);
    }
  });

  // Khi ngắt kết nối
  ws.on('close', () => {
    if (clientSeat !== -1 && room.seats[clientSeat] === clientId) {
      room.seats[clientSeat] = null;
    }
    room.clients.delete(clientId);
    console.log(`[-] Người chơi rời đi: ${clientName} (${clientId})`);

    broadcastToRoom(currentRoomId, {
      type: 'player_left',
      id: clientId,
      name: clientName,
      seatIndex: clientSeat,
      totalOnline: room.clients.size
    });
  });

  ws.on('error', (err) => {
    console.error('Lỗi WebSocket client:', err);
  });
});

function broadcastToRoom(roomId, messageObj, excludeClientId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const raw = JSON.stringify(messageObj);
  room.clients.forEach((client, id) => {
    if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🛕  CHÙA ONLINE SERVER ĐANG CHẠY TRÊN CỔNG: ${PORT}`);
  console.log(`👉  Truy cập cục bộ: http://localhost:${PORT}`);
  console.log(`👉  Truy cập qua mạng LAN: http://192.168.1.25:${PORT}`);
  console.log(`===============================================`);
});
