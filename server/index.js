const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

const DEFAULT_SEQUENCE = ['狼人', '女巫', '预言家', '猎人'];

function generateRoomId() {
  let id;
  do { id = Math.floor(1000 + Math.random() * 9000).toString(); } while (rooms[id]);
  return id;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    const user = { name: data.type === 'guest' ? data.name : data.username, id: socket.id, role_type: data.type === 'guest' ? 'guest' : 'user' };
    socket.emit('login_success', user);
  });

  socket.on('create_room', ({ user, mode }) => {
    const roomId = generateRoomId();
    const gameMode = (mode || '预女猎白').trim();
    const maxPlayers = gameMode === '预女猎' ? 9 : 12;
    
    console.log(`[Room Created] ID: ${roomId}, Mode: "${gameMode}", MaxPlayers: ${maxPlayers}`);

    rooms[roomId] = {
      id: roomId, creator: socket.id, creatorName: user.name, mode: gameMode,
      players: [{ ...user, id: socket.id, ready: false, spot: 0, isCreator: true }],
      slots: new Array(maxPlayers).fill(null),
      maxPlayers, status: 'LOBBY', isSimulation: false, currentTimer: null,
      sequenceOrder: [...DEFAULT_SEQUENCE]
    };
    rooms[roomId].slots[0] = rooms[roomId].players[0];
    socket.join(roomId);
    io.to(roomId).emit('room_update', rooms[roomId]);
  });

  socket.on('join_room', ({ roomId, user }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    const existing = room.players.find(p => p.name === user.name);
    if (existing) {
      existing.id = socket.id;
      if (existing.name === room.creatorName) {
        room.creator = socket.id;
        existing.isCreator = true;
      }
    } else {
      if (room.players.length >= room.maxPlayers || room.status !== 'LOBBY') return;
      room.players.push({ ...user, id: socket.id, ready: false, spot: null, isCreator: user.name === room.creatorName });
    }
    
    socket.join(roomId);
    io.to(roomId).emit('room_update', room);
  });

  socket.on('update_room_config', ({ roomId, sequenceOrder }) => {
    const room = rooms[roomId];
    if (room && room.creator === socket.id && room.status === 'LOBBY') {
      if (sequenceOrder) room.sequenceOrder = sequenceOrder;
      io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('select_spot', ({ roomId, spotIndex }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'LOBBY' || room.slots[spotIndex]) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (player.spot !== null) room.slots[player.spot] = null;
    player.spot = spotIndex;
    room.slots[spotIndex] = player;
    io.to(roomId).emit('room_update', room);
  });

  socket.on('start_game', (roomId) => {
    const room = rooms[roomId];
    if (room && room.creator === socket.id) {
      const unassigned = room.players.filter(p => p.spot === null);
      room.slots.forEach((slot, index) => {
        if (!slot && unassigned.length > 0) {
          const p = unassigned.shift();
          p.spot = index;
          room.slots[index] = p;
        }
      });
      triggerCountdown(roomId);
    }
  });

  socket.on('simulate_game', (roomId) => {
    const room = rooms[roomId];
    if (room && room.creator === socket.id) {
      room.isSimulation = true;
      room.slots.forEach((slot, index) => {
        if (!slot) {
          const mockPlayer = { id: `mock-${index}`, name: `座号 ${index + 1}`, ready: true, spot: index, isMock: true };
          room.slots[index] = mockPlayer;
          room.players.push(mockPlayer);
        }
      });
      triggerCountdown(roomId);
    }
  });

  socket.on('end_game', (roomId) => {
    const room = rooms[roomId];
    if (room && room.creator === socket.id) {
      if (room.currentTimer) clearTimeout(room.currentTimer);
      room.status = 'LOBBY';
      room.phase = null;
      room.currentSequenceId = 0;
      room.isSimulation = false;
      room.players = room.players.filter(p => !p.isMock);
      room.slots = room.slots.map(s => (s?.isMock ? null : s));
      room.players.forEach(p => { p.ready = false; p.gameRole = null; });
      io.to(roomId).emit('room_update', room);
    }
  });

  function triggerCountdown(roomId) {
    const room = rooms[roomId];
    if (room.status === 'STARTING') return; // Guard against double trigger
    
    console.log(`[Countdown] Room: ${roomId} - Starting 10s Lobby Countdown`);
    room.status = 'STARTING';
    io.to(roomId).emit('room_update', room);
    
    let countdown = 10;
    if (room.currentTimer) clearInterval(room.currentTimer);
    
    room.currentTimer = setInterval(() => {
      countdown--;
      io.to(roomId).emit('game_countdown', countdown);
      if (countdown <= 0) {
        clearInterval(room.currentTimer);
        room.currentTimer = null;
        assignRolesAndStart(roomId);
      }
    }, 1000);
  }

  async function assignRolesAndStart(roomId) {
    const room = rooms[roomId];
    if (!room || room.status === 'STARTED') return; // Guard against multiple calls
    console.log(`[Transition] Room: ${roomId} - Assigning Roles & Entering REVEAL Phase`);
    const rolesMeta = await db.getRoles();
    
    let rolePool = [];
    if (room.mode === '预女猎') {
      rolePool = ['狼人', '狼人', '狼人', '预言家', '女巫', '猎人', '平民', '平民', '平民'];
    } else {
      rolePool = ['狼人', '狼人', '狼人', '狼人', '预言家', '女巫', '猎人', '白痴', '平民', '平民', '平民', '平民'];
    }
    
    shuffle(rolePool);
    room.slots.forEach((player, index) => {
      if (player) {
        const meta = rolesMeta.find(r => r.name === rolePool[index]);
        player.gameRole = { name: meta.name, alignment: meta.alignment, description: meta.description, ability: meta.ability, isAlive: true };
        if (!player.isMock) io.to(player.id).emit('assign_role', player.gameRole);
      }
    });
    room.status = 'STARTED';
    room.phase = 'ROLE_REVEAL';
    room.currentSequenceId = 0; 
    room.nightActions = { killed: null, verified: null, saved: false, poisoned: null };
    io.to(roomId).emit('room_update', room);

    console.log(`[Reveal Phase] Room: ${roomId} - Status is now STARTED. Starting 30s Reveal Timer.`);

    // Start 30s Reveal Countdown
    if (room.currentTimer) clearInterval(room.currentTimer);
    let revealCount = 30;
    io.to(roomId).emit('game_countdown', revealCount);
    
    room.currentTimer = setInterval(() => {
      revealCount--;
      io.to(roomId).emit('game_countdown', revealCount);
      if (revealCount <= 0) {
        clearInterval(room.currentTimer);
        room.currentTimer = null;
        console.log(`[Reveal Phase] Room: ${roomId} - Countdown finished. Waiting for manual Enter Night by creator.`);
      }
    }, 1000);
  }

  function startNight(roomId) {
    const room = rooms[roomId];
    if (!room || room.status === 'NIGHT') return; 
    
    console.log(`[Night Phase] Room: ${roomId} - Transitioning to NIGHT`);
    room.status = 'NIGHT';
    room.currentSequenceId = 1;
    room.phase = 'NIGHT_DUSK';
    io.to(roomId).emit('room_update', room);
  }

  socket.on('enter_night', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'STARTED') return;
    
    // Ensure only creator can start the night
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isCreator) return;

    if (room.currentTimer) {
      clearInterval(room.currentTimer);
      room.currentTimer = null;
    }
    startNight(roomId);
  });

  socket.on('advance_sequence', ({ roomId, currentId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (currentId !== room.currentSequenceId) {
       console.log(`[Sequence Guard] Ignoring outdated/duplicate request. Client: ${currentId}, Server: ${room.currentSequenceId}`);
       return;
    }

    const seqMap = { '狼人': 'NIGHT_WEREWOLVES', '女巫': 'NIGHT_WITCH', '预言家': 'NIGHT_SEER', '猎人': 'NIGHT_HUNTER' };
    const nextRole = room.sequenceOrder[currentId - 1];

    if (nextRole) {
      room.phase = seqMap[nextRole];
      room.currentSequenceId = currentId + 1;
      io.to(roomId).emit('room_update', room);
    } else {
      room.currentSequenceId = room.sequenceOrder.length + 2; 
      transitionToDay(roomId);
    }
  });

  function transitionToDay(roomId) {
    const room = rooms[roomId];
    if (!room || room.status !== 'NIGHT') return;
    room.status = 'DAY';
    room.phase = 'RESULTS';
    const { killed, saved, poisoned } = room.nightActions;
    const results = [];
    if (killed && !saved) {
      const p = room.players.find(p => p.id === killed);
      if (p) { p.gameRole.isAlive = false; results.push({ name: p.name, type: 'killed' }); if (p.gameRole.name === '猎人' && !poisoned) p.gameRole.canShoot = true; }
    }
    if (poisoned) {
      const p = room.players.find(p => p.id === poisoned);
      if (p) { p.gameRole.isAlive = false; results.push({ name: p.name, type: 'poisoned' }); if (p.gameRole.name === '猎人') p.gameRole.canShoot = false; }
    }
    room.nightResults = results;
    console.log(`[Transition] Room: ${roomId} - Switching to DAY. Results:`, results);
    io.to(roomId).emit('room_update', room);
    
    if (room.currentTimer) clearTimeout(room.currentTimer);
    room.currentTimer = setTimeout(() => {
      room.phase = 'VOTING';
      io.to(roomId).emit('room_update', room);
    }, 15000); 
  }

  socket.on('werewolf_kill', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_WEREWOLVES') return;
    const player = room.players.find(p => p.id === socket.id);
    if (player?.gameRole?.name === '狼人' || (room.isSimulation && socket.id === room.creator)) {
      room.nightActions.killed = targetId;
      io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('seer_verify', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_SEER') return;
    const player = room.players.find(p => p.id === socket.id);
    if (player?.gameRole?.name === '预言家' || (room.isSimulation && socket.id === room.creator)) {
      const target = room.players.find(p => p.id === targetId);
      if (target) socket.emit('verify_result', { name: target.name, alignment: target.gameRole.alignment });
    }
  });

  socket.on('witch_action', ({ roomId, action, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_WITCH') return;
    const player = room.players.find(p => p.id === socket.id);
    if (player?.gameRole?.name === '女巫' || (room.isSimulation && socket.id === room.creator)) {
      if (action === 'save') room.nightActions.saved = true;
      if (action === 'poison') room.nightActions.poisoned = targetId;
      io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('toggle_ready', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) { player.ready = !player.ready; io.to(roomId).emit('room_update', room); }
    }
  });

  socket.on('leave_room', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.spot !== null) room.slots[player.spot] = null;
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(roomId);
      if (room.players.length === 0) delete rooms[roomId];
      else io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const pIdx = room.players.findIndex(p => p.id === socket.id);
      if (pIdx !== -1) {
        const p = room.players[pIdx];
        if (p.spot !== null) room.slots[p.spot] = null;
        room.players.splice(pIdx, 1);
        if (room.players.length === 0) delete rooms[roomId];
        else io.to(roomId).emit('room_update', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
