import React, { useState } from 'react';
import CustomModeModal from './CustomModeModal';

function Lobby({ user, onLogout, onCreateRoom, onJoinRoom, onOpenVotes }) {
  const [searchId, setSearchId] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const GAME_MODES = [
    {
      id: 'pre-witch-hunter-idiot',
      name: '預女獵白 · 標準 12 人場',
      description: '最經典的競技板子，博弈平衡性極佳。',
      serverMode: '預女獵白'
    },
    {
      id: 'wolf-king-dreamcatcher',
      name: '狼王 & 攝夢人 · 12 人場',
      description: '狼王帶隊，攝夢人守護夢境。',
      serverMode: '狼王攝夢人'
    },
    {
      id: 'mech-wolf-psychic',
      name: '機械狼 vs 通女獵守 · 12 人場',
      description: '機械狼學習技能，通靈師洞察真偽。',
      serverMode: '機械狼通女獵守'
    },
    {
      id: 'pre-witch-hunter',
      name: '預女獵 · 標準 9 人場',
      description: '快節奏經典局，適合新老玩家快速上手。',
      serverMode: '預女獵'
    }
  ];

  return (
    <div className="card card-wide dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }} className="dashboard-header">
        <div style={{ textAlign: 'left' }}>
          <h1>古堡大厅</h1>
          <p style={{ color: 'var(--text-dim)' }}>欢迎回来, {user.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={onOpenVotes}>Vote</button>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={onLogout}>退出登录</button>
        </div>
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

        {/* 🛠️ Custom Mode Section */}
        <div className="card" style={{ background: 'rgba(255, 191, 0, 0.05)', borderColor: 'rgba(255, 191, 0, 0.3)', padding: '25px', width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--amber-glow)', marginBottom: '10px' }}>自定義模式</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '15px' }}>自由配置人數、角色與發言順序，打造專屬戰場</p>
          <button className="btn btn-primary btn-fit" style={{ margin: '0 auto' }} onClick={() => setShowCustomModal(true)}>開啟自定義配置</button>
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
      {showCustomModal && (
        <CustomModeModal 
          onClose={() => setShowCustomModal(false)}
          onCreateRoom={(mode, config) => {
            setShowCustomModal(false);
            onCreateRoom(mode, config);
          }}
        />
      )}
    </div>
  );
}

export default Lobby;
