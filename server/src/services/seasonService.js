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
  const lambdaFor = Math.min(4.2, Math.max(0.3, 1.4 + diff * 0.09));
  const lambdaAgainst = Math.min(4.0, Math.max(0.25, 1.4 - diff * 0.09));
  const gf = poisson(lambdaFor);
  const ga = poisson(lambdaAgainst);
  return { gf, ga, res: gf > ga ? 'W' : gf < ga ? 'L' : 'D' };
}

/**
 * Speelt 38 wedstrijden (elke tegenstander thuis en uit, in geschudde volgorde).
 * Geeft { matches, wins, draws, losses, gf, ga, points } terug.
 */
function simulateSeason(teamStrength) {
  const fixtures = [];
  for (const opp of LEAGUE_OPPONENTS) {
    fixtures.push({ opp, home: true });
    fixtures.push({ opp, home: false });
  }
  // Fisher-Yates shuffle voor een willekeurige speelkalender
  for (let i = fixtures.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
  }

  const matches = [];
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;

  for (const { opp, home } of fixtures) {
    const m = simulateMatch(teamStrength, opp.strength, home);
    if (m.res === 'W') wins++;
    else if (m.res === 'D') draws++;
    else losses++;
    gf += m.gf;
    ga += m.ga;
    matches.push({ opp: opp.name, home, gf: m.gf, ga: m.ga, res: m.res });
  }

  return { matches, wins, draws, losses, gf, ga, points: wins * 3 + draws };
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

module.exports = { simulateSeason, getTier, determineWinner, LEAGUE_OPPONENTS };
