const K_FACTOR = 32;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * ELO-verandering voor speler 1 en 2.
 * score1: 1 = speler 1 wint, 0.5 = gelijkspel, 0 = speler 2 wint.
 */
function calculateElo(elo1, elo2, score1) {
  const expected1 = expectedScore(elo1, elo2);
  const change1 = Math.round(K_FACTOR * (score1 - expected1));
  const change2 = Math.round(K_FACTOR * ((1 - score1) - (1 - expected1)));
  return { change1, change2 };
}

module.exports = { calculateElo };
