import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: displayName ? `${displayName}'s Room` : 'New Room',
          description: ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }
      const data = await response.json();
      console.log('Room created:', data);
      
      // Join the room after creating it
      navigate(`/room/${data.room.roomCode}?username=${encodeURIComponent(displayName || 'Anonymous')}`);
    } catch (err) {
      console.error('Create room error:', err);
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    navigate(`/room/${roomCode}?username=${encodeURIComponent(displayName)}`);
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Live Stream</h1>
        <p className="subtitle">Join or create a room to start streaming</p>

        <div className="join-section">
          <form onSubmit={handleJoinRoom} className="join-form">
            <div className="form-group">
              <label htmlFor="displayName">Your Display Name</label>
              <input
                type="text"
                id="displayName"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength="50"
              />
            </div>

            <div className="form-group">
              <label htmlFor="roomCode">Room Code</label>
              <input
                type="text"
                id="roomCode"
                placeholder="Enter room code (e.g., ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength="6"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Joining...' : 'Join Room'}
              </button>
              <button 
                type="button" 
                onClick={handleCreateRoom} 
                className="btn btn-secondary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create New Room'}
              </button>
            </div>
          </form>
        </div>

        <div className="info-section">
          <h3>How it works:</h3>
          <ul>
            <li>Enter your display name</li>
            <li>Either enter a room code to join an existing room, or create a new one</li>
            <li>Share the room code with others to let them join</li>
            <li>Start streaming and chatting instantly!</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Home;
