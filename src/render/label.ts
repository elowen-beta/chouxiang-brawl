import { FONT } from '../game/constants.ts';

export function label(
  size: number,
  color: string,
  extra?: { align?: 'left' | 'center' | 'right'; stroke?: string; strokeThickness?: number },
) {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    align: extra?.align,
    resolution: 2,
    stroke: extra?.stroke,
    strokeThickness: extra?.strokeThickness ?? 0,
  };
}
