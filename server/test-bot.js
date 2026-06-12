/**
 * Bot-tegenstander voor handmatige tests: logt in als FootballFan,
 * daagt testspeler1 (id 2) uit, kiest een formatie en pickt elke ronde
 * automatisch een passende speler. Sluit af na battle:finished.
 */
const path = require('path');
const { io } = require(path.join(__dirname, '..', 'client', 'node_modules', 'socket.io-client'));
const { findSlotForPlayer } = require('./src/services/gameService');

const BASE = 'http://localhost:3001';
const TARGET_USER_ID = 2; // testspeler1
const FORMATION = '4-4-2';

async function main() {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fan@test.be', password: 'test1234' }),
  });
  const { token, user } = await res.json();
  console.log(`Bot ingelogd als ${user.username} (id ${user.id})`);

  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  await new Promise((r, j) => { socket.on('connect', r); socket.on('connect_error', j); });

  let battleId = null;
  const filled = new Set();
  let available = [];
  let pickedThisRound = false;

  const tryPick = () => {
    const fitting = available.find(p => findSlotForPlayer(FORMATION, filled, p.position) !== -1);
    if (!fitting) return console.log('Bot: geen passende speler!');
    setTimeout(() => socket.emit('battle:pick', { battleId, playerId: fitting.id }), 800);
  };

  // Inkomende uitdagingen direct accepteren
  socket.on('challenge:received', ({ battleId: bid, from }) => {
    console.log(`Bot: uitdaging van ${from.username} → accepteren`);
    socket.emit('challenge:accept', { battleId: bid });
  });

  socket.on('challenge:accepted', ({ battleId: bid }) => {
    battleId = bid;
    console.log(`Bot: battle ${bid} gestart`);
    socket.emit('battle:join', { battleId: bid });
    setTimeout(() => socket.emit('battle:formation', { battleId: bid, formation: FORMATION }), 1000);
  });
  socket.on('challenge:declined', () => { console.log('Bot: geweigerd'); process.exit(0); });
  socket.on('battle:round:start', (round) => {
    available = [...round.players];
    pickedThisRound = false;
    console.log(`Bot: ronde ${round.round} — ${round.club} ${round.season}`);
    tryPick();
  });
  socket.on('battle:pick:made', (d) => {
    available = available.filter(p => p.id !== d.player.id);
    if (d.userId === user.id) { filled.add(d.slot); pickedThisRound = true; }
  });
  socket.on('battle:error', (e) => {
    console.log('Bot battle:error:', e.message);
    if (!pickedThisRound && /gekozen/.test(e.message || '')) tryPick();
  });
  socket.on('battle:finished', (r) => {
    console.log(`Bot: klaar! tiers ${r.tier1}/${r.tier2}, winnaar ${r.winnerId}`);
    setTimeout(() => process.exit(0), 1000);
  });
  socket.on('battle:cancelled', () => { console.log('Bot: battle geannuleerd'); process.exit(0); });

  console.log('Bot: wacht op een uitdaging...');
  socket.on('error', (e) => console.log('Bot error:', e.message));

  // Veiligheidstimeout
  setTimeout(() => { console.log('Bot: timeout (15 min)'); process.exit(1); }, 15 * 60 * 1000);
}

main().catch(e => { console.error(e); process.exit(1); });
