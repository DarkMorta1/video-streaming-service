import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import '../styles/Room.css';

const Room = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'Anonymous';

  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const [error, setError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peersRef = useRef({});

  const cleanupPeer = useCallback((socketId, destroyPeer = true) => {
    const peer = peersRef.current[socketId];
    if (peer) {
      if (destroyPeer) {
        try {
          peer.destroy();
        } catch (err) {
          console.error('Error destroying peer:', err);
        }
      }
      delete peersRef.current[socketId];
    }

    if (remoteVideosRef.current[socketId]) {
      delete remoteVideosRef.current[socketId];
    }

    setRemoteStreams(prev => {
      if (!prev[socketId]) return prev;
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  }, []);

  const registerPeerListeners = useCallback((socketId, peer) => {
    peer.on('stream', (stream) => {
      setRemoteStreams(prev => ({
        ...prev,
        [socketId]: stream
      }));
    });

    peer.on('close', () => {
      cleanupPeer(socketId, false);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      cleanupPeer(socketId);
    });
  }, [cleanupPeer]);

  const replaceTracksForPeers = useCallback((previousStream, nextStream) => {
    const peerList = Object.values(peersRef.current);
    if (!peerList.length) return true;

    const oldVideoTrack = previousStream?.getVideoTracks()?.[0] || null;
    const newVideoTrack = nextStream?.getVideoTracks()?.[0] || null;
    const oldAudioTrack = previousStream?.getAudioTracks()?.[0] || null;
    const newAudioTrack = nextStream?.getAudioTracks()?.[0] || null;

    if (!oldVideoTrack && !oldAudioTrack) {
      return false;
    }

    let success = true;

    peerList.forEach(peer => {
      if (!peer?.replaceTrack) {
        success = false;
        return;
      }

      try {
        if (oldVideoTrack && newVideoTrack) {
          peer.replaceTrack(oldVideoTrack, newVideoTrack, previousStream);
        } else if (!newVideoTrack && oldVideoTrack && peer.removeTrack) {
          peer.removeTrack(oldVideoTrack, previousStream);
        }

        if (oldAudioTrack && newAudioTrack) {
          peer.replaceTrack(oldAudioTrack, newAudioTrack, previousStream);
        } else if (!newAudioTrack && oldAudioTrack && peer.removeTrack) {
          peer.removeTrack(oldAudioTrack, previousStream);
        }
      } catch (err) {
        console.error('Error swapping peer media tracks:', err);
        success = false;
      }
    });

    return success;
  }, []);

  const forcePeerReconnection = useCallback(() => {
    Object.keys(peersRef.current).forEach(socketId => {
      cleanupPeer(socketId);
    });

    setParticipants(prev =>
      prev.map(participant => ({
        ...participant,
        shouldInitiate: true
      }))
    );
  }, [cleanupPeer]);

  // Initialize socket connection
  useEffect(() => {
    if (!roomCode || !username) {
      navigate('/');
      return;
    }

    const socketURL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-room', {
        roomCode,
        username
      });
    });

    newSocket.on('error', (data) => {
      console.error('Socket error:', data);
      setError(data.message || 'Connection error');
      setTimeout(() => navigate('/'), 3000);
    });

    newSocket.on('user-joined', (data) => {
      console.log('User joined:', data);
      if (data.socketId === newSocket.id) return;
      setParticipants(prev => {
        if (prev.some(p => p.socketId === data.socketId)) {
          return prev;
        }
        return [...prev, { ...data, shouldInitiate: true }];
      });
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data);
      setParticipants(prev => prev.filter(p => p.socketId !== data.socketId));
      cleanupPeer(data.socketId);
    });

    newSocket.on('existing-participants', (data) => {
      console.log('Existing participants:', data);
      setParticipants(
        data.participants
          .filter(p => p.socketId !== newSocket.id)
          .map(p => ({ ...p, shouldInitiate: false }))
      );
    });

    newSocket.on('receive-message', (data) => {
      setChatMessages(prev => [...prev, data]);
    });

    newSocket.on('offer', async (data) => {
      const { from, offer } = data;
      if (peersRef.current[from]) return;

      const peer = new SimplePeer({
        initiator: false,
        trickleICE: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (data) => {
        newSocket.emit('answer', {
          to: from,
          answer: data
        });
      });

      registerPeerListeners(from, peer);

      peersRef.current[from] = peer;

      try {
        peer.signal(offer);
      } catch (err) {
        console.error('Error signaling offer:', err);
      }
    });

    newSocket.on('answer', (data) => {
      const { from, answer } = data;
      if (peersRef.current[from]) {
        try {
          peersRef.current[from].signal(answer);
        } catch (err) {
          console.error('Error signaling answer:', err);
        }
      }
    });

    newSocket.on('ice-candidate', (data) => {
      const { from, candidate } = data;
      if (peersRef.current[from]) {
        try {
          peersRef.current[from].addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ice candidate:', err);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode, username, navigate, cleanupPeer, registerPeerListeners]);

  // Get local media stream
  useEffect(() => {
    const getLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setError('Unable to access camera/microphone');
      }
    };

    getLocalStream();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Create peers for participants that current user should initiate
  useEffect(() => {
    if (!socket || !localStream) return;

    const toInitiate = participants.filter(
      participant => participant.shouldInitiate && !peersRef.current[participant.socketId]
    );

    if (!toInitiate.length) return;

    toInitiate.forEach((participant) => {
      const peer = new SimplePeer({
        initiator: true,
        trickleICE: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (data) => {
        socket.emit('offer', {
          to: participant.socketId,
          offer: data
        });
      });

      registerPeerListeners(participant.socketId, peer);

      peersRef.current[participant.socketId] = peer;
    });

    setParticipants(prev =>
      prev.map(p =>
        p.shouldInitiate && peersRef.current[p.socketId]
          ? { ...p, shouldInitiate: false }
          : p
      )
    );
  }, [socket, localStream, participants, registerPeerListeners]);

  // Screen share: start
  const startScreenShare = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError('Screen sharing not supported in this browser');
      return;
    }

    try {
      const previousStream = localStream;
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      // Build composite stream: use display video and keep microphone audio if displayStream lacks audio
      const micAudioTracks = localStream?.getAudioTracks() || [];
      let composedStream;

      if (displayStream.getAudioTracks().length === 0 && micAudioTracks.length > 0) {
        // combine display video track + mic audio tracks
        composedStream = new MediaStream();
        const displayVideoTrack = displayStream.getVideoTracks()[0];
        composedStream.addTrack(displayVideoTrack);
        micAudioTracks.forEach(t => composedStream.addTrack(t));
      } else {
        // displayStream already has audio or mic not available
        composedStream = displayStream;
      }

      // update local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = composedStream;
      }

      // store screen stream ref for stopping later
      screenStreamRef.current = displayStream;
      const tracksReplaced = replaceTracksForPeers(previousStream, composedStream);
      setLocalStream(composedStream);
      setIsScreenSharing(true);

      if (!tracksReplaced) {
        forcePeerReconnection();
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setError('Unable to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    try {
      const previousStream = localStream;
      const displayStream = screenStreamRef.current;
      // stop display tracks
      if (displayStream) {
        displayStream.getTracks().forEach(t => t.stop());
      }

      // Restore camera video track if available
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(camStream => {
        // update local video element
        if (localVideoRef.current) localVideoRef.current.srcObject = camStream;

        const tracksReplaced = replaceTracksForPeers(previousStream, camStream);

        setLocalStream(camStream);
        screenStreamRef.current = null;
        setIsScreenSharing(false);

        if (!tracksReplaced) {
          forcePeerReconnection();
        }
      }).catch(err => {
        console.error('Error getting camera stream after screen share:', err);
        setError('Unable to restore camera after screen sharing');
      });
    } catch (err) {
      console.error('Error stopping screen share:', err);
    }
  };

  // Automatically stop sharing if browser ends the display stream
  useEffect(() => {
    if (!isScreenSharing || !screenStreamRef.current) return;

    const [displayTrack] = screenStreamRef.current.getVideoTracks();
    if (!displayTrack) return;

    const handleEnded = () => {
      stopScreenShare();
    };

    displayTrack.addEventListener('ended', handleEnded);

    return () => {
      displayTrack.removeEventListener('ended', handleEnded);
    };
  }, [isScreenSharing]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    socket.emit('send-message', {
      message: message.trim(),
      roomCode
    });

    setChatMessages(prev => [...prev, {
      username,
      message: message.trim(),
      timestamp: new Date()
    }]);

    setMessage('');
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room', { roomCode });
      socket.disconnect();
    }
    localStream?.getTracks().forEach(track => track.stop());
    Object.keys(peersRef.current).forEach(socketId => cleanupPeer(socketId));
    navigate('/');
  };

  return (
    <div className="room-container">
      <div className="room-header">
        <div className="room-info">
          <h1>Room: {roomCode}</h1>
          <p>Welcome, {username}!</p>
        </div>
        <button onClick={handleLeaveRoom} className="leave-btn">Leave Room</button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="room-content">
        <div className="video-section">
          <div className="videos-grid">
            <div className="video-container local-video">
              <h3>
                You ({username})
                {isScreenSharing && <span className="screen-share-indicator"> (Sharing Screen)</span>}
              </h3>
              <video ref={localVideoRef} autoPlay muted playsInline />
            </div>

            {Object.entries(remoteStreams).map(([socketId, stream]) => {
              const participant = participants.find(p => p.socketId === socketId);
              return (
                <div key={socketId} className="video-container remote-video">
                  <h3>{participant?.username || 'Guest'}</h3>
                  <video
                    ref={(ref) => {
                      if (ref && stream) {
                        ref.srcObject = stream;
                        remoteVideosRef.current[socketId] = ref;
                      }
                    }}
                    autoPlay
                    playsInline
                  />
                </div>
              );
            })}
          </div>

          <div className="controls">
            <button
              onClick={toggleAudio}
              className={`control-btn ${!audioEnabled ? 'disabled' : ''}`}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              🎤 {audioEnabled ? 'Mute' : 'Unmuted'}
            </button>
            <button
              onClick={toggleVideo}
              className={`control-btn ${!videoEnabled ? 'disabled' : ''}`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              📹 {videoEnabled ? 'Stop Video' : 'Start Video'}
            </button>
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`control-btn ${isScreenSharing ? 'active' : ''}`}
              title={isScreenSharing ? 'Stop sharing your screen' : 'Share your screen'}
              disabled={!localStream}
            >
              🖥️ {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </button>
          </div>
        </div>

        <div className="chat-section">
          <h3>Chat</h3>
          <div className="messages">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="message">
                <strong>{msg.username}:</strong> {msg.message}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="chat-form">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={!socket}
            />
            <button type="submit" disabled={!socket || !message.trim()}>Send</button>
          </form>
        </div>
      </div>

      <div className="participants-panel">
        <h3>Participants ({participants.length + 1})</h3>
        <ul>
          <li className="local">
            <span className="indicator">●</span> {username} (You)
            {isScreenSharing && <span className="screen-share-indicator"> (Sharing Screen)</span>}
          </li>
          {participants.map(p => (
            <li key={p.socketId}>
              <span className="indicator">●</span> {p.username}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Room;
