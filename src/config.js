import { PHYSICS } from './settings.js';
/* ================= constants ================= */
const W = 120;
const H = 200;
const FL = 6;
const FR = 114;
const FT = 12;
const FLOOR = 190;
const LOSE_Y = 46;
const SPAWN_Y = 27;
const RAIL_Y = 9;
const G = PHYSICS.gravity;
const VMAX = PHYSICS.maxFallSpeed;
const MAXT = 10;
const PRISM = 11;
const CH_MAX = 14;
const FEVER_T = 8;
const BOOMER = 12;
const GOLDIE = 13;
const ZAPPY = 14;
const ICY = 15;
const SPECIALS = [
  {
    t: PRISM,
    req: 0,
    hint: 'MERGES WITH ANY PAL',
    desc: 'WILDCARD! MERGES WITH ANY PAL IT TOUCHES.',
  },
  {
    t: BOOMER,
    req: 2,
    hint: 'BOOM! POPS NEARBY PALS',
    desc: 'BOOMS A MOMENT AFTER LANDING AND POPS NEARBY PALS FOR POINTS.',
  },
  {
    t: GOLDIE,
    req: 3,
    hint: 'GOLD RUSH: SCORE X3',
    desc: 'TRIGGERS A 7 SECOND GOLD RUSH. ALL SCORES X3.',
  },
  {
    t: ZAPPY,
    req: 5,
    hint: 'ZAPS PALS UP A LEVEL',
    desc: 'LIGHTNING EVOLVES UP TO 4 NEARBY PALS ONE LEVEL.',
  },
  {
    t: ICY,
    req: 7,
    hint: 'FREEZES TIME',
    desc: 'SLOWS TIME FOR 7 SECONDS AND CLEARS ANY WARNING. THE STACK CAN NOT LOSE.',
  },
];
/** Which themed world shows once a tier has been reached (index into the worlds): dusk to sunrise. */
const WORLD_OF_TIER = [6, 6, 4, 4, 1, 5, 0, 3, 3, 2, 2];
const SCORE = [0, 1, 2, 4, 7, 12, 20, 32, 50, 80, 120];
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const TIERS = [
  {
    n: 'Blipp',
    r: 6,
    m: 4,
    ramp: ['#12326b', '#2f66d8', '#4c9dff', '#86ccff', '#e8f8ff'],
  },
  {
    n: 'Chirpy',
    r: 7.5,
    m: 2,
    ramp: ['#7a4208', '#e39a1c', '#ffd23f', '#ffe98a', '#fffbe2'],
  },
  {
    n: 'Bunbun',
    r: 9,
    m: 5,
    ramp: ['#7a1f52', '#e2669c', '#ff9cc4', '#ffc9e0', '#fff1f7'],
  },
  {
    n: 'Froggo',
    r: 11,
    m: 3,
    ramp: ['#08443a', '#1d9a7c', '#2fd0a2', '#8cf2cc', '#e8fff6'],
  },
  {
    n: 'Tabby',
    r: 13,
    m: 4,
    ramp: ['#5a1a05', '#d8541a', '#ff8236', '#ffb878', '#fff1dc'],
  },
  {
    n: 'Pandi',
    r: 15,
    m: 1,
    ramp: ['#1c1c2a', '#9aa3bd', '#d9deee', '#f3f5ff', '#ffffff'],
  },
  {
    n: 'Boo',
    r: 17.5,
    m: 3,
    ramp: ['#35237a', '#7d6ce0', '#b4a3ff', '#d9ccff', '#f7f3ff'],
  },
  {
    n: 'Hootie',
    r: 20,
    m: 4,
    ramp: ['#3a1f10', '#7a4a2a', '#a8693a', '#d39a5e', '#f6d4a4'],
  },
  {
    n: 'Bolt',
    r: 22.5,
    m: 3,
    ramp: ['#182838', '#46647f', '#7b9dbb', '#b3cfe6', '#ecf7ff'],
  },
  {
    n: 'Drako',
    r: 25,
    m: 6,
    ramp: ['#4a0a18', '#b01e30', '#e8443c', '#ff8a6a', '#ffdcc4'],
  },
  {
    n: 'Solis',
    r: 28,
    m: 7,
    ramp: ['#7a3200', '#ff9500', '#ffc400', '#ffe45c', '#fffbd6'],
  },
  {
    n: 'Prism',
    r: 7.5,
    m: 3,
    ramp: ['#2a1650', '#7a5cff', '#b39bff', '#e0d6ff', '#ffffff'],
  },
  {
    n: 'Boomer',
    r: 9,
    m: 4,
    ramp: ['#0a0a14', '#262636', '#464660', '#6a6a8c', '#c0c0dc'],
  },
  {
    n: 'Goldie',
    r: 9,
    m: 4,
    ramp: ['#4a2a00', '#b86a00', '#ffb000', '#ffd95a', '#fff2b0'],
  },
  {
    n: 'Zappy',
    r: 9,
    m: 4,
    ramp: ['#3a4a00', '#8ec400', '#d2ff2a', '#eeff86', '#fbffd6'],
  },
  {
    n: 'Icy',
    r: 9,
    m: 4,
    ramp: ['#134a66', '#59b8e0', '#9fe2ff', '#d2f4ff', '#ffffff'],
  },
];

/* ================= live procedural audio engine ================= */

const RANKS = [
  'ROOKIE',
  'POPPER',
  'MERGER',
  'COMBO KID',
  'PAL PRO',
  'EVOLVER',
  'STAR CHASER',
  'SUN SEEKER',
  'LEGEND',
];
const rank = (l) => RANKS[Math.min(RANKS.length - 1, Math.floor((l - 1) / 2))];
const need = (l) => 120 + l * 80;
export {
  W,
  H,
  FL,
  FR,
  FT,
  FLOOR,
  LOSE_Y,
  SPAWN_Y,
  RAIL_Y,
  G,
  VMAX,
  MAXT,
  PRISM,
  CH_MAX,
  FEVER_T,
  BOOMER,
  GOLDIE,
  ZAPPY,
  ICY,
  SPECIALS,
  SCORE,
  WORLD_OF_TIER,
  BAY,
  TIERS,
  RANKS,
  rank,
  need,
};
