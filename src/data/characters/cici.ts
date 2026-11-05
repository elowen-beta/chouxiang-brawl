import type { CharacterDef } from '../../game/types.ts';
import { tweakMoves } from '../move.ts';
import { fangfang } from './fangfang.ts';

/** 慢而重的尖角。重击是这套数据的招牌。 */
export const cici = {
  id: 'cici',
  name: '刺刺',
  epithet: '尖角',
  blurb: '出手慢半拍，砸出去很重。留给你心里那个锋利的家伙。',
  color: '#FFB000',
  accent: '#FFF0C2',
  shape: 'diamond',
  weight: 88,
  gravity: 0.4,
  walkSpeed: 5,
  airSpeed: 4.6,
  groundAccel: 0.7,
  airAccel: 0.34,
  friction: 0.6,
  jumpForce: 11.4,
  doubleJumpForce: 10.2,
  maxFall: 12,
  fastFall: 17,
  airJumps: 1,
  width: 46,
  height: 70,
  moves: tweakMoves(fangfang.moves, {
    jab: { damage: 9, baseKnockback: 8, knockbackGrowth: 70, startup: 5, recovery: 14 },
    fstrong: {
      damage: 19,
      baseKnockback: 32,
      knockbackGrowth: 124,
      startup: 16,
      recovery: 22,
      hitbox: { w: 72 },
    },
    utilt: { damage: 14, baseKnockback: 36, knockbackGrowth: 126, startup: 8 },
    dtilt: { damage: 10, baseKnockback: 12, knockbackGrowth: 74, startup: 6 },
    nair: { damage: 12, baseKnockback: 12, knockbackGrowth: 86, startup: 5 },
    fair: { damage: 16, baseKnockback: 24, knockbackGrowth: 114, startup: 10, recovery: 18 },
    uair: { damage: 15, baseKnockback: 28, knockbackGrowth: 120, startup: 7, boostY: -7.6 },
    dair: { damage: 17, baseKnockback: 18, knockbackGrowth: 104, startup: 11, recovery: 20 },
  }),
} satisfies CharacterDef;
