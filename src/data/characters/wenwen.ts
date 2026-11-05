import type { CharacterDef } from '../../game/types.ts';
import { tweakMoves } from '../move.ts';
import { fangfang } from './fangfang.ts';

/** 重量级。击飞成长不高，靠体重把别人熬出场。 */
export const wenwen = {
  id: 'wenwen',
  name: '稳稳',
  epithet: '压舱石',
  blurb: '重量级六边形。站得很稳，再慢慢把别人送出场。',
  color: '#2FCB8A',
  accent: '#D7FFE8',
  shape: 'hex',
  weight: 128,
  gravity: 0.48,
  walkSpeed: 4.4,
  airSpeed: 4,
  groundAccel: 0.55,
  airAccel: 0.28,
  friction: 0.62,
  jumpForce: 10.4,
  doubleJumpForce: 9.4,
  maxFall: 12.5,
  fastFall: 17,
  airJumps: 1,
  width: 60,
  height: 66,
  moves: tweakMoves(fangfang.moves, {
    jab: { damage: 8, baseKnockback: 10, knockbackGrowth: 48, startup: 5, recovery: 14 },
    fstrong: { damage: 14, baseKnockback: 20, knockbackGrowth: 88, startup: 15, recovery: 20 },
    utilt: { damage: 12, baseKnockback: 28, knockbackGrowth: 96, startup: 7 },
    dtilt: { damage: 9, baseKnockback: 12, knockbackGrowth: 50, startup: 6, recovery: 15 },
    nair: { damage: 10, baseKnockback: 12, knockbackGrowth: 62, startup: 5 },
    fair: { damage: 13, baseKnockback: 18, knockbackGrowth: 84, startup: 9, recovery: 18 },
    uair: { damage: 12, baseKnockback: 22, knockbackGrowth: 92, startup: 6, boostY: -7.2 },
    dair: { damage: 14, baseKnockback: 16, knockbackGrowth: 76, startup: 10, recovery: 20 },
  }),
} satisfies CharacterDef;
