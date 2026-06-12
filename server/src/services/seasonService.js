/**
 * Simuleert een volledig Premier League-seizoen van 38 wedstrijden
 * voor een gedraft elftal. Beide spelers krijgen dezelfde 19 tegenstanders
 * (thuis en uit); de uitkomsten hangen af van teamsterkte + wedstrijdgeluk.
 */

// Vaste competitie van 19 tegenstanders met elk een eigen sterkte
const LEAGUE_OPPONENTS = [
  { name: 'Manchester City',   strength: 90 },
  { name: 'Liverpool',         strength: 88 },
  { name: 'Arsenal',           strength: 87 },
  { name: 'Chelsea',           strength: 84 },
  { name: 'Manchester United', strength: 83 },
  { name: 'Tottenham',         strength: 82 },
  { name: 'Newcastle',         strength: 81 },
  { name: 'Aston Villa',       strength: 80 },
  { name: 'Brighton',          strength: 78 },
  { name: 'West Ham',          strength: 77 },
  { name: 'Brentford',         strength: 76 },
  { name: 'Crystal Palace',    strength: 76 },
  { name: 'Fulham',            strength: 75 },
  { name: 'Wolves',            strength: 75 },
  { name: 'Everton',           strength: 74 },
  { name: 'Nottingham Forest', strength: 73 },
  { name: 'Bournemouth',       strength: 72 },
  { name: 'Burnley',           strength: 70 },
  { name: 'Sheffield United',  strength: 68 },
];

// Hoe sterk een ratingverschil doorweegt per wedstrijd: lager = meer stunts
const DIFF_SLOPE = 0.075;
// Seizoensvorm: elk team heeft goede en slechte campagnes (blessures, dipjes)
const SEASON_FORM_RANGE = 2.5;

function poisson(lambda) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > limit);
  return k - 1;
}

function simulateMatch(teamStrength, oppStrength, home) {
  const diff = teamStrength - oppStrength + (home ? 1.5 : -1.5);
  const lambdaFor = Math.min(4.2, Math.max(0.3, 1.4 + diff * DIFF_SLOPE));
  const lambdaAgainst = Math.min(4.0, Math.max(0.25, 1.4 - diff * DIFF_SLOPE));
  const gf = poisson(lambdaFor);
  const ga = poisson(lambdaAgainst);
  return { gf, ga, res: gf > ga ? 'W' : gf < ga ? 'L' : 'D' };
}

const seasonForm = () => (Math.random() * 2 - 1) * SEASON_FORM_RANGE;

function emptyTally() {
  return { matches: [], wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 };
}

function applyResult(tally, opp, home, gf, ga, derby = false) {
  const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  if (res === 'W') tally.wins++;
  else if (res === 'D') tally.draws++;
  else tally.losses++;
  tally.gf += gf;
  tally.ga += ga;
  tally.points = tally.wins * 3 + tally.draws;
  tally.matches.push(derby ? { opp, home, gf, ga, res, derby: true } : { opp, home, gf, ga, res });
}

/**
 * Los seizoen van 38 wedstrijden voor één team (gebruikt voor kalibratie/tests).
 */
function simulateSeason(teamStrength) {
  const fixtures = [];
  for (const opp of LEAGUE_OPPONENTS) {
    fixtures.push({ opp, home: true });
    fixtures.push({ opp, home: false });
  }
  for (let i = fixtures.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
  }

  const effective = teamStrength + seasonForm();
  const tally = emptyTally();
  for (const { opp, home } of fixtures) {
    const m = simulateMatch(effective, opp.strength, home);
    applyResult(tally, opp.name, home, m.gf, m.ga);
  }
  return tally;
}

/**
 * Beide rivalen spelen in DEZELFDE competitie: 36 wedstrijden tegen
 * 18 clubs (thuis + uit) én twee onderlinge duels — op dezelfde speeldagen,
 * met gespiegelde uitslagen. Elk team krijgt een eigen seizoensvorm.
 * Geeft { season1, season2 } terug.
 */
function simulateRivalSeasons(strength1, strength2, name1 = 'Rivaal 1', name2 = 'Rivaal 2') {
  const opponents = LEAGUE_OPPONENTS.slice(0, 18); // 18 clubs + de rivaal = 38 duels
  const eff1 = strength1 + seasonForm();
  const eff2 = strength2 + seasonForm();

  // Gedeelde kalender: de onderlinge duels vallen voor beiden op dezelfde speeldag
  const slots = Array.from({ length: 38 }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const derbySlots = new Set([slots[0], slots[1]]);

  const buildFixtures = () => {
    const list = [];
    for (const opp of opponents) {
      list.push({ opp, home: true });
      list.push({ opp, home: false });
    }
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const fixtures1 = buildFixtures();
  const fixtures2 = buildFixtures();

  const season1 = emptyTally();
  const season2 = emptyTally();
  let derbyCount = 0;

  for (let day = 0; day < 38; day++) {
    if (derbySlots.has(day)) {
      // Onderling duel: één uitslag, gespiegeld voor beide teams
      const team1Home = derbyCount === 0;
      const m = simulateMatch(eff1, eff2, team1Home);
      applyResult(season1, name2, team1Home, m.gf, m.ga, true);
      applyResult(season2, name1, !team1Home, m.ga, m.gf, true);
      derbyCount++;
    } else {
      const f1 = fixtures1.pop();
      const f2 = fixtures2.pop();
      const m1 = simulateMatch(eff1, f1.opp.strength, f1.home);
      const m2 = simulateMatch(eff2, f2.opp.strength, f2.home);
      applyResult(season1, f1.opp.name, f1.home, m1.gf, m1.ga);
      applyResult(season2, f2.opp.name, f2.home, m2.gf, m2.ga);
    }
  }

  return { season1, season2 };
}

/**
 * Tier op basis van het gespeelde seizoen. Onverslagen telt zwaarder dan punten.
 */
function getTier(season) {
  if (season.wins === 38) return 'Perfect Season';
  if (season.losses === 0) return 'Invincible';
  if (season.points >= 90) return 'Champion';
  if (season.points >= 72) return 'European';
  if (season.points >= 50) return 'Midtable';
  return 'Relegation';
}

/**
 * Bepaal de battle-uitkomst: meeste punten wint, daarna doelsaldo,
 * daarna doelpunten voor. Volledig gelijk = gelijkspel (null).
 */
function determineWinner(season1, season2, p1Id, p2Id) {
  if (season1.points !== season2.points) {
    return season1.points > season2.points ? p1Id : p2Id;
  }
  const gd1 = season1.gf - season1.ga;
  const gd2 = season2.gf - season2.ga;
  if (gd1 !== gd2) return gd1 > gd2 ? p1Id : p2Id;
  if (season1.gf !== season2.gf) return season1.gf > season2.gf ? p1Id : p2Id;
  return null; // gelijkspel
}

module.exports = { simulateSeason, simulateRivalSeasons, getTier, determineWinner, LEAGUE_OPPONENTS };
