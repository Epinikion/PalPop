import { row } from './layers.js';

/** The probability that a layer plays in each kind of segment: 1 always, 0 never, in between a draw. */
const on = (intro, groove, build, drop, brk) => ({
  INTRO: intro,
  GROOVE: groove,
  BUILD: build,
  DROP: drop,
  BREAK: brk,
});
const NO = on(0, 0, 0, 0, 0);

/**
 * The four songs, as data. A profile says what the song is made of (tempo, keys, how chords move,
 * how the long form unfolds, which layers play and what patterns each one draws from); the
 * generator turns it into music that is different every time and never loops.
 */
export const PROFILES = {
  /* Hard techno: a distorted kick, a bass that rolls through every sixteenth before a beat, wide
     rave chords and a lot of percussion. Measured on a 144 BPM clip. */
  rave: {
    bpm: [142, 148],
    swing: 0.002,
    keys: [5, 6, 7, 9, 10],
    scales: [
      ['phrygian', 3],
      ['minor', 4],
      ['harmonic', 1],
    ],
    phraseBars: 4,
    harmony: {
      loops: [[1, 1, 1, 1], [2, 1, 1], [2, 2], [1, 1, 2], [4]],
      start: [
        [0, 5],
        [5, 2],
        [6, 1],
      ],
      moves: {
        0: [
          [5, 3],
          [6, 3],
          [3, 2],
          [4, 1],
          [1, 2],
          [0, 1],
        ],
        1: [
          [0, 3],
          [6, 2],
          [5, 1],
        ],
        2: [
          [0, 2],
          [6, 2],
          [3, 2],
          [5, 1],
        ],
        3: [
          [0, 3],
          [5, 2],
          [6, 2],
          [4, 1],
        ],
        4: [
          [0, 4],
          [5, 2],
        ],
        5: [
          [0, 3],
          [6, 3],
          [3, 1],
          [4, 1],
        ],
        6: [
          [0, 4],
          [5, 2],
          [3, 2],
          [4, 1],
        ],
      },
      keep: 0.4,
      tweak: 0.3,
      qualities: [
        ['sus4', 3],
        ['power', 2],
        ['triad', 2],
        ['seventh', 2],
      ],
    },
    form: {
      toggle: 0.5,
      INTRO: { len: [8, 16], energy: [0.35, 0.5], next: [['GROOVE', 1]] },
      GROOVE: {
        len: [16, 32],
        energy: [0.6, 0.8],
        next: [
          ['BUILD', 5],
          ['BREAK', 2],
          ['DROP', 2],
          ['GROOVE', 1],
        ],
      },
      BUILD: { len: [4, 8], energy: [0.7, 0.95], next: [['DROP', 1]] },
      DROP: {
        len: [16, 32],
        energy: [0.9, 1],
        next: [
          ['BREAK', 4],
          ['GROOVE', 3],
          ['BUILD', 2],
        ],
      },
      BREAK: {
        len: [8, 16],
        energy: [0.2, 0.4],
        next: [
          ['BUILD', 4],
          ['GROOVE', 1],
        ],
      },
    },
    layers: {
      kick: {
        on: on(1, 1, 1, 1, 0),
        tpl: row('X...X...X...X...'),
        roll: 2,
        dropout: 0.5,
        fill: 0.25,
      },
      bass: {
        on: on(0.5, 1, 0.7, 1, 0),
        tpl: row('.,oX.,oX.,oX.,oX'),
        mutate: 0.2,
        range: [45, 58],
        notes: [
          [[0, 0], 6],
          [[0, 1], 2],
          [[4, 0], 1],
          [[1, 0], 1],
          [[6, 0], 1],
        ],
        lens: [
          [1, 6],
          [2, 1],
        ],
      },
      hat: { on: on(0.6, 1, 0.8, 1, 0.15), tpl: row('oooooooooooooooo'), mutate: 0.15 },
      open: { on: on(0, 0.8, 0.5, 1, 0), tpl: row('..X...X...X...X.'), mutate: 0.08 },
      clap: { on: on(0, 0.85, 0.6, 1, 0), tpl: row('....X.......X...'), mutate: 0.05 },
      perc: {
        on: on(0.3, 0.8, 0.5, 0.9, 0.3),
        tpl: row('c.,.c.,.c.,.c.,.'),
        mutate: 0.25,
        kinds: [
          ['rim', 3],
          ['tom', 2],
          ['ping', 1],
          ['tick', 2],
          ['blast', 0.3],
        ],
      },
      snare: { on: on(1, 1, 1, 1, 1), roll: 4, fill: 0.3 },
      stab: {
        on: on(0, 0.45, 0.6, 0.85, 0.2),
        tpl: row('..o...,...o...o.'),
        mutate: 0.25,
        len: [
          [1, 3],
          [2, 3],
          [3, 1],
        ],
      },
      arp: {
        on: on(0.15, 0.5, 0.6, 0.75, 0.8),
        tpl: row('xoxoxoxoxoxoxoxo'),
        range: [60, 84],
        pool: [
          [0, 3],
          [1, 2],
          [2, 2],
          [3, 1],
          [-1, 1],
        ],
        len: 0.9,
        mutate: 0.22,
      },
      acid: {
        on: on(0, 0.3, 0, 0.35, 0),
        tpl: row('XooXoXooXooXoXoo'),
        range: [36, 62],
        mode: 'scale',
        pool: [
          [0, 4],
          [1, 2],
          [2, 2],
          [3, 1],
          [-1, 1],
          [4, 1],
        ],
        len: 0.9,
        mutate: 0.2,
        accent: 0.3,
      },
      lead: {
        on: on(0, 0.1, 0, 0.3, 0.3),
        range: [60, 79],
        rhythms: [
          [
            [0, 2],
            [3, 1],
            [4, 2],
            [8, 3],
            [12, 2],
          ],
          [
            [0, 3],
            [4, 3],
            [8, 2],
            [10, 2],
            [14, 2],
          ],
          [
            [2, 2],
            [6, 2],
            [10, 4],
            [16, 4],
            [24, 4],
          ],
        ],
      },
      pad: { on: on(0.5, 0.65, 0.7, 0.9, 1) },
    },
    sound: { kick: 4, tune: 3, duck: 0.6, voices: 'rave' },
    mix: {
      kick: 0.68,
      bass: 0.62,
      hat: 3.52,
      open: 2.88,
      clap: 2.56,
      perc: 2.4,
      snare: 1,
      stab: 4,
      arp: 4.8,
      acid: 1,
      lead: 1.4,
      pad: 3.8,
    },
  },

  /* Euphoric hard trance: a raw kick, a bass that fills every off-sixteenth, a constant sixteenth
     arpeggio high above and wide supersaw chords. Measured on a 156 BPM clip in B major. */
  euphoria: {
    bpm: [150, 158],
    swing: 0.002,
    keys: [4, 11, 9, 6, 2],
    scales: [
      ['major', 5],
      ['lydian', 2],
      ['mixolydian', 1],
    ],
    phraseBars: 4,
    harmony: {
      loops: [[1, 1, 1, 1], [2, 2], [2, 1, 1], [1, 1, 2], [4]],
      start: [
        [0, 4],
        [5, 3],
        [3, 2],
      ],
      moves: {
        0: [
          [4, 3],
          [5, 3],
          [3, 3],
          [1, 1],
          [2, 1],
        ],
        1: [
          [4, 3],
          [0, 1],
          [5, 2],
        ],
        2: [
          [5, 3],
          [3, 2],
          [0, 1],
        ],
        3: [
          [0, 3],
          [4, 3],
          [1, 1],
        ],
        4: [
          [0, 4],
          [5, 3],
          [3, 1],
        ],
        5: [
          [3, 3],
          [4, 3],
          [1, 2],
          [0, 1],
        ],
        6: [[0, 2]],
      },
      keep: 0.35,
      tweak: 0.3,
      qualities: [
        ['triad', 5],
        ['sus2', 2],
        ['ninth', 1],
      ],
    },
    form: {
      toggle: 0.5,
      INTRO: { len: [8, 16], energy: [0.3, 0.5], next: [['GROOVE', 1]] },
      GROOVE: {
        len: [16, 32],
        energy: [0.6, 0.8],
        next: [
          ['BUILD', 6],
          ['BREAK', 2],
          ['DROP', 1],
        ],
      },
      BUILD: { len: [8, 16], energy: [0.7, 0.95], next: [['DROP', 1]] },
      DROP: {
        len: [16, 32],
        energy: [0.9, 1],
        next: [
          ['BREAK', 5],
          ['GROOVE', 2],
          ['BUILD', 2],
        ],
      },
      BREAK: {
        len: [16],
        energy: [0.2, 0.4],
        next: [
          ['BUILD', 5],
          ['GROOVE', 1],
        ],
      },
    },
    layers: {
      kick: {
        on: on(1, 1, 1, 1, 0),
        tpl: row('X...X...X...X...'),
        roll: 4,
        dropout: 0.6,
        fill: 0.35,
      },
      bass: {
        on: on(0.5, 1, 0.4, 1, 0),
        tpl: row('.xXx.xXx.xXx.xXx'),
        mutate: 0.2,
        range: [33, 46],
        notes: [
          [[0, 0], 5],
          [[0, 1], 1],
          [[2, 0], 2],
          [[4, 0], 2],
          [[1, 0], 1],
        ],
        lens: [[1, 1]],
      },
      hat: { on: on(0.5, 1, 0.7, 1, 0.1), tpl: row('c,c,c,c,c,c,c,c,'), mutate: 0.15 },
      open: { on: on(0, 0.9, 0.5, 1, 0), tpl: row('..X...X...X...X.'), mutate: 0.05 },
      clap: { on: on(0, 0.9, 0.7, 1, 0), tpl: row('....X.......X...'), mutate: 0.05 },
      perc: {
        on: on(0.2, 0.6, 0.5, 0.7, 0.2),
        tpl: row('c.,.c.,.c.,.c.,.'),
        mutate: 0.25,
        kinds: [
          ['shaker', 3],
          ['rim', 2],
          ['ride', 1],
          ['tom', 1],
          ['ping', 1],
        ],
      },
      snare: { on: on(1, 1, 1, 1, 1), roll: 8, fill: 0.35 },
      stab: {
        on: on(0, 0.5, 0.5, 0.7, 0.1),
        tpl: row('..o...o...o...o.'),
        mutate: 0.2,
        len: [
          [1, 3],
          [2, 2],
          [4, 1],
        ],
      },
      arp: {
        on: on(0.5, 0.9, 0.7, 0.9, 1),
        tpl: row('xxxxxxxxxxxxxxxx'),
        range: [66, 89],
        pool: [
          [0, 3],
          [1, 3],
          [2, 3],
          [3, 2],
          [4, 2],
          [-1, 1],
        ],
        len: 0.9,
        mutate: 0.2,
        accent: 0.3,
      },
      acid: { on: NO, tpl: row('................'), range: [36, 62], pool: [[0, 1]], len: 1 },
      lead: {
        on: on(0, 0.1, 0, 0.8, 0.7),
        range: [66, 86],
        rhythms: [
          [
            [0, 8],
            [8, 6],
            [16, 8],
            [24, 6],
          ],
          [
            [0, 6],
            [6, 2],
            [8, 6],
            [16, 6],
            [24, 8],
          ],
          [
            [2, 6],
            [8, 4],
            [12, 4],
            [18, 6],
            [26, 6],
          ],
        ],
      },
      pad: { on: on(0.6, 0.7, 0.8, 0.9, 1) },
    },
    sound: { kick: 5, tune: -2, duck: 0.6, voices: 'euphoric' },
    mix: {
      kick: 0.7,
      bass: 0.62,
      hat: 2.8,
      open: 2.52,
      clap: 1.6,
      perc: 1.96,
      snare: 1,
      stab: 2.4,
      arp: 3.64,
      acid: 1,
      lead: 1.96,
      pad: 2.4,
    },
  },

  /* Melodic techno: a punchy kick, a bass that leans into the beat, plucked arpeggios, long wide
     pads and long builds. Measured on a 126 BPM mix in A minor. */
  melodic: {
    bpm: [122, 128],
    swing: 0.003,
    keys: [9, 2, 5, 7, 0],
    scales: [
      ['minor', 5],
      ['dorian', 2],
    ],
    phraseBars: 8,
    harmony: {
      loops: [[4, 4], [2, 2, 4], [2, 2, 2, 2], [1, 1, 2, 4], [8]],
      start: [
        [0, 5],
        [5, 2],
        [3, 1],
      ],
      moves: {
        0: [
          [5, 3],
          [6, 3],
          [3, 3],
          [4, 2],
          [2, 1],
        ],
        1: [
          [0, 3],
          [6, 2],
        ],
        2: [
          [6, 3],
          [0, 2],
          [5, 1],
        ],
        3: [
          [0, 3],
          [5, 2],
          [6, 2],
          [4, 1],
        ],
        4: [
          [0, 4],
          [5, 3],
          [3, 1],
        ],
        5: [
          [6, 3],
          [3, 2],
          [0, 2],
          [4, 1],
        ],
        6: [
          [0, 4],
          [5, 2],
          [3, 2],
        ],
      },
      keep: 0.5,
      tweak: 0.3,
      qualities: [
        ['triad', 3],
        ['seventh', 3],
        ['ninth', 2],
        ['sus2', 1],
      ],
    },
    form: {
      toggle: 0.5,
      INTRO: { len: [16, 32], energy: [0.25, 0.45], next: [['GROOVE', 1]] },
      GROOVE: {
        len: [16, 32],
        energy: [0.55, 0.75],
        next: [
          ['BUILD', 5],
          ['BREAK', 3],
          ['DROP', 1],
        ],
      },
      BUILD: { len: [8, 16], energy: [0.65, 0.9], next: [['DROP', 1]] },
      DROP: {
        len: [16, 32, 48],
        energy: [0.85, 1],
        next: [
          ['BREAK', 4],
          ['GROOVE', 3],
          ['BUILD', 1],
        ],
      },
      BREAK: {
        len: [16, 32],
        energy: [0.2, 0.4],
        next: [
          ['BUILD', 5],
          ['GROOVE', 1],
        ],
      },
    },
    layers: {
      kick: {
        on: on(1, 1, 1, 1, 0.1),
        tpl: row('X...X...X...X...'),
        roll: 0,
        dropout: 0.3,
        fill: 0.15,
      },
      bass: {
        on: on(0.4, 1, 0.6, 1, 0),
        tpl: row('..,o..,o..,o..,o'),
        mutate: 0.18,
        range: [41, 55],
        notes: [
          [[0, 0], 6],
          [[0, 1], 2],
          [[4, 0], 2],
          [[2, 0], 1],
        ],
        lens: [
          [1, 5],
          [2, 2],
        ],
      },
      hat: { on: on(0.4, 0.9, 0.7, 1, 0.2), tpl: row('c,c,c,c,c,c,c,c,'), mutate: 0.12 },
      open: { on: on(0.3, 1, 0.6, 1, 0), tpl: row('..X...X...X...X.'), mutate: 0.05 },
      clap: { on: on(0, 0.8, 0.6, 1, 0), tpl: row('....X.......X...'), mutate: 0.05 },
      perc: {
        on: on(0.3, 0.7, 0.5, 0.8, 0.3),
        tpl: row('c.,.c.,.c.,.c.,.'),
        mutate: 0.25,
        kinds: [
          ['shaker', 3],
          ['rim', 2],
          ['tom', 2],
          ['ping', 2],
          ['ride', 1],
        ],
      },
      snare: { on: on(1, 1, 1, 1, 1), roll: 8, fill: 0.2 },
      stab: {
        on: on(0, 0.6, 0.5, 0.8, 0.3),
        tpl: row('...x..o....x..o.'),
        mutate: 0.18,
        len: [
          [1, 2],
          [2, 3],
          [3, 1],
        ],
      },
      arp: {
        on: on(0.3, 0.8, 0.8, 0.9, 0.9),
        tpl: row('x,xoxxo,xoxx,xoxx'),
        range: [57, 81],
        pool: [
          [0, 3],
          [1, 3],
          [2, 3],
          [3, 2],
          [-1, 1],
          [4, 1],
        ],
        len: 0.85,
        mutate: 0.18,
        accent: 0.3,
      },
      acid: { on: NO, tpl: row('................'), range: [36, 62], pool: [[0, 1]], len: 1 },
      lead: {
        on: on(0, 0.1, 0, 0.3, 0.4),
        range: [62, 81],
        rhythms: [
          [
            [0, 6],
            [8, 4],
            [12, 4],
            [16, 8],
            [24, 6],
          ],
          [
            [0, 4],
            [4, 4],
            [8, 8],
            [16, 6],
            [24, 6],
          ],
        ],
      },
      pad: { on: on(0.7, 0.8, 0.9, 0.9, 1) },
    },
    sound: { kick: 1, tune: -3, duck: 0.5, voices: 'melodic' },
    mix: {
      kick: 0.7,
      bass: 1.5,
      hat: 2.2,
      open: 2,
      clap: 1.7,
      perc: 1.3,
      snare: 1,
      stab: 2.1,
      arp: 2.1,
      acid: 1,
      lead: 1.8,
      pad: 1.9,
    },
  },

  /* Rave anthem: a clean four-on-the-floor kick, a bass that pumps on every off-beat and a
     continuous sixteenth riff of one saw voice over big chords. Measured on a 136 BPM record. */
  anthem: {
    bpm: [134, 138],
    swing: 0.002,
    keys: [6, 9, 4, 11, 1],
    scales: [
      ['minor', 5],
      ['harmonic', 1],
      ['dorian', 1],
    ],
    phraseBars: 4,
    harmony: {
      loops: [[1, 1, 1, 1], [2, 2], [2, 1, 1], [4]],
      start: [
        [0, 5],
        [5, 2],
        [3, 1],
      ],
      moves: {
        0: [
          [5, 3],
          [6, 3],
          [3, 3],
          [4, 2],
        ],
        1: [
          [0, 3],
          [6, 2],
        ],
        2: [
          [6, 3],
          [0, 2],
          [5, 1],
        ],
        3: [
          [0, 3],
          [5, 2],
          [6, 2],
        ],
        4: [
          [0, 4],
          [5, 3],
        ],
        5: [
          [6, 3],
          [3, 2],
          [0, 2],
          [4, 1],
        ],
        6: [
          [0, 4],
          [5, 2],
          [3, 2],
        ],
      },
      keep: 0.4,
      tweak: 0.3,
      qualities: [
        ['triad', 4],
        ['seventh', 2],
        ['sus4', 1],
      ],
    },
    form: {
      toggle: 0.5,
      INTRO: { len: [8, 16], energy: [0.3, 0.5], next: [['GROOVE', 1]] },
      GROOVE: {
        len: [16],
        energy: [0.6, 0.8],
        next: [
          ['BUILD', 5],
          ['BREAK', 2],
          ['DROP', 2],
        ],
      },
      BUILD: { len: [4, 8], energy: [0.7, 0.95], next: [['DROP', 1]] },
      DROP: {
        len: [16, 32],
        energy: [0.9, 1],
        next: [
          ['BREAK', 4],
          ['GROOVE', 3],
          ['BUILD', 2],
        ],
      },
      BREAK: {
        len: [8, 16],
        energy: [0.2, 0.4],
        next: [
          ['BUILD', 5],
          ['GROOVE', 1],
        ],
      },
    },
    layers: {
      kick: {
        on: on(1, 1, 1, 1, 0),
        tpl: row('X...X...X...X...'),
        roll: 2,
        dropout: 0.5,
        fill: 0.2,
      },
      bass: {
        on: on(0.5, 1, 0.6, 1, 0),
        tpl: row('..X...X...X...X.'),
        mutate: 0.12,
        range: [34, 48],
        notes: [
          [[0, 0], 8],
          [[0, 1], 1],
          [[4, 0], 2],
        ],
        lens: [
          [2, 4],
          [1, 2],
        ],
      },
      hat: { on: on(0.5, 1, 0.7, 1, 0.1), tpl: row('c,c,c,c,c,c,c,c,'), mutate: 0.1 },
      open: { on: on(0, 0.9, 0.6, 1, 0), tpl: row('..X...X...X...X.'), mutate: 0.04 },
      clap: { on: on(0, 0.9, 0.7, 1, 0), tpl: row('....X.......X...'), mutate: 0.04 },
      perc: {
        on: on(0.2, 0.5, 0.4, 0.6, 0.2),
        tpl: row('c.,.c.,.c.,.c.,.'),
        mutate: 0.25,
        kinds: [
          ['shaker', 3],
          ['rim', 2],
          ['tom', 1],
          ['ride', 1],
        ],
      },
      snare: { on: on(1, 1, 1, 1, 1), roll: 4, fill: 0.3 },
      stab: {
        on: on(0, 0.5, 0.5, 0.8, 0.2),
        tpl: row('X..x..o...X..o..'),
        mutate: 0.15,
        len: [
          [1, 3],
          [2, 2],
        ],
      },
      arp: {
        on: on(0.4, 0.9, 0.7, 1, 0.9),
        tpl: row('XxxXxxXxxXxxXxxX'),
        range: [48, 72],
        mode: 'scale',
        pool: [
          [0, 5],
          [2, 2],
          [4, 2],
          [-1, 1],
          [1, 1],
          [3, 1],
          [-2, 1],
        ],
        len: 0.95,
        mutate: 0.15,
        accent: 0.35,
      },
      acid: { on: NO, tpl: row('................'), range: [36, 62], pool: [[0, 1]], len: 1 },
      lead: {
        on: on(0, 0.1, 0, 0.6, 0.7),
        range: [62, 84],
        rhythms: [
          [
            [0, 6],
            [8, 4],
            [12, 4],
            [16, 8],
            [24, 6],
          ],
          [
            [0, 3],
            [4, 3],
            [8, 4],
            [12, 4],
            [16, 6],
            [24, 6],
          ],
          [
            [0, 8],
            [8, 8],
            [16, 8],
            [24, 8],
          ],
        ],
      },
      pad: { on: on(0.5, 0.6, 0.7, 0.8, 1) },
    },
    sound: { kick: 3, tune: 0, duck: 0.65, voices: 'anthem' },
    mix: {
      kick: 1.15,
      bass: 0.45,
      hat: 1.8,
      open: 1.6,
      clap: 1.5,
      perc: 1.2,
      snare: 1,
      stab: 2.4,
      arp: 2.4,
      acid: 1,
      lead: 1.4,
      pad: 3.4,
    },
  },
};

export const PROFILE_IDS = Object.keys(PROFILES);
