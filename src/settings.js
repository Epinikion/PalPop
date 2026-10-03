/** Distances use the 120 × 200 board coordinate system; times are seconds. */
export const PHYSICS = Object.freeze({
  timestep: 1 / 240,
  gravity: 760,
  maxFallSpeed: 360,
  solverIterations: 5,
  airDrag: 0.16,
  floorDrag: 1.4,
  contactFriction: 0.12,
  wallRestitution: 0.28,
  floorRestitution: 0.19,
  floorBounceThreshold: 95,
  mergeDistance: 0.55,
  mergeDelay: 0.055,
  attractionDistance: 2,
  attractionForce: 120,
  attractionMaxSpeed: 85,
});
export const GAMEPLAY = Object.freeze({
  dropVelocity: 95,
  dropCooldown: 0.24,
  comboWindow: 1.4,
  extraComboTime: 0.1,
  maxExtraComboSteps: 3,
});
