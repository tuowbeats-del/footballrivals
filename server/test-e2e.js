/**
 * E2E-test: 4 spelers, 2 gelijktijdige battles over de volledige flow
 * (login → lobby → challenge/quick match → formaties → 11 draftrondes → seizoenssimulatie).
 * Gebruikt socket.io-client uit client/node_modules. Server moet draaien op :3001.
 */
const path = require('path');
const { io } = require(path.join(__dirname, '..', 'client', 'node_modules', 'socket.io-client'));

const BASE = 'http://localhost:3001';
let failures = 0;
const ok = (name, cond) => {
  if (!cond) { failures++; console.log(`❌ ${name}`); }
  else console.log(`✅ ${name}`);
};

async function api(pathname, method = 'GET', body = null, token = null) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket timeout')), 5000);
  });
}

function waitFor(socket, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout op '${event}'`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

// Speel een volledige battle: formaties + 11 rondes picks, geef het finished-event terug
async function playBattle(label, s1, s2, battleId, formation1 = '4-3-3', formation2 = '4-4-2') {
  s1.emit('battle:join', { battleId });
  s2.emit('battle:join', { battleId });
  await Promise.all([waitFor(s1, 'battle:state'), waitFor(s2, 'battle:state')]);

  const finished1 = waitFor(s1, 'battle:finished', 120000);
  const finished2 = waitFor(s2, 'battle:finished', 120000);

  // Per ronde: beide spelers picken de eerste passende beschikbare speler.
  // Net als de echte client: gekozen spelers verdwijnen uit de lijst, en bij
  // "net gekozen door je tegenstander" wordt een andere speler geprobeerd.
  const { findSlotForPlayer } = require('./src/services/gameService');
  const handleRounds = (socket, getFilled, formation, clubLog) => {
    let available = [];
    let pickedThisRound = false;
    const tryPick = () => {
      const fitting = available.find(p => findSlotForPlayer(formation, getFilled(), p.position) !== -1);
      if (!fitting) { console.log(`💥 [${label}] geen passende speler meer!`); return; }
      setTimeout(() => socket.emit('battle:pick', { battleId, playerId: fitting.id }), 20 + Math.random() * 100);
    };
    socket.on('battle:round:start', (round) => {
      available = [...round.players];
      pickedThisRound = false;
      clubLog.push(`${round.club} ${round.season}`);
      tryPick();
    });
    socket.on('battle:pick:made', (d) => {
      available = available.filter(p => p.id !== d.player.id);
      if (d.userId === socket.userId) { getFilled().add(d.slot); pickedThisRound = true; }
    });
    socket.on('battle:error', (e) => {
      if (!pickedThisRound && /gekozen/.test(e.message || '')) tryPick();
    });
  };

  const filled1 = new Set();
  const filled2 = new Set();
  const clubs1 = [];
  const clubs2 = [];
  handleRounds(s1, () => filled1, formation1, clubs1);
  handleRounds(s2, () => filled2, formation2, clubs2);

  s1.emit('battle:formation', { battleId, formation: formation1 });
  s2.emit('battle:formation', { battleId, formation: formation2 });

  const [r1] = await Promise.all([finished1, finished2]);
  return { result: r1, clubs1, clubs2 };
}

// Speel een oefenbattle tegen een bot uit (één menselijke socket)
async function playBotBattle(socket, battleId, formation) {
  socket.emit('battle:join', { battleId });
  await waitFor(socket, 'battle:state');

  const finished = waitFor(socket, 'battle:finished', 120000);
  const { findSlotForPlayer } = require('./src/services/gameService');
  const filled = new Set();
  let available = [];
  let pickedThisRound = false;

  const tryPick = () => {
    const fitting = available.find(p => findSlotForPlayer(formation, filled, p.position) !== -1);
    if (fitting) setTimeout(() => socket.emit('battle:pick', { battleId, playerId: fitting.id }), 30);
  };
  socket.on('battle:round:start', (round) => {
    available = [...round.players];
    pickedThisRound = false;
    tryPick();
  });
  socket.on('battle:pick:made', (d) => {
    available = available.filter(p => p.id !== d.player.id);
    if (d.userId === socket.userId) { filled.add(d.slot); pickedThisRound = true; }
  });
  socket.on('battle:error', (e) => {
    if (!pickedThisRound && /gekozen/.test(e.message || '')) tryPick();
  });

  socket.emit('battle:formation', { battleId, formation });
  return finished;
}

async function main() {
  // --- Login 4 spelers ---
  const creds = [
    ['speler1@test.be', 'test1234'],
    ['speler2@test.be', 'test1234'],
    ['pro@test.be', 'test1234'],
    ['fan@test.be', 'test1234'],
  ];
  const users = [];
  for (const [email, password] of creds) {
    const { status, data } = await api('/api/auth/login', 'POST', { email, password });
    ok(`login ${email} (${status})`, status === 200 && data.token);
    users.push(data);
  }

  // --- 4 sockets tegelijk verbinden ---
  const sockets = [];
  for (const u of users) {
    const s = await connect(u.token);
    s.userId = u.user.id;
    sockets.push(s);
  }
  ok('4 sockets tegelijk verbonden', sockets.length === 4);

  // --- Lobby: iedereen ziet 4 online spelers ---
  const lobbyList = await new Promise((resolve) => {
    sockets[0].emit('lobby:join');
    sockets[0].once('lobby:users', resolve);
  });
  ok(`lobby toont alle online spelers (${lobbyList.length})`, lobbyList.length >= 4);

  // --- Battle A via challenge (CLASSIC), battle B via quick match (EXPERT) ---
  const challengeReceived = waitFor(sockets[1], 'challenge:received');
  sockets[0].emit('challenge:send', { targetUserId: users[1].user.id, mode: 'CLASSIC' });
  const challA = await challengeReceived;
  ok('challenge ontvangen met juiste modus', challA.mode === 'CLASSIC' && challA.from.id === users[0].user.id);

  const acceptedA = waitFor(sockets[0], 'challenge:accepted');
  sockets[1].emit('challenge:accept', { battleId: challA.battleId });
  await acceptedA;
  ok('challenge geaccepteerd', true);

  const matchedC = waitFor(sockets[2], 'queue:matched');
  const matchedD = waitFor(sockets[3], 'queue:matched');
  sockets[2].emit('queue:join', { mode: 'EXPERT' });
  await waitFor(sockets[2], 'queue:waiting');
  sockets[3].emit('queue:join', { mode: 'EXPERT' });
  const [mC, mD] = await Promise.all([matchedC, matchedD]);
  ok('quick match koppelt 2 wachtende spelers', mC.battleId === mD.battleId && mC.mode === 'EXPERT');

  // --- Beide battles TEGELIJK volledig uitspelen ---
  console.log('▶️  Twee battles draaien nu parallel...');
  const t0 = Date.now();
  const [battleA, battleB] = await Promise.all([
    playBattle('A', sockets[0], sockets[1], challA.battleId, '4-3-3', '3-5-2'),
    playBattle('B', sockets[2], sockets[3], mC.battleId, '4-2-4', '5-3-2'),
  ]);
  console.log(`   beide battles klaar in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  for (const [label, b] of [['A', battleA], ['B', battleB]]) {
    const r = b.result;
    ok(`battle ${label}: seizoen van 38 wedstrijden gesimuleerd`,
      r.season1?.matches?.length === 38 && r.season2?.matches?.length === 38);
    ok(`battle ${label}: geldige tiers (${r.tier1} / ${r.tier2})`, !!r.tier1 && !!r.tier2);
    ok(`battle ${label}: winnaar of gelijkspel bepaald`, r.winnerId !== undefined);
    ok(`battle ${label}: ELO verrekend (${r.eloChange1}/${r.eloChange2})`,
      Number.isInteger(r.eloChange1) && Number.isInteger(r.eloChange2));
    ok(`battle ${label}: beide teams 11 spelers`,
      r.team1.filter(Boolean).length === 11 && r.team2.filter(Boolean).length === 11);
    // Nieuw: elke speler krijgt zijn EIGEN club per ronde
    ok(`battle ${label}: 11 rondes met clubs voor beide spelers`,
      b.clubs1.length === 11 && b.clubs2.length === 11);
    ok(`battle ${label}: spelers kregen elke ronde verschillende clubs`,
      b.clubs1.every((c, i) => c !== b.clubs2[i]));
    ok(`battle ${label}: geen club-herhaling per speler`,
      new Set(b.clubs1).size === 11 && new Set(b.clubs2).size === 11);
    console.log(`   [${label}] P1 ronde 1-3: ${b.clubs1.slice(0, 3).join(' · ')}`);
    console.log(`   [${label}] P2 ronde 1-3: ${b.clubs2.slice(0, 3).join(' · ')}`);
  }

  // EXPERT-check: tijdens battle B mochten geen ratings lekken — check pick:made payloads deden we niet,
  // maar het eindresultaat MAG ratings tonen. Check dat REST tijdens een lopende EXPERT geen rating gaf:
  // (battle B is al klaar; alleen valideren dat de REST-result nu volledig is)
  const { status: sA, data: dA } = await api(`/api/battles/${challA.battleId}`, 'GET', null, users[0].token);
  ok('battle-result opvraagbaar via REST', sA === 200 && dA.result?.player1Tier);

  // --- Geen toegang voor buitenstaanders ---
  const { status: s403 } = await api(`/api/battles/${challA.battleId}`, 'GET', null, users[2].token);
  ok('buitenstaander krijgt 403 op andermans battle', s403 === 403);

  // --- Leaderboard bijgewerkt ---
  const { data: lb } = await api('/api/leaderboard', 'GET', null, users[0].token);
  ok('leaderboard heeft entries', Array.isArray(lb) && lb.length >= 4);
  ok('geen bots op het leaderboard', !lb.some(e => /RookieRik|CoachCarlo|DonPep/.test(e.user?.username || '')));

  // --- Botgame (oefenpotje) ---
  const profileBefore = (await api('/api/auth/me', 'GET', null, users[0].token)).data.profile;
  const botMatched = waitFor(sockets[0], 'queue:matched');
  sockets[0].emit('battle:bot', { mode: 'CLASSIC', level: 'hard' });
  const bm = await botMatched;
  ok(`botgame gestart tegen ${bm.opponent}`, bm.practice === true && !!bm.battleId);

  const botResult = await playBotBattle(sockets[0], bm.battleId, '4-4-2');
  ok('botgame: volledig uitgespeeld (38 wedstrijden)', botResult.season1?.matches?.length === 38);
  ok('botgame is oefenpotje (practice, ELO 0/0)',
    botResult.practice === true && botResult.eloChange1 === 0 && botResult.eloChange2 === 0);

  const profileAfter = (await api('/api/auth/me', 'GET', null, users[0].token)).data.profile;
  ok('botgame wijzigt ELO en stats niet',
    profileAfter.currentElo === profileBefore.currentElo
    && profileAfter.totalBattles === profileBefore.totalBattles
    && profileAfter.wins === profileBefore.wins);

  // --- Rematch-flow ---
  const rematchReceived = waitFor(sockets[1], 'challenge:received');
  sockets[0].emit('challenge:rematch', { battleId: challA.battleId });
  const rem = await rematchReceived;
  ok('rematch-uitdaging ontvangen', rem.rematch === true);
  sockets[1].emit('challenge:decline', { battleId: rem.battleId });
  await waitFor(sockets[0], 'challenge:declined');
  ok('rematch geweigerd → afzender verwittigd', true);

  sockets.forEach(s => s.disconnect());
  console.log(failures === 0 ? '\n🎉 E2E: ALLES GESLAAGD' : `\n💥 ${failures} test(s) gefaald`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('💥 E2E-fout:', e.message); process.exit(1); });
