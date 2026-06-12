import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import PitchView from '../components/PitchView';
import { Toasts, useToasts } from '../components/shared/Toasts';

const TIER_STYLES = {
  'Perfect Season': { text: 'text-yellow-300', border: 'border-yellow-300', bg: 'bg-yellow-300/10', emoji: '🐐' },
  'Invincible':     { text: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-400/10', emoji: '🛡️' },
  'Champion':       { text: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-400/10', emoji: '🏆' },
  'European':       { text: 'text-blue-400',   border: 'border-blue-400',   bg: 'bg-blue-400/10', emoji: '🌍' },
  'Midtable':       { text: 'text-gray-300',   border: 'border-gray-500',   bg: 'bg-gray-500/10', emoji: '😐' },
  'Relegation':     { text: 'text-red-400',    border: 'border-red-400',    bg: 'bg-red-400/10', emoji: '📉' },
};

const REVEAL_MS = 320; // tempo van de speeldag-reveal

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    duration: 2.5 + Math.random() * 2,
    color: ['#facc15', '#4ade80', '#60a5fa', '#f87171', '#c084fc'][i % 5],
    size: 6 + Math.random() * 6,
  })), []);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`@keyframes confetti-fall {
        0% { transform: translateY(-5vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(105vh) rotate(720deg); opacity: 0.4; }
      }`}</style>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-5vh',
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SeasonTally({ name, season, upTo, color }) {
  const played = season.matches.slice(0, upTo);
  const wins = played.filter(m => m.res === 'W').length;
  const draws = played.filter(m => m.res === 'D').length;
  const losses = played.filter(m => m.res === 'L').length;
  const pts = wins * 3 + draws;
  const last = played[played.length - 1];

  return (
    <div className="card text-center">
      <h3 className={`font-bold text-sm mb-1 ${color}`}>{name}</h3>
      <div className="text-3xl font-black text-white mb-1">{pts} <span className="text-sm text-gray-500 font-bold">ptn</span></div>
      <div className="flex justify-center gap-3 text-sm font-bold mb-2">
        <span className="text-grass-400">{wins}W</span>
        <span className="text-gray-400">{draws}G</span>
        <span className="text-red-400">{losses}V</span>
      </div>
      {last && (
        <div className={`text-xs font-semibold rounded-lg py-1.5 px-2 ${
          last.derby ? 'border border-gold-500 ' : ''
        }${
          last.res === 'W' ? 'bg-grass-500/15 text-grass-300'
          : last.res === 'D' ? 'bg-gray-500/15 text-gray-300'
          : 'bg-red-500/15 text-red-300'
        }`}>
          {last.derby && '⚔️ DERBY: '}{last.home ? 'vs' : '@'} {last.opp} &nbsp;{last.gf}-{last.ga}
        </div>
      )}
      {/* Vormdots (onderlinge duels krijgen een gouden ring) */}
      <div className="flex flex-wrap justify-center gap-[3px] mt-2">
        {played.slice(-38).map((m, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              m.res === 'W' ? 'bg-grass-500' : m.res === 'D' ? 'bg-gray-500' : 'bg-red-500'
            } ${m.derby ? 'ring-2 ring-gold-400' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function StatBar({ label, value, max = 100, color = 'bg-grass-500' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-pitch-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
      </div>
      <span className="text-white w-8 text-right font-mono">{typeof value === 'number' ? value.toFixed(1) : value}</span>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams();
  const battleId = parseInt(id);
  const { state: liveResult } = useLocation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { toasts, addToast } = useToasts();

  const [data, setData] = useState(null);       // genormaliseerd resultaat
  const [loading, setLoading] = useState(true);
  const [matchday, setMatchday] = useState(liveResult ? 0 : 38);
  const [revealing, setRevealing] = useState(!!liveResult);
  const [rematchPending, setRematchPending] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const intervalRef = useRef(null);

  // Normaliseer: ofwel live socket-resultaat, ofwel uit de database
  useEffect(() => {
    const fromLive = () => {
      if (!liveResult?.season1) return null;
      return {
        season1: liveResult.season1,
        season2: liveResult.season2,
        tier1: liveResult.tier1,
        tier2: liveResult.tier2,
        score1: liveResult.score1,
        score2: liveResult.score2,
        eloChange1: liveResult.eloChange1,
        eloChange2: liveResult.eloChange2,
        winnerId: liveResult.winnerId,
        formation1: liveResult.formation1,
        formation2: liveResult.formation2,
        team1: liveResult.team1 || [],
        team2: liveResult.team2 || [],
        myAchievements: liveResult.achievements?.[user?.id] || [],
        mode: null,
      };
    };

    const live = fromLive();
    api.get(`/battles/${battleId}`)
      .then(res => {
        const b = res.data;
        if (!b.result) { navigate(`/battle/${battleId}`); return; }
        const team1 = new Array(11).fill(null);
        const team2 = new Array(11).fill(null);
        for (const r of b.rounds || []) {
          for (const p of r.picks || []) {
            if (p.userId === b.player1Id) team1[p.slot] = p.player;
            else team2[p.slot] = p.player;
          }
        }
        setData({
          player1: b.player1,
          player2: b.player2,
          player1Id: b.player1Id,
          player2Id: b.player2Id,
          practice: !!(b.player1?.isBot || b.player2?.isBot),
          mode: b.mode,
          ...(live || {
            season1: b.result.season1,
            season2: b.result.season2,
            tier1: b.result.player1Tier,
            tier2: b.result.player2Tier,
            score1: {
              totalRating: b.result.player1Rating, attack: b.result.player1Attack,
              midfield: b.result.player1Midfield, defense: b.result.player1Defense,
              chemistry: b.result.player1Chemistry,
            },
            score2: {
              totalRating: b.result.player2Rating, attack: b.result.player2Attack,
              midfield: b.result.player2Midfield, defense: b.result.player2Defense,
              chemistry: b.result.player2Chemistry,
            },
            eloChange1: b.result.eloChange1,
            eloChange2: b.result.eloChange2,
            winnerId: b.result.winnerId,
            myAchievements: [],
          }),
          formation1: (live && live.formation1) || b.formation1 || '4-3-3',
          formation2: (live && live.formation2) || b.formation2 || '4-3-3',
          team1: live?.team1?.length ? live.team1 : team1,
          team2: live?.team2?.length ? live.team2 : team2,
        });
      })
      .catch(() => navigate('/lobby'))
      .finally(() => setLoading(false));
  }, [battleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speeldag-voor-speeldag reveal
  useEffect(() => {
    if (!revealing || !data?.season1) return;
    intervalRef.current = setInterval(() => {
      setMatchday(prev => {
        if (prev >= 38) {
          clearInterval(intervalRef.current);
          setRevealing(false);
          return 38;
        }
        return prev + 1;
      });
    }, REVEAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [revealing, data]);

  // Rematch-flow
  useEffect(() => {
    if (!socket) return;
    const onAccepted = ({ battleId: newId }) => navigate(`/battle/${newId}`);
    const onDeclined = ({ by }) => {
      setRematchPending(false);
      addToast(`${by} weigerde de rematch`, 'info');
    };
    const onReceived = ({ from, battleId: newId, mode, rematch }) => {
      setIncomingChallenge({ from, battleId: newId, mode, rematch });
    };
    const onError = ({ message }) => {
      setRematchPending(false);
      addToast(message);
    };
    socket.on('challenge:accepted', onAccepted);
    socket.on('challenge:declined', onDeclined);
    socket.on('challenge:received', onReceived);
    socket.on('error', onError);
    return () => {
      socket.off('challenge:accepted', onAccepted);
      socket.off('challenge:declined', onDeclined);
      socket.off('challenge:received', onReceived);
      socket.off('error', onError);
    };
  }, [socket, navigate, addToast]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-spin">⚽</div>
          <p className="text-gray-400">Resultaat laden...</p>
        </div>
      </div>
    );
  }

  if (!data.season1 || !data.season1.matches) {
    // Oude battle zonder seizoensdata
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Voor deze battle is geen seizoensdata beschikbaar.</p>
        <button onClick={() => navigate('/lobby')} className="btn-primary px-6 py-2">Terug naar lobby</button>
      </div>
    );
  }

  const isP1 = data.player1Id === user?.id;
  const myName = user?.username;
  const oppName = isP1 ? data.player2?.username : data.player1?.username;

  const mySeason  = isP1 ? data.season1 : data.season2;
  const oppSeason = isP1 ? data.season2 : data.season1;
  const myTier    = isP1 ? data.tier1 : data.tier2;
  const oppTier   = isP1 ? data.tier2 : data.tier1;
  const myStats   = isP1 ? data.score1 : data.score2;
  const oppStats  = isP1 ? data.score2 : data.score1;
  const myElo     = isP1 ? data.eloChange1 : data.eloChange2;
  const myTeam    = isP1 ? data.team1 : data.team2;
  const oppTeam   = isP1 ? data.team2 : data.team1;
  const myFormation  = isP1 ? data.formation1 : data.formation2;
  const oppFormation = isP1 ? data.formation2 : data.formation1;

  const done = matchday >= 38;
  const won = data.winnerId === user?.id;
  const drew = data.winnerId === null;
  const ts = TIER_STYLES[myTier] || TIER_STYLES['Midtable'];

  const replay = () => { setMatchday(0); setRevealing(true); };
  const skip = () => { clearInterval(intervalRef.current); setMatchday(38); setRevealing(false); };
  const rematch = () => {
    if (!socket || rematchPending) return;
    setRematchPending(true);
    socket.emit('challenge:rematch', { battleId });
    addToast(`Rematch-uitdaging gestuurd naar ${oppName}`, 'info');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Toasts toasts={toasts} />
      {done && won && <Confetti />}

      {/* Inkomende (rematch-)uitdaging */}
      {incomingChallenge && (
        <div className="mb-4 bg-gold-500/10 border border-gold-500 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-in">
          <p className="text-gray-300 text-sm">
            {incomingChallenge.rematch ? '🔄' : '⚔️'} <strong className="text-white">{incomingChallenge.from.username}</strong>{' '}
            wil een {incomingChallenge.rematch ? 'rematch' : 'battle'} ({incomingChallenge.mode === 'EXPERT' ? 'Expert' : 'Classic'})!
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { socket?.emit('challenge:accept', { battleId: incomingChallenge.battleId }); setIncomingChallenge(null); }}
              className="btn-primary px-4 py-2 text-sm"
            >
              ✅ Accepteren
            </button>
            <button
              onClick={() => { socket?.emit('challenge:decline', { battleId: incomingChallenge.battleId }); setIncomingChallenge(null); }}
              className="btn-danger px-4 py-2 text-sm"
            >
              ❌ Weigeren
            </button>
          </div>
        </div>
      )}

      {/* SEIZOENSSIMULATIE */}
      <div className="text-center mb-5">
        {!done ? (
          <>
            <h1 className="text-2xl font-black text-white mb-1">📺 Het seizoen wordt gespeeld...</h1>
            <p className="text-grass-400 font-bold text-lg">Speeldag {matchday}/38</p>
          </>
        ) : (
          <div className="animate-fade-in">
            <div className="text-6xl mb-2">{drew ? '🤝' : won ? '🏆' : '💀'}</div>
            <h1 className={`text-4xl font-black mb-1 ${drew ? 'text-gray-300' : won ? 'text-grass-400' : 'text-red-400'}`}>
              {drew ? 'GELIJKSPEL' : won ? 'GEWONNEN!' : 'VERLOREN'}
            </h1>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-bold uppercase mt-1 ${ts.text} ${ts.border} ${ts.bg}`}>
              <span>{ts.emoji}</span> Jouw seizoen: {myTier}
            </div>
            {data.practice ? (
              <p className="text-sm font-semibold mt-2 text-gray-400">
                🤖 Oefenpotje — telt niet mee voor je ELO of stats
              </p>
            ) : (
              <p className={`text-lg font-bold mt-2 ${myElo >= 0 ? 'text-grass-400' : 'text-red-400'}`}>
                ELO {myElo >= 0 ? '+' : ''}{myElo}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Live standen */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SeasonTally name={myName} season={mySeason} upTo={matchday} color="text-grass-400" />
        <SeasonTally name={oppName} season={oppSeason} upTo={matchday} color="text-gold-400" />
      </div>

      {!done && (
        <div className="text-center mb-6">
          <button onClick={skip} className="btn-secondary px-6 py-2 text-sm">⏭️ Sla over</button>
        </div>
      )}

      {/* EINDOVERZICHT */}
      {done && (
        <div className="animate-fade-in">
          {/* Onderlinge duels */}
          {mySeason.matches.some(m => m.derby) && (
            <div className="card mb-4 border-gold-500/60">
              <h3 className="font-bold text-gold-400 text-sm mb-2">⚔️ De onderlinge duels</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mySeason.matches.map((m, i) => ({ ...m, day: i + 1 })).filter(m => m.derby).map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-between ${
                      m.res === 'W' ? 'bg-grass-500/15 text-grass-300'
                      : m.res === 'D' ? 'bg-gray-500/15 text-gray-300'
                      : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    <span>Speeldag {m.day} · {m.home ? 'thuis' : 'uit'} tegen {m.opp}</span>
                    <span className="font-black">{m.gf} - {m.ga}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {data.myAchievements?.length > 0 && (
            <div className="card mb-4 border-gold-500/50">
              <h3 className="font-bold text-gold-400 text-sm mb-2">🏅 Nieuwe achievements!</h3>
              <div className="flex flex-wrap gap-2">
                {data.myAchievements.map((a, i) => (
                  <div key={i} className="bg-pitch-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-xl">{a.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-white">{a.name}</p>
                      <p className="text-[10px] text-gray-400">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teamsterkte vergelijking */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { name: myName, tier: myTier, stats: myStats, isMe: true },
              { name: oppName, tier: oppTier, stats: oppStats, isMe: false },
            ].map(p => {
              const pts2 = TIER_STYLES[p.tier] || TIER_STYLES['Midtable'];
              return (
                <div key={p.name} className={`card border-2 ${p.isMe ? 'border-grass-500' : 'border-gold-500/50'}`}>
                  <h3 className={`font-bold mb-2 text-sm ${p.isMe ? 'text-grass-400' : 'text-gold-400'}`}>{p.name}</h3>
                  <div className={`inline-block px-2 py-0.5 rounded-full border text-xs font-bold uppercase mb-3 ${pts2.text} ${pts2.border} ${pts2.bg}`}>
                    {pts2.emoji} {p.tier}
                  </div>
                  <div className="space-y-1.5">
                    <StatBar label="Rating"   value={p.stats.totalRating} max={99} color="bg-white/30" />
                    <StatBar label="Aanval"   value={p.stats.attack}      max={99} color="bg-red-500" />
                    <StatBar label="Midveld"  value={p.stats.midfield}    max={99} color="bg-emerald-500" />
                    <StatBar label="Verdedig" value={p.stats.defense}     max={99} color="bg-blue-500" />
                    <StatBar label="Chemie"   value={p.stats.chemistry}   max={10} color="bg-gold-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Elftallen op het veld */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="card p-3">
              <h3 className="font-bold text-grass-400 text-sm mb-2">{myName} · {myFormation}</h3>
              <PitchView formation={myFormation} players={myTeam} />
            </div>
            <div className="card p-3">
              <h3 className="font-bold text-gold-400 text-sm mb-2">{oppName} · {oppFormation}</h3>
              <PitchView formation={oppFormation} players={oppTeam} accent="gold" />
            </div>
          </div>

          {/* Acties */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={rematch} disabled={rematchPending} className="btn-gold px-8 py-3 text-base disabled:opacity-50">
              {rematchPending ? '⏳ Wachten op antwoord...' : '🔄 Rematch'}
            </button>
            <button onClick={replay} className="btn-secondary px-6 py-3 text-base">
              📺 Seizoen opnieuw afspelen
            </button>
            <button onClick={() => navigate('/lobby')} className="btn-primary px-8 py-3 text-base">
              🏟️ Terug naar lobby
            </button>
            <Link to="/leaderboard" className="btn-secondary px-6 py-3 text-base text-center">
              🏆 Leaderboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
