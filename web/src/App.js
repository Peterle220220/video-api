import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import Videos from './pages/Videos';
import ProtectedRoute from './routes/ProtectedRoute';
import './styles/app.css';

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
