// Tijdelijke sanity-test van de spellogica (geen database nodig)
const { FORMATIONS, FORMATION_NAMES, findSlotForPlayer, teamHasFittingPick, calculateScore } = require('./src/services/gameService');
const { simulateSeason, simulateRivalSeasons, getTier, determineWinner } = require('./src/services/seasonService');
const { calculateElo } = require('./src/services/eloService');

let failures = 0;
const check = (name, cond) => {
  if (!cond) { failures++; console.log(`❌ ${name}`); }
  else console.log(`✅ ${name}`);
};

// --- Formaties ---
check('5 formaties, elk 11 slots', FORMATION_NAMES.length === 5
  && FORMATION_NAMES.every(f => FORMATIONS[f].slots.length === 11));

// --- Slot-logica ---
check('GK past alleen op slot 0', findSlotForPlayer('4-3-3', new Set(), 'GK') === 0);
check('GK past niet als slot 0 bezet', findSlotForPlayer('4-3-3', new Set([0]), 'GK') === -1);
check('ST past op ST-slot in 4-3-3', findSlotForPlayer('4-3-3', new Set(), 'ST') === 10);
check('ST valt terug op zone (LW) als ST bezet', findSlotForPlayer('4-3-3', new Set([10]), 'ST') === 8);
check('CAM past op CM-slot (zelfde zone)', findSlotForPlayer('4-3-3', new Set(), 'CAM') >= 5 && findSlotForPlayer('4-3-3', new Set(), 'CAM') <= 7);
check('ST past niet op verdediging', findSlotForPlayer('4-3-3', new Set([8, 9, 10]), 'ST') === -1);

// --- teamHasFittingPick: kan deze speler nog kiezen uit deze selectie? ---
const onlyGkOpen = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // alles behalve slot 0
check('Alleen GK open + squad heeft GK → club past', teamHasFittingPick('4-3-3', onlyGkOpen, ['GK', 'ST']));
check('Alleen GK open + squad zonder GK → club past niet', !teamHasFittingPick('4-3-3', onlyGkOpen, ['ST', 'CB', 'CM']));

// --- Score & sterkte ---
const perfectTeam = FORMATIONS['4-3-3'].slots.map(s => ({ position: s.position, rating: 90 }));
const score = calculateScore(perfectTeam, '4-3-3');
check('Perfect passend team: chemie 10', score.chemistry === 10);
check('Perfect team: sterkte = rating + 2', Math.abs(score.strength - 92) < 0.01);

// --- Seizoenssimulatie: 500 seizoenen per sterkteniveau ---
const avg = (strength, n = 500) => {
  let pts = 0, wins = 0, perfect = 0;
  for (let i = 0; i < n; i++) {
    const s = simulateSeason(strength);
    if (s.matches.length !== 38) { failures++; console.log('❌ seizoen != 38 wedstrijden'); break; }
    const sum = s.wins + s.draws + s.losses;
    if (sum !== 38 || s.points !== s.wins * 3 + s.draws) { failures++; console.log('❌ W/G/V of punten kloppen niet'); break; }
    pts += s.points; wins += s.wins;
    if (s.wins === 38) perfect++;
  }
  return { pts: pts / n, wins: wins / n, perfect };
};

const weak = avg(72), mid = avg(80), strong = avg(88), god = avg(95);
console.log(`   sterkte 72 → gem. ${weak.pts.toFixed(1)} ptn | 80 → ${mid.pts.toFixed(1)} | 88 → ${strong.pts.toFixed(1)} | 95 → ${god.pts.toFixed(1)} (${god.perfect}x perfect)`);
check('Zwak team degradeert (< 50 ptn)', weak.pts < 50);
check('Gemiddeld team is midtable (45-75)', mid.pts > 45 && mid.pts < 75);
check('Sterk team haalt Europees/titel (75-95)', strong.pts > 75 && strong.pts < 95);
check('Godenteam ~kampioen (> 90)', god.pts > 90);
check('Monotoon: meer sterkte = meer punten', weak.pts < mid.pts && mid.pts < strong.pts && strong.pts < god.pts);

// --- Rivaliserende seizoenen (zelfde competitie + onderlinge duels) ---
const rivals = simulateRivalSeasons(85, 85, 'SpelerA', 'SpelerB');
check('rivalen: beide spelen 38 wedstrijden',
  rivals.season1.matches.length === 38 && rivals.season2.matches.length === 38);
const derbies1 = rivals.season1.matches.filter(m => m.derby);
const derbies2 = rivals.season2.matches.filter(m => m.derby);
check('rivalen: precies 2 onderlinge duels per team', derbies1.length === 2 && derbies2.length === 2);
check('rivalen: derby-uitslagen gespiegeld (mijn 2-1 = jouw 1-2)',
  derbies1.every((m, i) => m.gf === derbies2[i].ga && m.ga === derbies2[i].gf && m.home !== derbies2[i].home));
const derbyDays1 = rivals.season1.matches.map((m, i) => (m.derby ? i : -1)).filter(i => i >= 0);
const derbyDays2 = rivals.season2.matches.map((m, i) => (m.derby ? i : -1)).filter(i => i >= 0);
check('rivalen: derby valt voor beiden op dezelfde speeldag', derbyDays1.join() === derbyDays2.join());
check('rivalen: derbynaam is de tegenstander', derbies1[0].opp === 'SpelerB' && derbies2[0].opp === 'SpelerA');

// Realisme: een klein draftvoordeel mag geen gegarandeerde winst zijn
let upsets = 0;
const RUNS = 400;
for (let i = 0; i < RUNS; i++) {
  const { season1, season2 } = simulateRivalSeasons(86, 84);
  if (determineWinner(season1, season2, 1, 2) === 2) upsets++;
}
console.log(`   sterkte 86 vs 84 → underdog wint ${((upsets / RUNS) * 100).toFixed(0)}% van de battles`);
check('underdog (-2 sterkte) stunt geregeld (20-50%)', upsets / RUNS > 0.2 && upsets / RUNS < 0.5);

// --- Tiers ---
check('38 wins = Perfect Season', getTier({ wins: 38, losses: 0, points: 114 }) === 'Perfect Season');
check('Ongeslagen = Invincible', getTier({ wins: 26, losses: 0, points: 90 }) === 'Invincible');
check('90 ptn met verlies = Champion', getTier({ wins: 29, losses: 6, points: 90 }) === 'Champion');
check('40 ptn = Relegation', getTier({ wins: 10, losses: 18, points: 40 }) === 'Relegation');

// --- Winnaarbepaling ---
const s1 = { points: 80, gf: 70, ga: 40 };
const s2 = { points: 75, gf: 90, ga: 20 };
check('Meeste punten wint', determineWinner(s1, s2, 1, 2) === 1);
check('Gelijk: doelsaldo beslist', determineWinner({ points: 80, gf: 70, ga: 40 }, { points: 80, gf: 75, ga: 40 }, 1, 2) === 2);
check('Volledig gelijk = null (gelijkspel)', determineWinner({ points: 80, gf: 70, ga: 40 }, { points: 80, gf: 70, ga: 40 }, 1, 2) === null);

// --- ELO ---
const w = calculateElo(1200, 1200, 1);
check('Gelijke ELO, winst → +16/-16', w.change1 === 16 && w.change2 === -16);
const d = calculateElo(1200, 1200, 0.5);
check('Gelijke ELO, gelijkspel → 0/0', d.change1 === 0 && d.change2 === 0);
const upset = calculateElo(1000, 1400, 1);
check('Underdog wint → grote winst, verliezer verliest evenveel', upset.change1 > 25 && upset.change2 === -upset.change1);

console.log(failures === 0 ? '\n🎉 ALLE TESTS GESLAAGD' : `\n💥 ${failures} test(s) gefaald`);
process.exit(failures === 0 ? 0 : 1);
