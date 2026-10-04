import { loadStats } from './records.js';

/**
 * Twenty-one badges earned from the lifetime stats. Each one has a clear goal and a progress bar
 * in the Palbook, pays XP once and can never be lost.
 */
export const BADGE_XP = 100;
const tier = (id, name, goal, hint) => ({ id, name, goal, hint, value: (s) => s.bestTier });
export const BADGES = [
  { id: 'first', name: 'FIRST POP', hint: 'FINISH A RUN', goal: 1, value: (s) => s.runs },
  tier('tabby', 'TABBY TIME', 4, 'EVOLVE A TABBY'),
  tier('panda', 'PANDA PARTY', 5, 'EVOLVE A PANDI'),
  tier('owl', 'OWL ORDER', 7, 'EVOLVE A HOOTIE'),
  tier('dragon', 'DRAGON DAYS', 9, 'EVOLVE A DRAKO'),
  tier('solis', 'SUN SEEKER', 10, 'EVOLVE A SOLIS'),
  { id: 'burst', name: 'SUN BURST', hint: 'CREATE THE SUN', goal: 1, value: (s) => s.suns },
  { id: 'king', name: 'SUN KING', hint: 'CREATE THE SUN 5 TIMES', goal: 5, value: (s) => s.suns },
  { id: 'chain3', name: 'LINKED UP', hint: 'CHAIN 3 MERGES', goal: 3, value: (s) => s.bestCombo },
  { id: 'chain5', name: 'CHAIN GANG', hint: 'CHAIN 5 MERGES', goal: 5, value: (s) => s.bestCombo },
  { id: 'chain7', name: 'DOMINO KING', hint: 'CHAIN 7 MERGES', goal: 7, value: (s) => s.bestCombo },
  { id: 'fever', name: 'FEVER DREAM', hint: 'START 10 FEVERS', goal: 10, value: (s) => s.fevers },
  {
    id: 'agent',
    name: 'SPECIAL AGENT',
    hint: 'USE 25 SPECIAL PALS',
    goal: 25,
    value: (s) => s.specials,
  },
  {
    id: 'machine',
    name: 'MERGE MACHINE',
    hint: 'MERGE 500 PALS',
    goal: 500,
    value: (s) => s.merges,
  },
  {
    id: 'legend',
    name: 'MERGE LEGEND',
    hint: 'MERGE 3000 PALS',
    goal: 3000,
    value: (s) => s.merges,
  },
  {
    id: 'marathon',
    name: 'MARATHON',
    hint: 'SURVIVE 5 MINUTES IN ONE RUN',
    goal: 300,
    value: (s) => Math.floor(s.longest),
  },
  {
    id: 'roller',
    name: 'HIGH ROLLER',
    hint: 'SCORE 4000 IN ONE RUN',
    goal: 4000,
    value: (s) => s.bestScore,
  },
  {
    id: 'daily',
    name: 'DAILY DEVOTEE',
    hint: 'PLAY THE DAILY ON 7 DAYS',
    goal: 7,
    value: (s, extra) => extra.dailyDays || 0,
  },
  {
    id: 'tourist',
    name: 'WORLD TOURIST',
    hint: 'VISIT ALL 7 WORLDS',
    goal: 7,
    value: (s, extra) => extra.worlds || 0,
  },
  {
    id: 'quests',
    name: 'QUEST MASTER',
    hint: 'FINISH 15 QUESTS',
    goal: 15,
    value: (s) => s.quests,
  },
  {
    id: 'mutant',
    name: 'MUTANT',
    hint: 'FINISH 10 MUTATOR RUNS',
    goal: 10,
    value: (s) => s.mutantRuns,
  },
];

/** Awards every badge whose goal has been reached and returns the new ones. */
export function checkBadges(store, extra = {}) {
  const stats = loadStats(store),
    saved = store.get('badges', []),
    had = Array.isArray(saved) ? saved : [],
    fresh = BADGES.filter((b) => !had.includes(b.id) && b.value(stats, extra) >= b.goal);
  if (fresh.length) store.set('badges', [...had, ...fresh.map((b) => b.id)]);
  return fresh;
}

/** Every badge with its progress, for the Palbook. */
export function badgeRows(store, extra = {}) {
  const stats = loadStats(store),
    saved = store.get('badges', []),
    had = Array.isArray(saved) ? saved : [];
  return BADGES.map((badge) => {
    const value = badge.value(stats, extra);
    return { badge, value: Math.min(value, badge.goal), got: had.includes(badge.id) };
  });
}
