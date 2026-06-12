import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-pitch-900 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <div className="text-8xl mb-4 animate-bounce">⚽</div>
        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
          Football<span className="text-grass-400">Rivals</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-md mx-auto">
          Bouw het ultieme voetbalteam. Versla je rivaal in een realtime draft battle.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register" className="btn-primary text-lg px-8 py-3">
            🚀 Start nu gratis
          </Link>
          <Link to="/login" className="btn-secondary text-lg px-8 py-3">
            Inloggen
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { icon: '🎯', title: 'Draft', desc: 'Kies de beste spelers per ronde uit echte clubs en seizoenen' },
          { icon: '⚡', title: 'Realtime', desc: 'Battle live tegen andere spelers via Socket.IO' },
          { icon: '🏆', title: 'ELO Systeem', desc: 'Klim op het leaderboard met een dynamisch ELO-rating' },
        ].map(f => (
          <div key={f.title} className="card hover:border-grass-500/40 transition-all">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-grass-400 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-400">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          { value: '14', label: 'Iconische seizoenen' },
          { value: '230+', label: 'Spelers' },
          { value: '38', label: 'Wedstrijden' },
          { value: '5', label: 'Formaties' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-2xl font-black text-gold-400">{s.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
