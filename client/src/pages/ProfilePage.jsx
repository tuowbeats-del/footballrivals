import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const TIER_COLORS = {
  'Perfect Season': 'text-yellow-300', 'Invincible': 'text-purple-400',
  'Champion': 'text-blue-400', 'European': 'text-green-400',
  'Midtable': 'text-gray-300', 'Relegation': 'text-red-400',
};

function EloBar({ elo }) {
  const pct = Math.min(100, Math.max(0, ((elo - 800) / (2200 - 800)) * 100));
  const tier = elo >= 1800 ? { label: 'Grandmaster', color: 'bg-yellow-400' }
    : elo >= 1500 ? { label: 'Master', color: 'bg-purple-500' }
    : elo >= 1300 ? { label: 'Diamond', color: 'bg-blue-400' }
    : elo >= 1100 ? { label: 'Gold', color: 'bg-gold-500' }
    : elo >= 900 ? { label: 'Silver', color: 'bg-gray-400' }
    : { label: 'Bronze', color: 'bg-orange-700' };

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">ELO Rang</span>
        <span className={`text-sm font-bold ${tier.color.replace('bg-', 'text-')}`}>{tier.label}</span>
      </div>
      <div className="bg-pitch-700 rounded-full h-2">
        <div className={`${tier.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-600">
        <span>800</span>
        <span className="text-white font-bold">{elo}</span>
        <span>2200</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/users/profile/${username}`),
      api.get('/battles/history'),
    ]).then(([p, h]) => {
      setProfile(p.data);
      setHistory(h.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-spin">⚽</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-3">🔍</div>
        <p className="text-gray-400">Profiel niet gevonden</p>
        <Link to="/lobby" className="btn-secondary mt-4 inline-block">Terug</Link>
      </div>
    );
  }

  const prof = profile.profile || {};
  const totalBattles = prof.totalBattles || 0;
  const wins = prof.wins || 0;
  const losses = prof.losses || 0;
  const winPct = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0.0';
  const elo = prof.currentElo || 1000;
  const isOwn = me?.username === username;

  const stats = [
    { label: 'Battles', value: totalBattles, icon: '⚔️' },
    { label: 'Gewonnen', value: wins, color: 'text-grass-400', icon: '✅' },
    { label: 'Gelijk', value: prof.draws || 0, color: 'text-gray-300', icon: '🤝' },
    { label: 'Verloren', value: losses, color: 'text-red-400', icon: '❌' },
    { label: 'Win %', value: `${winPct}%`, color: 'text-gold-400', icon: '📊' },
    { label: 'Huidige ELO', value: elo, icon: '⭐' },
    { label: 'Hoogste ELO', value: prof.highestElo || 1000, color: 'text-gold-400', icon: '🏆' },
    { label: 'Win streak', value: prof.currentStreak || 0, icon: '🔥' },
    { label: 'Beste streak', value: prof.highestStreak || 0, color: 'text-purple-400', icon: '⚡' },
    { label: 'Titels', value: prof.titles || 0, color: 'text-yellow-300', icon: '👑' },
    { label: 'Beste seizoen', value: `${Math.round(prof.highestScore || 0)} ptn`, color: 'text-grass-400', icon: '📈' },
    { label: 'Lid sinds', value: new Date(profile.createdAt).getFullYear(), icon: '📅' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="card mb-5 flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <div className="w-20 h-20 bg-pitch-700 rounded-full flex items-center justify-center text-4xl border-2 border-grass-500 flex-shrink-0">
          ⚽
        </div>
        <div className="text-center sm:text-left flex-1">
          <h1 className="text-2xl font-black text-white">{profile.username}</h1>
          <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
            <div className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-grass-500 animate-pulse' : 'bg-gray-600'}`}></div>
            <span className="text-sm text-gray-400">{profile.isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <p className="text-xl font-black text-gold-400 mt-1">{elo} ELO</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Lid sinds {new Date(profile.createdAt).toLocaleDateString('nl-BE')}
          </p>
        </div>
        {!isOwn && (
          <Link to="/lobby" className="btn-primary text-sm px-4 py-2">⚔️ Uitdagen</Link>
        )}
      </div>

      {/* ELO bar */}
      <EloBar elo={elo} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {stats.map(s => (
          <div key={s.label} className="card text-center hover:border-grass-500/40 transition-colors">
            <div className="text-lg mb-0.5">{s.icon}</div>
            <div className={`text-2xl font-black ${s.color || 'text-white'}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Achievements */}
      {profile.achievements?.length > 0 && (
        <div className="card mb-5">
          <h2 className="font-bold text-grass-400 mb-3 flex items-center gap-2">
            🏅 Achievements
            <span className="text-gray-500 text-sm font-normal">({profile.achievements.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.achievements.map(ua => (
              <div key={ua.id} className="bg-pitch-700 rounded-lg p-3 flex items-center gap-3">
                <span className="text-2xl">{ua.achievement.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-white">{ua.achievement.name}</p>
                  <p className="text-xs text-gray-400">{ua.achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match history */}
      <div className="card">
        <h2 className="font-bold text-grass-400 mb-3">📜 Match History</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Nog geen battles gespeeld.</p>
        ) : (
          <div className="space-y-2">
            {history.map(b => {
              const myId = profile.id;
              const isP1 = b.player1Id === myId;
              const won = b.result?.winnerId === myId;
              const drew = b.result?.winnerId === null;
              const oppName = isP1 ? b.player2?.username : b.player1?.username;
              const myPts = isP1 ? b.result?.player1Pts : b.result?.player2Pts;
              const oppPts = isP1 ? b.result?.player2Pts : b.result?.player1Pts;
              const myTier = isP1 ? b.result?.player1Tier : b.result?.player2Tier;
              return (
                <Link
                  key={b.id}
                  to={`/result/${b.id}`}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:opacity-80 ${
                    drew ? 'border-gray-500/30 bg-gray-500/5'
                    : won ? 'border-grass-500/30 bg-grass-500/5' : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-sm w-6 ${drew ? 'text-gray-400' : won ? 'text-grass-400' : 'text-red-400'}`}>
                      {drew ? 'G' : won ? 'W' : 'V'}
                    </span>
                    <div>
                      <p className="text-sm text-gray-300">vs <strong className="text-white">{oppName}</strong></p>
                      {myTier && (
                        <p className={`text-xs ${TIER_COLORS[myTier] || 'text-gray-400'}`}>{myTier}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {b.result && (
                      <p className="text-sm font-bold text-white">{myPts} <span className="text-gray-500">-</span> {oppPts}</p>
                    )}
                    <p className="text-xs text-gray-600">{new Date(b.createdAt).toLocaleDateString('nl-BE')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
