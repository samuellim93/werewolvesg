import React, { useState } from 'react';

function Room({ room, socket, onLeave, onToggleReady, onStart }) {
  const [showGuide, setShowGuide] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const isCreator = room.creator === socket.id;
  const readyCount = room.players.filter(p => p.ready).length;
  const canStart = readyCount === room.players.length && room.players.length >= 1; 

  const [sequence, setSequence] = useState(room.sequenceOrder || ['狼人', '女巫', '预言家', '猎人']);

  const moveRole = (index, direction) => {
    const newSeq = [...sequence];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSeq.length) return;
    [newSeq[index], newSeq[targetIndex]] = [newSeq[targetIndex], newSeq[index]];
    setSequence(newSeq);
  };

  const applyConfig = () => {
    socket.emit('update_room_config', { roomId: room.id, sequenceOrder: sequence });
    setShowConfig(false);
  };

  const handleSelectSpot = (index) => {
    if (room.slots[index]) return;
    socket.emit('select_spot', { roomId: room.id, spotIndex: index });
  };

  return (
    <div className="card card-wide dashboard">
      {showConfig && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', padding: '15px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', border: '1px solid var(--amber-glow)' }}>
            <h2 style={{ marginBottom: '20px' }}>房间配置</h2>
            <div className="tabs">
              <div className="tab active">叙事顺序 (Sequence)</div>
            </div>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '15px' }}>拖动或点击箭头调整夜晚角色行动顺序：</p>
              {sequence.map((roleName, idx) => (
                <div key={roleName} className="player-slot occupied" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '10px 15px', marginBottom: '8px', minHeight: 'auto' }}>
                  <span style={{ fontWeight: 'bold' }}>{idx + 1}. {roleName}</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="btn btn-secondary" style={{ width: '30px', padding: '5px', margin: 0 }} onClick={() => moveRole(idx, -1)} disabled={idx === 0}>↑</button>
                    <button className="btn btn-secondary" style={{ width: '30px', padding: '5px', margin: 0 }} onClick={() => moveRole(idx, 1)} disabled={idx === sequence.length - 1}>↓</button>
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
          <p style={{ color: 'var(--text-dim)' }}>模式：预女猎白 · 标准 12 人场</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', borderColor: 'var(--text-dim)' }} onClick={onLeave}>退出房间</button>
      </div>

      <div className="player-grid">
        {room.slots.map((player, index) => (
          <div 
            key={index} 
            className={`player-slot ${player ? 'occupied' : ''} ${player?.ready ? 'ready' : ''}`}
            onClick={() => handleSelectSpot(index)}
            style={{ cursor: !player ? 'pointer' : 'default' }}
          >
            <div style={{ position: 'absolute', top: '5px', left: '8px', fontSize: '0.6rem', color: 'var(--text-dim)' }}>#{index + 1}</div>
            {player ? (
              <>
                <div style={{ fontWeight: 'bold' }}>{player.name}</div>
                {player.id === room.creator && <div className="creator-marker">房主</div>}
                {player.ready && <div className="ready-badge">READY</div>}
                {player.id === socket.id && <div style={{ color: 'var(--amber-glow)', fontSize: '0.6rem' }}>[你]</div>}
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>点击占位...</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '30px', justifyContent: 'center' }} className="dashboard-header">
        <button 
          className={`btn btn-fit ${room.players.find(p => p.id === socket.id)?.ready ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onToggleReady}
        >
          {room.players.find(p => p.id === socket.id)?.ready ? '取消准备' : '准备就绪'}
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
          <div className="card" style={{ maxWidth: '500px' }}>
            <h2>游戏规则：预女猎白</h2>
            <div style={{ textAlign: 'left', marginTop: '20px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
              <p><strong>狼人杀 (预女猎白)</strong> 是最经典的 12 人板子：</p>
              <ul style={{ paddingLeft: '20px', marginTop: '10px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                <li><strong>狼人 (4名)：</strong> 每晚可以杀害一名玩家。</li>
                <li><strong>预言家 (1名)：</strong> 每晚可以查验一名玩家的身份（好人/坏人）。</li>
                <li><strong>女巫 (1名)：</strong> 拥有一瓶灵药（救人）和一瓶毒药（杀人），每种只能使用一次。</li>
                <li><strong>猎人 (1名)：</strong> 被杀或被投出且未被毒死时，可以开枪带走一名玩家。</li>
                <li><strong>白痴 (1名)：</strong> 被投票出局时可以翻牌免死，但失去投票权。</li>
                <li><strong>平民 (4名)：</strong> 无特殊能力，通过分析推理找出狼人。</li>
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
