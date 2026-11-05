import type { Launch, MoveDef } from './types.ts';

/**
 * Percent-based launch, in the family of platform-fighter formulas:
 *
 *   scaled = ((p/10 + p*damage/20) * 200/(weight+100) * 1.4 + 18) * kbg/100
 *   knockback = scaled + baseKnockback
 *
 * `p` is the victim's percent AFTER this hit is added. Speed and hitstun
 * are linear in knockback. Angles use degrees; 90 is up.
 */
const SPEED_SCALE = 0.108;
const HITSTUN_SCALE = 0.3;

export function computeLaunch(
  percentAfter: number,
  move: MoveDef,
  weight: number,
  facing: 1 | -1,
): Launch {
  const p = Math.max(0, percentAfter);
  const scaled =
    ((p / 10 + (p * move.damage) / 20) * (200 / (weight + 100)) * 1.4 + 18) *
    (move.knockbackGrowth / 100);
  const knockback = scaled + move.baseKnockback;
  const rad = (move.angle * Math.PI) / 180;
  const speed = knockback * SPEED_SCALE;
  const vx = Math.cos(rad) * speed * facing;
  const vy = -Math.sin(rad) * speed;
  const hitstun = Math.max(4, Math.min(110, Math.round(knockback * HITSTUN_SCALE)));
  const hitlag = Math.max(3, Math.min(12, Math.round(move.damage * 0.4 + 3)));
  return { knockback, vx, vy, hitstun, hitlag };
}
