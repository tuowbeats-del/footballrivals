import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import { Toasts, useToasts } from '../components/shared/Toasts';

export default function LobbyPage() {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const { toasts, addToast } = useToasts();

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [challenges, setChallenges] = useState([]);
  const [pendingBattle, setPendingBattle] = useState(null);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('CLASSIC');
  const [queueing, setQueueing] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    api.get('/chat/lobby?limit=50')
      .then(res => setMessages(res.data.map(m => ({ ...m, username: m.user?.username }))))
      .catch(() => {});
    api.get('/battles/history')
      .then(res => setHistory(res.data.slice(0, 5)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.emit('lobby:join');

    const onUsers = (users) => setOnlineUsers(users);
    const onMessage = (msg) => setMessages(prev => [...prev.slice(-99), msg]);
    const onChallengeReceived = ({ from, battleId, mode: m, rematch }) => {
      setChallenges(prev => [...prev, { from, battleId, mode: m, rematch, ts: Date.now() }]);
    };
    const onChallengeAccepted = ({ battleId }) => {
      setPendingBattle(null);
      navigate(`/battle/${battleId}`);
    };
    const onChallengeDeclined = ({ by }) => {
      setPendingBattle(null);
      addToast(`${by} weigerde je uitdaging`, 'info');
    };
    const onChallengeSent = ({ battleId, to, mode: m }) => {
      setPendingBattle({ battleId, to, mode: m });
    };
    const onQueueWaiting = () => setQueueing(true);
    const onQueueLeft = () => setQueueing(false);
    const onQueueMatched = ({ battleId, opponent }) => {
      setQueueing(false);
      addToast(`Tegenstander gevonden: ${opponent}!`, 'success');
      navigate(`/battle/${battleId}`);
    };
    const onError = ({ message, battleId }) => {
      addToast(message);
      setPendingBattle(null);
      setQueueing(false);
      // Zit je nog in een lopende battle? Stuur er direct naartoe
      if (battleId) setTimeout(() => navigate(`/battle/${battleId}`), 1200);
    };

    socket.on('lobby:users', onUsers);
    socket.on('lobby:message', onMessage);
    socket.on('challenge:received', onChallengeReceived);
    socket.on('challenge:accepted', onChallengeAccepted);
    socket.on('challenge:declined', onChallengeDeclined);
    socket.on('challenge:sent', onChallengeSent);
    socket.on('queue:waiting', onQueueWaiting);
    socket.on('queue:left', onQueueLeft);
    socket.on('queue:matched', onQueueMatched);
    socket.on('error', onError);

    return () => {
      socket.emit('lobby:leave');
      socket.off('lobby:users', onUsers);
      socket.off('lobby:message', onMessage);
      socket.off('challenge:received', onChallengeReceived);
      socket.off('challenge:accepted', onChallengeAccepted);
      socket.off('challenge:declined', onChallengeDeclined);
      socket.off('challenge:sent', onChallengeSent);
      socket.off('queue:waiting', onQueueWaiting);
      socket.off('queue:left', onQueueLeft);
      socket.off('queue:matched', onQueueMatched);
      socket.off('error', onError);
    };
  }, [socket, navigate, addToast]);

  // Uitdagingen verlopen na 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setChallenges(prev => prev.filter(c => now - c.ts < 30000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('lobby:chat', { message: chatInput.trim() });
    setChatInput('');
  };

  const challengeUser = (targetId) => {
    if (!socket || pendingBattle) return;
    socket.emit('challenge:send', { targetUserId: targetId, mode });
  };

  const acceptChallenge = (battleId) => {
    if (!socket) return;
    socket.emit('challenge:accept', { battleId });
    setChallenges(prev => prev.filter(c => c.battleId !== battleId));
  };

  const declineChallenge = (battleId) => {
    if (!socket) return;
    socket.emit('challenge:decline', { battleId });
    setChallenges(prev => prev.filter(c => c.battleId !== battleId));
  };

  const toggleQueue = () => {
    if (!socket) return;
    if (queueing) socket.emit('queue:leave');
    else socket.emit('queue:join', { mode });
  };

  const others = onlineUsers.filter(u => u.id !== user?.id);
  const formatTime = (ts) => new Date(ts).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });

  const ModeBadge = ({ m }) => (
    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
      m === 'EXPERT'
        ? 'border-purple-400 text-purple-300 bg-purple-400/10'
        : 'border-grass-500 text-grass-400 bg-grass-500/10'
    }`}>
      {m}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toasts toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-black text-white flex items-center gap-2">
          🏟️ <span className="text-grass-400">Lobby</span>
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-grass-500 animate-pulse' : 'bg-red-500'}`}></div>
          {connected ? 'Verbonden' : 'Niet verbonden'}
        </div>
      </div>

      {/* Modus + quick match */}
      <div className="card mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-semibold">Spelmodus:</span>
          <div className="flex rounded-lg overflow-hidden border border-pitch-600">
            {['CLASSIC', 'EXPERT'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={queueing}
                className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                  mode === m
                    ? m === 'EXPERT' ? 'bg-purple-500 text-white' : 'bg-grass-500 text-pitch-900'
                    : 'bg-pitch-700 text-gray-400 hover:text-white'
                }`}
              >
                {m === 'CLASSIC' ? '⚽ Classic' : '🕵️ Expert'}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-600 hidden md:inline">
            {mode === 'CLASSIC' ? 'Ratings zichtbaar tijdens het draften' : 'Alleen namen & posities — ken je klassiekers!'}
          </span>
        </div>
        <button
          onClick={toggleQueue}
          disabled={!connected || !!pendingBattle}
          className={queueing ? 'btn-danger px-5 py-2 text-sm' : 'btn-gold px-5 py-2 text-sm'}
        >
          {queueing ? '✖ Stop zoeken...' : '🎲 Quick match'}
        </button>
      </div>

      {queueing && (
        <div className="mb-4 bg-gold-500/10 border border-gold-500/50 rounded-xl p-3 flex items-center gap-3 animate-slide-in">
          <div className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gold-300 text-sm font-semibold">Zoeken naar een {mode}-tegenstander...</p>
        </div>
      )}

      {/* Oefenen tegen een bot */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white text-sm">🤖 Oefenen tegen een bot</h2>
            <p className="text-xs text-gray-500">Altijd beschikbaar — telt niet mee voor je ELO of stats</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { level: 'easy', name: 'Rookie Amorim', icon: '😅', desc: 'Makkelijk' },
              { level: 'medium', name: 'Coach Ricky', icon: '🎯', desc: 'Normaal' },
              { level: 'hard', name: 'Don Cox', icon: '🧠', desc: 'Moeilijk' },
            ].map(b => (
              <button
                key={b.level}
                onClick={() => socket?.emit('battle:bot', { mode, level: b.level })}
                disabled={!connected || !!pendingBattle || queueing}
                title={b.desc}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>{b.icon}</span> {b.name}
                <span className="text-gray-500">· {b.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inkomende uitdagingen */}
      {challenges.length > 0 && (
        <div className="mb-4 space-y-2">
          {challenges.map(c => (
            <div key={c.battleId} className="bg-gold-500/10 border border-gold-500 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-in">
              <div>
                <p className="font-bold text-gold-400 flex items-center gap-2">
                  {c.rematch ? '🔄 Rematch!' : '⚔️ Uitdaging ontvangen!'} <ModeBadge m={c.mode || 'CLASSIC'} />
                </p>
                <p className="text-gray-300 text-sm">
                  <strong className="text-white">{c.from.username}</strong> daagt je uit voor een {c.mode === 'EXPERT' ? 'Expert' : 'Classic'} battle!
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => acceptChallenge(c.battleId)} className="btn-primary px-4 py-2 text-sm">
                  ✅ Accepteren
                </button>
                <button onClick={() => declineChallenge(c.battleId)} className="btn-danger px-4 py-2 text-sm">
                  ❌ Weigeren
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uitgaande uitdaging */}
      {pendingBattle && (
        <div className="mb-4 bg-pitch-700 border border-grass-500/30 rounded-xl p-4 flex items-center justify-between animate-slide-in">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-grass-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-300 text-sm">
              Wachten op <strong className="text-grass-400">{pendingBattle.to}</strong>... <ModeBadge m={pendingBattle.mode || 'CLASSIC'} />
            </p>
          </div>
          <button onClick={() => setPendingBattle(null)} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Annuleer</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linkerkolom: online spelers + recente battles */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-grass-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-grass-500 rounded-full animate-pulse"></span>
              Online Spelers ({others.length})
            </h2>
            <div className="space-y-2">
              {others.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Geen andere spelers online.</p>
              ) : (
                others.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-pitch-700 rounded-lg p-2.5 hover:bg-pitch-600 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 bg-grass-500 rounded-full flex-shrink-0"></div>
                      <Link
                        to={`/profile/${u.username}`}
                        className="font-medium text-sm truncate hover:text-grass-400 transition-colors"
                      >
                        {u.username}
                      </Link>
                    </div>
                    <button
                      onClick={() => challengeUser(u.id)}
                      disabled={!!pendingBattle || queueing}
                      title={`Daag uit (${mode})`}
                      className="text-xs btn-primary px-2.5 py-1 flex-shrink-0 ml-2 disabled:opacity-40"
                    >
                      ⚔️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-bold text-grass-400 mb-3">📜 Recente Battles</h2>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm italic">Nog geen battles gespeeld.</p>
            ) : (
              <div className="space-y-2">
                {history.map(b => {
                  const isP1 = b.player1Id === user?.id;
                  const drew = b.result?.winnerId === null;
                  const won = b.result?.winnerId === user?.id;
                  const oppName = isP1 ? b.player2?.username : b.player1?.username;
                  const myPts = isP1 ? b.result?.player1Pts : b.result?.player2Pts;
                  const oppPts = isP1 ? b.result?.player2Pts : b.result?.player1Pts;
                  return (
                    <Link
                      key={b.id}
                      to={`/result/${b.id}`}
                      className={`flex items-center justify-between p-2 rounded-lg border text-sm transition-colors hover:opacity-80 ${
                        drew ? 'border-gray-500/30 bg-gray-500/5'
                        : won ? 'border-grass-500/30 bg-grass-500/5' : 'border-red-500/30 bg-red-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${drew ? 'text-gray-400' : won ? 'text-grass-400' : 'text-red-400'}`}>
                          {drew ? 'G' : won ? 'W' : 'V'}
                        </span>
                        <span className="text-gray-300 truncate">vs {oppName}</span>
                      </div>
                      {b.result && (
                        <span className="text-gray-500 text-xs">{myPts} - {oppPts} ptn</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rechterkolom: chat */}
        <div className="lg:col-span-2">
          <div className="card flex flex-col" style={{ height: '520px' }}>
            <h2 className="font-bold text-grass-400 mb-3 flex items-center gap-2 flex-shrink-0">
              💬 Lobby Chat
            </h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1">
              {messages.length === 0 && (
                <p className="text-gray-600 text-sm italic text-center mt-8">
                  Wees de eerste om te chatten!
                </p>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.userId === user?.id || msg.user?.username === user?.username;
                return (
                  <div key={msg.id || i} className={`text-sm flex gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-3 py-1.5 rounded-xl ${
                      isMe
                        ? 'bg-grass-500/20 text-grass-300 rounded-tr-sm'
                        : 'bg-pitch-700 text-gray-300 rounded-tl-sm'
                    }`}>
                      {!isMe && (
                        <span className="text-grass-400 font-semibold text-xs block">
                          {msg.username || msg.user?.username}
                        </span>
                      )}
                      <span>{msg.message}</span>
                      <span className="text-gray-600 text-xs ml-2">
                        {formatTime(msg.time || msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Typ een bericht..."
                maxLength={300}
                className="input-field flex-1"
                disabled={!connected}
              />
              <button type="submit" disabled={!connected || !chatInput.trim()} className="btn-primary px-4">
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
