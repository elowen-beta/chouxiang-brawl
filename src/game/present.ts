import type { CharacterDef } from './types.ts';

export function weightLabel(weight: number): string {
  if (weight >= 115) return '重';
  if (weight >= 92) return '中';
  return '轻';
}

export function speedLabel(walkSpeed: number): string {
  if (walkSpeed >= 6.2) return '快';
  if (walkSpeed >= 5.2) return '中';
  return '慢';
}

export function strongDamage(def: CharacterDef): number {
  return def.moves.find((move) => move.slot === 'fstrong')?.damage ?? 0;
}

export function percentColor(percent: number): string {
  if (percent < 30) return '#f7f4ee';
  if (percent < 70) return '#ffe56a';
  if (percent < 120) return '#ff9a3c';
  if (percent < 180) return '#ff4d6a';
  return '#ff4ad8';
}
