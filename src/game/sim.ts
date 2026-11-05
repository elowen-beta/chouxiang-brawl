import { STOCKS } from './constants.ts';
import { cpuInput } from './cpu.ts';
import { blankInput, type InputFrame } from './input.ts';
import { computeLaunch } from './knockback.ts';
import { getCharacter } from './roster.ts';
import type { SlotSetup } from './setup.ts';
import { STAGE, type PlatformDef } from './stage.ts';
import type {
  AttackState,
  FighterState,
  MatchPhase,
  MoveDef,
  MoveSlot,
  SimEvent,
} from './types.ts';

const AERIAL: ReadonlySet<MoveSlot> = new Set(['nair', 'fair', 'uair', 'dair']);

export interface Sim {
  fighters: FighterState[];
  frame: number;
  fightFrame: number;
  countdown: number;
  phase: MatchPhase;
  winner: number | null;
  events: SimEvent[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function createMatch(slots: readonly SlotSetup[]): Sim {
  const active = slots
    .map((slot, seat) => ({ slot, seat }))
    .filter((entry) => entry.slot.joined);
  if (active.length < 2) {
    throw new Error('至少需要两位选手');
  }

  const fighters = active.map(({ slot, seat }, index) => {
    const def = getCharacter(slot.characterId);
    const spot = spawnSpot(index, active.length, def.height);
    const feet = spot.y + def.height / 2;
    const fighter: FighterState = {
      index,
      seat,
      def,
      cpu: slot.cpu,
      x: spot.x,
      y: spot.y,
      vx: 0,
      vy: 0,
      facing: spot.facing,
      percent: 0,
      stocks: STOCKS,
      airborne: false,
      jumpsLeft: def.airJumps,
      coyote: 0,
      jumpBuffer: 0,
      jumpAge: 99,
      jumpScale: def.jumpForce,
      fastFalling: false,
      attack: null,
      attackBuffer: null,
      hitstun: 0,
      hitlag: 0,
      pending: null,
      intangible: 24,
      respawnTimer: 0,
      landLag: 0,
      flash: 0,
      rot: 0,
      rotVel: 0,
      prevBottom: feet,
      dropIgnore: 0,
      cpuJumpHold: 0,
      rng: (index + 1) * 9973,
      width: def.width,
      height: def.height,
    };
    return fighter;
  });

  return {
    fighters,
    frame: 0,
    fightFrame: 0,
    countdown: 180,
    phase: 'countdown',
    winner: null,
    events: [],
  };
}

export function placeFighter(sim: Sim, index: number, x: number, y: number): void {
  const fighter = sim.fighters[index];
  if (!fighter) return;
  fighter.x = x;
  fighter.y = y;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.prevBottom = y + fighter.height / 2;
  fighter.airborne = false;
  fighter.fastFalling = false;
  fighter.attack = null;
  fighter.hitstun = 0;
  fighter.hitlag = 0;
  fighter.pending = null;
  fighter.rot = 0;
}

export function step(sim: Sim, bySeat: readonly InputFrame[]): void {
  sim.events = [];
  if (sim.phase === 'end') return;

  if (sim.phase === 'countdown') {
    sim.countdown -= 1;
    if (sim.countdown <= 0) {
      sim.phase = 'fight';
      sim.fightFrame = 0;
    }
    return;
  }

  sim.frame += 1;
  sim.fightFrame += 1;

  const inputs = sim.fighters.map((fighter) => {
    if (fighter.cpu) return cpuInput(fighter, sim.fighters);
    return bySeat[fighter.seat] ?? blankInput();
  });

  sim.fighters.forEach((fighter, index) => {
    const input = inputs[index] ?? blankInput();
    updateFighter(sim, fighter, input);
  });

  resolveHits(sim);
  separateBodies(sim);

  for (const fighter of sim.fighters) {
    if (!inPlay(fighter)) continue;
    if (outsideBlast(fighter)) eliminate(sim, fighter);
  }

  for (const fighter of sim.fighters) {
    if (!fighter.attack) continue;
    const move = fighter.attack.move;
    if (fighter.attack.frame >= move.startup + move.active + move.recovery) {
      fighter.attack = null;
    }
  }

  const living = sim.fighters.filter((fighter) => fighter.stocks > 0);
  if (living.length <= 1) {
    sim.phase = 'end';
    sim.winner = living[0]?.index ?? -1;
  }
}

export function hitboxWorld(fighter: FighterState): Rect | null {
  if (!fighter.attack) return null;
  const move = fighter.attack.move;
  const played = fighter.attack.frame - 1;
  if (played < move.startup || played >= move.startup + move.active) return null;
  const box = move.hitbox;
  const x = fighter.facing === 1 ? fighter.x + box.x : fighter.x - box.x - box.w;
  return { x, y: fighter.y + box.y, w: box.w, h: box.h };
}

function updateFighter(sim: Sim, fighter: FighterState, input: InputFrame): void {
  if (fighter.stocks <= 0) return;

  if (fighter.flash > 0) fighter.flash -= 1;

  if (fighter.respawnTimer > 0) {
    fighter.respawnTimer -= 1;
    if (fighter.respawnTimer === 0) respawn(sim, fighter);
    return;
  }

  if (fighter.hitlag > 0) {
    fighter.hitlag -= 1;
    if (fighter.hitlag > 0) return;
    if (fighter.pending) releaseLaunch(fighter);
  }

  if (fighter.intangible > 0) fighter.intangible -= 1;
  if (fighter.landLag > 0) fighter.landLag -= 1;

  const actionable =
    fighter.attack === null && fighter.hitstun === 0 && fighter.landLag === 0;

  if (actionable) {
    if (input.left && !input.right) fighter.facing = -1;
    if (input.right && !input.left) fighter.facing = 1;
  }

  if (input.jumpPressed) fighter.jumpBuffer = 7;
  else if (fighter.jumpBuffer > 0) fighter.jumpBuffer -= 1;

  if (input.upAttackPressed) fighter.attackBuffer = { kind: 'up', time: 6 };
  else if (input.strongPressed) fighter.attackBuffer = { kind: 'strong', time: 6 };
  else if (input.jabPressed) fighter.attackBuffer = { kind: 'jab', time: 6 };
  else if (fighter.attackBuffer) {
    fighter.attackBuffer.time -= 1;
    if (fighter.attackBuffer.time <= 0) fighter.attackBuffer = null;
  }

  if (
    fighter.jumpBuffer > 0 &&
    fighter.attack === null &&
    fighter.hitstun === 0 &&
    fighter.landLag === 0
  ) {
    if (!fighter.airborne || fighter.coyote > 0) {
      fighter.vy = -fighter.def.jumpForce;
      fighter.airborne = true;
      fighter.coyote = 0;
      fighter.jumpBuffer = 0;
      fighter.jumpsLeft = fighter.def.airJumps;
      fighter.fastFalling = false;
      fighter.jumpAge = 0;
      fighter.jumpScale = fighter.def.jumpForce;
      sim.events.push({ type: 'jump', player: fighter.index, x: fighter.x, y: fighter.y });
    } else if (fighter.jumpsLeft > 0) {
      fighter.vy = -fighter.def.doubleJumpForce;
      fighter.jumpsLeft -= 1;
      fighter.jumpBuffer = 0;
      fighter.fastFalling = false;
      fighter.jumpAge = 0;
      fighter.jumpScale = fighter.def.doubleJumpForce;
      fighter.vx *= 0.85;
      sim.events.push({ type: 'jump', player: fighter.index, x: fighter.x, y: fighter.y });
    }
  }

  if (fighter.jumpAge < 8 && fighter.vy < 0) {
    fighter.jumpAge += 1;
    const cap = fighter.jumpScale * 0.58;
    if (!input.jump && fighter.vy < -cap) {
      fighter.vy = -cap;
      fighter.jumpAge = 99;
    }
  }

  if (actionable && fighter.attackBuffer) {
    const slot = slotFrom(fighter.attackBuffer.kind, fighter, input);
    startAttack(fighter, slot);
  }

  if (
    fighter.airborne &&
    fighter.hitstun === 0 &&
    fighter.attack === null &&
    input.downPressed &&
    fighter.vy > 1.2
  ) {
    fighter.vy = fighter.def.fastFall;
    fighter.fastFalling = true;
  }

  const dir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
  if (fighter.hitstun > 0) {
    if (input.left) fighter.vx -= 0.17;
    if (input.right) fighter.vx += 0.17;
    if (input.jump) fighter.vy -= 0.05;
    if (input.down) fighter.vy += 0.05;
    if (!fighter.airborne) fighter.vx = approach(fighter.vx, 0, 0.16);
  } else if (!fighter.airborne) {
    if (fighter.attack) {
      fighter.vx = approach(fighter.vx, 0, fighter.def.friction * 1.5);
    } else if (dir !== 0) {
      fighter.vx += dir * fighter.def.groundAccel;
      if (dir > 0) fighter.vx = Math.min(fighter.vx, fighter.def.walkSpeed);
      else fighter.vx = Math.max(fighter.vx, -fighter.def.walkSpeed);
    } else {
      fighter.vx = approach(fighter.vx, 0, fighter.def.friction);
    }
  } else if (dir !== 0) {
    const accel = fighter.def.airAccel * (fighter.attack ? 0.4 : 1);
    fighter.vx += dir * accel;
    const max = fighter.def.airSpeed;
    if (fighter.vx > max) fighter.vx = max;
    if (fighter.vx < -max) fighter.vx = -max;
  } else {
    fighter.vx *= 0.992;
  }

  if (fighter.attack) {
    const move = fighter.attack.move;
    if (fighter.attack.frame === move.startup) {
      if (move.boostX) fighter.vx = move.boostX * fighter.facing;
      if (move.boostY !== undefined) {
        fighter.vy = move.boostY;
        if (move.boostY < 0) {
          fighter.airborne = true;
          fighter.fastFalling = false;
        }
      }
    }
    fighter.attack.frame += 1;
  }

  if (fighter.airborne) {
    fighter.vy += fighter.def.gravity;
    if (fighter.hitstun === 0) {
      const cap = fighter.fastFalling ? fighter.def.fastFall : fighter.def.maxFall;
      if (fighter.vy > cap) fighter.vy = cap;
    }
  }

  tryDrop(fighter, input);
  fighter.x += fighter.vx;
  fighter.y += fighter.vy;
  resolvePlatform(sim, fighter, input);

  if (fighter.hitstun > 0) {
    fighter.hitstun -= 1;
    fighter.rot += fighter.rotVel;
    if (fighter.hitstun === 0 && !fighter.airborne) fighter.rot = 0;
  } else if (!fighter.airborne) {
    fighter.rot = 0;
  } else {
    fighter.rot *= 0.9;
  }
}

function startAttack(fighter: FighterState, slot: MoveSlot): void {
  const move = fighter.def.moves.find((entry) => entry.slot === slot);
  if (!move) return;
  const attack: AttackState = { move, frame: 0, hit: [] };
  fighter.attack = attack;
  fighter.attackBuffer = null;
  fighter.fastFalling = false;
  if (!fighter.airborne) fighter.vx *= 0.5;
}

function slotFrom(
  kind: 'jab' | 'strong' | 'up',
  fighter: FighterState,
  input: InputFrame,
): MoveSlot {
  if (kind === 'up') return fighter.airborne ? 'uair' : 'utilt';
  if (kind === 'strong') return fighter.airborne ? 'fair' : 'fstrong';
  if (fighter.airborne && input.down) return 'dair';
  if (fighter.airborne) return 'nair';
  if (input.down) return 'dtilt';
  return 'jab';
}

function tryDrop(fighter: FighterState, input: InputFrame): void {
  if (fighter.dropIgnore > 0) fighter.dropIgnore -= 1;
  if (
    fighter.airborne ||
    fighter.hitstun > 0 ||
    fighter.attack ||
    !input.down ||
    input.jump ||
    input.jumpPressed
  ) {
    return;
  }
  const under = platformUnder(fighter.x, feetOf(fighter));
  if (!under?.passThrough) return;
  fighter.airborne = true;
  fighter.y += 10;
  fighter.vy = Math.max(fighter.vy, 2.2);
  fighter.dropIgnore = 14;
  fighter.coyote = 0;
  fighter.fastFalling = true;
  fighter.prevBottom = feetOf(fighter);
}

function resolvePlatform(sim: Sim, fighter: FighterState, input: InputFrame): void {
  let steppedOff = false;
  if (fighter.airborne && fighter.vy >= 0 && fighter.dropIgnore === 0) {
    const bottom = feetOf(fighter);
    const prev = fighter.prevBottom;
    for (const platform of STAGE.platforms) {
      if (input.down && platform.passThrough) continue;
      if (fighter.x < platform.x || fighter.x > platform.x + platform.w) continue;
      if (prev <= platform.y + 1 && bottom >= platform.y) {
        const impact = fighter.vy;
        fighter.y = platform.y - fighter.height / 2;
        fighter.vy = 0;
        fighter.airborne = false;
        fighter.fastFalling = false;
        fighter.jumpsLeft = fighter.def.airJumps;
        fighter.coyote = 0;
        fighter.rot = 0;
        if (fighter.attack && AERIAL.has(fighter.attack.move.slot)) {
          fighter.attack = null;
          fighter.landLag = 6;
        }
        if (impact > 9) {
          sim.events.push({
            type: 'land',
            player: fighter.index,
            x: fighter.x,
            y: platform.y,
            impact,
          });
        }
        break;
      }
    }
  }

  if (!fighter.airborne) {
    const under = platformUnder(fighter.x, feetOf(fighter));
    if (!under) {
      fighter.airborne = true;
      fighter.coyote = 6;
      steppedOff = true;
    }
  }
  if (fighter.airborne && fighter.coyote > 0 && !steppedOff) fighter.coyote -= 1;
  fighter.prevBottom = feetOf(fighter);
}

function resolveHits(sim: Sim): void {
  const pairs: { attacker: FighterState; victim: FighterState; move: MoveDef }[] = [];
  for (const attacker of sim.fighters) {
    if (!inPlay(attacker) || attacker.hitlag > 0 || !attacker.attack) continue;
    const box = hitboxWorld(attacker);
    if (!box) continue;
    for (const victim of sim.fighters) {
      if (victim.index === attacker.index || !inPlay(victim)) continue;
      if (victim.intangible > 0 || victim.hitlag > 0) continue;
      if (attacker.attack.hit.includes(victim.index)) continue;
      if (!overlap(box, hurtbox(victim))) continue;
      attacker.attack.hit.push(victim.index);
      pairs.push({ attacker, victim, move: attacker.attack.move });
    }
  }

  for (const pair of pairs) connect(sim, pair.attacker, pair.victim, pair.move);
}

function connect(
  sim: Sim,
  attacker: FighterState,
  victim: FighterState,
  move: MoveDef,
): void {
  victim.percent = Math.min(999, victim.percent + move.damage);
  const launch = computeLaunch(victim.percent, move, victim.def.weight, attacker.facing);
  victim.pending = launch;
  victim.hitlag = Math.max(victim.hitlag, launch.hitlag);
  victim.attack = null;
  victim.attackBuffer = null;
  victim.flash = 8;
  attacker.hitlag = Math.max(attacker.hitlag, Math.min(8, launch.hitlag));
  sim.events.push({
    type: 'hit',
    x: (attacker.x + victim.x) / 2,
    y: (attacker.y + victim.y) / 2,
    kb: launch.knockback,
    damage: move.damage,
    attacker: attacker.index,
    victim: victim.index,
  });
}

function releaseLaunch(fighter: FighterState): void {
  const launch = fighter.pending;
  if (!launch) return;
  fighter.pending = null;
  fighter.vx = launch.vx;
  fighter.vy = launch.vy;
  fighter.hitstun = launch.hitstun;
  fighter.attack = null;
  fighter.fastFalling = false;
  fighter.jumpAge = 99;
  if (launch.vy < -1.6 || fighter.airborne) {
    fighter.airborne = true;
    fighter.coyote = 0;
  } else {
    fighter.vy = 0;
    fighter.airborne = false;
  }
  if (Math.abs(launch.vx) > 0.4) fighter.facing = launch.vx > 0 ? -1 : 1;
  fighter.rotVel = launch.knockback > 80 ? 0.22 * Math.sign(launch.vx || fighter.facing) : 0.04;
}

function separateBodies(sim: Sim): void {
  const list = sim.fighters;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (!a || !b || !inPlay(a) || !inPlay(b)) continue;
      if (a.hitstun > 0 || b.hitstun > 0 || a.hitlag > 0 || b.hitlag > 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minX = (a.width + b.width) * 0.42;
      const minY = (a.height + b.height) * 0.38;
      if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;
      const dir = dx === 0 ? (a.index < b.index ? -1 : 1) : Math.sign(dx);
      const shift = Math.min(4, (minX - Math.abs(dx)) * 0.45 + 0.4);
      a.x -= dir * shift;
      b.x += dir * shift;
    }
  }
}

function eliminate(sim: Sim, fighter: FighterState): void {
  sim.events.push({ type: 'ko', player: fighter.index, x: fighter.x, y: fighter.y });
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.attack = null;
  fighter.hitstun = 0;
  fighter.hitlag = 0;
  fighter.pending = null;
  fighter.rotVel = 0;
  fighter.attackBuffer = null;
  if (fighter.stocks > 1) {
    fighter.stocks -= 1;
    fighter.percent = 0;
    fighter.respawnTimer = 78;
    fighter.x = Math.max(STAGE.blast.left + 20, Math.min(STAGE.blast.right - 20, fighter.x));
    fighter.y = 80;
  } else {
    fighter.stocks = 0;
    fighter.respawnTimer = 0;
    fighter.x = -4000;
    fighter.y = -4000;
  }
}

function respawn(sim: Sim, fighter: FighterState): void {
  const spot = spawnSpot(fighter.index, sim.fighters.length, fighter.height);
  fighter.x = spot.x;
  fighter.y = spot.y - 160;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.facing = spot.facing;
  fighter.percent = 0;
  fighter.airborne = true;
  fighter.jumpsLeft = fighter.def.airJumps;
  fighter.intangible = 120;
  fighter.hitstun = 0;
  fighter.hitlag = 0;
  fighter.pending = null;
  fighter.attack = null;
  fighter.fastFalling = false;
  fighter.rot = 0;
  fighter.rotVel = 0;
  fighter.dropIgnore = 0;
  fighter.prevBottom = fighter.y + fighter.height / 2;
  fighter.jumpAge = 99;
  sim.events.push({ type: 'respawn', player: fighter.index });
}

function spawnSpot(
  index: number,
  total: number,
  height: number,
): { x: number; y: number; facing: 1 | -1 } {
  const main = STAGE.platforms[0];
  const left = STAGE.platforms[1];
  const right = STAGE.platforms[2];
  if (!main || !left || !right) return { x: 640, y: 400, facing: 1 };
  if (total <= 2) {
    const x = index === 0 ? 470 : 810;
    return { x, y: main.y - height / 2, facing: index === 0 ? 1 : -1 };
  }
  if (index === 0) return { x: 520, y: main.y - height / 2, facing: 1 };
  if (index === 1) return { x: 760, y: main.y - height / 2, facing: -1 };
  if (index === 2) return { x: left.x + left.w / 2, y: left.y - height / 2, facing: 1 };
  return { x: right.x + right.w / 2, y: right.y - height / 2, facing: -1 };
}

function inPlay(fighter: FighterState): boolean {
  return fighter.stocks > 0 && fighter.respawnTimer === 0;
}

function outsideBlast(fighter: FighterState): boolean {
  const blast = STAGE.blast;
  return (
    fighter.x < blast.left ||
    fighter.x > blast.right ||
    fighter.y < blast.top ||
    fighter.y > blast.bottom
  );
}

function feetOf(fighter: FighterState): number {
  return fighter.y + fighter.height / 2;
}

function platformUnder(x: number, feetY: number): PlatformDef | null {
  for (const platform of STAGE.platforms) {
    if (x >= platform.x && x <= platform.x + platform.w && Math.abs(feetY - platform.y) <= 6) {
      return platform;
    }
  }
  return null;
}

function hurtbox(fighter: FighterState): Rect {
  const insetX = fighter.width * 0.12;
  const insetY = fighter.height * 0.08;
  return {
    x: fighter.x - fighter.width / 2 + insetX,
    y: fighter.y - fighter.height / 2 + insetY,
    w: fighter.width - insetX * 2,
    h: fighter.height - insetY * 2,
  };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return target;
}
