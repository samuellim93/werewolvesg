import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './Lobby';
import Room from './Room';
import GameView from './GameView';
import './index.css';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [activeTab, setActiveTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  
  // Game States
  const [role, setRole] = useState(null);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    socket.on('login_success', (data) => {
      setUserData(data);
      setIsLoggedIn(true);
    });

    socket.on('room_update', (room) => {
      setCurrentRoom(room);
    });

    socket.on('game_countdown', (count) => {
      setCountdown(count);
    });

    socket.on('assign_role', (roleData) => {
      setRole(roleData);
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('login_success');
      socket.off('room_update');
      socket.off('game_countdown');
      socket.off('assign_role');
      socket.off('error');
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username && password) {
      socket.emit('login', { type: 'standard', username, password });
    }
  };

  const handleGuestLogin = (e) => {
    e.preventDefault();
    if (guestName) {
      socket.emit('login', { type: 'guest', name: guestName });
    }
  };

  const createRoom = (mode = '预女猎白') => {
    socket.emit('create_room', { user: userData, mode });
  };

  const joinRoom = (roomId) => {
    socket.emit('join_room', { roomId, user: userData });
  };

  const leaveRoom = () => {
    if (currentRoom) {
      socket.emit('leave_room', currentRoom.id);
      setCurrentRoom(null);
      setRole(null);
      setCountdown(null);
    }
  };

  const toggleReady = () => {
    if (currentRoom) {
      socket.emit('toggle_ready', currentRoom.id);
    }
  };

  const handleStartGame = (mode) => {
    if (currentRoom) {
      if (mode === 'simulate') {
        socket.emit('simulate_game', currentRoom.id);
      } else {
        socket.emit('start_game', currentRoom.id);
      }
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="card">
        <h2>The Night Castle</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Enter the realm to proceed
        </p>

        <div className="tabs">
          <div className={`tab ${activeTab === 'login' ? 'active' : ''}`} onClick={() => setActiveTab('login')}>Member</div>
          <div className={`tab ${activeTab === 'guest' ? 'active' : ''}`} onClick={() => setActiveTab('guest')}>Guest</div>
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username</label>
              <input type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">Enter Castle</button>
          </form>
        ) : (
          <form onSubmit={handleGuestLogin}>
            <div className="input-group">
              <label>Your Name</label>
              <input type="text" placeholder="e.g. Wanderer" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '20px' }}>* Guests have limited access to the sanctuary.</p>
            <button type="submit" className="btn btn-primary">Login as Guest</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {error && (
        <div style={{ 
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#ff4444', color: 'white', padding: '10px 30px', borderRadius: '5px',
          zIndex: 1000, boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        }}>
          {error}
        </div>
      )}
      
      {currentRoom ? (
        currentRoom.status === 'LOBBY' ? (
          <Room 
            room={currentRoom} 
            socket={socket} 
            onLeave={leaveRoom} 
            onToggleReady={toggleReady} 
            onStart={handleStartGame}
          />
        ) : (
          <GameView 
            room={currentRoom} 
            socket={socket} 
            role={role} 
            countdown={countdown} 
          />
        )
      ) : (
        <Lobby user={userData} socket={socket} onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      )}
    </div>
  );
}

export default App;
