const { v4: uuidv4 } = require('uuid');

// In-memory storage
const rooms = new Map();
const users = new Map();

// Generate room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate unique ID
const generateId = () => uuidv4();

// Create room
const createRoom = (title, description = '') => {
  const roomCode = generateRoomCode();
  const room = {
    id: generateId(),
    roomCode,
    title,
    description,
    createdAt: new Date(),
    isActive: false,
    participants: [],
    messages: []
  };
  rooms.set(roomCode, room);
  return room;
};

// Get room
const getRoom = (roomCode) => {
  return rooms.get(roomCode);
};

// Add participant
const addParticipant = (roomCode, userId, username, socketId) => {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  const participant = {
    userId,
    username,
    socketId,
    joinedAt: new Date()
  };
  room.participants.push(participant);
  users.set(userId, { roomCode, username, socketId });
  return room;
};

// Remove participant
const removeParticipant = (roomCode, socketId) => {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  const participantIndex = room.participants.findIndex(p => p.socketId === socketId);
  if (participantIndex > -1) {
    const participant = room.participants[participantIndex];
    room.participants.splice(participantIndex, 1);
    users.delete(participant.userId);
    
    // Delete room if empty
    if (room.participants.length === 0) {
      rooms.delete(roomCode);
    }
  }
  
  return room;
};

// Add chat message
const addMessage = (roomCode, userId, username, message) => {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  room.messages.push({
    userId,
    username,
    message,
    timestamp: new Date()
  });
  
  return room;
};

module.exports = {
  rooms,
  users,
  generateRoomCode,
  generateId,
  createRoom,
  getRoom,
  addParticipant,
  removeParticipant,
  addMessage
};
