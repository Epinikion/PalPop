/** Storage failures (private mode, blocked cookies, malformed JSON) never stop play. */
export function createStorage(resolveStorage = () => globalThis.localStorage, prefix = 'palpop:') {
  return {
    get(key, fallback) {
      try {
        const value = resolveStorage().getItem(prefix + key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        resolveStorage().setItem(prefix + key, JSON.stringify(value));
      } catch {}
    },
  };
}
export const store = createStorage();
