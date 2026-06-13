import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import PitchView from '../components/PitchView';
import { Toasts, useToasts } from '../components/shared/Toasts';
import {
  FORMATION_NAMES, findSlotForPlayer, POS_COLORS, getRatingColor, posLabel,
} from '../utils/formations';

export default function BattlePage() {
  const { id } = useParams();
  const battleId = parseInt(id);
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { toasts, addToast } = useToasts();

  const [status, setStatus] = useState('loading');
  const [mode, setMode] = useState('CLASSIC');
  const [practice, setPractice] = useState(false);
  const [players12, setPlayers12] = useState({ player1: null, player2: null });
  const [myFormation, setMyFormation] = useState(null);     // bevestigd door server
  const [chosenFormation, setChosenFormation] = useState(''); // lokaal geselecteerd
  const [oppFormation, setOppFormation] = useState(null);
  const [myTeam, setMyTeam] = useState({});   // slot -> speler
  const [oppTeam, setOppTeam] = useState({});
  const [spinning, setSpinning] = useState(false);
  const [spinText, setSpinText] = useState('');
  const [currentRound, setCurrentRound] = useState(null);
  const [players, setPlayers] = useState([]);
  const [pickPending, setPickPending] = useState(false);
  const [iHavePicked, setIHavePicked] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(-1);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const spinTimerRef = useRef(null);
  // Spelers die deze ronde al gekozen zijn (ook tijdens de spin-animatie)
  const pickedIdsRef = useRef(new Set());

  const isP1 = players12.player1?.id === user?.id;
  const me = isP1 ? players12.player1 : players12.player2;
  const opp = isP1 ? players12.player2 : players12.player1;
  const myFilled = useMemo(() => new Set(Object.keys(myTeam).map(Number)), [myTeam]);

  // Chatgeschiedenis via REST; alle battle-state komt via de socket
  useEffect(() => {
    api.get(`/chat/battle/${battleId}`)
      .then(res => setChatMessages(res.data.map(m => ({ ...m, username: m.user?.username }))))
      .catch(() => {});
  }, [battleId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('battle:join', { battleId });

    const applyTeams = (picks, setter) => {
      const team = {};
      for (const p of picks) team[p.slot] = p.player;
      setter(team);
    };

    // Volledige state (eerste join én herstel na refresh/herstart)
    const onState = (data) => {
      setStatus(data.status);
      setMode(data.mode);
      setPractice(!!data.practice);
      setPlayers12({ player1: data.player1, player2: data.player2 });

      const amP1 = data.player1?.id === user?.id;
      setMyFormation(amP1 ? data.formation1 : data.formation2);
      setOppFormation(amP1 ? data.formation2 : data.formation1);
      applyTeams(data.myPicks || [], setMyTeam);
      applyTeams(data.oppPicks || [], setOppTeam);
      setIHavePicked(!!data.iHavePicked);

      if (data.round) {
        setCurrentRound(data.round);
        setPlayers(data.round.players || []);
        setDeadline(data.round.deadline || null);
      }

      if (data.status === 'FINISHED') {
        navigate(`/result/${battleId}`);
      }
      if (data.status === 'CANCELLED') {
        addToast('Deze battle is geannuleerd', 'info');
        navigate('/lobby');
      }
    };

    const onFormationSet = ({ userId, formation }) => {
      if (userId === user?.id) setMyFormation(formation);
      else setOppFormation(formation);
    };

    const onRoundStart = (data) => {
      setIHavePicked(false);
      setPickPending(false);
      setPlayers([]);
      pickedIdsRef.current = new Set();
      setStatus('DRAFTING');
      setDeadline(data.deadline || null);

      // Spin-animatie, daarna de club onthullen
      const spinMessages = ['🎰 Spinnen...', '🏟️ Club kiezen...', '📅 Seizoen kiezen...'];
      let i = 0;
      setSpinning(true);
      setSpinText(spinMessages[0]);
      const interval = setInterval(() => {
        i++;
        setSpinText(spinMessages[i % spinMessages.length]);
      }, 400);

      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        clearInterval(interval);
        setSpinning(false);
        setCurrentRound(data);
        // Picks die tijdens de spin-animatie binnenkwamen niet opnieuw tonen
        setPlayers((data.players || []).filter(p => !pickedIdsRef.current.has(p.id)));
      }, 2000);
    };

    const onPickMade = ({ userId, slot, player }) => {
      // Gekozen speler direct uit de keuzelijst halen (voor beide spelers)
      pickedIdsRef.current.add(player.id);
      setPlayers(prev => prev.filter(p => p.id !== player.id));
      if (userId === user?.id) {
        setMyTeam(prev => ({ ...prev, [slot]: player }));
        setIHavePicked(true);
        setPickPending(false);
      } else {
        setOppTeam(prev => ({ ...prev, [slot]: player }));
      }
    };

    const onAutopick = ({ userId }) => {
      addToast(
        userId === user?.id
          ? '⏰ Tijd om! Het systeem koos voor jou.'
          : '⏰ Tijd om — tegenstander kreeg een autopick.',
        'info',
      );
    };

    const onFinished = (result) => {
      navigate(`/result/${battleId}`, { state: result });
    };

    const onCancelled = ({ message }) => {
      addToast(message || 'Battle geannuleerd', 'info');
      setTimeout(() => navigate('/lobby'), 1200);
    };

    const onChatMsg = (msg) => setChatMessages(prev => [...prev.slice(-99), msg]);

    const onError = ({ message }) => {
      addToast(message);
      setPickPending(false);
    };

    socket.on('battle:state', onState);
    socket.on('battle:formation:set', onFormationSet);
    socket.on('battle:round:start', onRoundStart);
    socket.on('battle:pick:made', onPickMade);
    socket.on('battle:autopick', onAutopick);
    socket.on('battle:finished', onFinished);
    socket.on('battle:cancelled', onCancelled);
    socket.on('battle:chat:message', onChatMsg);
    socket.on('battle:error', onError);

    return () => {
      clearTimeout(spinTimerRef.current);
      socket.off('battle:state', onState);
      socket.off('battle:formation:set', onFormationSet);
      socket.off('battle:round:start', onRoundStart);
      socket.off('battle:pick:made', onPickMade);
      socket.off('battle:autopick', onAutopick);
      socket.off('battle:finished', onFinished);
      socket.off('battle:cancelled', onCancelled);
      socket.off('battle:chat:message', onChatMsg);
      socket.off('battle:error', onError);
    };
  }, [socket, battleId, user?.id, navigate, addToast]);

  // Countdown op basis van server-deadline
  useEffect(() => {
    if (!deadline) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const submitFormation = () => {
    if (!chosenFormation || !socket) return;
    socket.emit('battle:formation', { battleId, formation: chosenFormation });
  };

  const pickPlayer = (player) => {
    if (pickPending || iHavePicked || !socket) return;
    if (myFormation && findSlotForPlayer(myFormation, myFilled, player.position) === -1) {
      addToast(`Een ${posLabel(player.position)} past niet meer in jouw ${myFormation}`);
      return;
    }
    setPickPending(true);
    socket.emit('battle:pick', { battleId, playerId: player.id });
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('battle:chat', { battleId, message: chatInput.trim() });
    setChatInput('');
  };

  const forfeit = () => {
    if (!socket) return;
    if (window.confirm('Weet je zeker dat je deze battle wilt verlaten?')) {
      socket.emit('battle:forfeit', { battleId });
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⚽</div>
          <p className="text-gray-400 animate-pulse">Battle laden...</p>
        </div>
      </div>
    );
  }

  const inFormationPhase = !spinning && (status === 'FORMATION_SELECT' || status === 'PENDING');
  const timerPct = secondsLeft !== null ? Math.min(100, (secondsLeft / 60) * 100) : 0;
  const myPickCount = Object.keys(myTeam).length;
  const oppPickCount = Object.keys(oppTeam).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <Toasts toasts={toasts} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 text-lg font-bold">
          <span className="text-grass-400">{me?.username}</span>
          <span className="text-gray-500 text-base">⚔️</span>
          <span className="text-gold-400">{opp?.username}</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            mode === 'EXPERT'
              ? 'border-purple-400 text-purple-300 bg-purple-400/10'
              : 'border-grass-500 text-grass-400 bg-grass-500/10'
          }`}>
            {mode}
          </span>
          {practice && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-500 text-gray-400 bg-gray-500/10">
              🤖 OEFENPOTJE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentRound && (
            <div className="bg-pitch-700 px-3 py-1.5 rounded-full border border-grass-500/30 text-sm">
              <span className="text-grass-400 font-bold">Ronde {currentRound.round}/{currentRound.totalRounds || 11}</span>
              {myFormation && <span className="text-gray-500 ml-2">| {myFormation}</span>}
            </div>
          )}
          <button onClick={forfeit} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
            Verlaten
          </button>
        </div>
      </div>

      {/* SPIN OVERLAY */}
      {spinning && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-7xl mb-6 animate-spin">⚽</div>
            <p className="text-3xl font-black text-grass-400 animate-pulse mb-2">{spinText}</p>
            <p className="text-gray-400">Welke club & seizoen wordt het?</p>
          </div>
        </div>
      )}

      {/* FORMATIE KIEZEN */}
      {inFormationPhase && !myFormation && (
        <div className="max-w-lg mx-auto card mb-6 text-center">
          <h2 className="text-xl font-bold text-grass-400 mb-1">🏟️ Kies je formatie</h2>
          <p className="text-gray-400 text-sm mb-4">
            Strikt draften: spelers passen alleen op posities in hun eigen zone!
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {FORMATION_NAMES.map(f => (
              <button
                key={f}
                onClick={() => setChosenFormation(f)}
                className={`p-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  chosenFormation === f
                    ? 'border-grass-500 bg-grass-500/20 text-grass-400 scale-105'
                    : 'border-pitch-600 text-gray-400 hover:border-grass-500/50 hover:text-grass-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {chosenFormation && (
            <div className="max-w-[260px] mx-auto mb-5">
              <PitchView formation={chosenFormation} compact />
            </div>
          )}
          <button
            onClick={submitFormation}
            disabled={!chosenFormation}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            ✅ Bevestig formatie
          </button>
        </div>
      )}

      {/* Wachten op tegenstander */}
      {inFormationPhase && myFormation && !oppFormation && (
        <div className="max-w-lg mx-auto card mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-5 h-5 border-2 border-grass-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-300 font-medium">Wachten op <span className="text-gold-400">{opp?.username}</span>...</p>
          </div>
          <p className="text-gray-500 text-sm mb-4">Jouw formatie: <span className="text-grass-400 font-bold">{myFormation}</span></p>
          <div className="max-w-[260px] mx-auto">
            <PitchView formation={myFormation} compact />
          </div>
        </div>
      )}

      {/* DRAFT FASE */}
      {currentRound && !spinning && status === 'DRAFTING' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Mijn veld */}
          <div className="xl:col-span-1 order-2 xl:order-1">
            <div className="card p-3">
              <h3 className="font-bold text-grass-400 mb-2 text-sm flex items-center justify-between">
                <span>Mijn team</span>
                <span className="text-gray-500">{myPickCount}/11</span>
              </h3>
              <PitchView formation={myFormation} players={myTeam} highlightSlot={hoverSlot} />
            </div>
            <div className="card p-3 mt-3">
              <h3 className="font-bold text-gold-400 mb-2 text-sm flex items-center justify-between">
                <span>{opp?.username}</span>
                <span className="text-gray-500">{oppPickCount}/11</span>
              </h3>
              {oppFormation && <PitchView formation={oppFormation} players={oppTeam} accent="gold" compact />}
            </div>
          </div>

          {/* Spelerskeuze */}
          <div className="xl:col-span-2 space-y-3 order-1 xl:order-2">
            {/* Club + timer */}
            <div className="card py-3">
              <div className="text-center mb-2">
                <p className="text-grass-400 text-xs font-bold uppercase tracking-wide">Jouw club deze ronde</p>
                <h2 className="text-xl font-black text-gold-400">{currentRound.club}</h2>
                <p className="text-gray-400 text-sm">Seizoen {currentRound.season}</p>
                {currentRound.oppClub && (
                  <p className="text-gray-500 text-xs mt-1">
                    {opp?.username} draft uit <span className="text-gold-400/80 font-semibold">{currentRound.oppClub} {currentRound.oppSeason}</span>
                  </p>
                )}
              </div>
              {secondsLeft !== null && !iHavePicked && (
                <div className="px-2">
                  <div className="bg-pitch-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        secondsLeft <= 10 ? 'bg-red-500' : secondsLeft <= 25 ? 'bg-gold-500' : 'bg-grass-500'
                      }`}
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                  <p className={`text-center text-xs mt-1 font-bold ${secondsLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-gray-500'}`}>
                    ⏱️ {secondsLeft}s
                  </p>
                </div>
              )}
              {iHavePicked && (
                <p className="text-grass-400 text-sm font-semibold text-center animate-pulse">
                  ✅ Pick gemaakt — wachten op {opp?.username}...
                </p>
              )}
            </div>

            {/* Spelersgrid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {players.map(p => {
                const fits = myFormation ? findSlotForPlayer(myFormation, myFilled, p.position) !== -1 : true;
                const disabled = iHavePicked || pickPending || !fits;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickPlayer(p)}
                    onMouseEnter={() => fits && setHoverSlot(findSlotForPlayer(myFormation, myFilled, p.position))}
                    onMouseLeave={() => setHoverSlot(-1)}
                    disabled={disabled}
                    className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                      disabled
                        ? 'border-pitch-600 opacity-40 cursor-not-allowed'
                        : 'border-pitch-600 hover:border-grass-500 hover:bg-grass-500/10 cursor-pointer active:scale-95'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POS_COLORS[p.position] || 'bg-gray-600 text-white'}`}>
                        {posLabel(p.position)}
                      </span>
                      {typeof p.rating === 'number'
                        ? <span className={`font-black text-base ${getRatingColor(p.rating)}`}>{p.rating}</span>
                        : <span className="font-black text-base text-purple-400">?</span>}
                    </div>
                    <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate">{p.nationality}</p>
                    {typeof p.pace === 'number' && (
                      <div className="mt-1.5 grid grid-cols-3 gap-0.5 text-center">
                        {[['PAC', p.pace], ['SHO', p.shooting], ['PAS', p.passing]].map(([l, v]) => (
                          <div key={l} className="text-center">
                            <div className="text-gray-500 text-xs leading-none">{l}</div>
                            <div className="text-xs font-bold text-gray-300">{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!fits && !iHavePicked && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded px-1">
                        past niet
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat */}
          <div className="xl:col-span-1 order-3">
            <div className="card flex flex-col" style={{ height: '500px' }}>
              <h3 className="font-bold text-grass-400 mb-3 flex-shrink-0 text-sm">💬 Battle Chat</h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1">
                {chatMessages.map((msg, i) => {
                  const isMe = msg.userId === user?.id;
                  return (
                    <div key={msg.id || i} className="text-xs">
                      <span className={`font-semibold ${isMe ? 'text-grass-400' : 'text-gold-400'}`}>
                        {msg.username || msg.user?.username}:{' '}
                      </span>
                      <span className="text-gray-300">{msg.message}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="flex gap-1.5 flex-shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Bericht..."
                  maxLength={300}
                  className="input-field flex-1 text-sm py-1.5"
                />
                <button type="submit" className="btn-primary px-3 text-sm py-1.5">➤</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATING */}
      {status === 'CALCULATING' && !spinning && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-spin">⚽</div>
            <p className="text-xl font-bold text-grass-400 animate-pulse">Seizoen wordt gesimuleerd...</p>
          </div>
        </div>
      )}
    </div>
  );
}
