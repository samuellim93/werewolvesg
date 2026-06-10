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
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes session recovery
    skipMiddlewares: true,
  },
  cors: {
    origin: ["https://graceful-travesseiro-065548.netlify.app", "https://monumental-puffpuff-e1cd70.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

const rooms = {};
const roomTimers = {};
const disconnectTimers = {};
const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds


const COMPREHENSIVE_SEQUENCE = [
  '夢魘', '石像鬼', '機械狼', '魔術師', '守衛', '攝夢人', '狼人', '女巫', '預言家', '通靈師', '獵魔人', '獵人', '守墓人'
];
const WOLF_GROUP_ROLES = ['狼人', '狼王', '狼美人', '白狼王', '惡靈騎士', '夢魘', '血月使徒'];


function getDefaultSequenceForMode(mode, config = null) {
  let rolePool = [];
  if (mode === '預女獵') {
    rolePool = ['狼人', '狼人', '狼人', '預言家', '女巫', '獵人', '平民', '平民', '平民'];
  } else if (mode === '狼王攝夢人') {
    rolePool = ['狼人', '狼人', '狼人', '狼王', '預言家', '女巫', '獵人', '攝夢人', '平民', '平民', '平民', '平民'];
  } else if (mode === '機械狼通女獵守') {
    rolePool = ['狼人', '狼人', '狼人', '機械狼', '通靈師', '女巫', '獵人', '守衛', '平民', '平民', '平民', '平民'];
  } else if (mode === 'CUSTOM' && config) {
    rolePool = config.rolePool;
  } else {
    // 預女獵白 (Default 12-pax)
    rolePool = ['狼人', '狼人', '狼人', '狼人', '預言家', '女巫', '獵人', '白痴', '平民', '平民', '平民', '平民'];
  }
  
  const activeRoles = new Set();
  rolePool.forEach(role => {
    if (COMPREHENSIVE_SEQUENCE.includes(role)) {
      activeRoles.add(role);
    } else if (WOLF_GROUP_ROLES.includes(role)) {
      activeRoles.add('狼人');
    }
  });
  
  return COMPREHENSIVE_SEQUENCE.filter(role => activeRoles.has(role));
}

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

  socket.on('create_room', ({ user, mode, config }) => {
    const roomId = generateRoomId();
    const gameMode = (mode || '預女獵白').trim();
    const maxPlayers = gameMode === '預女獵' ? 9 : 12;
    
    rooms[roomId] = {
      id: roomId, creator: socket.id, creatorName: user.name, mode: gameMode,
      players: [{ ...user, id: socket.id, ready: false, spot: 0, isCreator: true }],
      slots: new Array(config ? config.maxPlayers : maxPlayers).fill(null),
      maxPlayers: config ? config.maxPlayers : maxPlayers, 
      status: 'LOBBY', isSimulation: false,
      sequenceOrder: (config && config.sequenceOrder) ? config.sequenceOrder : getDefaultSequenceForMode(gameMode, config),
      customConfig: config
    };
    if (roomTimers[roomId]) clearInterval(roomTimers[roomId]);
    roomTimers[roomId] = null;
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
      existing.isOffline = false;
      if (existing.name === room.creatorName) {
        room.creator = socket.id;
        existing.isCreator = true;
      }
      
      const timerKey = `${roomId}_${existing.name}`;
      if (disconnectTimers[timerKey]) {
        clearTimeout(disconnectTimers[timerKey]);
        delete disconnectTimers[timerKey];
        console.log(`[Reconnection] Player ${existing.name} reconnected to room ${roomId}. Cleared disconnect timer.`);
      }
    } else {
      if (room.players.length >= room.maxPlayers || room.status !== 'LOBBY') return;
      room.players.push({ ...user, id: socket.id, ready: false, spot: null, isCreator: user.name === room.creatorName, isOffline: false });
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
      if (roomTimers[roomId]) clearInterval(roomTimers[roomId]);
      roomTimers[roomId] = null;
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
    if (room.status === 'STARTING') return; 
    
    console.log(`[Countdown] Room: ${roomId} - Starting 10s Lobby Countdown`);
    room.status = 'STARTING';
    io.to(roomId).emit('room_update', room);
    
    let countdown = 10;
    if (roomTimers[roomId]) clearInterval(roomTimers[roomId]);
    
    roomTimers[roomId] = setInterval(() => {
      countdown--;
      io.to(roomId).emit('game_countdown', countdown);
      if (countdown <= 0) {
        clearInterval(roomTimers[roomId]);
        roomTimers[roomId] = null;
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
    if (room.mode === '預女獵') {
      rolePool = ['狼人', '狼人', '狼人', '預言家', '女巫', '獵人', '平民', '平民', '平民'];
    } else if (room.mode === '狼王攝夢人') {
      rolePool = ['狼人', '狼人', '狼人', '狼王', '預言家', '女巫', '獵人', '攝夢人', '平民', '平民', '平民', '平民'];
    } else if (room.mode === '機械狼通女獵守') {
      rolePool = ['狼人', '狼人', '狼人', '機械狼', '通靈師', '女巫', '獵人', '守衛', '平民', '平民', '平民', '平民'];
    } else if (room.mode === 'CUSTOM' && room.customConfig) {
      rolePool = room.customConfig.rolePool;
    } else {
      rolePool = ['狼人', '狼人', '狼人', '狼人', '預言家', '女巫', '獵人', '白痴', '平民', '平民', '平民', '平民'];
    }
    
    shuffle(rolePool);
    room.slots.forEach((player, index) => {
      if (player) {
        const roleName = rolePool[index];
        const meta = roleName ? rolesMeta.find(r => r.name === roleName) : null;
        if (meta) {
          player.gameRole = { name: meta.name, alignment: meta.alignment, description: meta.description, ability: meta.ability, isAlive: true };
          if (!player.isMock) io.to(player.id).emit('assign_role', player.gameRole);
        } else {
          console.warn(`[Warning] No role meta found for index ${index} (roleName: ${roleName}). Falling back to Villager.`);
          const villagerMeta = rolesMeta.find(r => r.name === '平民');
          player.gameRole = { name: villagerMeta.name, alignment: villagerMeta.alignment, description: villagerMeta.description, ability: villagerMeta.ability, isAlive: true };
        }
      }
    });
    room.status = 'STARTED';
    room.phase = 'ROLE_REVEAL';
    room.currentSequenceId = 0; 
    room.nightActions = { 
      killed: null, 
      verified: null, 
      saved: false, 
      poisoned: null,
      guarded: null,
      dreaming: null,
      feared: null,
      hunted: null,
      magicianSwaps: []
    };

    // Dynamically filter sequenceOrder based on active roles in the pool
    const activeRoles = new Set();
    rolePool.forEach(role => {
      if (COMPREHENSIVE_SEQUENCE.includes(role)) {
        activeRoles.add(role);
      } else if (WOLF_GROUP_ROLES.includes(role)) {
        activeRoles.add('狼人');
      }
    });

    if (room.sequenceOrder) {
      room.sequenceOrder = room.sequenceOrder.filter(role => activeRoles.has(role));
      const missingRoles = COMPREHENSIVE_SEQUENCE.filter(role => activeRoles.has(role) && !room.sequenceOrder.includes(role));
      room.sequenceOrder = [...room.sequenceOrder, ...missingRoles];
    } else {
      room.sequenceOrder = COMPREHENSIVE_SEQUENCE.filter(role => activeRoles.has(role));
    }

    io.to(roomId).emit('room_update', room);

    console.log(`[Reveal Phase] Room: ${roomId} - Status is now STARTED. Starting 30s Reveal Timer.`);

    // Start 30s Reveal Countdown
    if (roomTimers[roomId]) clearInterval(roomTimers[roomId]);
    let revealCount = 30;
    io.to(roomId).emit('game_countdown', revealCount);
    
    roomTimers[roomId] = setInterval(() => {
      revealCount--;
      io.to(roomId).emit('game_countdown', revealCount);
      if (revealCount <= 0) {
        clearInterval(roomTimers[roomId]);
        roomTimers[roomId] = null;
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

    if (roomTimers[roomId]) {
      clearInterval(roomTimers[roomId]);
      roomTimers[roomId] = null;
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

    const seqMap = { 
      '狼人': 'NIGHT_WEREWOLVES', 
      '女巫': 'NIGHT_WITCH', 
      '預言家': 'NIGHT_SEER', 
      '獵人': 'NIGHT_HUNTER',
      '守衛': 'NIGHT_GUARD',
      '魔術師': 'NIGHT_MAGICIAN',
      '攝夢人': 'NIGHT_DREAMCATCHER',
      '通靈師': 'NIGHT_PSYCHIC',
      '石像鬼': 'NIGHT_GARGOYLE',
      '夢魘': 'NIGHT_NIGHTMARE',
      '機械狼': 'NIGHT_MECHANICAL_WOLF',
      '獵魔人': 'NIGHT_DEMON_HUNTER',
      '守墓人': 'NIGHT_GRAVEDIGGER'
    };
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
    const { killed, saved, poisoned, guarded, dreaming, hunted } = room.nightActions;
    const results = [];
    
    // 1. Determine Night Deaths
    const deathMap = new Set();

    // -- Werewolf Kill vs Guard/Witch --
    if (killed) {
      const isGuarded = (guarded === killed);
      const isSaved = saved;
      
      if (isGuarded && isSaved) {
        // Milk Through (奶穿)
        deathMap.add(killed);
      } else if (!isGuarded && !isSaved) {
        // Normal Kill
        deathMap.add(killed);
      }
      // If (Guarded and !Saved) or (!Guarded and Saved), player survives.
    }

    // -- Witch Poison --
    if (poisoned) {
      const target = room.players.find(p => p.id === poisoned);
      if (target && target.gameRole.name !== '獵魔人') { // Demon Hunter is immune
        deathMap.add(poisoned);
      }
    }

    // -- Demon Hunter Hunt --
    if (hunted) {
      const target = room.players.find(p => p.id === hunted);
      const hunter = room.players.find(p => p.gameRole.name === '獵魔人');
      if (target && target.gameRole.alignment === 'Bad') {
        deathMap.add(hunted);
      } else if (target && hunter) {
        deathMap.add(hunter.id);
      }
    }

    // -- Dreamcatcher Logic (Simplified) --
    if (dreaming) {
      // Immune to night damage (already handled by not adding to deathMap if dreaming?)
      // Actually, if dreaming is target of kill/poison, they survive.
      // But if Dreamcatcher dies, target dies.
      const dreamcatcher = room.players.find(p => p.gameRole.name === '攝夢人');
      if (dreamcatcher && deathMap.has(dreamcatcher.id)) {
        deathMap.add(dreaming);
      }
    }

    // 2. Apply Deaths & Collect Results
    deathMap.forEach(pid => {
      const p = room.players.find(p => p.id === pid);
      if (p && p.gameRole.isAlive) {
        p.gameRole.isAlive = false;
        results.push({ name: p.name, id: p.id, type: 'died' });
        
        // Special Gun Status
        if (p.gameRole.name === '獵人' || p.gameRole.name === '狼王') {
          p.gameRole.canShoot = !poisoned || poisoned !== pid;
        }
      }
    });

    room.nightResults = results;
    console.log(`[Transition] Room: ${roomId} - Switching to DAY. Results:`, results);
    io.to(roomId).emit('room_update', room);
    
    if (roomTimers[roomId + '_day']) clearTimeout(roomTimers[roomId + '_day']);
    roomTimers[roomId + '_day'] = setTimeout(() => {
      room.phase = 'VOTING';
      io.to(roomId).emit('room_update', room);
    }, 15000); 
  }

  socket.on('werewolf_kill', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_WEREWOLVES') return;
    const player = room.players.find(p => p.id === socket.id);
    if (WOLF_GROUP_ROLES.includes(player?.gameRole?.name) || (room.isSimulation && socket.id === room.creator)) {
      room.nightActions.killed = targetId;
      io.to(roomId).emit('room_update', room);
    }
  });

  socket.on('seer_verify', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_SEER') return;
    const player = room.players.find(p => p.id === socket.id);
    if (player?.gameRole?.name === '預言家' || (room.isSimulation && socket.id === room.creator)) {
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

  socket.on('guard_protect', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_GUARD') return;
    room.nightActions.guarded = targetId;
    io.to(roomId).emit('room_update', room);
  });

  socket.on('dream_link', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_DREAMCATCHER') return;
    room.nightActions.dreaming = targetId;
    io.to(roomId).emit('room_update', room);
  });

  socket.on('psychic_verify', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || (room.phase !== 'NIGHT_PSYCHIC' && room.phase !== 'NIGHT_GARGOYLE')) return;
    const target = room.players.find(p => p.id === targetId);
    if (target) {
      let roleNameToShow = target.gameRole.name;
      if (room.phase === 'NIGHT_PSYCHIC' && target.gameRole.name === '機械狼') {
        roleNameToShow = target.gameRole.learnedRole || '機械狼';
      }
      socket.emit('verify_result', { name: target.name, alignment: target.gameRole.alignment, roleName: roleNameToShow });
    }
  });

  socket.on('nightmare_fear', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_NIGHTMARE') return;
    room.nightActions.feared = targetId;
    io.to(roomId).emit('room_update', room);
  });

  socket.on('mech_learn', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_MECHANICAL_WOLF') return;
    const target = room.players.find(p => p.id === targetId);
    if (target) {
      let player = room.players.find(p => p.id === socket.id);
      if (room.isSimulation && socket.id === room.creator) {
        player = room.players.find(p => p.gameRole?.name === '機械狼');
      }
      if (player) {
        player.gameRole.learnedRole = target.gameRole.name;
        socket.emit('verify_result', { name: target.name, alignment: target.gameRole.alignment, roleName: target.gameRole.name });
      }
      socket.emit('game_log', `你成功學習了 ${target.name} 的技能 (${target.gameRole.name})`);
    }
  });

  socket.on('hunter_hunt', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'NIGHT_DEMON_HUNTER') return;
    room.nightActions.hunted = targetId;
    io.to(roomId).emit('room_update', room);
  });

  socket.on('knight_duel', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'DAY') return;
    const player = room.players.find(p => p.id === socket.id);
    const isSimulation = room.isSimulation && player.isCreator;
    
    const actor = isSimulation ? room.players.find(p => p.gameRole?.name === '騎士') : player;
    if (actor?.gameRole?.name === '騎士' && actor.gameRole.isAlive) {
      const target = room.players.find(p => p.id === targetId);
      if (target && target.gameRole.isAlive) {
        console.log(`[Knight Duel] ${actor.name} duels ${target.name}`);
        if (target.gameRole.alignment === 'Bad') {
          target.gameRole.isAlive = false;
          io.to(roomId).emit('game_log', `騎士決鬥成功！狼人 ${target.name} 被斬殺。`);
          startNight(roomId);
        } else {
          actor.gameRole.isAlive = false;
          io.to(roomId).emit('game_log', `騎士決鬥失敗！騎士 ${actor.name} 以死謝罪。`);
        }
        io.to(roomId).emit('room_update', room);
      }
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
      if (player) {
        const timerKey = `${roomId}_${player.name}`;
        if (disconnectTimers[timerKey]) {
          clearTimeout(disconnectTimers[timerKey]);
          delete disconnectTimers[timerKey];
        }
        if (player.spot !== null) room.slots[player.spot] = null;
        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(roomId);
        if (room.players.length === 0) delete rooms[roomId];
        else io.to(roomId).emit('room_update', room);
      }
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const pIdx = room.players.findIndex(p => p.id === socket.id);
      if (pIdx !== -1) {
        const p = room.players[pIdx];
        if (p.isMock) {
          if (p.spot !== null) room.slots[p.spot] = null;
          room.players.splice(pIdx, 1);
          if (room.players.length === 0) delete rooms[roomId];
          else io.to(roomId).emit('room_update', room);
          continue;
        }

        p.isOffline = true;
        console.log(`[Disconnection] Player ${p.name} disconnected from room ${roomId}. Starting 30s grace period.`);
        io.to(roomId).emit('room_update', room);

        const timerKey = `${roomId}_${p.name}`;
        if (disconnectTimers[timerKey]) clearTimeout(disconnectTimers[timerKey]);

        disconnectTimers[timerKey] = setTimeout(() => {
          const r = rooms[roomId];
          if (r) {
            const idx = r.players.findIndex(player => player.name === p.name);
            if (idx !== -1) {
              const playerToRemove = r.players[idx];
              console.log(`[Disconnection] Grace period expired for ${playerToRemove.name} in room ${roomId}. Removing from room.`);
              
              if (playerToRemove.spot !== null) r.slots[playerToRemove.spot] = null;
              r.players.splice(idx, 1);

              if (r.players.length === 0 || (r.creator === playerToRemove.id && r.isSimulation)) {
                delete rooms[roomId];
              } else {
                if (r.creator === playerToRemove.id) {
                  const nextHuman = r.players.find(pl => !pl.isMock);
                  if (nextHuman) {
                    r.creator = nextHuman.id;
                    nextHuman.isCreator = true;
                  }
                }
                io.to(roomId).emit('room_update', r);
              }
            }
          }
          delete disconnectTimers[timerKey];
        }, DISCONNECT_GRACE_PERIOD);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
