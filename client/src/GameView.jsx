import React, { useState, useEffect, useRef, useMemo } from 'react';
import useNarrator from './useNarrator';

function GameView({ room, socket, role, countdown, onLeave }) {
  const [verifyResult, setVerifyResult] = useState(null);
  const [log, setLog] = useState(['• 游戏正式初始化。']);
  const [showRole, setShowRole] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [canAct, setCanAct] = useState(false);

  const { speak, stopSpeech, NARRATION_SEQUENCE } = useNarrator();
  const lastSequenceRef = useRef(null);
  
  const myPlayer = room.players.find(p => p.id === socket.id);
  const isStarting = room.status === 'STARTING';
  const isNight = room.status === 'NIGHT';
  const isCreator = room.creator === socket.id || myPlayer?.isCreator;
  const isSimulation = room.isSimulation;
  
  const isAlive = myPlayer?.gameRole?.isAlive || myPlayer?.gameRole?.isIdiotRevealed;
  const canVote = isAlive && !myPlayer?.gameRole?.isIdiotRevealed;
  const hasGodMode = isSimulation && isCreator;

  // 🎙️ Sequence Narration Controller
  useEffect(() => {
    console.log(`[GameView Logic] Status: ${room.status}, Phase: ${room.phase}, Countdown: ${countdown}`);
    if (room.status !== 'NIGHT' && room.status !== 'DAY') return;

    const seqId = room.currentSequenceId;
    if (seqId === lastSequenceRef.current) return;
    lastSequenceRef.current = seqId;

    setCanAct(false);

    console.log(`[Narrator Controller] Phase: ${room.phase}, Status: ${room.status}, SequenceID: ${seqId}`);

    if (room.phase === 'NIGHT_DUSK') {
      const seq = NARRATION_SEQUENCE['NIGHT_DUSK'];
      speak(seq.text, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
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

  const confirmAction = () => {
    if (!pendingAction) return;
    const seq = NARRATION_SEQUENCE[room.phase];
    if (room.phase !== 'NIGHT_SEER' && seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
    }
    if (pendingAction.type === 'save' || pendingAction.type === 'poison') {
      socket.emit('witch_action', { roomId: room.id, action: pendingAction.type, targetId: pendingAction.targetId });
    } else {
      socket.emit(pendingAction.type, { roomId: room.id, targetId: pendingAction.targetId });
    }
    setPendingAction(null);
  };

  const handleSeerConfirm = () => {
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => {
          setVerifyResult(null);
          socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
      });
    } else {
      setVerifyResult(null);
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  };

  const initiateAction = (type, target) => {
    const spotIndex = room.slots.findIndex(s => s?.id === target.id) + 1;
    setPendingAction({ type, targetId: target.id, targetName: target.name, targetSpot: spotIndex });
  };

  const handleFinishTurn = () => {
    const seq = NARRATION_SEQUENCE[room.phase];
    if (seq && seq.closing) {
      setCanAct(false);
      speak(seq.closing, () => socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId }));
    } else {
      socket.emit('advance_sequence', { roomId: room.id, currentId: room.currentSequenceId });
    }
  };

  const handleEndGame = () => {
    stopSpeech();
    socket.emit('end_game', room.id);
  };

  const handleEnterNight = () => {
    socket.emit('enter_night', room.id);
  };

  const renderActions = () => {
    if (!isAlive && !myPlayer?.gameRole?.isIdiotRevealed && !hasGodMode) return <p style={{ color: '#ff4444' }}>你已被淘汰。</p>;

    if (room.phase === 'ROLE_REVEAL') {
      return (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '15px' }}>
             <h4 style={{ color: 'var(--amber-glow)', margin: 0 }}>身份确认阶段</h4>
             <h2 className="pulse" style={{ color: (countdown || 30) <= 5 ? '#ff4444' : 'var(--amber-glow)', fontSize: '2.5rem', margin: '10px 0' }}>
               {countdown || 30}s
             </h2>
             
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

    if (!canAct) return <p style={{ color: 'var(--amber-glow)', fontStyle: 'italic' }}>🎙️ 请听从旁白引导...</p>;

    if (room.phase === 'NIGHT_WEREWOLVES' && (role.name === '狼人' || hasGodMode)) {
      return (
        <div>
          <h4>狼人行动：请选择猎杀目标</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.filter(p => p && p.gameRole?.isAlive).map(p => (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem', borderColor: p.gameRole?.name === '狼人' ? '#ff4444' : '' }} onClick={() => initiateAction('werewolf_kill', p)}>
                击杀 #{room.slots.indexOf(p) + 1}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (room.phase === 'NIGHT_SEER' && (role?.name === '预言家' || hasGodMode)) {
      return (
        <div>
          <h4>预言家行动：请选择验人目标</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {room.slots.filter(p => p && p.gameRole?.isAlive).map(p => (
              <button key={p.id} className="btn btn-secondary btn-action" style={{ width: 'auto', fontSize: '0.9rem' }} onClick={() => initiateAction('seer_verify', p)}>查验 #{room.slots.indexOf(p) + 1}</button>
            ))}
            {hasGodMode && <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8rem', opacity: 0.6 }} onClick={handleFinishTurn}>跳过</button>}
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
            <h4>女巫行动：</h4>
            {hasGodMode && <button className="btn btn-secondary" style={{ width: 'auto', padding: '5px 10px', fontSize: '0.7rem' }} onClick={handleFinishTurn}>完成/无药</button>}
          </div>
          <p style={{ fontSize: '0.9rem' }}>{victim ? `昨晚被杀的是：${room.slots.findIndex(s => s?.id === victim.id) + 1} 号。` : '昨晚是平安夜。'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            {canSave && !room.nightActions.saved && <button className="btn btn-primary btn-action" style={{ width: 'auto', minWidth: '150px' }} onClick={() => initiateAction('save', victim)}>使用救药</button>}
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px' }}>毒杀目标：</p>
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

    if (room.phase === 'NIGHT_HUNTER' && (role.name === '猎人' || hasGodMode) ) {
        const targetPlayer = hasGodMode ? room.players.find(p => p.gameRole?.name === '猎人') : myPlayer;
        const isPoisoned = room.nightActions.poisoned === targetPlayer?.id;

        return (
          <div>
            <h4>猎人行动：</h4>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>
              你的技能状态：
              {isPoisoned ? (
                <strong style={{ color: '#ff4444' }}> 不可用</strong>
              ) : (
                <strong style={{ color: 'var(--amber-glow)' }}> 可用</strong>
              )}
            </p>
            <button className="btn btn-primary btn-action" style={{ width: 'auto', padding: '10px 40px' }} onClick={handleFinishTurn}>确认 (OK)</button>
          </div>
        );
    }

    return <p style={{ color: 'var(--text-dim)' }}>当前阶段：{room.phase || '等候入夜'}</p>;
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
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
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
              <h2 className="glow-text">查验结果</h2>
              <p style={{ fontSize: '1.1rem', margin: '15px 0' }}>
                 玩家 {verifyResult.name} 的身份为：
              </p>
              <h1 style={{ color: verifyResult.alignment === 'Bad' ? '#ff4444' : 'var(--amber-glow)', fontSize: '2.5rem', margin: '10px 0' }}>
                 {verifyResult.alignment === 'Bad' ? '坏人' : '好人'}
              </h1>
              <p style={{ color: 'var(--text-dim)', marginBottom: '20px', fontSize: '0.8rem' }}>
                 (坏人仅限狼人角色)
              </p>
              <button className="btn btn-primary btn-action" style={{ width: '100%' }} onClick={handleSeerConfirm}>确认并闭眼</button>
           </div>
        </div>
      )}

      {pendingAction && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '320px', border: '1px solid var(--amber-glow)' }}>
            <h3 style={{ color: 'var(--amber-glow)', marginBottom: '15px' }}>确认行动</h3>
            <p style={{ fontSize: '0.9rem' }}>确定对 #{pendingAction.targetSpot} 玩家执行操作？</p>
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
             (room.phase || room.status)
          }</span></h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>房号 {room.id}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {isSimulation && isCreator && <button className="btn btn-primary" style={{ width: 'auto', background: '#ff4444', border: 'none', padding: '8px 12px', margin: 0 }} onClick={handleEndGame}>🛑 结束</button>}
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.8rem', borderColor: 'var(--text-dim)', margin: 0 }} onClick={() => setShowGuide(true)}>📖 规则</button>
          <span className="reveal-link" style={{ fontSize: '0.9rem' }} onClick={() => setShowRole(true)}>Reveal</span>
        </div>
      </div>

      <div className="player-grid">
        {room.slots.map((p, index) => {
          const isVictim = room.nightActions?.killed === p?.id && room.phase === 'NIGHT_WITCH' && (role?.name === '女巫' || hasGodMode);
          const isWolf = role?.name === '狼人' && p?.gameRole?.name === '狼人';
          return (
            <div key={index} className={`player-slot occupied ${p?.gameRole?.isAlive === false ? 'dead' : ''} ${p?.gameRole?.isIdiotRevealed ? 'ready' : ''} ${isVictim ? 'victim-pulse' : ''}`} style={{ opacity: (!p || p?.gameRole?.isAlive === false) && !p?.gameRole?.isIdiotRevealed ? 0.3 : 1, border: isVictim ? '2px solid #ff4444' : (isWolf ? '1px solid #ff4444' : '') }}>
              <div style={{ position: 'absolute', top: '5px', left: '8px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>#{index + 1}</div>
              {p ? (
                <>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{p.name}</div>
                  {p.id === socket.id && <div style={{ color: 'var(--amber-glow)', fontSize: '0.6rem' }}>[你]</div>}
                  {hasGodMode && p.gameRole && (
                    <div style={{ marginTop: '5px', background: 'rgba(255, 191, 0, 0.15)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--amber-dim)', color: 'var(--amber-glow)', fontSize: '0.8rem', fontWeight: '600' }}>
                      {p.gameRole.name}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>空席</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '15px', background: 'rgba(255, 191, 0, 0.05)', padding: '15px', borderRadius: '15px', minHeight: '100px' }}>
        {renderActions()}
      </div>

      <div style={{ marginTop: '15px', textAlign: 'left' }}>
        <h4 style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>古堡纪录</h4>
        <div style={{ height: '60px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px', fontSize: '0.7rem' }}>
          {log.map((entry, i) => <p key={i}>{entry}</p>)}
        </div>
      </div>

      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '500px' }}>
            <h2>游戏规则：{room.mode === '预女猎' ? '预女猎' : '预女猎白'}</h2>
            <div style={{ textAlign: 'left', marginTop: '20px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
              <p><strong>狼人杀 ({room.mode === '预女猎' ? '预女猎' : '预女猎白'})</strong> 是标准的 {room.maxPlayers} 人板子：</p>
              <ul style={{ paddingLeft: '20px', marginTop: '10px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                <li><strong>狼人 ({room.mode === '预女猎' ? 3 : 4}名)：</strong> 每晚可以杀害一名玩家。</li>
                <li><strong>预言家 (1名)：</strong> 每晚可以查验一名玩家的身份（好人/坏人）。</li>
                <li><strong>女巫 (1名)：</strong> 拥有一瓶灵药（救人）和一瓶毒药（杀人），每种只能使用一次。</li>
                <li><strong>猎人 (1名)：</strong> 被杀或被投出且未被毒死时，可以开枪带走一名玩家。</li>
                {room.mode !== '预女猎' && <li><strong>白痴 (1名)：</strong> 被投票出局时可以翻牌免死，但失去投票权。</li>}
                <li><strong>平民 ({room.mode === '预女猎' ? 3 : 4}名)：</strong> 无特殊能力，通过分析推理找出狼人。</li>
              </ul>
            </div>
            <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setShowGuide(false)}>我明白了</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameView;
