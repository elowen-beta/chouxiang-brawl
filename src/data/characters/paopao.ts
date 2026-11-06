import type { CharacterDef } from '../../game/types.ts';
import { move } from '../move.ts';

/** 轻飘空战向。复制方方模板改的，八槽齐全。 */
export const paopao = {
  id: 'paopao',
  name: '泡泡',
  epithet: '一戳就破',
  blurb: '轻飘飘的一团。戳爆之前先把人顶上天，落地时自己也怕碎。',
  color: '#7AD7F0',
  accent: '#E8F9FF',
  shape: 'circle',
  weight: 72,
  gravity: 0.28,
  walkSpeed: 5.2,
  airSpeed: 6.2,
  groundAccel: 0.9,
  airAccel: 0.55,
  friction: 0.42,
  jumpForce: 12.6,
  doubleJumpForce: 11.4,
  maxFall: 9,
  fastFall: 14,
  airJumps: 1,
  width: 52,
  height: 52,
  moves: [
    move('jab', '轻戳', 5, 5, 48, 55, 2, 2, 9, { x: 12, y: -14, w: 32, h: 30 }),
    move('fstrong', '吹开', 12, 22, 96, 40, 10, 4, 16, { x: 14, y: -18, w: 58, h: 40 }, { x: 1.6 }),
    move('utilt', '顶上天', 10, 34, 118, 92, 4, 4, 12, { x: -20, y: -66, w: 40, h: 50 }),
    move('dtilt', '擦地', 6, 6, 50, 25, 3, 3, 11, { x: 14, y: 10, w: 42, h: 18 }),
    move('nair', '鼓胀', 8, 12, 80, 60, 2, 8, 10, { x: -40, y: -34, w: 80, h: 68 }),
    move('fair', '前飘击', 11, 16, 92, 38, 5, 4, 14, { x: 16, y: -14, w: 48, h: 34 }),
    move('uair', '升空戳', 11, 28, 120, 90, 3, 5, 13, { x: -22, y: -64, w: 44, h: 48 }, { y: -9.2 }),
    move('dair', '落地怕碎', 13, 10, 78, 270, 6, 3, 16, { x: -16, y: 8, w: 32, h: 40 }),
  ],
} satisfies CharacterDef;
