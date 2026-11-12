/**
 * A damped spring sampled into keyframe values, for Web Animations that should
 * settle like a spring (the week strip's lifted day). Pure, so it is tested.
 * Stiffness `k` and damping `c` are per unit mass; the values are sampled at
 * 60 fps from a 240 Hz simulation and always end exactly on `to`.
 */
export function springValues(
  k: number,
  c: number,
  from = 0,
  to = 1,
): { values: number[]; duration: number } {
  let x = from;
  let v = 0;
  const dt = 1 / 240;
  const values: number[] = [];
  for (let i = 0; i < 480; i++) {
    const acceleration = -k * (x - to) - c * v;
    v += acceleration * dt;
    x += v * dt;
    if (i % 4 === 3) values.push(x);
    if (i > 24 && Math.abs(x - to) < 0.0015 && Math.abs(v) < 0.02) break;
  }
  values.push(to);
  return { values, duration: (values.length * 1000) / 60 };
}
