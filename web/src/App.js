import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/app.css';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Videos from './pages/Videos';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/videos" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/videos"
          element={
            <ProtectedRoute>
              <Videos />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/videos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
