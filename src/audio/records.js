/** How long a file that failed to load is left alone before it is tried again (ms). */
const RETRY = 15000;
/** The level that marks a song's first note (see `onset` in gen/all-my-pals.js). */
const ONSET_LEVEL = 0.01;

/**
 * How much later than in the reference decode the song starts in this decoded buffer (seconds).
 * MP3 decoders differ in how much of the encoder's lead-in they keep.
 */
export function leadOf(buffer, onset) {
  const rate = buffer.sampleRate,
    end = Math.min(buffer.length, Math.ceil((onset + 0.5) * rate));
  let first = end;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < first; i++)
      if (Math.abs(data[i]) > ONSET_LEVEL) {
        first = i;
        break;
      }
  }
  const lead = first / rate - onset;
  return Math.abs(lead) < 0.2 ? lead : 0;
}

/**
 * Loads the recorded songs a style plays (`assets/music`, see gen/all-my-pals.js) in the
 * background and hands them out as audio buffers. A file is fetched once; it is decoded for each
 * session that plays it and let go with that session, because a decoded three-minute song holds
 * about 70 MB. A song that is not ready when its bar comes simply joins later, where the music is,
 * so a slow phone or connection never stops the music.
 */
export function createRecords() {
  const files = new Map(),
    sessions = new WeakMap();

  function bytes(file) {
    const held = files.get(file);
    if (held && !(held.failed && Date.now() - held.failed > RETRY)) return held.data;
    const entry = { failed: 0 };
    entry.data = globalThis
      .fetch(new URL(`../../assets/music/${file}`, import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error(`${file}: ${response.status}`);
        return response.arrayBuffer();
      })
      .catch((error) => {
        entry.failed = Date.now();
        throw error;
      });
    files.set(file, entry);
    return entry.data;
  }

  /** Starts loading a song for a session (once); resolves when it can play, or could not load. */
  function load(session, context, { file, onset }) {
    if (!sessions.has(session)) sessions.set(session, new Map());
    const held = sessions.get(session);
    const known = held.get(file);
    if (known && !(known.failed && Date.now() - known.failed > RETRY)) return known.ready;
    const entry = { song: null, failed: 0 };
    // The decoder takes the bytes over, so it gets a copy and the fetched file stays usable.
    entry.ready = bytes(file)
      .then((data) => context.decodeAudioData(data.slice(0)))
      .then((buffer) => (entry.song = { buffer, lead: leadOf(buffer, onset) }))
      .catch(() => (entry.failed = Date.now()));
    held.set(file, entry);
    return entry.ready;
  }
  /** A loaded song: its buffer, and how much later it starts there than in the measurements. */
  const get = (session, file) => sessions.get(session)?.get(file)?.song || null;
  return { load, get };
}

const managers = new WeakMap();
/** One loader per audio state. */
export function recordsFor(audio) {
  if (!managers.has(audio)) managers.set(audio, createRecords());
  return managers.get(audio);
}
