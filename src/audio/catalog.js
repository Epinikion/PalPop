const DANCE = 5;
const TECHNO = 6;
const FESTIVAL = 7;
const VISUAL_THEME = 6;
const TRACKS = {
  [FESTIVAL]: {
    buttonId: 'festivalTrack',
    label: 'FESTIVAL HOUSE / PIANO + BIG SYNTH HOOK',
    name: 'SKYLINE RUSH',
    style: 'festival',
    trim: 1,
    bpm: 128,
    description:
      'UPLIFTING PIANO CHORDS, A WIDE SYNTH HOOK AND BIG BUILDS INTO PUMPING DROPS. FAMILIAR THEMES RETURN AS THE SONG KEEPS EVOLVING.',
  },
  [TECHNO]: {
    buttonId: 'technoTrack',
    label: 'TECHNO / ACID + ROLLING BASS',
    name: 'LIVE TECHNO',
    style: 'techno',
    trim: 0.7,
    bpm: 136,
    description:
      'ROLLING BASS, ACID AND DUB CHORDS. MERGES LIFT THE GROOVE. THE SET KEEPS PLAYING BETWEEN GAMES.',
  },
  [DANCE]: {
    buttonId: 'danceTrack',
    label: 'ELECTRO / PUMPING BASS + SYNTH STABS',
    name: 'NEON CIRCUIT',
    style: 'dance',
    trim: 1.1,
    bpm: 130,
    description:
      'PUMPING FOUR-ON-THE-FLOOR ELECTRO. SAW SYNTHS, SYNCOPATED BASS AND FRESH EIGHT-BAR PHRASES. THE HARMONY AND ARRANGEMENT KEEP REGENERATING.',
  },
};
const TRACK_IDS = Object.keys(TRACKS).map(Number);
export { DANCE, TECHNO, FESTIVAL, VISUAL_THEME, TRACK_IDS, TRACKS };
