import React, { useState, useEffect } from 'react';

const BAD_ROLES = [
  '狼人', '狼王', '機械狼', '夢魘', '石像鬼',
  '狼美人', '白狼王', '隱狼', '血月使徒', '惡靈騎士',
  '覺醒狼王', '覺醒隱狼', '尋香魅影'
];
const GOOD_ROLES = [
  '預言家', '女巫', '獵人', '守衛', '白痴', '攝夢人', '通靈師', '魔術師', '獵魔人', '守墓人', '騎士',
  '覺醒預言家'
];

const getNightActingRoles = (badRoles, goodRoles) => {
  const active = new Set();
  badRoles.forEach(role => {
    if (['狼人', '狼王', '狼美人', '白狼王', '血月使徒', '惡靈騎士', '覺醒狼王'].includes(role)) {
      active.add('狼人');
    }
    if (['機械狼', '夢魘', '石像鬼', '覺醒狼王', '覺醒隱狼', '尋香魅影'].includes(role)) {
      active.add(role);
    }
  });
  goodRoles.forEach(role => {
    if (['預言家', '女巫', '獵人', '守衛', '攝夢人', '通靈師', '魔術師', '獵魔人', '守墓人', '覺醒預言家'].includes(role)) {
      active.add(role);
    }
  });
  return Array.from(active);
};

function CustomModeModal({ onClose, onCreateRoom }) {
  const [pax, setPax] = useState(12);
  const [selectedBad, setSelectedBad] = useState(['狼人']);
  const [wolfCount, setWolfCount] = useState(3);
  const [selectedGood, setSelectedGood] = useState([]);
  const [civilians, setCivilians] = useState(4);
  const [sequence, setSequence] = useState(['狼人']);
  const [sheriffEnabled, setSheriffEnabled] = useState(false);

  // Auto-calculate civilians to match pax
  useEffect(() => {
    const badCount = selectedBad.includes('狼人') ? (selectedBad.length - 1 + wolfCount) : selectedBad.length;
    const totalSpecial = badCount + selectedGood.length;
    const requiredCivs = Math.max(0, pax - totalSpecial);
    setCivilians(requiredCivs);
  }, [pax, selectedBad, selectedGood, wolfCount]);

  // Sync sequence with selected roles (night-acting only)
  useEffect(() => {
    const nightRoles = getNightActingRoles(selectedBad, selectedGood);
    setSequence(prev => {
      const filtered = prev.filter(role => nightRoles.includes(role));
      const newRoles = nightRoles.filter(role => !prev.includes(role));
      return [...filtered, ...newRoles];
    });
  }, [selectedBad, selectedGood]);

  const toggleRole = (role, type) => {
    if (type === 'bad') {
      setSelectedBad(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    } else {
      setSelectedGood(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    }
  };

  const moveRole = (index, direction) => {
    const newSeq = [...sequence];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSeq.length) return;
    [newSeq[index], newSeq[targetIndex]] = [newSeq[targetIndex], newSeq[index]];
    setSequence(newSeq);
  };

  const handleCreate = () => {
    let rolePool = [];
    
    // Add Bad Roles
    selectedBad.forEach(role => {
      if (role === '狼人') {
        for (let i = 0; i < wolfCount; i++) rolePool.push('狼人');
      } else {
        rolePool.push(role);
      }
    });

    // Add Good Roles
    selectedGood.forEach(role => rolePool.push(role));

    // Add Civilians
    for (let i = 0; i < civilians; i++) rolePool.push('平民');
    
    if (rolePool.length !== pax) {
      alert(`角色總數 (${rolePool.length}) 與人數 (${pax}) 不符！`);
      return;
    }

    if (selectedBad.length === 0) {
        alert('請至少選擇一個狼人陣營角色');
        return;
    }

    onCreateRoom('CUSTOM', {
      maxPlayers: pax,
      rolePool: rolePool,
      sequenceOrder: sequence,
      sheriffEnabled: sheriffEnabled
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ margin: 0 }}>自定義模式設置</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <div className="input-group">
          <label>遊戲人數 (Pax)</label>
          <div className="pax-selector">
            {[9, 10, 11, 12].map(num => (
              <button key={num} className={`pax-btn ${pax === num ? 'active' : ''}`} onClick={() => setPax(num)}>{num} 人</button>
            ))}
          </div>
        </div>

        <div className="input-group">
          <label>狼人陣營 (Bad Roles)</label>
          <div className="role-grid">
            {BAD_ROLES.map(role => (
              <div key={role} style={{ position: 'relative' }}>
                <div className={`role-chip ${selectedBad.includes(role) ? 'selected' : ''}`} onClick={() => toggleRole(role, 'bad')}>
                  {role}
                </div>
                {role === '狼人' && selectedBad.includes('狼人') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', justifyContent: 'center' }}>
                    <button onClick={() => setWolfCount(Math.max(1, wolfCount - 1))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '4px', width: '24px', cursor: 'pointer' }}>-</button>
                    <span style={{ fontSize: '0.9rem', color: 'var(--amber-glow)', fontWeight: 'bold' }}>{wolfCount}</span>
                    <button onClick={() => setWolfCount(wolfCount + 1)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '4px', width: '24px', cursor: 'pointer' }}>+</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="input-group">
          <label>神職陣營 (Good Roles)</label>
          <div className="role-grid">
            {GOOD_ROLES.map(role => (
              <div key={role} className={`role-chip ${selectedGood.includes(role) ? 'selected' : ''}`} onClick={() => toggleRole(role, 'good')}>
                {role}
              </div>
            ))}
          </div>
        </div>

        <div className="input-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
          <div>
            <label style={{ marginBottom: '0' }}>平民人數 (Civilians)</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>自動根據總人數調整</p>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--amber-glow)' }}>{civilians}</div>
        </div>

        <div className="input-group" style={{ marginTop: '30px' }}>
          <label>夜晚行動順序 (Sequence)</label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '15px' }}>調整角色在夜晚被喚醒的順序</p>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px' }}>
            {sequence.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '20px' }}>請先選擇角色</p>}
            {sequence.map((role, index) => (
              <div key={role} className="sequence-item">
                <span>{index + 1}. {role}</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => moveRole(index, -1)} style={{ background: 'none', border: 'none', color: 'var(--amber-glow)', cursor: 'pointer' }}>▲</button>
                  <button onClick={() => moveRole(index, 1)} style={{ background: 'none', border: 'none', color: 'var(--amber-glow)', cursor: 'pointer' }}>▼</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginTop: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
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

        <div style={{ marginTop: '40px', display: 'flex', gap: '15px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>取消</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate}>生成房間</button>
        </div>
      </div>
    </div>
  );
}

export default CustomModeModal;
