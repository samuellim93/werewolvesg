import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useNarrator from './useNarrator';

const WOLF_GROUP_ROLES = ['狼人', '狼王', '狼美人', '白狼王', '惡靈騎士', '夢魘', '血月使徒', '覺醒狼王', '覺醒隱狼', '尋香魅影'];

const PlayerSlot = React.memo(({ index, player, socketId, hasGodMode, isVictim, isWolf, onClick }) => {
  return (
    <div 
      className={`player-slot occupied ${player?.gameRole?.isAlive === false ? 'dead' : ''} ${player?.gameRole?.isIdiotRevealed ? 'ready' : ''} ${isVictim ? 'victim-pulse' : ''}`} 
      onClick={onClick}
      style={{ 
        opacity: (!player || player?.gameRole?.isAlive === false) && !player?.gameRole?.isIdiotRevealed ? 0.3 : (player?.isOffline ? 0.4 : 1), 
        border: isVictim ? '2px solid #ff4444' : (isWolf ? '1px solid #ff4444' : ''),
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ position: 'absolute', top: '5px', left: '8px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>#{index + 1}</div>
      {player ? (
        <>
          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: player?.isOffline ? 'var(--text-dim)' : '#fff' }}>
            {player.name} {player?.isOffline && <span style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 'normal' }}>[离线]</span>}
          </div>
          {player.id === socketId && <div style={{ color: 'var(--amber-glow)', fontSize: '0.6rem' }}>[你]</div>}
          {hasGodMode && player.gameRole && (
            <div style={{ marginTop: '5px', background: 'rgba(255, 191, 0, 0.15)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--amber-dim)', color: 'var(--amber-glow)', fontSize: '0.8rem', fontWeight: '600' }}>
              {player.gameRole.name}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>空席</div>
      )}
    </div>
  );
});

const TimerDisplay = React.memo(({ socket, initialCount = 30 }) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    socket.on('game_countdown', (c) => setCount(c));
    return () => socket.off('game_countdown');
  }, [socket]);

  return (
    <h2 className="pulse" style={{ color: count <= 5 ? '#ff4444' : 'var(--amber-glow)', fontSize: '2.5rem', margin: '10px 0' }}>
      {count}s
    </h2>
  );
});

function GameView({ room, socket, role, onLeave, onOpenVotes }) {
  const [verifyResult, setVerifyResult] = useState(null);
  const [log, setLog] = useState(['• 游戏正式初始化。']);
  const [showRole, setShowRole] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [canAct, setCanAct] = useState(false);
  const [selectedMagicianTargets, setSelectedMagicianTargets] = useState([]);
  const [selectedSeerTargets, setSelectedSeerTargets] = useState([]);
  const [selectedPhantomTargets, setSelectedPhantomTargets] = useState([]);

  useEffect(() => {
    setSelectedMagicianTargets([]);
    setSelectedSeerTargets([]);
    setSelectedPhantomTargets([]);
  }, [room.phase]);

  const { speak, stopSpeech, NARRATION_SEQUENCE } = useNarrator();
  const lastSequenceRef = useRef(null);
  
  const myPlayer = useMemo(() => room.players.find(p => p.id === socket.id), [room.players, socket.id]);
  const isStarting = useMemo(() => room.status === 'STARTING', [room.status]);
  const isNight = useMemo(() => room.status === 'NIGHT', [room.status]);
  const isCreator = useMemo(() => room.creator === socket.id || myPlayer?.isCreator, [room.creator, socket.id, myPlayer?.isCreator]);
  const isSimulation = useMemo(() => room.isSimulation, [room.isSimulation]);
  
  const isAlive = useMemo(() => myPlayer?.gameRole?.isAlive || myPlayer?.gameRole?.isIdiotRevealed, [myPlayer?.gameRole?.isAlive, myPlayer?.gameRole?.isIdiotRevealed]);
  const canVote = useMemo(() => isAlive && !myPlayer?.gameRole?.isIdiotRevealed, [isAlive, myPlayer?.gameRole?.isIdiotRevealed]);
  const hasGodMode = useMemo(() => isSimulation && isCreator, [isSimulation, isCreator]);

  // 🎙️ Sequence Narration Controller
  useEffect(() => {
    console.log(`[GameView Logic] Status: ${room.status}, Phase: ${room.phase}`);
    if (room.status !== 'NIGHT' && room.status !== 'DAY') return;

    const eventKey = `${room.status}_${room.phase}_${room.currentSequenceId}`;
    if (eventKey === lastSequenceRef.current) return;
    lastSequenceRef.current = eventKey;

    setCanAct(false);

    console.log(`[Narrator Controller] Phase: ${room.phase}, Status: ${room.status}, SequenceID: ${room.currentSequenceId}`);

    if (room.phase === 'NIGHT_DUSK') {
      const seq = NARRATION_SEQUENCE['NIGHT_DUSK'];
      speak(seq.text, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
      return;
    }

    if (room.phase === 'SHERIFF') {
      const seq = NARRATION_SEQUENCE['SHERIFF'];
      if (seq) speak(seq.text);
      return;
    }

    if (room.status === 'DAY' && room.phase === 'RESULTS') {
      console.log(`[Narrator] Entering Results Announcement. Results:`, room.nightResults);
      const resultsText = room.nightResults.length === 0 
        ? '无人死亡：昨晚是平安夜' 
        : `有人死亡：昨晚死亡的是 ${room.nightResults.map(r => room.slots.findIndex(s => s?.name === r.name) + 1).join(', ')} 号玩家。`;
      
      speak('天亮了，所有人请睁眼。', () => {
          setTimeout(() => {
              speak('公布结果：', () => {
                  setTimeout(() => speak(resultsText), 500);
              });
          }, 800);
      });
      return;
    }

    const roleSeq = NARRATION_SEQUENCE[room.phase];
    if (roleSeq && roleSeq.type === 'ACTION') {
      speak(roleSeq.opening);
      setCanAct(true);
      return;
    }

  }, [room.status, room.phase, room.currentSequenceId, room.id, socket, speak, NARRATION_SEQUENCE, room.nightResults, room.slots]);

  useEffect(() => {
    socket.on('verify_result', (result) => setVerifyResult(result));
    socket.on('game_log', (msg) => setLog(prev => [...prev, `• ${msg}`]));
    
    return () => {
      socket.off('verify_result');
      socket.off('game_log');
    };
  }, [socket]);

  useEffect(() => {
    setPendingAction(null);
  }, [room.phase]);

  const confirmAction = useCallback(() => {
    if (!pendingAction) return;
    const seq = NARRATION_SEQUENCE[room.phase];
    const isVerifyPhase = ['NIGHT_SEER', 'NIGHT_PSYCHIC', 'NIGHT_GARGOYLE', 'NIGHT_MECHANICAL_WOLF'].includes(room.phase);
    if (!isVerifyPhase && seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
    }
    if (pendingAction.type === 'save' || pendingAction.type === 'poison') {
      socket.emit('witch_action', { roomId: room.id, action: pendingAction.type, targetId: pendingAction.targetId });
    } else if (pendingAction.type === 'knight_duel') {
      socket.emit('knight_duel', { roomId: room.id, targetId: pendingAction.targetId });
    } else {
      socket.emit(pendingAction.type, { roomId: room.id, targetId: pendingAction.targetId });
    }
    setPendingAction(null);
  }, [pendingAction, NARRATION_SEQUENCE, room.phase, room.id, room.currentSequenceId, socket, speak]);

  const handleVerifyConfirm = useCallback(() => {
    setVerifyResult(null);
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => {
          socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
      });
    } else {
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  }, [NARRATION_SEQUENCE, room.phase, room.id, room.currentSequenceId, socket, speak]);

  const initiateAction = useCallback((type, target) => {
    const spotIndex = room.slots.findIndex(s => s?.id === target.id) + 1;
    setPendingAction({ type, targetId: target.id, targetName: target.name, targetSpot: spotIndex });
  }, [room.slots]);

  const initiateGuardSkip = useCallback(() => {
    setPendingAction({ type: 'guard_protect', targetId: null, targetName: '不守護（空守）', targetSpot: null });
  }, []);

  const initiateDreamSkip = useCallback(() => {
    setPendingAction({ type: 'dream_link', targetId: null, targetName: '不攝夢（空夢）', targetSpot: null });
  }, []);

  const handleFinishTurn = useCallback(() => {
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
    } else {
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  }, [NARRATION_SEQUENCE, room.phase, room.id, room.currentSequenceId, socket, speak]);

  const handleMagicianToggle = useCallback((id) => {
    setSelectedMagicianTargets(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }, []);

  const confirmMagicianSwap = useCallback(() => {
    if (selectedMagicianTargets.length !== 2) return;
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => {
        socket.emit('magician_swap', { roomId: room.id, targets: selectedMagicianTargets });
        socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
      });
    } else {
      socket.emit('magician_swap', { roomId: room.id, targets: selectedMagicianTargets });
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  }, [selectedMagicianTargets, NARRATION_SEQUENCE, room.phase, room.id, room.currentSequenceId, socket, speak]);

  const handleSeerToggle = useCallback((id) => {
    setSelectedSeerTargets(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const confirmSeerCheck = useCallback(() => {
    if (selectedSeerTargets.length !== 2) return;
    socket.emit('awakened_seer_verify', { roomId: room.id, targets: selectedSeerTargets });
  }, [selectedSeerTargets, room.id, socket]);

  const handlePhantomToggle = useCallback((id) => {
    setSelectedPhantomTargets(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const confirmPhantomBind = useCallback(() => {
    if (selectedPhantomTargets.length !== 2) return;
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => {
        socket.emit('scent_phantom_bind', { roomId: room.id, targets: selectedPhantomTargets });
        socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
      });
    } else {
      socket.emit('scent_phantom_bind', { roomId: room.id, targets: selectedPhantomTargets });
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  }, [selectedPhantomTargets, NARRATION_SEQUENCE, room.phase, room.id, room.currentSequenceId, socket, speak]);

  const handleEndGame = useCallback(() => {
    stopSpeech();
    socket.emit('end_game', room.id);
  }, [socket, room.id, stopSpeech]);

  const handleEnterNight = useCallback(() => {
    socket.emit('enter_night', room.id);
  }, [socket, room.id]);

  const renderActions = () => {
    if (!isAlive && !myPlayer?.gameRole?.isIdiotRevealed && !hasGodMode && !isCreator) return <p style={{ color: '#ff4444' }}>你已被淘汰。</p>;

    if (room.phase === 'ROLE_REVEAL') {
      return (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '15px' }}>
             <h4 style={{ color: 'var(--amber-glow)', margin: 0 }}>身份确认阶段</h4>
             <TimerDisplay socket={socket} initialCount={30} />
             
             {isCreator ? (
               <div style={{ width: '100%' }}>
                 <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '15px' }}>所有玩家准备就绪后，点击进入夜晚</p>
                 <button className="btn btn-primary btn-action" style={{ width: '100%' }} onClick={handleEnterNight}>
                   进入夜晚 (Enter Night)
                 </button>
               </div>
             ) : (
               <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '10px' }}>等待房主开启夜晚...</p>
             )}
          </div>
        </div>
      );
    }

    if (room.status === 'NIGHT' && !canAct) return <p style={{ color: 'var(--amber-glow)', fontStyle: 'italic' }}>🎙️ 请听从旁白引导...</p>;

    if (room.phase === 'NIGHT_WEREWOLVES' && (WOLF_GROUP_ROLES.includes(role?.name) || hasGodMode)) {
      return (
        <div>
          <h4>狼人行動：請選擇獵殺目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.filter(p => p && p.gameRole?.isAlive).map(p => {
              const isWolfKing = p.gameRole?.name === '狼王';
              return (
                <button 
                  key={p.id} 
                  className="btn btn-secondary btn-action" 
                  style={{ width: 'auto', fontSize: '0.9rem', borderColor: p.gameRole?.name === '狼人' ? '#ff4444' : '' }} 
                  onClick={() => initiateAction('werewolf_kill', p)}
                  disabled={isWolfKing}
                >
                  擊殺 #{room.slots.indexOf(p) + 1} {isWolfKing && '(狼王不可自刀)'}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_SEER' && (role?.name === '預言家' || hasGodMode)) {
      return (
        <div>
          <h4>預言家行動：請選擇驗人目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.filter(p => p && p.gameRole?.isAlive).map(p => (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('seer_verify', p)}>查驗 #{room.slots.indexOf(p) + 1}</button>
            ))}
            {hasGodMode && <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8rem', opacity: 0.6 }} onClick={handleFinishTurn}>跳過</button>}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_WITCH' && (role?.name === '女巫' || hasGodMode)) {
      const victim = room.players.find(p => p.id === room.nightActions.killed);
      const canSave = victim && (victim.id !== socket.id || hasGodMode);

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4>女巫行動：</h4>
            {hasGodMode && <button className="btn btn-secondary" style={{ width: 'auto', padding: '5px 10px', fontSize: '0.7rem' }} onClick={handleFinishTurn}>完成/無藥</button>}
          </div>
          <p style={{ fontSize: '0.9rem' }}>{victim ? `昨晚被殺的是：${room.slots.findIndex(s => s?.id === victim.id) + 1} 號。` : '昨晚是平安夜。'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            {canSave && !room.nightActions.saved && <button className="btn btn-primary btn-action" style={{ width: 'auto', minWidth: '150px' }} onClick={() => initiateAction('save', victim)}>使用救藥</button>}
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px' }}>毒殺目標：</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {room.slots.filter(p => p && p.gameRole?.isAlive).map(p => (
                  <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('poison', p)}>#{room.slots.indexOf(p) + 1}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_HUNTER' && (role?.name === '獵人' || hasGodMode) ) {
        const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '獵人') : myPlayer;
        const isPoisoned = room.nightActions.poisoned === targetPlayer?.id;

        return (
          <div>
            <h4>獵人行動：</h4>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>
              你的技能狀態：
              {isPoisoned ? (
                <strong style={{ color: '#ff4444' }}> 不可用</strong>
              ) : (
                <strong style={{ color: 'var(--amber-glow)' }}> 可用</strong>
              )}
            </p>
            <button className="btn btn-primary btn-action" style={{ width: 'auto', padding: '10px 40px' }} onClick={handleFinishTurn}>確認 (OK)</button>
          </div>
        );
    }

    // --- New Role Actions ---

    if (room.phase === 'NIGHT_GUARD' && (role?.name === '守衛' || hasGodMode)) {
      return (
        <div>
          <h4>守衛行動：請選擇守護目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('guard_protect', p)}>
                守護 #{i + 1}
              </button>
            ))}
            <button className="btn btn-secondary" style={{ width: 'auto', borderColor: 'var(--amber-glow)', fontSize: '0.9rem' }} onClick={initiateGuardSkip}>
              不守護 (空守)
            </button>
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_MAGICIAN' && (role?.name === '魔術師' || hasGodMode)) {
      return (
        <div>
          <h4>魔術師行動：請選擇兩名玩家交換</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '15px' }}>
            請選擇兩名玩家交換狀態。已經被交換過的玩家不可再次選擇。
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', justifyContent: 'center' }}>
            {room.slots.map((p, i) => {
              if (!p || !p.gameRole?.isAlive) return null;
              const isSelected = selectedMagicianTargets.includes(p.id);
              const isAlreadySwapped = room.swappedIds?.includes(p.id);
              return (
                <button 
                  key={p.id} 
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ 
                    width: 'auto', 
                    fontSize: '0.9rem',
                    borderColor: isSelected ? 'var(--amber-glow)' : '',
                    opacity: isAlreadySwapped ? 0.4 : 1,
                    cursor: isAlreadySwapped ? 'not-allowed' : 'pointer'
                  }} 
                  onClick={() => handleMagicianToggle(p.id)}
                  disabled={isAlreadySwapped}
                >
                  #{i + 1} {p.name} {isAlreadySwapped && '(已交換)'}
                </button>
              );
            })}
          </div>
          <button 
            className="btn btn-primary btn-action" 
            style={{ marginTop: '20px', width: 'auto', padding: '10px 40px' }} 
            onClick={confirmMagicianSwap}
            disabled={selectedMagicianTargets.length !== 2}
          >
            確認交換 ({selectedMagicianTargets.length}/2)
          </button>
        </div>
      );
    }

    if (room.phase === 'NIGHT_DREAMCATCHER' && (role?.name === '攝夢人' || hasGodMode)) {
      return (
        <div>
          <h4>攝夢人行動：請選擇攝夢目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('dream_link', p)}>
                攝夢 #{i + 1}
              </button>
            ))}
            <button className="btn btn-secondary" style={{ width: 'auto', borderColor: 'var(--amber-glow)', fontSize: '0.9rem' }} onClick={initiateDreamSkip}>
              不攝夢 (空夢)
            </button>
          </div>
        </div>
      );
    }

    if ((room.phase === 'NIGHT_PSYCHIC' && (role?.name === '通靈師' || hasGodMode)) || (room.phase === 'NIGHT_GARGOYLE' && (role?.name === '石像鬼' || hasGodMode))) {
      return (
        <div>
          <h4>{role?.name || '查驗'}行動：請選擇查驗目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('psychic_verify', p)}>
                查驗 #{i + 1}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_NIGHTMARE' && (role?.name === '夢魘' || hasGodMode)) {
      return (
        <div>
          <h4>夢魘行動：請選擇恐懼目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('nightmare_fear', p)}>
                恐懼 #{i + 1}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_MECHANICAL_WOLF' && (role?.name === '機械狼' || hasGodMode)) {
      return (
        <div>
          <h4>機械狼行動：請選擇學習目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('mech_learn', p)}>
                學習 #{i + 1}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_DEMON_HUNTER' && (role?.name === '獵魔人' || hasGodMode)) {
      return (
        <div>
          <h4>獵魔人行動：請選擇狩獵目標</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('hunter_hunt', p)}>
                狩獵 #{i + 1}
              </button>
            ))}
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8rem', opacity: 0.6 }} onClick={handleFinishTurn}>跳過</button>
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_WOLF_KING' && (role?.name === '狼王' || hasGodMode)) {
        const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '狼王') : myPlayer;
        const isPoisoned = room.nightActions.poisoned === targetPlayer?.id;

        return (
          <div>
            <h4>狼王行動：</h4>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>
              你的技能狀態：
              {isPoisoned ? (
                <strong style={{ color: '#ff4444' }}> 不可用 (被女巫毒殺)</strong>
              ) : (
                <strong style={{ color: 'var(--amber-glow)' }}> 可用</strong>
              )}
            </p>
            <button className="btn btn-primary btn-action" style={{ width: 'auto', padding: '10px 40px' }} onClick={handleFinishTurn}>確認 (OK)</button>
          </div>
        );
    }

    if (room.phase === 'NIGHT_AWAKENED_SEER' && (role?.name === '覺醒預言家' || hasGodMode)) {
      return (
        <div>
          <h4>覺醒預言家行動：請選擇兩名查驗目標</h4>
          <p style={{ color: 'var(--amber-glow)', fontSize: '0.9rem' }}>
            已選中: {selectedSeerTargets.map(id => {
              const p = room.players.find(x => x.id === id);
              const spot = room.slots.findIndex(s => s?.id === id) + 1;
              return p ? `#${spot} ${p.name}` : '';
            }).filter(Boolean).join(' 和 ')}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
              <button 
                key={p.id} 
                className={`btn btn-action ${selectedSeerTargets.includes(p.id) ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ width: 'auto', fontSize: '0.9rem' }} 
                onClick={() => handleSeerToggle(p.id)}
              >
                #{i + 1}
              </button>
            ))}
          </div>
          {selectedSeerTargets.length === 2 && (
            <button className="btn btn-primary btn-action" style={{ marginTop: '15px', width: 'auto', padding: '10px 40px' }} onClick={confirmSeerCheck}>
              確認查驗 (Verify)
            </button>
          )}
        </div>
      );
    }

    if (room.phase === 'NIGHT_AWAKENED_WOLF_KING' && (role?.name === '覺醒狼王' || hasGodMode)) {
      const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '覺醒狼王') : myPlayer;
      const claws = targetPlayer?.gameRole?.claws || 0;
      const isPoisoned = room.nightActions.poisoned === targetPlayer?.id;
      
      const teammates = room.slots.filter(p => p && p.id !== targetPlayer?.id && p.gameRole?.isAlive && WOLF_GROUP_ROLES.includes(p.gameRole?.name));

      return (
        <div>
          <h4>覺醒狼王行動：傳授狼王爪或自刀</h4>
          <p style={{ fontSize: '0.9rem' }}>
            你的狀態：<strong>擁有 {claws} 個狼王爪</strong>
            {isPoisoned && <span style={{ color: '#ff4444' }}> (被女巫毒殺，出局無法開槍)</span>}
          </p>
          
          {claws > 0 && teammates.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>選擇傳給一名狼隊友 (消耗 1 次技能):</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                {teammates.map(p => {
                  const spot = room.slots.findIndex(s => s?.id === p.id) + 1;
                  return (
                    <button 
                      key={p.id} 
                      className="btn btn-secondary btn-action" 
                      style={{ width: 'auto', fontSize: '0.85rem' }} 
                      onClick={() => {
                        socket.emit('awakened_wolf_king_pass_claw', { roomId: room.id, targetId: p.id });
                        handleFinishTurn();
                      }}
                    >
                      傳給 #{spot} ({p.name})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-action" 
              style={{ width: 'auto', background: '#ff4444', border: 'none', color: 'white' }}
              onClick={() => {
                socket.emit('awakened_wolf_king_self_kill', { roomId: room.id });
                handleFinishTurn();
              }}
            >
              💀 選擇自刀出局
            </button>
            <button className="btn btn-secondary btn-action" style={{ width: 'auto' }} onClick={handleFinishTurn}>
              不傳授/確認閉眼
            </button>
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_AWAKENED_HIDDEN_WOLF' && (role?.name === '覺醒隱狼' || hasGodMode)) {
      const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '覺醒隱狼') : myPlayer;
      const mimickedFrom = targetPlayer?.gameRole?.mimickedFrom;

      return (
        <div>
          <h4>覺醒隱狼行動：模仿其他玩家</h4>
          {mimickedFrom ? (
            <div>
              <p style={{ color: 'var(--amber-glow)', margin: '10px 0' }}>
                🎭 你已經成功模仿了 <strong>{mimickedFrom}</strong>，正在獲取其身份技能。
              </p>
              <button className="btn btn-primary btn-action" style={{ width: 'auto', padding: '10px 40px' }} onClick={handleFinishTurn}>確認閉眼</button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '10px' }}>請選擇一名玩家進行模仿，你將立刻獲得其身份與技能：</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {room.slots.map((p, i) => p && p.id !== targetPlayer?.id && p.gameRole?.isAlive && (
                  <button 
                    key={p.id} 
                    className="btn btn-secondary btn-action" 
                    style={{ width: 'auto', fontSize: '0.9rem' }} 
                    onClick={() => {
                      socket.emit('awakened_hidden_wolf_mimic', { roomId: room.id, targetId: p.id });
                      handleFinishTurn();
                    }}
                  >
                    模仿 #{i + 1} ({p.name})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (room.phase === 'NIGHT_SCENT_PHANTOM' && (role?.name === '尋香魅影' || hasGodMode)) {
      const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '尋香魅影') : myPlayer;
      return (
        <div>
          <h4>尋香魅影行動：綁定生命線</h4>
          
          {room.scentKnownWolfSpot ? (
            <p style={{ color: 'var(--amber-glow)', fontSize: '0.85rem', marginBottom: '12px' }}>
              📢 你的首夜線索：存活狼人同伴此時在 <strong>{room.scentKnownWolfSpot}</strong> 號座位。
            </p>
          ) : (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '12px' }}>
              📢 首夜線索：場上無其他存活的狼人同伴。
            </p>
          )}

          {room.isBondTriggered ? (
            <p style={{ color: '#ff4444', fontSize: '0.9rem' }}>⚠️ 你的生死連結已經在本局中觸發，無法再進行綁定。</p>
          ) : (
            <div>
              <p style={{ color: 'var(--amber-glow)', fontSize: '0.9rem' }}>
                已選中綁定兩人: {selectedPhantomTargets.map(id => {
                  const p = room.players.find(x => x.id === id);
                  const spot = room.slots.findIndex(s => s?.id === id) + 1;
                  return p ? `#${spot} ${p.name}` : '';
                }).filter(Boolean).join(' 和 ')}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {room.slots.map((p, i) => p && p.gameRole?.isAlive && (
                  <button 
                    key={p.id} 
                    className={`btn btn-action ${selectedPhantomTargets.includes(p.id) ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ width: 'auto', fontSize: '0.9rem' }} 
                    onClick={() => handlePhantomToggle(p.id)}
                  >
                    #{i + 1}
                  </button>
                ))}
              </div>
              {selectedPhantomTargets.length === 2 && (
                <button className="btn btn-primary btn-action" style={{ marginTop: '15px', width: 'auto', padding: '10px 40px' }} onClick={confirmPhantomBind}>
                  確認綁定 (Bind)
                </button>
              )}
            </div>
          )}

          {room.isBondTriggered && (
            <button className="btn btn-primary btn-action" style={{ marginTop: '10px', width: 'auto' }} onClick={handleFinishTurn}>確認閉眼</button>
          )}
        </div>
      );
    }

    if (room.status === 'DAY') {
      if (room.phase === 'SHERIFF') {
        return (
          <div>
            <h4>警長競選階段</h4>
            <p style={{ fontSize: '1.1rem', color: 'var(--amber-glow)', margin: '20px 0', lineHeight: '1.6' }}>
              📢 想要上警的玩家，請舉手。<br />天亮請睜眼。
            </p>
            {isCreator && (
              <button 
                className="btn btn-primary btn-action" 
                style={{ width: 'auto', padding: '10px 40px', marginTop: '10px' }} 
                onClick={() => socket.emit('proceed_to_results', room.id)}
              >
                公佈昨晚出局情況 (Proceed to Results)
              </button>
            )}
          </div>
        );
      }

      if (room.phase === 'RESULTS') {
        return (
          <div>
            <h4>昨晚出局情況</h4>
            <div style={{ margin: '20px 0', fontSize: '1.1rem', color: 'var(--amber-glow)', lineHeight: '1.6' }}>
              {room.nightResults.length === 0 ? (
                <p>🟢 昨晚是平安夜，無人出局。</p>
              ) : (
                <div>
                  <p>🔴 昨晚出局的玩家有：</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', justifyContent: 'center' }}>
                    {room.nightResults.map(r => {
                      const spotIdx = room.slots.findIndex(s => s?.name === r.name) + 1;
                      return (
                        <div key={r.id} style={{ background: 'rgba(255, 68, 68, 0.15)', border: '1px solid #ff4444', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold' }}>
                          #{spotIdx} 玩家 ({r.name})
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {isCreator && (
              <button 
                className="btn btn-primary btn-action" 
                style={{ width: 'auto', padding: '10px 40px', marginTop: '10px' }} 
                onClick={() => socket.emit('proceed_to_voting', room.id)}
              >
                進入白天討論/投票階段 (Proceed to Voting)
              </button>
            )}
          </div>
        );
      }

      if ((role?.name === '騎士' || hasGodMode) && isAlive) {
        return (
          <div>
            <h4>騎士行動：發動決鬥</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {room.slots.map((p, i) => p && p.id !== (hasGodMode ? '' : socket.id) && p.gameRole?.isAlive && (
                <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem', borderColor: 'var(--amber-glow)' }} onClick={() => initiateAction('knight_duel', p)}>
                  與 #{i + 1} 決鬥
                </button>
              ))}
            </div>
          </div>
        );
      }
      if (room.phase === 'VOTING') {
        return (
          <div>
            <p style={{ color: 'var(--amber-glow)', margin: '15px 0' }}>💬 白天討論與投票中... 請點擊玩家頭像查看詳情或投票。</p>
            {isCreator && (
              <button 
                className="btn btn-primary btn-action" 
                style={{ width: 'auto', padding: '10px 40px' }} 
                onClick={handleEnterNight}
              >
                進入天黑 (Enter Night)
              </button>
            )}
          </div>
        );
      }
      return <p style={{ color: 'var(--amber-glow)' }}>白天討論中... 請點擊玩家頭像查看詳情或投票。</p>;
    }

    return <p style={{ color: 'var(--text-dim)' }}>當前階段：{room.phase || '等候入夜'}</p>;
  };


  return (
    <div className="card card-wide dashboard" style={{ position: 'relative' }}>
      {isSimulation && (
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', background: 'var(--amber-glow)', color: 'black', padding: '2px 15px', borderRadius: '0 0 10px 10px', fontSize: '0.6rem', fontWeight: 'bold', zIndex: 100 }}>
          SIM / GOD MODE
        </div>
      )}

      {/* 🔮 Reveal Role Popup */}
      {showRole && role && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', border: '1px solid var(--amber-glow)', textAlign: 'center' }}>
            <h2 className="glow-text">{role.name}</h2>
            <div style={{ margin: '20px 0', textAlign: 'left', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
               <p style={{ color: role.alignment === 'Bad' ? '#ff4444' : 'var(--amber-glow)', fontWeight: 'bold', marginBottom: '10px' }}>
                 阵营：{role.alignment === 'Bad' ? '狼人阵营 (Bad)' : '好人阵营 (Good)'}
               </p>
               <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                 <p style={{ fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.4' }}>{role.description}</p>
                 <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
                 <p style={{ fontSize: '0.85rem' }}><strong>能力：</strong>{role.ability}</p>
               </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowRole(false)}>Closed</button>
          </div>
        </div>
      )}

      {verifyResult && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', padding: '20px' }}>
           <div className="card" style={{ width: '100%', maxWidth: '350px', border: '2px solid var(--amber-glow)', textAlign: 'center' }}>
              <h2 className="glow-text">{room.phase === 'NIGHT_MECHANICAL_WOLF' ? '学习结果' : '查验结果'}</h2>
              <p style={{ fontSize: '1.1rem', margin: '15px 0' }}>
                 {room.phase === 'NIGHT_MECHANICAL_WOLF' ? `你成功学习了 ${verifyResult.name} 的技能：` : `玩家 ${verifyResult.name} 的身份为：`}
              </p>
              <h1 style={{ color: verifyResult.alignment === 'Bad' ? '#ff4444' : 'var(--amber-glow)', fontSize: '2.5rem', margin: '10px 0' }}>
                 {verifyResult.roleName ? verifyResult.roleName : (verifyResult.alignment === 'Bad' ? '坏人' : '好人')}
              </h1>
              <p style={{ color: 'var(--text-dim)', marginBottom: '20px', fontSize: '0.8rem' }}>
                 {verifyResult.roleName ? `(具体身份阵营：${verifyResult.alignment === 'Bad' ? '坏人' : '好人'})` : '(坏人仅限狼人角色)'}
              </p>
              <button className="btn btn-primary btn-action" style={{ width: '100%' }} onClick={handleVerifyConfirm}>确认并闭眼</button>
           </div>
        </div>
      )}

      {pendingAction && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '320px', border: '1px solid var(--amber-glow)' }}>
            <h3 style={{ color: 'var(--amber-glow)', marginBottom: '15px' }}>确认行动</h3>
            <p style={{ fontSize: '0.9rem' }}>
              {pendingAction.targetId === null ? 
                (pendingAction.type === 'guard_protect' ? '确定选择不守护任何人（空守）？' : '确定选择不摄入任何人梦境（空梦）？') : 
                `确定对 #${pendingAction.targetSpot} 玩家执行操作？`}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={confirmAction}>确定</button>
              <button className="btn btn-secondary" onClick={() => setPendingAction(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }} className="dashboard-header">
        <div style={{ textAlign: 'left' }}>
          <h2><span className="glow-text">{
             room.phase === 'ROLE_REVEAL' ? '身份确认' :
             room.phase === 'NIGHT_DUSK' ? '入夜' :
             room.phase === 'NIGHT_WEREWOLVES' ? '狼人行动' : 
             room.phase === 'NIGHT_WITCH' ? '女巫行动' : 
             room.phase === 'NIGHT_SEER' ? '预言家行动' : 
             room.phase === 'NIGHT_HUNTER' ? '猎人行动' :
             room.phase === 'NIGHT_WOLF_KING' ? '狼王行动' :
             room.phase === 'SHERIFF' ? '警长竞选' :
             room.phase === 'RESULTS' ? '昨晚出局情况' :
             room.phase === 'VOTING' ? '投票阶段' :
             (room.phase || room.status)
          }</span></h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>房号 {room.id}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8rem', borderColor: 'var(--text-dim)', margin: 0 }} onClick={onOpenVotes}>Vote</button>
          {isSimulation && isCreator && <button className="btn btn-primary" style={{ width: 'auto', background: '#ff4444', border: 'none', padding: '8px 12px', margin: 0 }} onClick={handleEndGame}>🛑 结束</button>}
          <span className="reveal-link" style={{ fontSize: '0.9rem' }} onClick={() => setShowRole(true)}>Reveal</span>
        </div>
      </div>

      <div className="player-grid">
        {room.slots.map((p, index) => {
          const isVictim = room.nightActions?.killed === p?.id && room.phase === 'NIGHT_WITCH' && (role?.name === '女巫' || hasGodMode);
          const isWolf = WOLF_GROUP_ROLES.includes(role?.name) && WOLF_GROUP_ROLES.includes(p?.gameRole?.name);
          return (
            <PlayerSlot 
              key={index}
              index={index}
              player={p}
              socketId={socket.id}
              hasGodMode={hasGodMode}
              isVictim={isVictim}
              isWolf={isWolf}
            />
          );
        })}
      </div>

      <div style={{ marginTop: '15px', background: 'rgba(255, 191, 0, 0.05)', padding: '15px', borderRadius: '15px', minHeight: '100px' }}>
        {renderActions()}
      </div>

      {/* Log section removed */}


    </div>
  );
}

export default GameView;
