import { STYLES } from './styles.js';
import { composeTrack, drumRow, formOf, isRecord } from './track.js';
import { pick, unit } from './random.js';

/** Which stem a layer plays (the hook has a lifted variant for the second drop). */
const MELODIC = ['bass', 'hook', 'arp', 'stab', 'pad'];
/** Drum fills at the end of an eight-bar phrase, and how often each comes. */
const FILLS = [
  ['none', 4],
  ['snare', 2],
  ['tom', 1],
  ['kickout', 1],
  ['clap', 1],
];

/**
 * An endless DJ set of one style: track after track, each composed from the seed and its number, so
 * the set never plays the same track twice, while every track itself is built the way real tracks
 * are - loops that repeat and develop through its sections. Everything the engine plays in a bar is
 * a pure function of the bar (`plan(bar)`), and only a few tracks are held at a time.
 *
 * The set also keeps the clock: where every step falls in time. Generated tracks keep the session's
 * tempo; a recorded song keeps its own, bar by bar as it was measured, so the music the game plays
 * along with it stays on its beat.
 */
export function createSet(session) {
  const style = STYLES[session.style],
    record = style.record,
    barTime = 16 * session.s16,
    starts = [0],
    times = [0],
    keys = [],
    tracks = new Map(),
    plans = new Map();

  /** The key of track `index` (each track moves to a new one). */
  function keyOf(index) {
    while (keys.length <= index) {
      const k = keys.length;
      keys.push(k === 0 ? session.pc : trackFor(k, keys[k - 1]).pc);
    }
    return keys[index];
  }
  /** Places one more track: the bar and the second where the next one starts. */
  function extend() {
    const index = starts.length - 1,
      length = formOf(session, index).length;
    starts.push(starts[index] + length);
    times.push(
      times[index] +
        (isRecord(session, index) ? record.bars[length] - record.bars[0] : length * barTime),
    );
  }
  function trackFor(index, previousPc) {
    if (!tracks.has(index)) {
      tracks.set(index, composeTrack(session, index, previousPc));
      // Only the tracks around the one playing are kept.
      for (const key of tracks.keys()) if (key < index - 1 || key > index + 2) tracks.delete(key);
    }
    return tracks.get(index);
  }
  const track = (index) => trackFor(index, index ? keyOf(index - 1) : undefined);

  /** The track a bar belongs to, and the bar inside it. */
  function locate(bar) {
    bar = Math.max(0, Math.floor(bar));
    while (starts.at(-1) <= bar) extend();
    const index = last(starts, bar);
    return { index, local: bar - starts[index], start: starts[index] };
  }
  /** Seconds from the start of the set to a step (a fraction of a step is allowed). */
  function secondsAt(step) {
    if (step <= 0) return step * session.s16;
    const bar = Math.floor(step / 16),
      { index, local } = locate(bar),
      within = step / 16 - bar;
    if (!isRecord(session, index)) return times[index] + (local + within) * barTime;
    const marks = record.bars;
    return times[index] + marks[local] - marks[0] + within * (marks[local + 1] - marks[local]);
  }
  /** The step (with its fraction) that sounds a number of seconds after the start of the set. */
  function stepAt(seconds) {
    if (seconds <= 0) return seconds / session.s16;
    while (times.at(-1) <= seconds) extend();
    const index = last(times, seconds),
      into = seconds - times[index];
    if (!isRecord(session, index)) return 16 * starts[index] + into / session.s16;
    const marks = record.bars,
      at = marks[0] + into,
      bar = Math.min(last(marks, at), marks.length - 2);
    return 16 * (starts[index] + bar) + (16 * (at - marks[bar])) / (marks[bar + 1] - marks[bar]);
  }
  function sectionOf(t, local) {
    let found = t.sections[0];
    for (const section of t.sections) if (section.start <= local) found = section;
    return found;
  }
  /** Whether a layer plays in a bar of a section. */
  function playing(name, section, bs) {
    const { spec, len } = section,
      half = bs >= len / 2;
    if (name === 'arp' && !style.arp) return false;
    if (name === 'stab' && !style.stabRhythms) return false;
    if (name === 'rumble' && !style.sound.rumble) return false;
    return (
      spec.layers.includes(name) ||
      (half && (spec.late || []).includes(name)) ||
      (!half && (spec.early || []).includes(name))
    );
  }
  function layersAt(bar) {
    const { index, local } = locate(bar),
      t = track(index),
      section = sectionOf(t, local),
      bs = local - section.start,
      on = {};
    for (const name of [
      ...MELODIC,
      'kick',
      'hat',
      'open',
      'clap',
      'ride',
      'perc',
      'rumble',
      'roll',
    ])
      on[name] = !t.record && playing(name, section, bs);
    return on;
  }

  /** `{ sec, bs, len, cyc, energy, progress }` for the music meter and the gameplay sounds. */
  function sectionAt(bar) {
    const { index, local } = locate(bar),
      t = track(index),
      section = sectionOf(t, local),
      bs = local - section.start;
    return {
      sec: section.type,
      bs,
      len: section.len,
      cyc: index,
      track: index,
      progress: bs / section.len,
      energy: ENERGY[section.type],
    };
  }
  /** The chord that sounds in a bar, for gameplay replies that should fit the music. */
  function chordAt(bar) {
    const { index, local } = locate(bar),
      t = track(index),
      chord = t.chords[Math.floor((local % t.cycleBars) / t.chordBars)];
    return { ...chord, bass: 28 + ((chord.root - 4 + 12) % 12) };
  }

  /** Everything that happens in one bar, as data. */
  function plan(bar) {
    bar = Math.max(0, Math.floor(bar));
    if (plans.has(bar)) return plans.get(bar);
    const { index, local, start } = locate(bar),
      t = track(index),
      section = sectionOf(t, local),
      bs = local - section.start,
      { type, len } = section,
      on = layersAt(bar),
      phraseEnd = bs % 8 === 7,
      lastBar = bs === len - 1,
      build = type === 'BUILD',
      seed = t.seed,
      dropout = build && lastBar,
      second = Math.floor(bs / 16) % 2 === 1,
      row = (name) => drumRow(second ? t.rows[name].b : t.rows[name].a),
      empty = () => new Array(16).fill(0),
      drums = {};
    if (t.record) return remember(recordPlan());
    for (const name of ['kick', 'hat', 'open', 'clap', 'ride'])
      drums[name] = on[name] ? row(name) : empty();
    const perc = drumRow(t.rows.perc.a);
    drums.perc = on.perc ? perc.slice((bar % 2) * 16, (bar % 2) * 16 + 16) : empty();
    drums.snare = empty();
    drums.tom = empty();

    // A build rolls on the snare, faster and louder towards the drop; its kick doubles at the end.
    if (on.roll) {
      const progress = (bs + 1) / len,
        interval = progress < 0.4 ? 4 : progress < 0.7 ? 2 : 1;
      for (let i = 0; i < 16; i += interval) drums.snare[i] = 0.35 + 0.55 * progress;
      if (on.kick && progress > 0.75) for (let i = 2; i < 16; i += 4) drums.kick[i] = 0.7;
    }
    // A fill at the end of most eight-bar phrases, so the groove breathes.
    const fill =
      phraseEnd && !build && on.kick ? pick(weightedList(FILLS), seed, 'fill', bar) : 'none';
    if (fill === 'snare') for (let i = 12; i < 16; i++) drums.snare[i] = 0.4 + 0.12 * (i - 12);
    if (fill === 'tom') [12, 13, 14, 15].forEach((i, n) => (drums.tom[i] = 0.9 - 0.1 * n));
    if (fill === 'kickout') drums.kick[12] = 0;
    if (fill === 'clap') drums.clap[14] = drums.clap[15] = 0.6;
    if (dropout) for (const name in drums) for (let i = 12; i < 16; i++) drums[name][i] = 0;

    // Melodic loops: which stem each playing layer starts in this bar, and from where in its loop.
    // `joins` are the loops already under way, for music that begins in the middle of them.
    const stems = [],
      joins = [];
    const cycleAt = local % t.cycleBars;
    for (const name of MELODIC) {
      if (!on[name]) continue;
      const before = bar > start ? layersAt(bar - 1)[name] : false;
      let until = 1;
      while (
        until < t.cycleBars - cycleAt &&
        bar + until < start + t.length &&
        layersAt(bar + until)[name]
      )
        until++;
      (cycleAt !== 0 && before ? joins : stems).push({
        layer: name,
        stem: name === 'hook' ? (section.variant === 'B' ? 'hookB' : 'hookA') : name,
        offset: cycleAt,
        bars: until,
        ends: bar + until >= start + t.length || !layersAt(bar + until)[name],
      });
    }

    // Filter automation: each layer's cutoff moves through the section (0 closed, 1 open).
    const auto = {},
      progress = bs / len,
      next = (bs + 1) / len;
    for (const name of MELODIC) {
      const range = section.spec.auto[name] || [0.9, 0.9];
      auto[name] = [
        range[0] + (range[1] - range[0]) * progress,
        range[0] + (range[1] - range[0]) * next,
      ];
    }
    auto.reverb = section.spec.auto.reverb ?? 0.4;

    // Transitions.
    const fx = {};
    if (build && bs === Math.max(0, len - 4)) fx.riser = 4;
    if (build && lastBar) fx.swell = true;
    if (type === 'DROP' && bs === 0) fx.impact = fx.crash = 'long';
    else if ((type === 'DROP' || type === 'GROOVE') && bs > 0 && bs % 8 === 0) fx.crash = 'short';
    if (type === 'BREAK' && bs === 0 && local > 0) fx.downlifter = true;
    if (local === 0 && index > 0) fx.crash = 'long';

    const result = {
      bar,
      track: index,
      local,
      sec: type,
      bs,
      len,
      variant: section.variant,
      progress,
      on,
      dropout,
      drums,
      stems,
      joins,
      auto,
      fx,
      fill,
      chord: chordAt(bar),
      key: { pc: t.pc, scale: t.scale },
      record: null,
    };
    return remember(result);

    /** A bar of the recorded song: the engine only has to keep it playing. */
    function recordPlan() {
      for (const name of ['kick', 'hat', 'open', 'clap', 'ride', 'perc', 'snare', 'tom'])
        drums[name] = empty();
      const inside = (ranges) => ranges.some(([from, to]) => local >= from && local < to);
      return {
        bar,
        track: index,
        local,
        sec: type,
        bs,
        len,
        variant: section.variant,
        progress: bs / len,
        on,
        dropout: false,
        drums,
        stems: [],
        joins: [],
        auto: { reverb: 0.4 },
        fx: {},
        fill: 'none',
        chord: chordAt(bar),
        key: { pc: t.pc, scale: t.scale },
        record: { file: t.record.file, kick: inside(t.record.kick), sung: inside(t.record.sung) },
      };
    }
    function remember(result) {
      plans.set(bar, result);
      if (plans.size > 32) plans.delete(plans.keys().next().value);
      return result;
    }
  }

  return {
    plan,
    sectionAt,
    chordAt,
    layersAt,
    track,
    locate,
    secondsAt,
    stepAt,
    size: () => tracks.size + plans.size,
    feel: () => unit(session.seed, 'feel'),
  };
}

/** How much is going on in each kind of section, for the gameplay sounds. */
const ENERGY = {
  INTRO: 0.4,
  GROOVE: 0.65,
  VERSE: 0.6,
  BREAK: 0.3,
  CHORUS: 0.45,
  BUILD: 0.75,
  DROP: 1,
  OUTRO: 0.45,
};

/** The last index of a sorted list whose value is at most `value`. */
function last(list, value) {
  let low = 0,
    high = list.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (list[mid] <= value) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** `[value, weight]` entries as a flat list `pick` can draw from. */
function weightedList(entries) {
  return entries.flatMap(([value, weight]) => new Array(weight).fill(value));
}
