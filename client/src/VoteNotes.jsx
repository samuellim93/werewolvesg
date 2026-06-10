import React from 'react';

function VoteNotes({ notes, setNotes, onClose }) {
  const addDay = () => {
    const nextDay = notes.length + 1;
    setNotes([...notes, { day: nextDay, text: '' }]);
  };

  const updateNote = (index, newText) => {
    const updated = [...notes];
    updated[index].text = newText;
    setNotes(updated);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'center' }}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>投票記錄簿</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
          {notes.map((note, index) => (
            <div key={note.day} style={{ marginBottom: '25px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--amber-glow)' }}>Day {note.day} Voting Result</h3>
              <textarea 
                placeholder="在此輸入投票記錄或筆記..."
                value={note.text}
                onChange={(e) => updateNote(index, e.target.value)}
                style={{ 
                  width: '100%', 
                  minHeight: '80px', 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '8px', 
                  color: 'white', 
                  padding: '12px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={addDay}>+ Add Days</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

export default VoteNotes;
