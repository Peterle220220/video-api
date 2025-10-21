import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import io from 'socket.io-client';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import Videos from './pages/Videos';
import ProtectedRoute from './routes/ProtectedRoute';
import './styles/app.css';
import Register from './pages/Register';
import Account from './pages/Account';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io(process.env.REACT_APP_WS_URL || 'http://localhost:3003');
    
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('WebSocket connected:', data);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="app">
        {!isConnected && (
          <div className="connection-status">
            <p>Connecting to server...</p>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/videos" replace />} />
          <Route path="/login" element={<Login socket={socket} />} />
          <Route path="/register" element={<Register socket={socket} />} />
          <Route path="/forgot-password" element={<ForgotPassword socket={socket} />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account socket={socket} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos"
            element={
              <ProtectedRoute>
                <Videos socket={socket} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/videos" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
