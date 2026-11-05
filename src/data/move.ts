import type { HitboxDef, MoveDef, MoveSlot } from '../game/types.ts';

export function move(
  slot: MoveSlot,
  name: string,
  damage: number,
  baseKnockback: number,
  knockbackGrowth: number,
  angle: number,
  startup: number,
  active: number,
  recovery: number,
  hitbox: HitboxDef,
  boost?: { x?: number; y?: number },
): MoveDef {
  return {
    id: slot,
    slot,
    name,
    damage,
    baseKnockback,
    knockbackGrowth,
    angle,
    startup,
    active,
    recovery,
    hitbox,
    boostX: boost?.x,
    boostY: boost?.y,
  };
}

export function tweakMoves(
  base: readonly MoveDef[],
  patches: Partial<
    Record<MoveSlot, Partial<Omit<MoveDef, 'hitbox'>> & { hitbox?: Partial<HitboxDef> }>
  >,
): MoveDef[] {
  return base.map((entry) => {
    const patch = patches[entry.slot];
    if (!patch) return { ...entry, hitbox: { ...entry.hitbox } };
    const { hitbox, ...rest } = patch;
    return { ...entry, ...rest, hitbox: { ...entry.hitbox, ...hitbox } };
  });
}
