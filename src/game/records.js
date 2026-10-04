import { MAXT } from '../config.js';

/**
 * What the game remembers between runs: lifetime stats and records, the last ten scores,
 * persistent quests and the daily challenge. Everything is a pure function over a storage object
 * (get/set), so it is testable without a browser. Nothing here ever takes anything away from the
 * player: a missed day costs nothing and a quest never expires.
 */
const HISTORY = 10;
export const QUEST_SLOTS = 3;
const STATS = {
  runs: 0,
  secs: 0,
  merges: 0,
  bestScore: 0,
  bestTier: 0,
  bestCombo: 0,
  longest: 0,
  suns: 0,
  fevers: 0,
  specials: 0,
  quests: 0,
  mutantRuns: 0,
};

export function loadStats(store) {
  const saved = store.get('stats', {});
  return { ...STATS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

/**
 * Books a finished run and describes it against the player's history.
 * `run`: { score, tier, secs, merges, combo, suns, fevers, specials, mutator?, previousBest? }; the best
 * before this run defaults to the stored one.
 */
export function recordRun(store, run) {
  const before = loadStats(store),
    previousBest = run.previousBest ?? store.get('best', 0),
    after = {
      runs: before.runs + 1,
      secs: before.secs + run.secs,
      merges: before.merges + run.merges,
      bestScore: Math.max(before.bestScore, run.score),
      bestTier: Math.max(before.bestTier, run.tier),
      bestCombo: Math.max(before.bestCombo, run.combo),
      longest: Math.max(before.longest, run.secs),
      suns: before.suns + run.suns,
      fevers: before.fevers + run.fevers,
      specials: before.specials + run.specials,
      quests: before.quests,
      mutantRuns: before.mutantRuns + (run.mutator ? 1 : 0),
    },
    saved = store.get('hist', []),
    history = [
      ...(Array.isArray(saved) ? saved : []),
      { s: run.score, t: run.tier, secs: Math.round(run.secs) },
    ].slice(-HISTORY),
    recent = history.slice(-5),
    records = [];
  store.set('stats', after);
  store.set('hist', history);
  // The first run sets every record, which says nothing: celebrate only real improvements.
  if (before.runs > 0) {
    if (run.tier > before.bestTier) records.push('BEST PAL');
    if (run.combo > before.bestCombo && run.combo >= 3) records.push('BEST CHAIN');
    if (run.secs > before.longest && run.secs >= 30) records.push('LONGEST RUN');
  }
  return {
    previousBest,
    newBest: run.score > previousBest,
    gap: Math.max(0, previousBest - run.score),
    nearMiss: run.score < previousBest && previousBest - run.score <= previousBest * 0.15,
    average: Math.round(recent.reduce((sum, r) => sum + r.s, 0) / recent.length),
    runs: after.runs,
    records,
  };
}

/* ---------------- quests ---------------- */
const TARGETS = {
  reach: (level) => Math.min(MAXT, 4 + Math.floor(level / 2)),
  chain: (level) => Math.min(6, 3 + Math.floor(level / 4)),
  score: (level, stats) => Math.max(1500, Math.ceil((stats.bestScore * 1.1) / 500) * 500),
  merges: (level) => 60 + 20 * Math.floor(level / 2),
  fevers: (level) => 2 + Math.floor(level / 5),
  specials: (level) => 3 + Math.floor(level / 4),
};
export const QUEST_TYPES = Object.keys(TARGETS);
const reward = (level) => Math.min(400, 100 + level * 20);
/** How a run moves a quest: best-in-a-run quests keep their high-water mark, the rest add up. */
const PROGRESS = {
  reach: (prog, run) => Math.max(prog, run.tier),
  chain: (prog, run) => Math.max(prog, run.combo),
  score: (prog, run) => Math.max(prog, run.score),
  merges: (prog, run) => prog + run.merges,
  fevers: (prog, run) => prog + run.fevers,
  specials: (prog, run) => prog + run.specials,
};
const valid = (q) =>
  q &&
  QUEST_TYPES.includes(q.type) &&
  Number.isFinite(q.target) &&
  Number.isFinite(q.prog) &&
  Number.isFinite(q.xp);

export function makeQuest(random, level, stats, taken = []) {
  const kinds = QUEST_TYPES.filter((type) => !taken.includes(type)),
    pool = kinds.length ? kinds : QUEST_TYPES,
    type = pool[Math.floor(random() * pool.length)];
  return { type, target: TARGETS[type](level, stats), prog: 0, xp: reward(level) };
}

/** The three open quests; missing or damaged slots are filled with new ones. */
export function ensureQuests(store, random, level) {
  const saved = store.get('quests', []),
    quests = (Array.isArray(saved) ? saved : []).filter(valid).slice(0, QUEST_SLOTS);
  while (quests.length < QUEST_SLOTS)
    quests.push(
      makeQuest(
        random,
        level,
        loadStats(store),
        quests.map((q) => q.type),
      ),
    );
  store.set('quests', quests);
  return quests;
}

/**
 * Applies a finished run to the quests. Progress survives death; a completed quest pays its XP
 * and is replaced by a new one of another kind. `rows` describes every slot for the game-over panel.
 */
export function advanceQuests(store, random, run, level) {
  const quests = ensureQuests(store, random, level),
    stats = loadStats(store),
    rows = [],
    next = [];
  let xp = 0;
  for (const quest of quests) {
    const after = PROGRESS[quest.type](quest.prog, run),
      done = after >= quest.target;
    rows.push({ ...quest, before: quest.prog, after: Math.min(after, quest.target), done });
    if (done) {
      xp += quest.xp;
      next.push(null);
    } else next.push({ ...quest, prog: after });
  }
  for (let i = 0; i < next.length; i++)
    if (!next[i])
      next[i] = makeQuest(
        random,
        level,
        stats,
        next.filter(Boolean).map((q) => q.type),
      );
  store.set('quests', next);
  const finished = rows.filter((row) => row.done).length;
  if (finished) store.set('stats', { ...stats, quests: stats.quests + finished });
  return { rows, xp };
}

/* ---------------- daily challenge ---------------- */
const DAY = 86400000;
const FIRST_DAY = Date.UTC(2026, 0, 1);
export const dayKey = (date = new Date()) =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
const toUtc = (key) =>
  Date.UTC(Math.floor(key / 10000), (Math.floor(key / 100) % 100) - 1, key % 100);
/** Whole days since 1 January 2026, counting that day as number 1. */
export const dailyNumber = (key) => Math.round((toUtc(key) - FIRST_DAY) / DAY) + 1;
export function shiftDay(key, days) {
  const date = new Date(toUtc(key) + days * DAY);
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}
/** The same seed for everyone on the same day. */
export const dailySeed = (key) => (Math.imul(key, 2654435761) ^ 0x9e3779b9) >>> 0;

export function dailyState(store, key) {
  const saved = store.get('daily', null);
  return saved && saved.d === key
    ? { best: saved.best || 0, tier: saved.tier || 0, tries: saved.tries || 0 }
    : { best: 0, tier: 0, tries: 0 };
}

export function recordDaily(store, key, run) {
  const before = dailyState(store, key),
    state = {
      d: key,
      best: Math.max(before.best, run.score),
      tier: Math.max(before.tier, run.tier),
      tries: before.tries + 1,
    },
    saved = store.get('days', []),
    days = Array.isArray(saved) ? saved : [];
  store.set('daily', state);
  if (!days.includes(key)) store.set('days', [...days, key].slice(-60));
  return { ...state, newBest: run.score > before.best };
}

/** Days in a row up to today (or yesterday, while today is still unplayed). Never shown as a threat. */
export function streak(store, key) {
  const saved = store.get('days', []),
    days = new Set(Array.isArray(saved) ? saved : []);
  let day = days.has(key) ? key : shiftDay(key, -1),
    count = 0;
  while (days.has(day)) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
