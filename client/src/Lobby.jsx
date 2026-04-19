import React, { useState } from 'react';

function Lobby({ user, onLogout, onCreateRoom, onJoinRoom }) {
  const [searchId, setSearchId] = useState('');

  const GAME_MODES = [
    {
      id: 'pre-witch-hunter-idiot',
      name: '预女猎白 · 标准 12 人场',
      description: '最经典的竞技板子，博弈平衡性极佳。',
      serverMode: '预女猎白'
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }} className="dashboard-header">
        
        {/* 🃏 Game Modes Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {GAME_MODES.map(mode => (
            <div key={mode.id} className="card" style={{ background: 'rgba(255, 191, 0, 0.05)', padding: '25px', width: '100%', maxWidth: 'none', textAlign: 'left', border: '1px solid rgba(255, 191, 0, 0.2)' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>模式：{mode.name}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '20px' }}>{mode.description}</p>
              <button className="btn btn-primary" onClick={() => onCreateRoom(mode.serverMode)}>创建房间</button>
            </div>
          ))}
          
          <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255,255,255,0.1)', padding: '20px', textAlign: 'center', opacity: 0.6 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>更多模式（如 9 人速爽场）敬请期待...</p>
          </div>
        </div>

        {/* 🚪 Join Room Section */}
        <div className="card" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '25px', width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ marginBottom: '15px' }}>加入现有房间</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '20px' }}>输入房号与好友并肩作战</p>
          <div className="input-group" style={{ marginBottom: '15px' }}>
            <input 
              type="text" 
              placeholder="输入 4 位房号" 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px' }}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => onJoinRoom(searchId)}>立即加入</button>
        </div>

      </div>
    </div>
  );
}

export default Lobby;
