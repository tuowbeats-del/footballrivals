import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const RANK_ICONS  = { 1: '🥇', 2: '🥈', 3: '🥉' };
const ELO_TIERS   = [
  { min: 1800, label: 'Grandmaster', color: 'text-yellow-300', bg: 'bg-yellow-300/10' },
  { min: 1500, label: 'Master',      color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { min: 1300, label: 'Diamond',     color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  { min: 1100, label: 'Gold',        color: 'text-gold-400',   bg: 'bg-gold-400/10' },
  { min: 900,  label: 'Silver',      color: 'text-gray-300',   bg: 'bg-gray-400/10' },
  { min: 0,    label: 'Bronze',      color: 'text-orange-700', bg: 'bg-orange-700/10' },
];

function getEloTier(elo) {
  return ELO_TIERS.find(t => elo >= t.min) || ELO_TIERS[ELO_TIERS.length - 1];
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [sort, setSort] = useState('elo');
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaderboard?sort=${sort}&limit=50`)
      .then(res => {
        setEntries(res.data);
        const idx = res.data.findIndex(e => e.userId === user?.id);
        setMyRank(idx >= 0 ? idx + 1 : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort, user?.id]);

  const sortButtons = [
    { key: 'elo',    label: '⭐ ELO' },
    { key: 'wins',   label: '✅ Wins' },
    { key: 'winPct', label: '📊 Win %' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-black text-white flex items-center gap-2">
          🏆 <span className="text-gold-400">Leaderboard</span>
        </h1>
        {myRank && (
          <div className="bg-pitch-700 border border-grass-500/30 rounded-lg px-3 py-1.5 text-sm">
            Jouw rang: <span className="text-grass-400 font-bold">#{myRank}</span>
          </div>
        )}
      </div>

      {/* ELO tier legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {ELO_TIERS.map(t => (
          <div key={t.label} className={`text-xs px-2 py-1 rounded-full ${t.color} ${t.bg} font-semibold`}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Sort buttons */}
      <div className="flex gap-2 mb-5">
        {sortButtons.map(s => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              sort === s.key ? 'btn-gold' : 'btn-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-4xl animate-spin mb-2">⚽</div>
          <p className="text-gray-400">Laden...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nog geen spelers op het leaderboard.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const rank = i + 1;
            const isMe = e.userId === user?.id;
            const tier = getEloTier(e.elo);
            return (
              <Link
                key={e.id}
                to={`/profile/${e.user?.username}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                  isMe
                    ? 'border-grass-500 bg-grass-500/10'
                    : 'border-pitch-700 bg-pitch-800 hover:border-grass-500/30'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {RANK_ICONS[rank] ? (
                    <span className="text-xl">{RANK_ICONS[rank]}</span>
                  ) : (
                    <span className="text-gray-500 font-bold text-sm">{rank}</span>
                  )}
                </div>

                {/* Online indicator */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  e.user?.isOnline ? 'bg-grass-500 animate-pulse' : 'bg-gray-600'
                }`}></div>

                {/* Username + tier */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold truncate ${isMe ? 'text-grass-400' : 'text-white'}`}>
                      {e.user?.username}
                    </span>
                    {isMe && <span className="text-xs text-grass-500 flex-shrink-0">(jij)</span>}
                  </div>
                  <div className={`text-xs ${tier.color}`}>{tier.label}</div>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-gold-400 text-lg leading-none">{e.elo}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {e.wins}W / {e.losses}L
                    <span className="ml-1 text-gray-600">({(e.winPct * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
