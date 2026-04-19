import React, { useState } from 'react';

function Lobby({ user, onLogout, onCreateRoom, onJoinRoom }) {
  const [searchId, setSearchId] = useState('');

  const GAME_MODES = [
    {
      id: 'pre-witch-hunter-idiot',
      name: '预女猎白 · 标准 12 人场',
      description: '最经典的竞技板子，博弈平衡性极佳。',
      serverMode: '预女猎白'
    },
    {
      id: 'pre-witch-hunter',
      name: '预女猎 · 标准 9 人场',
      description: '快节奏经典局，适合新老玩家快速上手。',
      serverMode: '预女猎'
    }
  ];

  return (
    <div className="card card-wide dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }} className="dashboard-header">
        <div style={{ textAlign: 'left' }}>
          <h1>古堡大厅</h1>
          <p style={{ color: 'var(--text-dim)' }}>欢迎回来, {user.name}</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={onLogout}>退出登录</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        
        {/* 🚪 Join Room Section (Now on Top) */}
        <div className="card" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '25px', width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '10px' }}>加入现有房间</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '15px' }}>输入 4 位房号与好友并肩作战</p>
          <div style={{ display: 'flex', gap: '10px', maxWidth: '400px', margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="0000" 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px', flex: 1, minWidth: '150px' }}
            />
            <button className="btn btn-secondary btn-fit" style={{ margin: 0 }} onClick={() => onJoinRoom(searchId)}>立即加入</button>
          </div>
        </div>

        {/* 🃏 Game Modes Section (Now Below) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {GAME_MODES.map(mode => (
            <div key={mode.id} className="card" style={{ background: 'rgba(255, 191, 0, 0.05)', padding: '25px', width: '100%', maxWidth: 'none', textAlign: 'left', border: '1px solid rgba(255, 191, 0, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>模式：{mode.name}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{mode.description}</p>
                </div>
                <button className="btn btn-primary btn-fit" style={{ margin: 0 }} onClick={() => onCreateRoom(mode.serverMode)}>创建房间</button>
              </div>
            </div>
          ))}
          
          <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255,255,255,0.1)', padding: '15px', textAlign: 'center', opacity: 0.6 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>更多模式（如 9 人速爽场）敬请期待...</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Lobby;
