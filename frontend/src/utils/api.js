import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const roomAPI = {
  createRoom: (title, description) =>
    api.post('/rooms/create', { title, description }),
  getRoomByCode: (roomCode) =>
    api.get(`/rooms/code/${roomCode}`)
};

export default api;

