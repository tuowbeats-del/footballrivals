import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/shared/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import LobbyPage from './pages/LobbyPage';
import BattlePage from './pages/BattlePage';
import ResultPage from './pages/ResultPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner size="lg" text="Laden..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/lobby" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');

  if (loading) return <LoadingSpinner size="lg" text="Laden..." />;

  return (
    <SocketProvider token={token}>
      <div className="min-h-screen bg-pitch-900">
        <Navbar />
        <Routes>
          <Route path="/" element={user ? <Navigate to="/lobby" /> : <Home />} />
          <Route path="/login" element={user ? <Navigate to="/lobby" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/lobby" /> : <Register />} />
          <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/battle/:id" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
          <Route path="/result/:id" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
          <Route path="/profile/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
