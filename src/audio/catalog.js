const DANCE = 5;
const TECHNO = 6;
const FESTIVAL = 7;
const VOCAL = 8;
const WAREHOUSE = 9;
const TRANCE = 10;
const INDIE = 11;
const TRACKS = {
  [INDIE]: {
    buttonId: 'indieTrack',
    label: 'INDIE DANCE / ELECTRIC PIANO + OFFBEAT BASS',
    name: 'OPEN ROAD',
    style: 'indie',
    trim: 1.2,
    pump: 0.8,
    vocals: true,
    bpm: 123,
    description:
      'WARM, SUNNY INDIE DANCE: A STRAIGHT KICK THAT PUMPS THE WHOLE MIX, A ROUND BASS BETWEEN THE BEATS, DOTTED ELECTRIC PIANO AND A SUNG HOOK. LONG GROOVES, ONE REAL BREAKDOWN.',
  },
  [TRANCE]: {
    buttonId: 'tranceTrack',
    label: 'TRANCE / ROLLING BASS + SUPERSAW WALL',
    name: 'HORIZON LINE',
    style: 'trance',
    trim: 0.92,
    pump: 0.2,
    bpm: 140,
    description:
      'BRIGHT, WIDE TRANCE AT FESTIVAL SIZE: A BASS THAT ROLLS INTO EVERY KICK, A WALL OF SUPERSAWS AND SIXTEENTH ARPEGGIOS, LONG BUILDS AND SHORT, SWEEPING BREAKDOWNS.',
  },
  [WAREHOUSE]: {
    buttonId: 'warehouseTrack',
    label: 'TECHNO / HARD KICK + RUMBLE + PERCUSSION',
    name: 'WAREHOUSE',
    style: 'warehouse',
    trim: 1.1,
    bpm: 135,
    description:
      'DARK, HYPNOTIC TECHNO BUILT ON A HARD KICK, A ROLLING RUMBLE AND LAYERED PERCUSSION THAT DRIFTS AGAINST THE BEAT. LONG BUILDS, BRUTAL DROPS, VERY LITTLE SYNTH.',
  },
  [VOCAL]: {
    buttonId: 'vocalTrack',
    label: 'MELODIC HOUSE / SUNG HOOKS + PIANO',
    name: 'GOLDEN HOUR',
    style: 'vocal',
    trim: 1.08,
    pump: 0.35,
    vocals: true,
    bpm: 122,
    description:
      'WARM, WORDLESS SYNTH VOCALS OVER PIANO, PLUCKS AND A SOFT FOUR-ON-THE-FLOOR. VERSES, BUILDS AND SING-ALONG CHORUSES KEEP RETURNING WITH NEW MELODIES.',
  },
  [FESTIVAL]: {
    buttonId: 'festivalTrack',
    label: 'FESTIVAL HOUSE / PIANO + BIG SYNTH HOOK',
    name: 'SKYLINE RUSH',
    style: 'festival',
    trim: 1.2,
    pump: 0.3,
    bpm: 128,
    description:
      'UPLIFTING PIANO CHORDS, A WIDE SYNTH HOOK AND BIG BUILDS INTO PUMPING DROPS. FAMILIAR THEMES RETURN AS THE SONG KEEPS EVOLVING.',
  },
  [TECHNO]: {
    buttonId: 'technoTrack',
    label: 'TECHNO / ACID + ROLLING BASS',
    name: 'LIVE TECHNO',
    style: 'techno',
    trim: 0.85,
    pump: 0.6,
    bpm: 136,
    description:
      'ROLLING BASS, ACID AND DUB CHORDS. MERGES LIFT THE GROOVE. THE SET KEEPS PLAYING BETWEEN GAMES.',
  },
  [DANCE]: {
    buttonId: 'danceTrack',
    label: 'ELECTRO / PUMPING BASS + SYNTH STABS',
    name: 'NEON CIRCUIT',
    style: 'dance',
    trim: 1.4,
    pump: 0.4,
    bpm: 130,
    description:
      'PUMPING FOUR-ON-THE-FLOOR ELECTRO. SAW SYNTHS, SYNCOPATED BASS AND FRESH EIGHT-BAR PHRASES. THE HARMONY AND ARRANGEMENT KEEP REGENERATING.',
  },
};
const TRACK_IDS = Object.keys(TRACKS).map(Number);
export { DANCE, TECHNO, FESTIVAL, VOCAL, WAREHOUSE, TRANCE, INDIE, TRACK_IDS, TRACKS };
