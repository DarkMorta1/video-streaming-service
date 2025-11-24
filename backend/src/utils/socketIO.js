const { generateId, createRoom, getRoom, addParticipant, removeParticipant, addMessage } = require('./roomManager');

const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('join-room', async (data) => {
      try {
        const { roomCode, username } = data;

        if (!roomCode || !username) {
          socket.emit('error', { message: 'Room code and username required' });
          return;
        }

        // Get room
        const room = getRoom(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Add participant
        const userId = generateId();
        addParticipant(roomCode, userId, username, socket.id);

        // Join socket room
        socket.join(roomCode);

        // Store info in socket
        socket.data.roomCode = roomCode;
        socket.data.userId = userId;
        socket.data.username = username;

        // Broadcast user joined
        io.to(roomCode).emit('user-joined', {
          userId,
          username,
          socketId: socket.id,
          participantCount: room.participants.length
        });

        // Send existing participants to new user
        socket.emit('existing-participants', {
          participants: room.participants.map(p => ({
            userId: p.userId,
            username: p.username,
            socketId: p.socketId
          }))
        });

        console.log(`${username} joined room ${roomCode}`);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
      io.to(data.to).emit('offer', {
        from: socket.id,
        offer: data.offer
      });
    });

    socket.on('answer', (data) => {
      io.to(data.to).emit('answer', {
        from: socket.id,
        answer: data.answer
      });
    });

    socket.on('ice-candidate', (data) => {
      io.to(data.to).emit('ice-candidate', {
        from: socket.id,
        candidate: data.candidate
      });
    });

    // Chat message
    socket.on('send-message', (data) => {
      try {
        const { message } = data;
        const { roomCode, userId, username } = socket.data;

        addMessage(roomCode, userId, username, message);

        io.to(roomCode).emit('receive-message', {
          userId,
          username,
          message,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    // Leave room
    socket.on('leave-room', () => {
      try {
        const { roomCode, userId, username } = socket.data;

        if (roomCode) {
          removeParticipant(roomCode, socket.id);
          socket.leave(roomCode);
          
          io.to(roomCode).emit('user-left', {
            userId,
            username,
            socketId: socket.id,
            participantCount: getRoom(roomCode)?.participants.length || 0
          });
        }
      } catch (error) {
        console.error('Leave room error:', error);
      }
    });

    // Audio stream events
    socket.on('audio-stream-start', () => {
      const { roomCode } = socket.data;
      if (roomCode) {
        io.to(roomCode).emit('audio-stream-started', {
          userId: socket.data.userId,
          username: socket.data.username
        });
      }
    });

    socket.on('audio-stream-end', () => {
      const { roomCode } = socket.data;
      if (roomCode) {
        io.to(roomCode).emit('audio-stream-ended', {
          userId: socket.data.userId,
          username: socket.data.username
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      try {
        const { roomCode, userId, username } = socket.data;

        if (roomCode) {
          removeParticipant(roomCode, socket.id);
          io.to(roomCode).emit('user-left', {
            userId,
            username,
            socketId: socket.id,
            participantCount: getRoom(roomCode)?.participants.length || 0
          });
        }

        console.log('User disconnected:', socket.id);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });
};

module.exports = { setupSocketIO };
