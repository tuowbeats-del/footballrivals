// Spiegel van server/src/services/gameService.js — slotvolgorde moet identiek blijven.
// x/y zijn veldcoördinaten in procenten (GK onderaan).
export const FORMATIONS = {
  '4-3-3': {
    slots: [
      { pos: 'GK', x: 50, y: 88 },
      { pos: 'CB', x: 36, y: 70 }, { pos: 'CB', x: 64, y: 70 },
      { pos: 'LB', x: 11, y: 66 }, { pos: 'RB', x: 89, y: 66 },
      { pos: 'CM', x: 28, y: 46 }, { pos: 'CM', x: 50, y: 50 }, { pos: 'CM', x: 72, y: 46 },
      { pos: 'LW', x: 15, y: 22 }, { pos: 'RW', x: 85, y: 22 }, { pos: 'ST', x: 50, y: 16 },
    ],
  },
  '4-4-2': {
    slots: [
      { pos: 'GK', x: 50, y: 88 },
      { pos: 'CB', x: 36, y: 70 }, { pos: 'CB', x: 64, y: 70 },
      { pos: 'LB', x: 11, y: 66 }, { pos: 'RB', x: 89, y: 66 },
      { pos: 'LM', x: 12, y: 44 }, { pos: 'CM', x: 37, y: 48 }, { pos: 'CM', x: 63, y: 48 }, { pos: 'RM', x: 88, y: 44 },
      { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
    ],
  },
  '3-5-2': {
    slots: [
      { pos: 'GK', x: 50, y: 88 },
      { pos: 'CB', x: 26, y: 70 }, { pos: 'CB', x: 50, y: 73 }, { pos: 'CB', x: 74, y: 70 },
      { pos: 'LM', x: 8, y: 44 }, { pos: 'CM', x: 30, y: 42 }, { pos: 'CDM', x: 50, y: 52 }, { pos: 'CM', x: 70, y: 42 }, { pos: 'RM', x: 92, y: 44 },
      { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
    ],
  },
  '5-3-2': {
    slots: [
      { pos: 'GK', x: 50, y: 88 },
      { pos: 'CB', x: 30, y: 71 }, { pos: 'CB', x: 50, y: 74 }, { pos: 'CB', x: 70, y: 71 },
      { pos: 'LB', x: 8, y: 62 }, { pos: 'RB', x: 92, y: 62 },
      { pos: 'CM', x: 30, y: 44 }, { pos: 'CDM', x: 50, y: 50 }, { pos: 'CM', x: 70, y: 44 },
      { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
    ],
  },
  '4-2-4': {
    slots: [
      { pos: 'GK', x: 50, y: 88 },
      { pos: 'CB', x: 36, y: 70 }, { pos: 'CB', x: 64, y: 70 },
      { pos: 'LB', x: 11, y: 66 }, { pos: 'RB', x: 89, y: 66 },
      { pos: 'CDM', x: 37, y: 48 }, { pos: 'CDM', x: 63, y: 48 },
      { pos: 'LW', x: 12, y: 22 }, { pos: 'RW', x: 88, y: 22 },
      { pos: 'ST', x: 38, y: 14 }, { pos: 'CF', x: 62, y: 18 },
    ],
  },
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

export const POSITION_GROUPS = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT', CF: 'ATT',
};

// Spiegel van de server: exacte positie eerst, daarna zelfde zone
export function findSlotForPlayer(formation, filledSlots, playerPos) {
  const form = FORMATIONS[formation];
  if (!form) return -1;
  const open = form.slots
    .map((s, i) => ({ ...s, slot: i }))
    .filter(s => !filledSlots.has(s.slot));
  const exact = open.find(s => s.pos === playerPos);
  if (exact) return exact.slot;
  const zone = open.find(s => POSITION_GROUPS[s.pos] === POSITION_GROUPS[playerPos]);
  return zone ? zone.slot : -1;
}

export const POS_COLORS = {
  GK: 'bg-yellow-600 text-white',
  CB: 'bg-blue-700 text-white', LB: 'bg-blue-600 text-white', RB: 'bg-blue-600 text-white',
  CDM: 'bg-emerald-700 text-white', CM: 'bg-emerald-600 text-white',
  CAM: 'bg-emerald-500 text-white', LM: 'bg-emerald-500 text-white', RM: 'bg-emerald-500 text-white',
  LW: 'bg-red-600 text-white', RW: 'bg-red-600 text-white',
  ST: 'bg-red-700 text-white', CF: 'bg-red-700 text-white',
};

export const getRatingColor = (r) =>
  r >= 90 ? 'text-yellow-300' : r >= 85 ? 'text-orange-400' : r >= 80 ? 'text-green-400' : r >= 75 ? 'text-blue-400' : 'text-gray-300';
