import React, { useEffect, useState } from 'react';
import api from '../services/api';

const POSITIONS = ['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];

const defaultPlayer = {
  name: '', position: 'ST', rating: 75, pace: 75, shooting: 75,
  passing: 75, dribbling: 75, defending: 50, physical: 70,
  nationality: '', clubSeasonId: '',
};

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [battles, setBattles] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [newPlayer, setNewPlayer] = useState(defaultPlayer);
  const [newClub, setNewClub] = useState({ name: '', country: '' });
  const [newSeason, setNewSeason] = useState({ year: '', label: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  useEffect(() => {
    if (tab === 'users')   api.get('/admin/users').then(r => setUsers(r.data)).catch(() => {});
    if (tab === 'battles') api.get('/admin/battles').then(r => setBattles(r.data)).catch(() => {});
    if (tab === 'data') {
      api.get('/admin/clubs').then(r => setClubs(r.data)).catch(() => {});
      api.get('/admin/seasons').then(r => setSeasons(r.data)).catch(() => {});
    }
  }, [tab]);

  const blockUser = async (id, block) => {
    try {
      await api.put(`/admin/users/${id}/block`, { block });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isBlocked: block } : u));
      showMsg(`Gebruiker ${block ? 'geblokkeerd' : 'gedeblokkeerd'}`);
    } catch { showMsg('Actie mislukt', 'error'); }
  };

  const addClub = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/clubs', newClub);
      setClubs(prev => [...prev, res.data]);
      setNewClub({ name: '', country: '' });
      showMsg('Club aangemaakt!');
    } catch { showMsg('Club aanmaken mislukt', 'error'); }
  };

  const addSeason = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/seasons', newSeason);
      setSeasons(prev => [...prev, res.data]);
      setNewSeason({ year: '', label: '' });
      showMsg('Seizoen aangemaakt!');
    } catch { showMsg('Seizoen aanmaken mislukt', 'error'); }
  };

  const addPlayer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/players', newPlayer);
      setNewPlayer(defaultPlayer);
      showMsg('Speler aangemaakt!');
    } catch { showMsg('Speler aanmaken mislukt', 'error'); }
    finally { setLoading(false); }
  };

  const resetLeaderboard = async () => {
    if (!confirm('⚠️ Dit reset ALLE ELO en statistieken naar 0. Zeker weten?')) return;
    try {
      await api.post('/admin/leaderboard/reset');
      showMsg('Leaderboard gereset!');
    } catch { showMsg('Reset mislukt', 'error'); }
  };

  const tabs = [
    { key: 'users',   label: '👥 Gebruikers' },
    { key: 'battles', label: '⚔️ Battles' },
    { key: 'data',    label: '📊 Data' },
    { key: 'actions', label: '🔧 Acties' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-gold-400 mb-6">⚙️ Admin Paneel</h1>

      {message.text && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in ${
          message.type === 'error' ? 'alert-error' : 'alert-success'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn-gold text-sm' : 'btn-secondary text-sm'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="card overflow-x-auto">
          <h2 className="font-bold text-grass-400 mb-4">Alle gebruikers ({users.length})</h2>
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-pitch-600">
                {['ID','Gebruiker','Email','Rol','ELO','Status','Actie'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-pitch-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-600">{u.id}</td>
                  <td className="py-2 pr-4 font-medium">{u.username}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{u.email}</td>
                  <td className="py-2 pr-4">
                    <span className={u.role === 'ADMIN' ? 'text-gold-400 font-bold' : 'text-gray-500'}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gold-400 font-mono">{u.profile?.currentElo || 1000}</td>
                  <td className="py-2 pr-4">
                    <span className={u.isBlocked ? 'text-red-400 font-semibold' : 'text-grass-400'}>
                      {u.isBlocked ? '🔒 Geblokkeerd' : '✅ Actief'}
                    </span>
                  </td>
                  <td className="py-2">
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => blockUser(u.id, !u.isBlocked)}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${
                          u.isBlocked
                            ? 'bg-grass-500/20 text-grass-400 hover:bg-grass-500/30'
                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        }`}
                      >
                        {u.isBlocked ? 'Deblokkeer' : 'Blokkeer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BATTLES TAB */}
      {tab === 'battles' && (
        <div className="card overflow-x-auto">
          <h2 className="font-bold text-grass-400 mb-4">Recente battles ({battles.length})</h2>
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-pitch-600">
                {['ID','Speler 1','Speler 2','Status','Score','Datum'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-700">
              {battles.map(b => (
                <tr key={b.id} className="hover:bg-pitch-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-600">{b.id}</td>
                  <td className="py-2 pr-4">{b.player1?.username}</td>
                  <td className="py-2 pr-4">{b.player2?.username}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      b.status === 'FINISHED' ? 'bg-grass-500/20 text-grass-400'
                      : b.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400'
                      : 'bg-gold-500/20 text-gold-400'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">
                    {b.result ? `${b.result.player1Pts} - ${b.result.player2Pts}` : '-'}
                  </td>
                  <td className="py-2 text-gray-600 text-xs">
                    {new Date(b.createdAt).toLocaleDateString('nl-BE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DATA TAB */}
      {tab === 'data' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Add club */}
          <form onSubmit={addClub} className="card space-y-3">
            <h2 className="font-bold text-grass-400">➕ Club toevoegen</h2>
            <input className="input-field text-sm" placeholder="Clubnaam" value={newClub.name}
              onChange={e => setNewClub(p => ({ ...p, name: e.target.value }))} required />
            <input className="input-field text-sm" placeholder="Land" value={newClub.country}
              onChange={e => setNewClub(p => ({ ...p, country: e.target.value }))} required />
            <button type="submit" className="btn-primary w-full text-sm">Toevoegen</button>
            {clubs.length > 0 && (
              <div className="text-xs text-gray-600 max-h-24 overflow-y-auto space-y-0.5">
                {clubs.map(c => <div key={c.id}>{c.id}. {c.name}</div>)}
              </div>
            )}
          </form>

          {/* Add season */}
          <form onSubmit={addSeason} className="card space-y-3">
            <h2 className="font-bold text-grass-400">➕ Seizoen toevoegen</h2>
            <input className="input-field text-sm" placeholder="Jaar (bv. 2004)" value={newSeason.year}
              onChange={e => setNewSeason(p => ({ ...p, year: e.target.value }))} required />
            <input className="input-field text-sm" placeholder="Label (bv. 2003-04)" value={newSeason.label}
              onChange={e => setNewSeason(p => ({ ...p, label: e.target.value }))} required />
            <button type="submit" className="btn-primary w-full text-sm">Toevoegen</button>
            {seasons.length > 0 && (
              <div className="text-xs text-gray-600 max-h-24 overflow-y-auto space-y-0.5">
                {seasons.map(s => <div key={s.id}>{s.id}. {s.label}</div>)}
              </div>
            )}
          </form>

          {/* Add player */}
          <form onSubmit={addPlayer} className="card space-y-2">
            <h2 className="font-bold text-grass-400">➕ Speler toevoegen</h2>
            <input className="input-field text-sm" placeholder="Naam" value={newPlayer.name}
              onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))} required />
            <select className="input-field text-sm" value={newPlayer.position}
              onChange={e => setNewPlayer(p => ({ ...p, position: e.target.value }))}>
              {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
            </select>
            <input type="number" className="input-field text-sm" placeholder="Rating (1-99)"
              min="1" max="99" value={newPlayer.rating}
              onChange={e => setNewPlayer(p => ({ ...p, rating: parseInt(e.target.value) || 75 }))} />
            <div className="grid grid-cols-2 gap-2">
              {['pace','shooting','passing','dribbling','defending','physical'].map(attr => (
                <input key={attr} type="number" className="input-field text-xs py-1" placeholder={attr}
                  min="1" max="99" value={newPlayer[attr]}
                  onChange={e => setNewPlayer(p => ({ ...p, [attr]: parseInt(e.target.value) || 70 }))} />
              ))}
            </div>
            <input className="input-field text-sm" placeholder="Nationaliteit" value={newPlayer.nationality}
              onChange={e => setNewPlayer(p => ({ ...p, nationality: e.target.value }))} required />
            <input type="number" className="input-field text-sm" placeholder="ClubSeason ID"
              value={newPlayer.clubSeasonId}
              onChange={e => setNewPlayer(p => ({ ...p, clubSeasonId: e.target.value }))} required />
            <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
              {loading ? 'Bezig...' : 'Speler toevoegen'}
            </button>
          </form>
        </div>
      )}

      {/* ACTIONS TAB */}
      {tab === 'actions' && (
        <div className="max-w-md space-y-4">
          <div className="card">
            <h2 className="font-bold text-red-400 mb-3">⚠️ Gevaarlijke acties</h2>
            <p className="text-gray-400 text-sm mb-4">
              Deze acties zijn onomkeerbaar. Gebruik met voorzichtigheid.
            </p>
            <button onClick={resetLeaderboard} className="btn-danger w-full py-3">
              🔄 Leaderboard volledig resetten
            </button>
            <p className="text-xs text-gray-600 mt-2">
              Reset alle ELO naar 1000, wins/losses naar 0 voor alle spelers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
