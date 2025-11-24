import React, { createContext, useState, useCallback } from 'react';

export const RoomContext = createContext();

export const RoomProvider = ({ children }) => {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addParticipant = useCallback((participant) => {
    setParticipants(prev => {
      const exists = prev.find(p => p.socketId === participant.socketId);
      if (!exists) {
        return [...prev, participant];
      }
      return prev;
    });
  }, []);

  const removeParticipant = useCallback((socketId) => {
    setParticipants(prev => prev.filter(p => p.socketId !== socketId));
  }, []);

  const addChatMessage = useCallback((message) => {
    setChatMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  const setRoomData = useCallback((roomData) => {
    setRoom(roomData);
  }, []);

  return (
    <RoomContext.Provider value={{
      room,
      participants,
      chatMessages,
      loading,
      error,
      addParticipant,
      removeParticipant,
      addChatMessage,
      clearMessages,
      setRoomData
    }}>
      {children}
    </RoomContext.Provider>
  );
};
