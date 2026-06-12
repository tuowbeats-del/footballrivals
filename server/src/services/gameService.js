const FORMATIONS = {
  '4-3-3': {
    slots: [
      { slot: 0, position: 'GK' },
      { slot: 1, position: 'CB' }, { slot: 2, position: 'CB' },
      { slot: 3, position: 'LB' }, { slot: 4, position: 'RB' },
      { slot: 5, position: 'CM' }, { slot: 6, position: 'CM' }, { slot: 7, position: 'CM' },
      { slot: 8, position: 'LW' }, { slot: 9, position: 'RW' }, { slot: 10, position: 'ST' },
    ],
    defense: [1, 2, 3, 4],
    midfield: [5, 6, 7],
    attack: [8, 9, 10],
  },
  '4-4-2': {
    slots: [
      { slot: 0, position: 'GK' },
      { slot: 1, position: 'CB' }, { slot: 2, position: 'CB' },
      { slot: 3, position: 'LB' }, { slot: 4, position: 'RB' },
      { slot: 5, position: 'LM' }, { slot: 6, position: 'CM' }, { slot: 7, position: 'CM' }, { slot: 8, position: 'RM' },
      { slot: 9, position: 'ST' }, { slot: 10, position: 'ST' },
    ],
    defense: [1, 2, 3, 4],
    midfield: [5, 6, 7, 8],
    attack: [9, 10],
  },
  '3-5-2': {
    slots: [
      { slot: 0, position: 'GK' },
      { slot: 1, position: 'CB' }, { slot: 2, position: 'CB' }, { slot: 3, position: 'CB' },
      { slot: 4, position: 'LM' }, { slot: 5, position: 'CM' }, { slot: 6, position: 'CDM' }, { slot: 7, position: 'CM' }, { slot: 8, position: 'RM' },
      { slot: 9, position: 'ST' }, { slot: 10, position: 'ST' },
    ],
    defense: [1, 2, 3],
    midfield: [4, 5, 6, 7, 8],
    attack: [9, 10],
  },
  '5-3-2': {
    slots: [
      { slot: 0, position: 'GK' },
      { slot: 1, position: 'CB' }, { slot: 2, position: 'CB' }, { slot: 3, position: 'CB' },
      { slot: 4, position: 'LB' }, { slot: 5, position: 'RB' },
      { slot: 6, position: 'CM' }, { slot: 7, position: 'CDM' }, { slot: 8, position: 'CM' },
      { slot: 9, position: 'ST' }, { slot: 10, position: 'ST' },
    ],
    defense: [1, 2, 3, 4, 5],
    midfield: [6, 7, 8],
    attack: [9, 10],
  },
  '4-2-4': {
    slots: [
      { slot: 0, position: 'GK' },
      { slot: 1, position: 'CB' }, { slot: 2, position: 'CB' },
      { slot: 3, position: 'LB' }, { slot: 4, position: 'RB' },
      { slot: 5, position: 'CDM' }, { slot: 6, position: 'CDM' },
      { slot: 7, position: 'LW' }, { slot: 8, position: 'RW' },
      { slot: 9, position: 'ST' }, { slot: 10, position: 'CF' },
    ],
    defense: [1, 2, 3, 4],
    midfield: [5, 6],
    attack: [7, 8, 9, 10],
  },
};

const FORMATION_NAMES = Object.keys(FORMATIONS);

const POSITION_GROUPS = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT', CF: 'ATT',
};

function positionFit(playerPos, slotPos) {
  if (playerPos === slotPos) return 1.0;
  if (POSITION_GROUPS[playerPos] === POSITION_GROUPS[slotPos]) return 0.9;
  return 0; // strikt draften: andere zones passen niet
}

// Strikt: een speler past alleen op een slot met exact dezelfde positie of dezelfde zone
function slotFits(playerPos, slotPos) {
  return positionFit(playerPos, slotPos) > 0;
}

/**
 * Zoek het beste open slot voor een speler binnen een formatie.
 * filledSlots: Set van bezette slotnummers. Geeft slotnummer of -1.
 * Voorkeur: exacte positiematch, daarna zelfde zone.
 */
function findSlotForPlayer(formation, filledSlots, playerPos) {
  const form = FORMATIONS[formation];
  if (!form) return -1;
  const open = form.slots.filter(s => !filledSlots.has(s.slot));
  const exact = open.find(s => s.position === playerPos);
  if (exact) return exact.slot;
  const zone = open.find(s => POSITION_GROUPS[s.position] === POSITION_GROUPS[playerPos]);
  return zone ? zone.slot : -1;
}

// Kan dit team nog minstens één speler uit deze selectie kiezen?
function teamHasFittingPick(formation, filledSlots, squadPositions) {
  return squadPositions.some(pos => findSlotForPlayer(formation, filledSlots, pos) !== -1);
}

function calculateChemistry(slottedPlayers, formation) {
  const form = FORMATIONS[formation];
  if (!form) return 5;
  let total = 0;
  let count = 0;
  form.slots.forEach(({ slot, position }) => {
    const p = slottedPlayers[slot];
    if (!p) return;
    total += positionFit(p.position, position) || 0.7;
    count++;
  });
  if (count === 0) return 5;
  return (total / count) * 10;
}

function getZoneRating(slottedPlayers, formation, zone) {
  const form = FORMATIONS[formation];
  if (!form) return 70;
  const zonePlayers = form[zone].map(i => slottedPlayers[i]).filter(Boolean);
  if (!zonePlayers.length) return 70;
  return zonePlayers.reduce((sum, p) => sum + p.rating, 0) / zonePlayers.length;
}

/**
 * Teamsterkte op basis van spelers-per-slot (index = slotnummer).
 * Geen punten meer hier — die komen uit de seizoenssimulatie.
 */
function calculateScore(slottedPlayers, formation) {
  const validPlayers = slottedPlayers.filter(Boolean);
  const chemistry = calculateChemistry(slottedPlayers, formation);
  const totalRating = validPlayers.length > 0
    ? validPlayers.reduce((s, p) => s + p.rating, 0) / validPlayers.length
    : 70;
  const attack = getZoneRating(slottedPlayers, formation, 'attack');
  const midfield = getZoneRating(slottedPlayers, formation, 'midfield');
  const defense = getZoneRating(slottedPlayers, formation, 'defense');

  // Strikt draften geeft chemie 9-10; perfecte posities leveren tot +2 sterkte op
  const strength = totalRating + (chemistry - 9) * 2;

  return {
    totalRating: parseFloat(totalRating.toFixed(2)),
    attack: parseFloat(attack.toFixed(2)),
    midfield: parseFloat(midfield.toFixed(2)),
    defense: parseFloat(defense.toFixed(2)),
    chemistry: parseFloat(chemistry.toFixed(2)),
    strength: parseFloat(strength.toFixed(2)),
  };
}

module.exports = {
  FORMATIONS,
  FORMATION_NAMES,
  POSITION_GROUPS,
  positionFit,
  slotFits,
  findSlotForPlayer,
  teamHasFittingPick,
  calculateScore,
  calculateChemistry,
  getZoneRating,
};
