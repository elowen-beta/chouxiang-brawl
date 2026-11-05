import type { CharacterDef } from '../../game/types.ts';
import { move } from '../move.ts';

/**
 * 模板角色。复制这个文件，改 id / 名字 / 体型 / 手感，
 * 再在 src/game/roster.ts 登记，就能把你喜欢的角色加进大乱斗。
 */
export const fangfang = {
  id: 'fangfang',
  name: '方方',
  epithet: '标准件',
  blurb: '装配台的标准件。想换成你喜欢的角色，就改这份数据。',
  color: '#4C8DFF',
  accent: '#D6E6FF',
  shape: 'square',
  weight: 100,
  gravity: 0.38,
  walkSpeed: 5.5,
  airSpeed: 5,
  groundAccel: 0.85,
  airAccel: 0.42,
  friction: 0.55,
  jumpForce: 11.8,
  doubleJumpForce: 10.6,
  maxFall: 11,
  fastFall: 16,
  airJumps: 1,
  width: 48,
  height: 64,
  moves: [
    move('jab', '轻击', 7, 6, 60, 48, 3, 3, 11, { x: 14, y: -10, w: 36, h: 28 }),
    move('fstrong', '重击', 15, 26, 108, 34, 12, 4, 18, { x: 16, y: -16, w: 64, h: 36 }, { x: 2.4 }),
    move('utilt', '上击', 11, 32, 116, 88, 5, 4, 14, { x: -22, y: -70, w: 44, h: 48 }),
    move('dtilt', '下刺', 8, 8, 62, 18, 4, 3, 13, { x: 16, y: 8, w: 46, h: 22 }),
    move('nair', '空中轻击', 9, 10, 74, 52, 3, 6, 12, { x: -36, y: -30, w: 72, h: 58 }),
    move('fair', '空中重击', 13, 20, 100, 36, 7, 3, 16, { x: 18, y: -12, w: 50, h: 32 }),
    move('uair', '上攻', 12, 24, 112, 86, 4, 5, 15, { x: -24, y: -68, w: 48, h: 46 }, { y: -8.4 }),
    move('dair', '下砸', 14, 14, 90, 270, 8, 3, 18, { x: -18, y: 10, w: 36, h: 46 }),
  ],
} satisfies CharacterDef;
