/**
 * "All My Pals", the song of the ALL MY PALS soundtrack: a finished recording, made with Suno to
 * lyrics written for the game. What the game needs to play along with it was measured from the
 * recording (see README, "The song"):
 * - `bars`: the start of each of its 104 bars in the file, in seconds, and the end of the last one.
 *   Its tempo drifts from about 136.0 to 137.2 BPM, as generated audio does, so the game's clock
 *   follows these bars while the song plays (the recording itself plays untouched).
 * - `chords`: the chord of every bar, one scale degree of A minor per character.
 * - `sections`: where each part starts, `kick` the bars with a beat, `sung` the bars with a voice.
 * - `onset`: when the first note passes 1 % of full scale. The times above are measured on the file
 *   as ffmpeg decodes it; browsers' decoders may start a few milliseconds earlier or later, which
 *   this one landmark lets the player measure and correct.
 */
export const ALL_MY_PALS = {
  file: 'all-my-pals.mp3',
  onset: 0.2065,
  pc: 9,
  scale: 'minor',
  bars: [
    0.2105, 1.9769, 3.7425, 5.5074, 7.2717, 9.0356, 10.7994, 12.5634, 14.3278, 16.0927, 17.858,
    19.6232, 21.3882, 23.1527, 24.9165, 26.6797, 28.4421, 30.2038, 31.9651, 33.7258, 35.4861,
    37.2458, 39.0051, 40.764, 42.5225, 44.2809, 46.039, 47.7969, 49.5547, 51.3124, 53.0699, 54.8273,
    56.5845, 58.3416, 60.0985, 61.8552, 63.6115, 65.3675, 67.1232, 68.8786, 70.6338, 72.3888,
    74.1437, 75.8985, 77.6532, 79.4079, 81.1625, 82.917, 84.6713, 86.4255, 88.1794, 89.9332,
    91.6868, 93.4402, 95.1933, 96.9462, 98.6987, 100.4509, 102.2028, 103.9545, 105.7059, 107.4573,
    109.2085, 110.9596, 112.7106, 114.4617, 116.2126, 117.9635, 119.7142, 121.4648, 123.2152,
    124.9655, 126.7156, 128.4656, 130.2155, 131.9657, 133.716, 135.4665, 137.2169, 138.9669,
    140.7162, 142.4649, 144.2132, 145.9613, 147.7097, 149.4584, 151.2074, 152.9568, 154.7063,
    156.4559, 158.2053, 159.9546, 161.7037, 163.4527, 165.2015, 166.9502, 168.6988, 170.4474,
    172.1961, 173.9448, 175.6935, 177.4422, 179.191, 180.9398, 182.6887,
  ],
  // G Dm F C in the intro, then Dm Am F C, two bars each; G before the first drop, Em before the last.
  chords: [
    '66335522',
    '33005522',
    '33005566',
    '33005522',
    '33005522',
    '33005522',
    '33005522',
    '33005522',
    '33005524',
    '33005522',
    '33005522',
    '33005522',
    '33005522',
  ].join(''),
  sections: [
    [0, 'INTRO'],
    [8, 'VERSE'],
    [22, 'BUILD'],
    [24, 'DROP'],
    [40, 'DROP'],
    [56, 'CHORUS'],
    [70, 'BUILD'],
    [72, 'DROP'],
    [96, 'OUTRO'],
  ],
  kick: [
    [8, 22],
    [24, 39],
    [40, 56],
    [72, 88],
    [90, 96],
  ],
  sung: [
    [8, 22],
    [40, 72],
  ],
};
