import type { CharacterDef } from '../../game/types.ts';
import { move } from '../move.ts';

/**
 * 推石人。重装蓄力型：起步黏滞，过临界点后势不可挡。
 * 由外援池 Cosmo 按 fangfang.ts 模板改制，id: tuishi。
 */
export const tuishi = {
  id: 'tuishi',
  name: '推石人',
  epithet: '重装蓄力',
  blurb: '推着石头上场的人。平时慢，滚起来没人敢挡；赢了也要从头再推。',
  color: '#8A7F72',
  accent: '#E8DFD0',
  shape: 'circle',
  weight: 132,
  gravity: 0.46,
  walkSpeed: 4.2,
  airSpeed: 4.3,
  groundAccel: 0.5,
  airAccel: 0.3,
  friction: 0.62,
  jumpForce: 10.4,
  doubleJumpForce: 9.2,
  maxFall: 13,
  fastFall: 19,
  airJumps: 1,
  width: 56,
  height: 58,
  moves: [
    move('jab', '推', 6, 7, 55, 42, 4, 3, 12, { x: 16, y: -8, w: 38, h: 26 }),
    move('fstrong', '上坡', 16, 30, 115, 30, 24, 5, 22, { x: 18, y: -14, w: 66, h: 38 }, { x: 2.8 }),
    move('utilt', '顶石', 11, 30, 110, 88, 7, 4, 15, { x: -24, y: -72, w: 48, h: 50 }),
    move('dtilt', '垫脚石', 8, 9, 60, 20, 5, 3, 13, { x: 18, y: 10, w: 48, h: 20 }),
    move('nair', '石环', 10, 11, 75, 50, 5, 6, 13, { x: -40, y: -32, w: 80, h: 62 }),
    move('fair', '滚石', 14, 22, 102, 36, 9, 4, 17, { x: 20, y: -10, w: 54, h: 34 }, { x: 1.6 }),
    move('uair', '举石问天', 12, 26, 112, 88, 6, 5, 16, { x: -26, y: -70, w: 52, h: 48 }, { y: -6 }),
    move('dair', '山顶见', 15, 15, 92, 270, 10, 3, 20, { x: -20, y: 12, w: 40, h: 48 }, { y: 2 }),
  ],
} satisfies CharacterDef;
