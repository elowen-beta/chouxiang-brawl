import { cici } from '../data/characters/cici.ts';
import { fangfang } from '../data/characters/fangfang.ts';
import { gungun } from '../data/characters/gungun.ts';
import { wenwen } from '../data/characters/wenwen.ts';
import { MOVE_SLOTS } from './constants.ts';
import type { CharacterDef } from './types.ts';

/**
 * 花名册。把你喜欢的角色加进大乱斗：
 * 1. 在 src/data/characters/ 新增一份数据
 * 2. 在这里 import，放进 roster 数组
 */
export const roster: CharacterDef[] = [fangfang, gungun, cici, wenwen];

export function assertRoster(list: readonly CharacterDef[]): void {
  const ids = new Set<string>();
  for (const character of list) {
    if (ids.has(character.id)) {
      throw new Error(`花名册里有重复 id：${character.id}`);
    }
    ids.add(character.id);
    for (const slot of MOVE_SLOTS) {
      if (!character.moves.some((entry) => entry.slot === slot)) {
        throw new Error(`${character.name} 缺少招式 ${slot}`);
      }
    }
  }
}

assertRoster(roster);

export function getCharacter(id: string): CharacterDef {
  const found = roster.find((character) => character.id === id);
  if (!found) throw new Error(`花名册里没有 ${id}`);
  return found;
}
