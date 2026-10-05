export function createRenderText({ game }) {
  const FONT = {
    0: [7, 5, 5, 5, 7],
    1: [2, 6, 2, 2, 7],
    2: [7, 1, 7, 4, 7],
    3: [7, 1, 7, 1, 7],
    4: [5, 5, 7, 1, 1],
    5: [7, 4, 7, 1, 7],
    6: [7, 4, 7, 5, 7],
    7: [7, 1, 1, 2, 2],
    8: [7, 5, 7, 5, 7],
    9: [7, 5, 7, 1, 7],
    A: [2, 5, 7, 5, 5],
    B: [6, 5, 6, 5, 6],
    C: [3, 4, 4, 4, 3],
    D: [6, 5, 5, 5, 6],
    E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3],
    H: [5, 5, 7, 5, 5],
    I: [7, 2, 2, 2, 7],
    J: [1, 1, 1, 5, 2],
    K: [5, 5, 6, 5, 5],
    L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5],
    N: [6, 5, 5, 5, 5],
    O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4],
    Q: [2, 5, 5, 7, 3],
    R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6],
    T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7],
    V: [5, 5, 5, 5, 2],
    W: [5, 5, 7, 7, 5],
    X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2],
    Z: [7, 1, 2, 4, 7],
    '+': [0, 2, 7, 2, 0],
    '!': [2, 2, 2, 0, 2],
    '.': [0, 0, 0, 0, 2],
    ',': [0, 0, 0, 2, 4],
    "'": [2, 2, 0, 0, 0],
    '?': [6, 1, 2, 0, 2],
    '-': [0, 0, 7, 0, 0],
    ' ': [0, 0, 0, 0, 0],
    '&': [2, 5, 2, 5, 3],
    '/': [1, 1, 2, 4, 4],
    ':': [0, 2, 0, 2, 0],
  };
  /* M, N and W need five columns to read as themselves; everything else fits in three. */
  const WIDE = {
    M: [17, 27, 21, 17, 17],
    N: [17, 25, 21, 19, 17],
    W: [17, 17, 21, 27, 17],
  };
  const columns = (ch) => (WIDE[ch] ? 5 : 3);
  function textW(str, sc) {
    let w = -1;
    for (const ch of String(str).toUpperCase()) w += columns(ch) + 1;
    return Math.max(0, w) * sc;
  }
  function drawText(g, str, x, y, col, sc, out) {
    str = String(str).toUpperCase();
    sc = sc || 1;
    const x0 = Math.round(x - textW(str, sc) / 2);
    const put = (ox, oy, c) => {
      g.fillStyle = c;
      let cx = x0 + ox,
        ci = 0;
      for (const ch of str) {
        if (c === 'rainbow')
          g.fillStyle = 'hsl(' + (((game.elapsed * 360 + ci++ * 45) % 360) | 0) + ',100%,66%)';
        const gl = WIDE[ch] || FONT[ch],
          n = columns(ch);
        if (gl)
          for (let r = 0; r < 5; r++)
            for (let q = 0; q < n; q++)
              if (gl[r] & (1 << (n - 1 - q))) g.fillRect(cx + q * sc, y + oy + r * sc, sc, sc);
        cx += (n + 1) * sc;
      }
    };
    if (out !== false) {
      const o = out || '#1b1230';
      for (const d of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [0, 2],
      ])
        put(d[0], d[1], o);
    }
    put(0, 0, col);
  }
  return { textW, drawText };
}
