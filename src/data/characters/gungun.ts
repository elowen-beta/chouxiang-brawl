import type { CharacterDef } from '../../game/types.ts';
import { tweakMoves } from '../move.ts';
import { fangfang } from './fangfang.ts';

/** 轻飘的球。多一次跳跃，击飞成长偏低。 */
export const gungun = {
  id: 'gungun',
  name: '滚滚',
  epithet: '弹性球',
  blurb: '轻、飘、能多跳一次。适合把灵活的角色装进来。',
  color: '#FF5D8F',
  accent: '#FFD0E2',
  shape: 'circle',
  weight: 76,
  gravity: 0.3,
  walkSpeed: 6.5,
  airSpeed: 5.9,
  groundAccel: 0.95,
  airAccel: 0.5,
  friction: 0.42,
  jumpForce: 12.1,
  doubleJumpForce: 11.2,
  maxFall: 9.5,
  fastFall: 14.5,
  airJumps: 2,
  width: 52,
  height: 52,
  moves: tweakMoves(fangfang.moves, {
    jab: { damage: 5, baseKnockback: 4, knockbackGrowth: 46, startup: 2, recovery: 8 },
    fstrong: { damage: 12, baseKnockback: 18, knockbackGrowth: 92, startup: 9, recovery: 15 },
    utilt: { damage: 9, baseKnockback: 24, knockbackGrowth: 100, startup: 4 },
    dtilt: { damage: 6, baseKnockback: 6, knockbackGrowth: 50, startup: 3, recovery: 10 },
    nair: { damage: 7, baseKnockback: 6, knockbackGrowth: 60, startup: 2 },
    fair: { damage: 10, baseKnockback: 14, knockbackGrowth: 84, startup: 5, recovery: 13 },
    uair: { damage: 9, baseKnockback: 16, knockbackGrowth: 96, startup: 3, boostY: -9.2 },
    dair: { damage: 11, baseKnockback: 10, knockbackGrowth: 76, startup: 6, recovery: 14 },
  }),
} satisfies CharacterDef;
