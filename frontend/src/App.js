import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import Home from './pages/Home';
import Room from './pages/Room';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/room/:roomCode"
          element={
            <RoomProvider>
              <Room />
            </RoomProvider>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;

