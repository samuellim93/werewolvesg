import React, { useState, useEffect, useMemo, useCallback } from 'react';

const ROLE_DESCRIPTIONS = {
  '狼人': '每晚可以共同睜眼殺死任意一名玩家。',
  '狼王': '屬於狼人陣營，出局後可以開槍帶走一名玩家（被毒死或自爆除外）。',
  '機械狼': '屬於狼人陣營，不與狼人相認，每晚可以學習一名存活玩家的技能。',
  '夢魘': '每晚在進入狼人階段前先行發動恐懼，封鎖該玩家當晚技能。',
  '石像鬼': '每天晚上能查驗一人，確切知道該名玩家身分牌。不與狼人碰面，直到其他狼人全出局。',
  '預言家': '每晚可以查驗一位玩家的真實身份陣營（好人/壞人）。',
  '通靈師': '每晚可以查驗一名玩家的具体身份（查驗到機械狼時顯示其學習的技能）。',
  '女巫': '擁有一瓶靈藥（救人）和一瓶毒藥（殺人），每種只能使用一次，不能自救。',
  '獵人': '被殺或被投出且未被毒死時，可以開槍帶走一名玩家。',
  '守衛': '每晚可以守護一名玩家免受狼人殺害，不能連續兩晚守護同一人，同守同救會造成「奶穿」死亡。',
  '攝夢人': '每晚攝入一名玩家夢境，使其免疫當晚傷害，但連續兩晚攝入同一人或攝夢人出局時，該玩家會死亡。',
  '白痴': '被投票放逐時可以翻牌免死，保留發言權但失去投票權。',
  '平民': '沒有任何特殊功能的普通村民，白天投票放逐狼人。',
  '魔術師': '每天晚上可以選擇兩名玩家進行技能互換，每人每局只能被交換一次。',
  '獵魔人': '第二個晚上開始可以進行狩獵，若獵到狼人則狼人死亡，若獵到好人則自己死亡。免疫毒藥。',
  '守墓人': '第二晚起能得知上一白天被放逐玩家所屬陣營（好人/狼人）。',
  '騎士': '白天發言階段可以公佈身份並選擇一名玩家決鬥，若對方是狼則斬殺並直接入夜，否則騎士以死謝罪。',
  '狼美人': '夜間可以選擇任意一名好人進行魅惑，被魅惑的玩家在狼美人出局的時候跟著出局。',
  '白狼王': '可以在白天階段自爆帶走場上任意一名玩家。',
  '隱狼': '晚上不與狼人睜眼，身份隱藏。預言家查驗顯示為好人。',
  '血月使徒': '自爆立即進入黑夜並封鎖當晚神職技能。最後一名被投出時可翻牌免死多活一天。',
  '惡靈騎士': '無法死在夜裡，不能自刀。被驗、被毒、被守時能反彈傷害殺死對方。',
  '覺醒預言家': '每晚查驗兩名玩家，均為好人時系統顯示為好人，否則顯示為壞人。',
  '覺醒狼王': '擁有兩次狼王爪，出局開槍。夜間可傳授狼王爪給狼隊友，並可以選擇自刀出局。',
  '覺醒隱狼': '其餘狼人出局後覺醒，可在夜間選擇一名玩家模仿，獲得其身份及技能。',
  '尋香魅影': '首夜獲知一名狼人位置。其餘狼人出局後方可刀人。每晚可綁定兩人，一人死則另一人隨之死亡（限一次）。'
};

const LobbyPlayerSlot = React.memo(({ index, player, socketId, creatorId, onClick }) => {
  return (
    <div 
      className={`player-slot ${player ? 'occupied' : ''} ${player?.ready ? 'ready' : ''}`}
      onClick={onClick}
      style={{ cursor: !player ? 'pointer' : 'default', opacity: player?.isOffline ? 0.4 : 1 }}
    >
      <div style={{ position: 'absolute', top: '5px', left: '8px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>#${index + 1}</div>
      {player ? (
        <>
          <div style={{ fontWeight: 'bold', color: player?.isOffline ? 'var(--text-dim)' : '#fff' }}>
            {player.name} {player?.isOffline && <span style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 'normal' }}>[离线]</span>}
          </div>
          {player.id === creatorId && <div className="creator-marker">房主</div>}
          {player.ready && <div className="ready-badge">READY</div>}
          {player.id === socketId && <div style={{ color: 'var(--amber-glow)', fontSize: '0.6rem' }}>[你]</div>}
        </>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>点击占位...</div>
      )}
    </div>
  );
});

function Room({ room, socket, onLeave, onToggleReady, onStart, onOpenVotes }) {
  const [showGuide, setShowGuide] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  const isCreator = useMemo(() => room.creator === socket.id, [room.creator, socket.id]);
  const readyCount = useMemo(() => room.players.filter(p => p.ready).length, [room.players]);
  const canStart = useMemo(() => readyCount === room.players.length && room.players.length >= 1, [readyCount, room.players.length]); 

  const [sequence, setSequence] = useState(room.sequenceOrder || ['狼人', '女巫', '預言家', '獵人']);
  const [sheriffEnabled, setSheriffEnabled] = useState(room.sheriffEnabled || false);

  useEffect(() => {
    if (room.sequenceOrder) {
      setSequence(room.sequenceOrder);
    }
    if (room.sheriffEnabled !== undefined) {
      setSheriffEnabled(room.sheriffEnabled);
    }
  }, [room.sequenceOrder, room.sheriffEnabled]);

  const getRulesData = useMemo(() => {
    let modeTitle = '';
    let introText = '';
    let rolesList = [];

    if (room.mode === '預女獵') {
      modeTitle = '預女獵 · 標準 9 人場';
      introText = `狼人殺 (預女獵) 是標準的 9 人板子：`;
      rolesList = [
        { name: '狼人', count: 3 },
        { name: '預言家', count: 1 },
        { name: '女巫', count: 1 },
        { name: '獵人', count: 1 },
        { name: '平民', count: 3 }
      ];
    } else if (room.mode === '狼王攝夢人') {
      modeTitle = '狼王 & 攝夢人 · 12 人場';
      introText = `狼人殺 (狼王 & 攝夢人) 是標準的 12 人板子：`;
      rolesList = [
        { name: '狼人', count: 3 },
        { name: '狼王', count: 1 },
        { name: '預言家', count: 1 },
        { name: '女巫', count: 1 },
        { name: '獵人', count: 1 },
        { name: '攝夢人', count: 1 },
        { name: '平民', count: 4 }
      ];
    } else if (room.mode === '機械狼通女獵守') {
      modeTitle = '機械狼 vs 通女獵守 · 12 人場';
      introText = `狼人殺 (機械狼 vs 通女獵守) 是標準的 12 人板子：`;
      rolesList = [
        { name: '狼人', count: 3 },
        { name: '機械狼', count: 1 },
        { name: '通靈師', count: 1 },
        { name: '女巫', count: 1 },
        { name: '獵人', count: 1 },
        { name: '守衛', count: 1 },
        { name: '平民', count: 4 }
      ];
    } else if (room.mode === 'CUSTOM') {
      modeTitle = '自定義配置模式';
      introText = `自定義 ${room.maxPlayers} 人自定義角色配置：`;
      
      const counts = {};
      if (room.customConfig?.rolePool) {
        room.customConfig.rolePool.forEach(role => {
          counts[role] = (counts[role] || 0) + 1;
        });
      }
      rolesList = Object.entries(counts).map(([name, count]) => ({ name, count }));
    } else {
      modeTitle = '預女獵白 · 標準 12 人場';
      introText = `狼人殺 (預女獵白) 是標準 of 12 人板子：`;
      rolesList = [
        { name: '狼人', count: 4 },
        { name: '預言家', count: 1 },
        { name: '女巫', count: 1 },
        { name: '獵人', count: 1 },
        { name: '白痴', count: 1 },
        { name: '平民', count: 4 }
      ];
    }

    return { modeTitle, introText, rolesList };
  }, [room]);

  const { modeTitle, introText, rolesList } = getRulesData;

  const moveRole = useCallback((index, direction) => {
    const newSeq = [...sequence];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSeq.length) return;
    [newSeq[index], newSeq[targetIndex]] = [newSeq[targetIndex], newSeq[index]];
    setSequence(newSeq);
  }, [sequence]);

  const applyConfig = useCallback(() => {
    socket.emit('update_room_config', { roomId: room.id, sequenceOrder: sequence, sheriffEnabled });
    setShowConfig(false);
  }, [socket, room.id, sequence, sheriffEnabled]);

  const handleSelectSpot = useCallback((index) => {
    if (room.slots[index]) return;
    socket.emit('select_spot', { roomId: room.id, spotIndex: index });
  }, [socket, room.id, room.slots]);

  const myPlayer = useMemo(() => room.players.find(p => p.id === socket.id), [room.players, socket.id]);

  return (
    <div className="card card-wide dashboard">
      {showConfig && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', padding: '15px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', border: '1px solid var(--amber-glow)' }}>
            <h2 style={{ marginBottom: '20px' }}>房间配置</h2>
            <div className="tabs">
              <div className="tab active">叙事顺序 (Sequence)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'block', color: 'var(--text-light)' }}>警長競選模式 (Sheriff)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>開啟後第一天白天將進行警長競選</span>
              </div>
              <button 
                className={`btn ${sheriffEnabled ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  width: 'auto', 
                  padding: '6px 16px', 
                  margin: 0,
                  fontSize: '0.8rem',
                  borderColor: sheriffEnabled ? 'var(--amber-glow)' : 'var(--text-dim)',
                  background: sheriffEnabled ? 'var(--amber-glow)' : 'transparent',
                  color: sheriffEnabled ? 'black' : 'var(--text-dim)',
                  fontWeight: 'bold'
                }}
                onClick={() => setSheriffEnabled(!sheriffEnabled)}
              >
                {sheriffEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div style={{ textAlign: 'left', marginBottom: '20px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '15px' }}>拖動或點擊箭頭調整夜晚角色行動順序：</p>
              {sequence.map((roleName, idx) => (
                <div key={roleName} className="player-slot occupied" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '6px 12px', marginBottom: '6px', minHeight: 'auto' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{idx + 1}. {roleName}</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: '0', margin: 0, fontSize: '0.8rem' }} onClick={() => moveRole(idx, -1)} disabled={idx === 0}>↑</button>
                    <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: '0', margin: 0, fontSize: '0.8rem' }} onClick={() => moveRole(idx, 1)} disabled={idx === sequence.length - 1}>↓</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={applyConfig}>保存设置</button>
              <button className="btn btn-secondary" onClick={() => setShowConfig(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }} className="dashboard-header">
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <h1>备战间 #{room.id}</h1>
             {isCreator && (
               <button 
                 onClick={() => setShowConfig(true)}
                 style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', color: 'var(--text-dim)' }}
                 title="配置房间"
               >
                 ⚙️
               </button>
             )}
          </div>
          <p style={{ color: 'var(--text-dim)' }}>
            模式：{
              room.mode === '預女獵' ? '預女獵 · 標準 9 人場' : 
              room.mode === '狼王攝夢人' ? '狼王 & 攝夢人 · 12 人場' : 
              room.mode === '機械狼通女獵守' ? '機械狼 vs 通女獵守 · 12 人場' : 
              room.mode === 'CUSTOM' ? '自定義配置模式' : 
              '預女獵白 · 標準 12 人場'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', borderColor: 'var(--text-dim)' }} onClick={onOpenVotes}>Vote</button>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', borderColor: 'var(--text-dim)' }} onClick={onLeave}>退出房间</button>
        </div>
      </div>

      <div className="player-grid">
        {room.slots.map((player, index) => (
          <LobbyPlayerSlot 
            key={index}
            index={index}
            player={player}
            socketId={socket.id}
            creatorId={room.creator}
            onClick={() => handleSelectSpot(index)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '30px', justifyContent: 'center' }} className="dashboard-header">
        <button 
          className={`btn btn-fit ${myPlayer?.ready ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onToggleReady}
        >
          {myPlayer?.ready ? '取消准备' : '准备就绪'}
        </button>
        
        {isCreator && (
          <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '500px' }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'var(--amber-glow)', color: 'black', opacity: canStart ? 1 : 0.5 }}
              onClick={() => onStart('normal')}
              disabled={!canStart}
            >
              🚀 开始游戏 ({readyCount}/{room.players.length})
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ borderColor: 'var(--amber-glow)' }}
              onClick={() => onStart('simulate')}
            >
              🤖 快速模拟
            </button>
          </div>
        )}
      </div>

      <button 
        style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--text-dim)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        onClick={() => setShowGuide(true)}
      >
        查看游戏规则
      </button>

      {showGuide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <h2>遊戲規則：{modeTitle}</h2>
            <div style={{ textAlign: 'left', marginTop: '20px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
              <p><strong>{introText}</strong></p>
              <ul style={{ paddingLeft: '20px', marginTop: '10px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                {rolesList.map(r => (
                  <li key={r.name} style={{ marginBottom: '10px' }}>
                    <strong>{r.name} ({r.count}名)：</strong>
                    {ROLE_DESCRIPTIONS[r.name] || '沒有任何特殊功能的村民/角色。'}
                  </li>
                ))}
              </ul>
            </div>
            <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setShowGuide(false)}>我明白了</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;