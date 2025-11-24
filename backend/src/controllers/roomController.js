const { createRoom: createRoomInMemory, getRoom } = require('../utils/roomManager');

const createRoom = async (req, res) => {
  try {
    const { title, description } = req.body;
    console.log('Create room request:', { title, description });

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const room = createRoomInMemory(title, description || '');
    console.log('Room created:', room);

    res.status(201).json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        title: room.title,
        description: room.description
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
};

const getRoomByCode = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = getRoom(roomCode);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        title: room.title,
        description: room.description,
        isActive: room.isActive,
        participants: room.participants.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createRoom, getRoomByCode };
