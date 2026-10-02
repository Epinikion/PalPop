/** Deterministic musical variation stays independent from AudioContext and the DOM. */
export function createAudioMath(audio) {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function hashRand(n, salt) {
    let x = (n + audio.seed + (salt | 0) * 0x9e3779b9) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  return { midi, hashRand };
}
