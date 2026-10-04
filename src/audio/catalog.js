const SOLAR = 1;
const BLACKOUT = 2;
const AFTER_HOURS = 3;
const ANTHEM = 4;
/**
 * The soundtracks. Each one is a generative style (see gen/profiles.js): the song is composed as it
 * plays, from the seed, and never loops. `trim` and `pump` are per-song balance of the master bus.
 */
const TRACKS = {
  [SOLAR]: {
    buttonId: 'solarTrack',
    label: 'EUPHORIC TRANCE / SIXTEENTH ARPS + SUPERSAW LEAD',
    name: 'SOLAR RUSH',
    style: 'euphoria',
    trim: 1,
    pump: 0.7,
    bpm: 156,
    description:
      'FAST, EUPHORIC HARD TRANCE: A RAW KICK, A BASS THAT ROLLS THROUGH EVERY SIXTEENTH, ARPEGGIOS THAT NEVER STOP AND A BIG MAJOR-KEY LEAD. COMPOSED AS IT PLAYS, NEVER THE SAME TWICE.',
  },
  [BLACKOUT]: {
    buttonId: 'raveTrack',
    label: 'HARD TECHNO / DISTORTED KICK + ROLLING BASS',
    name: 'BLACKOUT',
    style: 'rave',
    trim: 1,
    pump: 0.7,
    bpm: 145,
    description:
      'HARD, ENDLESS TECHNO: A DISTORTED KICK, A BASS THAT ROLLS THROUGH EVERY SIXTEENTH, WIDE RAVE CHORDS AND HEAVY PERCUSSION. COMPOSED AS IT PLAYS, NEVER THE SAME TWICE.',
  },
  [AFTER_HOURS]: {
    buttonId: 'melodicTrack',
    label: 'MELODIC TECHNO / DEEP PADS + SLOW MELODIES',
    name: 'AFTER HOURS',
    style: 'melodic',
    trim: 1,
    pump: 0.6,
    bpm: 126,
    description:
      'DEEP, DRIVING MELODIC TECHNO: A ROUND KICK, A MOVING BASS, WIDE PADS AND LONG MELODIES THAT TURN OVER SLOWLY. COMPOSED AS IT PLAYS, NEVER THE SAME TWICE.',
  },
  [ANTHEM]: {
    buttonId: 'anthemTrack',
    label: 'RAVE ANTHEM / ARP RIFF + BIG BUILDS',
    name: 'RAVE ANTHEM',
    style: 'anthem',
    trim: 1,
    pump: 0.7,
    bpm: 136,
    description:
      'A CLASSIC DANCEFLOOR ANTHEM: A BRIGHT SYNTH RIFF OVER A STRAIGHT KICK, BIG BUILDS, SNARE ROLLS AND DROPS. COMPOSED AS IT PLAYS, NEVER THE SAME TWICE.',
  },
};
const TRACK_IDS = Object.keys(TRACKS).map(Number);
export { SOLAR, BLACKOUT, AFTER_HOURS, ANTHEM, TRACK_IDS, TRACKS };
