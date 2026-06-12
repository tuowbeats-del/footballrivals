import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/lobby', label: 'Lobby', icon: '🏟️' },
    { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: `/profile/${user.username}`, label: 'Profiel', icon: '👤' },
  ];

  if (user.role === 'ADMIN') {
    navLinks.push({ to: '/admin', label: 'Admin', icon: '⚙️', admin: true });
  }

  return (
    <nav className="bg-pitch-800 border-b border-grass-500/20 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/lobby" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-spin-slow transition-all">⚽</span>
            <span className="font-black text-xl text-white tracking-tight">
              Football<span className="text-grass-400">Rivals</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 ${
                  isActive(link.to)
                    ? link.admin ? 'bg-gold-500/20 text-gold-400' : 'bg-grass-500/20 text-grass-400'
                    : link.admin ? 'text-gold-400/70 hover:text-gold-400 hover:bg-gold-500/10' : 'text-gray-300 hover:text-grass-400 hover:bg-grass-500/10'
                }`}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* User info + logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-pitch-700 px-3 py-1.5 rounded-lg border border-grass-500/20">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-grass-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-white">{user.username}</span>
            </div>
            <button onClick={handleLogout} className="btn-secondary text-sm px-3 py-1.5">
              Uitloggen
            </button>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden text-gray-300 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-grass-500/20 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg font-medium text-sm ${
                  isActive(link.to) ? 'bg-grass-500/20 text-grass-400' : 'text-gray-300 hover:text-grass-400'
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-400">{user.username}</span>
              <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">Uitloggen</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
