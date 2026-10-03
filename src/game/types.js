/**
 * @typedef {object} Pal
 * @property {number} t Index in TIERS (the saved sprite IDs remain stable).
 * @property {number} id Unique ID used to resolve coincident collision centers.
 * @property {number} x Horizontal board position.
 * @property {number} y Vertical board position.
 * @property {number} vx Horizontal speed, board units per second.
 * @property {number} vy Vertical speed, board units per second.
 * @property {number} r Collision radius.
 * @property {number} iw Inverse mass; proportional to inverse area.
 * @property {number} age Time since spawning, in seconds.
 * @property {boolean} mg Whether reserved by an in-progress merge.
 * @property {boolean} dead Whether pending removal.
 * @property {number} s Animated scale (visual only).
 * @property {number} sv Scale velocity (visual only).
 * @property {number} q Squash amount (visual only).
 * @property {number} qv Squash velocity (visual only).
 * @property {number} bt Time until next blink (visual only).
 * @property {number} bl Remaining blink time (visual only).
 * @property {number} flash Highlight opacity (visual only).
 * @property {number} ot Time over the lose line.
 */
export {};
