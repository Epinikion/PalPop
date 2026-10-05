/** The sung phrases of "All My Pals" (rendered by tools/vocals/sing.py). */
export const VOCAL_FILES = ['verse1', 'verse2', 'chorus', 'chorus-low', 'hook'];

/**
 * Loads the sung phrases once per audio context, in the background, and hands them out as audio
 * buffers. A phrase that is not loaded yet is simply not sung, so a slow connection never stops the
 * music.
 */
export function createVocals() {
  const banks = new WeakMap();
  function load(context) {
    if (!banks.has(context)) {
      const bank = { buffers: {} };
      bank.ready = Promise.all(
        VOCAL_FILES.map(async (name) => {
          try {
            const response = await globalThis.fetch(
              new URL(`../../assets/vocals/${name}.wav`, import.meta.url),
            );
            bank.buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
          } catch {
            bank.buffers[name] = null;
          }
        }),
      );
      banks.set(context, bank);
    }
    return banks.get(context).ready;
  }
  const get = (context, name) => banks.get(context)?.buffers[name] || null;
  return { load, get };
}

const managers = new WeakMap();
/** One loader per audio state. */
export function vocalsFor(audio) {
  if (!managers.has(audio)) managers.set(audio, createVocals());
  return managers.get(audio);
}
