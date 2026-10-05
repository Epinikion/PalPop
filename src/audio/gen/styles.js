/**
 * The styles as data. A style does not write music note by note; it holds the vocabulary a
 * producer of that genre works with - chord progressions, bass and hook rhythms, drum grooves, the
 * shape of a track - and `track.js` draws one track at a time from it.
 *
 * Rows are sixteen steps per bar (thirty-two for two-bar rows):
 * - drums: `X` accent, `x` normal, `o` soft, `-` ghost, `,` very soft, `.` rest;
 * - bass: `R` root, `O` octave, `F` fifth, `S` the scale step above, `.` rest, `-` hold;
 * - hooks and stabs: `X` a new note, `-` hold it, `.` rest.
 * Progressions are scale degrees (0 = the key's root) with how many bars each chord lasts.
 */
import { ALL_MY_PALS } from './all-my-pals.js';

const INTRO = 'INTRO',
  GROOVE = 'GROOVE',
  BREAK = 'BREAK',
  BUILD = 'BUILD',
  DROP = 'DROP',
  OUTRO = 'OUTRO';

/**
 * The shape of a track: the sections in order, how long each may be (bars) and which layers play.
 * `late` layers enter halfway through the section. `auto` sets where each layer's filter starts and
 * ends (0 closed to 1 open) and how much reverb the section gets.
 */
const FORM = [
  {
    type: INTRO,
    len: [16, 32],
    layers: ['kick', 'hat', 'perc'],
    late: ['open', 'bass'],
    auto: { bass: [0.25, 0.55], reverb: 0.3 },
  },
  {
    type: GROOVE,
    len: [16, 32],
    layers: ['kick', 'hat', 'open', 'clap', 'perc', 'bass', 'rumble'],
    late: ['arp', 'ride'],
    auto: { bass: [0.55, 0.8], arp: [0.2, 0.45], hook: [0.2, 0.35], reverb: 0.35 },
  },
  {
    type: BREAK,
    len: [16, 32],
    layers: ['pad', 'arp'],
    late: ['hook', 'hat'],
    auto: { pad: [0.4, 0.7], arp: [0.35, 0.6], hook: [0.35, 0.5], reverb: 0.8 },
  },
  {
    type: BUILD,
    len: [8, 16],
    layers: ['pad', 'arp', 'hook', 'roll', 'hat'],
    late: ['kick', 'clap'],
    auto: { pad: [0.6, 0.9], arp: [0.45, 1], hook: [0.4, 1], reverb: 0.6 },
  },
  {
    type: DROP,
    len: [32],
    layers: [
      'kick',
      'hat',
      'open',
      'clap',
      'ride',
      'perc',
      'bass',
      'rumble',
      'hook',
      'pad',
      'stab',
    ],
    late: ['arp'],
    auto: { bass: [0.85, 0.9], hook: [1, 1], pad: [0.85, 0.9], arp: [0.7, 0.8], reverb: 0.4 },
  },
  {
    type: BREAK,
    len: [8, 16],
    layers: ['pad', 'arp', 'hat'],
    late: ['hook'],
    auto: { pad: [0.5, 0.75], arp: [0.4, 0.6], hook: [0.4, 0.55], reverb: 0.8 },
  },
  {
    type: BUILD,
    len: [8],
    layers: ['pad', 'arp', 'hook', 'roll', 'hat', 'kick'],
    late: ['clap'],
    auto: { pad: [0.7, 0.95], arp: [0.5, 1], hook: [0.45, 1], reverb: 0.6 },
  },
  {
    type: DROP,
    len: [32],
    variant: 'B',
    layers: [
      'kick',
      'hat',
      'open',
      'clap',
      'ride',
      'perc',
      'bass',
      'rumble',
      'hook',
      'pad',
      'stab',
    ],
    late: ['arp'],
    auto: { bass: [0.9, 0.95], hook: [1, 1], pad: [0.9, 0.95], arp: [0.75, 0.85], reverb: 0.4 },
  },
  {
    type: OUTRO,
    len: [16, 32],
    layers: ['kick', 'hat', 'open', 'perc', 'clap'],
    early: ['bass', 'rumble'],
    auto: { bass: [0.7, 0.3], reverb: 0.35 },
  },
];

export const STYLES = {
  /* Hard techno, after a 144 BPM clip: a distorted kick with a long tail and a rumble under it, fast
     hats, a short detuned riff that repeats and a dark pad that opens up in the breaks. */
  rave: {
    bpm: [142, 148],
    swing: 0,
    keys: [5, 6, 7, 9, 10, 2, 4],
    scales: [
      ['minor', 3],
      ['phrygian', 3],
      ['harmonic', 1],
    ],
    progressions: [
      [[0, 0, 0, 0], 2],
      [[0, 0, 5, 6], 2],
      [[0, 0, 0, 1], 2],
      [[0, 5, 0, 6], 2],
      [[0, 6, 5, 6], 2],
      [[0, 3, 0, 4], 2],
    ],
    bass: ['.RRR.RRR.RRR.RRR', '.RRR.RRO.RRR.RRF', '.RR-.RR-.RR-.RRO', '.RRR.RRR.RRR.ROR'],
    bassRange: [33, 45],
    hookRhythms: [
      'X..X..X.X..X..X.',
      'X.X..X.XX.X..X.X',
      'X..X..X...X..X..',
      'X-.X-.X-.X-.X-X-',
      'X..X.X..X..X.XX.',
    ],
    hookRange: [57, 76],
    hookMoves: 'riff',
    arp: null,
    stabRhythms: ['..X..X....X..X..', '...X..X....X..X.', 'X.....X.....X...'],
    drums: {
      kick: ['X...X...X...X...'],
      hat: ['-x-x-x-x-x-x-x-x', ',x,x,x,x,x,x,x,X', 'oxoxoxoxoxoxoxox'],
      open: ['..x...x...x...x.', '..x...x...x...xo'],
      clap: ['....X.......X...', '....X.......X..o'],
      ride: ['x.o.x.o.x.o.x.o.', 'o.x.o.x.o.x.o.x.'],
      perc: [
        '...x..x....x.x.....x..x...x..x..',
        '..x..x...x..x.....x..x...x.x..x.',
        '.x...x.x.x...x...x...x.x.x...x.x',
      ],
    },
    form: FORM,
    sound: { kick: 'hard', rumble: 0.9, hook: 'rave', arp: 'pluck', pad: 'dark', bass: 'roll' },
    mix: { kick: 0.8, rumble: 0.8, bass: 0.7, hat: 4, open: 2.2, clap: 1, ride: 2.4, perc: 1.2 },
    stems: { bass: 0.6, hook: 1.15, pad: 0.85, arp: 0.5, stab: 1 },
    pump: 0.35,
  },

  /* Euphoric hard trance, after a 156 BPM clip in B/E major: a punchy clean kick, a bass that rolls
     through the three sixteenths after every kick, a seven-saw lead and a sustained saw wall. */
  euphoria: {
    bpm: [150, 158],
    swing: 0,
    keys: [4, 11, 9, 6, 2, 7],
    scales: [
      ['major', 5],
      ['minor', 2],
    ],
    progressions: [
      [[5, 3, 0, 4], 2],
      [[0, 4, 5, 3], 2],
      [[3, 4, 5, 5], 2],
      [[5, 4, 3, 4], 2],
      [[3, 0, 4, 5], 2],
      [[0, 2, 3, 4], 2],
      [[5, 3, 0, 4], 1],
    ],
    bass: ['.RRR.RRR.RRR.RRR', '.RRR.RRR.RRR.ROR', '.RRO.RRO.RRO.RRO'],
    bassRange: [33, 45],
    hookRhythms: [
      'X--X--X-X--X--X-',
      'X-X-X--X-X-X--X-',
      'X--X--X-X-X-X-X-',
      'X---X--X--X-X---X--X--X-X-X-X---',
      'X-X--X--X-X-X---X-X--X--X---X-X-',
    ],
    hookRange: [64, 84],
    hookMoves: 'lead',
    arp: {
      rhythms: ['XXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', 'X.XXX.XXX.XXX.XX'],
      orders: [
        [0, 1, 2, 3],
        [0, 2, 1, 3, 2, 1],
        [0, 1, 2, 1, 3, 2, 1, 2],
        [3, 2, 1, 0],
      ],
      range: [64, 88],
    },
    stabRhythms: null,
    drums: {
      kick: ['X...X...X...X...'],
      hat: [',.,.,.,.,.,.,.,.', ',.-.,.-.,.-.,.-.', '-,-,-,-,-,-,-,-,'],
      open: ['..x...x...x...x.'],
      clap: ['....X.......X...'],
      ride: ['..x...x...x...x.', 'x.o.x.o.x.o.x.o.'],
      perc: ['................................', '..........o.........o.......o...'],
    },
    form: FORM,
    sound: { kick: 'clean', rumble: 0, hook: 'supersaw', arp: 'pluck', pad: 'wall', bass: 'roll' },
    mix: { kick: 0.72, rumble: 0, bass: 0.8, hat: 1.5, open: 1.1, clap: 0.9, ride: 1, perc: 1 },
    stems: { bass: 0.6, hook: 0.85, pad: 0.6, arp: 0.5, stab: 0.5 },
    pump: 0.45,
  },

  /* Vocal trance: every other track is the recorded song "All My Pals" (made with Suno, see
     all-my-pals.js), played as it is; the tracks between are generated in the sound of SOLAR RUSH,
     slower, at the song's tempo. */
  pals: {
    bpm: [137, 137],
    swing: 0,
    keys: [9, 0, 2, 7, 5, 11],
    scales: [
      ['minor', 3],
      ['major', 2],
    ],
    progressions: [
      [[5, 3, 0, 4], 2],
      [[0, 4, 5, 3], 2],
      [[3, 4, 5, 5], 2],
      [[5, 4, 3, 4], 2],
      [[3, 0, 4, 5], 2],
      [[0, 2, 3, 4], 2],
      [[5, 3, 0, 4], 1],
    ],
    bass: ['.RRR.RRR.RRR.RRR', '.RRR.RRR.RRR.ROR', '.RRO.RRO.RRO.RRO'],
    bassRange: [33, 45],
    hookRhythms: [
      'X--X--X-X--X--X-',
      'X-X-X--X-X-X--X-',
      'X--X--X-X-X-X-X-',
      'X---X--X--X-X---X--X--X-X-X-X---',
      'X-X--X--X-X-X---X-X--X--X---X-X-',
    ],
    hookRange: [64, 84],
    hookMoves: 'lead',
    arp: {
      rhythms: ['XXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', 'X.XXX.XXX.XXX.XX'],
      orders: [
        [0, 1, 2, 3],
        [0, 2, 1, 3, 2, 1],
        [0, 1, 2, 1, 3, 2, 1, 2],
        [3, 2, 1, 0],
      ],
      range: [64, 88],
    },
    stabRhythms: null,
    drums: {
      kick: ['X...X...X...X...'],
      hat: [',.,.,.,.,.,.,.,.', ',.-.,.-.,.-.,.-.', '-,-,-,-,-,-,-,-,'],
      open: ['..x...x...x...x.'],
      clap: ['....X.......X...'],
      ride: ['..x...x...x...x.', 'x.o.x.o.x.o.x.o.'],
      perc: ['................................', '..........o.........o.......o...'],
    },
    form: FORM,
    sound: { kick: 'clean', rumble: 0, hook: 'supersaw', arp: 'pluck', pad: 'wall', bass: 'roll' },
    mix: { kick: 0.72, rumble: 0, bass: 0.8, hat: 1.5, open: 1.1, clap: 0.9, ride: 1, perc: 1 },
    stems: { bass: 0.6, hook: 0.85, pad: 0.6, arp: 0.5, stab: 0.5 },
    pump: 0.45,
    record: { every: 2, ...ALL_MY_PALS },
  },

  /* Melodic techno, after a 126 BPM mix in A minor: a round kick, a bass that rolls and moves to the
     fifth, a plucked motif with a long echo that carries the track, wide pads and long builds. */
  melodic: {
    bpm: [122, 128],
    swing: 0.04,
    keys: [9, 4, 2, 7, 0, 5],
    scales: [
      ['minor', 4],
      ['dorian', 2],
    ],
    progressions: [
      [[0, 5, 2, 6], 2],
      [[0, 3, 5, 4], 2],
      [[0, 6, 5, 6], 2],
      [[0, 0, 5, 5], 2],
      [[0, 2, 6, 5], 2],
      [[0, 0, 3, 4], 2],
    ],
    bass: ['.RRR.RRR.RRR.RRR', '.RRF.RRF.RRF.RRO', 'R.RR.RR.R.RR.RR.', '.R.R.R.R.R.R.RFR'],
    bassRange: [36, 48],
    hookRhythms: [
      'X.X.XX.X.X.XX.X.',
      'X..X..X.X..X..X.',
      'X.XX.XX.X.XX.XX.',
      'XX.X.XX.XX.X.XX.',
      'X.X.X.X.XX.X.X.X',
    ],
    hookRange: [60, 79],
    hookMoves: 'pluck',
    arp: {
      rhythms: ['X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX', 'X.XXX.XXX.XXX.XX'],
      orders: [
        [0, 1, 2, 3],
        [0, 2, 3, 2],
        [0, 1, 2, 1, 3, 2],
      ],
      range: [60, 84],
    },
    stabRhythms: null,
    drums: {
      kick: ['X...X...X...X...'],
      hat: [',,o,,,o,,,o,,,o,', ',-o-,-o-,-o-,-o-', '.,o,.,o,.,o,.,o,'],
      open: ['..o...o...o...o.'],
      clap: ['....X.......X...', '....X.......X..,'],
      ride: ['..o...o...o...o.'],
      perc: [
        '...o..o....o.o.....o..o...o.....',
        '..o.....o..o......o.....o..o..o.',
        '.o...o....o..o.......o...o.o....',
      ],
    },
    form: FORM,
    sound: { kick: 'punch', rumble: 0, hook: 'pluck', arp: 'soft', pad: 'warm', bass: 'deep' },
    mix: { kick: 0.8, rumble: 0, bass: 0.85, hat: 2.6, open: 1.3, clap: 0.9, ride: 1.3, perc: 1.8 },
    stems: { bass: 0.7, hook: 0.6, pad: 0.45, arp: 0.4, stab: 0.4 },
    pump: 0.4,
  },

  /* A rave anthem, after a 136 BPM Eurodance record: a clean kick, a bass on every off-beat, a bright
     plucked riff that is the whole song, soft chords under it and big builds. */
  anthem: {
    bpm: [134, 138],
    swing: 0,
    keys: [8, 4, 9, 6, 1, 11],
    scales: [['minor', 1]],
    progressions: [
      [[0, 5, 2, 6], 1],
      [[0, 5, 2, 6], 2],
      [[0, 3, 5, 6], 1],
      [[5, 6, 0, 0], 1],
      [[0, 6, 5, 6], 1],
      [[0, 5, 6, 4], 1],
    ],
    bass: ['..R...R...R...R.', '..R...O...R...O.', '..R-..R-..R-..R-', '..R...R...R..RO.'],
    bassRange: [36, 48],
    hookRhythms: ['X.XX.XX.X.XX.XX.', 'XX.X.XX.XX.X.XX.', 'X.XX.X.XX.XX.X.X', 'X.X.XX.XX.X.XX.X'],
    hookRange: [64, 84],
    hookMoves: 'riff',
    arp: null,
    stabRhythms: ['..X...X...X...X.', 'X..X..X.X..X..X.'],
    drums: {
      kick: ['X...X...X...X...'],
      hat: [',.,.,.,.,.,.,.,.', '-.,.-.,.-.,.-.,.'],
      open: ['..x...x...x...x.'],
      clap: ['....X.......X...'],
      ride: ['x.o.x.o.x.o.x.o.'],
      perc: ['................................', '.......o...............o.....o..'],
    },
    form: FORM,
    sound: {
      kick: 'punch',
      tune: 2,
      rumble: 0,
      hook: 'bright',
      arp: 'pluck',
      pad: 'airy',
      bass: 'offbeat',
    },
    mix: { kick: 1, rumble: 0, bass: 0.8, hat: 1.4, open: 1.3, clap: 1, ride: 0.8, perc: 0.8 },
    stems: { bass: 0.55, hook: 0.3, pad: 0.3, arp: 0.3, stab: 0.25 },
    pump: 0.45,
  },
};

export const STYLE_IDS = Object.keys(STYLES);
export const SECTION = { INTRO, GROOVE, BREAK, BUILD, DROP, OUTRO };
