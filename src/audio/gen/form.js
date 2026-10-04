import { between, unit, weighted } from './random.js';

/**
 * The long form of a song, generated one segment at a time and never repeating: an intro, then
 * grooves, builds, drops and breakdowns in an order drawn from the profile's graph, with lengths
 * and energies drawn from its ranges. Layers switch on and off with the segment and, a little at
 * a time, with every phrase inside it.
 */
export function createForm(session, profile) {
  const { seed } = session,
    spec = profile.form,
    layers = profile.layers,
    segments = [];

  function addSegment() {
    const index = segments.length,
      previous = segments.at(-1),
      type = previous
        ? weighted(
            repeatGuard(spec[previous.type].next, previous, segments.at(-2)),
            seed,
            'next',
            index,
          )
        : 'INTRO',
      def = spec[type],
      len = def.len[Math.floor(unit(seed, 'len', index) * def.len.length)],
      energy = def.energy[0] + (def.energy[1] - def.energy[0]) * unit(seed, 'energy', index),
      start = previous ? previous.start + previous.len : 0,
      on = {};
    for (const [name, layer] of Object.entries(layers))
      on[name] = unit(seed, 'layer', index, name) < (layer.on[type] ?? 0);
    segments.push({ index, type, start, len, energy, on });
  }
  /** The same section may not come back three times in a row, however the dice fall. */
  function repeatGuard(options, previous, before) {
    if (before && before.type === previous.type)
      return options.filter(([type]) => type !== previous.type);
    return options;
  }
  function segmentAt(bar) {
    bar = Math.max(0, Math.floor(bar));
    while ((segments.at(-1)?.start ?? -1) + (segments.at(-1)?.len ?? 0) <= bar) addSegment();
    let low = 0,
      high = segments.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (segments[mid].start <= bar) low = mid;
      else high = mid - 1;
    }
    return segments[low];
  }
  /** `{ sec, bs, len, cyc, energy, progress }`: the vocabulary the rest of the engine speaks. */
  function sectionAt(bar) {
    const segment = segmentAt(bar),
      bs = Math.floor(bar) - segment.start;
    return {
      sec: segment.type,
      bs,
      len: segment.len,
      cyc: segment.index,
      energy: segment.energy,
      progress: bs / segment.len,
    };
  }
  /** Which layers play in this bar: the segment's set, with one optional layer toggled per phrase. */
  function layersAt(bar) {
    const segment = segmentAt(bar),
      on = { ...segment.on },
      bs = Math.floor(bar) - segment.start,
      steps = Math.floor(bs / profile.phraseBars),
      optional = Object.keys(layers).filter(
        (name) => layers[name].on[segment.type] > 0 && layers[name].on[segment.type] < 1,
      );
    for (let step = 1; step <= steps && optional.length; step++) {
      const name = optional[between(0, optional.length - 1, seed, 'toggle', segment.index, step)];
      if (unit(seed, 'flip', segment.index, step) < spec.toggle) on[name] = !on[name];
    }
    return on;
  }
  return { sectionAt, layersAt, segmentAt, segments };
}
