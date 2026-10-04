import { composeVocalPhrase, pitchOf } from './songs/vocal-composition.js';

/** Lead level per part: verses sit back, the chorus carries the song. */
export const LEAD = { intro: 0.3, verse: 0.4, pre: 0.45, chorus: 0.52, bridge: 0.46, outro: 0.28 };

/**
 * The sung parts of a vocal-led style: finds the phrase for a section and sings the notes that
 * start on a step, with doubles, a tenor, a harmony and the choir. `forms` are the style's
 * 64-bar forms (the first one is the opening chapter) and `lead` its level per part.
 */
export function createSinger({ audio, audioComposition, audioInstruments, forms, lead = LEAD }) {
  const phrases = new Map();
  /** Phrases are indexed by step, with their neighbours, so legato and breaths can be decided. */
  function phraseFor(session, kind, occurrence) {
    const key = `${session.seed}:${kind}:${occurrence}`;
    if (!phrases.has(key)) {
      const phrase = composeVocalPhrase(session, kind, occurrence);
      phrase.byStep = new Map(
        phrase.notes.map((note, index) => [
          note.step,
          { note, previous: phrase.notes[index - 1], next: phrase.notes[index + 1] },
        ]),
      );
      phrases.set(key, phrase);
      if (phrases.size > 6) phrases.delete(phrases.keys().next().value);
    }
    return phrases.get(key);
  }
  /** How many sections of this name came earlier in the chapter (first chorus, final chorus...). */
  function occurrenceOf(cyc, name, start) {
    const form = cyc === 0 ? forms[0] : audioComposition.chapterFor(cyc).form;
    return form.filter(([end, label]) => label === name && end <= start).length;
  }
  /**
   * Sings whatever starts on sixteenth `si` of this bar. `kind` is intro, verse, pre, chorus,
   * bridge or outro, `human(salt)` a deterministic random, `level` the voice's mix level.
   */
  function sing({
    t,
    ts,
    si,
    section,
    session,
    kind,
    occurrence,
    human,
    voicing,
    dropout,
    level: mix = 1,
  }) {
    const s16 = session.s16,
      intro = kind === 'intro',
      pre = kind === 'pre',
      chorus = kind === 'chorus',
      bridge = kind === 'bridge',
      outro = kind === 'outro',
      final = chorus && occurrence > 0,
      half = Math.floor(section.bs / 8),
      LEVEL = { voice: mix },
      LEAD = lead;
    if (!dropout && !audio.dangerActive) {
      const phrase = phraseFor(session, kind, occurrence),
        local = intro
          ? section.bs - (section.len - phrase.bars)
          : outro || pre
            ? section.bs
            : section.bs % phrase.bars,
        hit = local >= 0 ? phrase.byStep.get(local * 16 + si) : null;
      if (hit) {
        const { note, previous, next } = hit,
          gap = previous ? note.step - (previous.step + previous.len) : 99,
          legato = gap <= 1 && Math.abs(note.midi - previous.midi) <= 7,
          nextGap = next ? next.step - (note.step + note.len) : 99,
          at = ts + 0.008 + (human(12) - 0.5) * 0.014,
          d = Math.max(0.14, note.len * s16 - 0.03),
          level = LEAD[kind] * note.vel * LEVEL.voice * (chorus ? 1 + 0.08 * (half % 2) : 1),
          sing = {
            syllable: note.syllable,
            from: legato ? previous.midi : null,
            scoop: !legato && gap >= 4 && human(7) < 0.5 ? 0.5 + human(8) * 0.5 : 0,
            fall: nextGap >= 5 && note.len >= 4 && human(9) < 0.7 ? 0.6 + human(10) * 0.5 : 0,
            breath: intro || outro ? 1.4 : 1,
            reverbSend: bridge || intro || outro ? 0.34 : 0.22,
          };
        audioInstruments.eVoice(at, note.midi, d, level, sing);
        if (chorus || bridge) {
          // A second take a few cents off, slightly late, widens the lead the way doubling does.
          audioInstruments.eVoice(at + 0.014, note.midi, d, level * 0.36, {
            ...sing,
            backing: true,
            pan: -0.3,
            cents: -6,
            vibrato: 0.7,
            delaySend: 0.05,
          });
        }
        if ((chorus && (half % 2 === 1 || final)) || bridge)
          audioInstruments.eVoice(at + 0.01, note.midi - 12, d, level * 0.32, {
            ...sing,
            type: 'tenor',
            backing: true,
            pan: 0.28,
            scoop: 0,
          });
        if (final || (pre && local >= 2))
          audioInstruments.eVoice(at + 0.018, pitchOf(session, note.degree + 2), d, level * 0.28, {
            ...sing,
            backing: true,
            pan: 0.38,
            cents: 4,
            scoop: 0,
            from: null,
          });
      }
      // A soft "ooh" choir under the bridge, the final chorus and the end of the intro.
      if (si === 0 && (bridge || final || (intro && section.bs >= 2) || (outro && section.bs < 2)))
        voicing.forEach((note, index) =>
          audioInstruments.eVoice(
            t + 0.012 * index,
            note,
            s16 * 15,
            (bridge ? 0.34 : final ? 0.22 : 0.26) * LEVEL.voice,
            {
              syllable: 'oo',
              type: note < 58 ? 'tenor' : 'alto',
              backing: true,
              pan: [-0.35, 0, 0.35][index],
              vibrato: 0.6,
              reverbSend: 0.32,
            },
          ),
        );
    }
  }
  return { sing, occurrenceOf, phraseCount: () => phrases.size };
}
