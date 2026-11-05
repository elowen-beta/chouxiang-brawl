import { computeLaunch } from '../src/game/knockback.ts';
import { blankInput, type InputFrame } from '../src/game/input.ts';
import { createMatch, placeFighter, step, type Sim } from '../src/game/sim.ts';
import { STAGE } from '../src/game/stage.ts';
import type { FighterState, MoveSlot } from '../src/game/types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fresh(): Sim {
  const sim = createMatch([
    { joined: true, characterId: 'fangfang', cpu: false },
    { joined: true, characterId: 'gungun', cpu: false },
    { joined: false, characterId: 'cici', cpu: false },
    { joined: false, characterId: 'wenwen', cpu: false },
  ]);
  sim.phase = 'fight';
  sim.countdown = 0;
  for (const fighter of sim.fighters) fighter.intangible = 0;
  return sim;
}

function press(patch: Partial<InputFrame>): InputFrame {
  return { ...blankInput(), ...patch };
}

function frames(sim: Sim, count: number, inputFor: (sim: Sim) => InputFrame[]): void {
  for (let i = 0; i < count; i += 1) step(sim, inputFor(sim));
}

function groundY(fighter: FighterState): number {
  const main = STAGE.platforms[0];
  assert(main, 'main platform');
  return main.y - fighter.height / 2;
}

function trace(slot: MoveSlot, percent: number): { ko: string | null; x: number; y: number; minY: number; kb: number } {
  const fang = fresh().fighters[0];
  assert(fang, 'fang');
  const move = fang.def.moves.find((entry) => entry.slot === slot);
  assert(move, slot);
  const launch = computeLaunch(percent, move, fang.def.weight, 1);
  let x = 640;
  let y = groundY(fang);
  let vx = launch.vx;
  let vy = launch.vy;
  let minY = y;
  let ko: string | null = null;
  for (let i = 0; i < launch.hitstun; i += 1) {
    vy += fang.def.gravity;
    x += vx;
    y += vy;
    if (y < minY) minY = y;
    const blast = STAGE.blast;
    if (x < blast.left || x > blast.right || y < blast.top || y > blast.bottom) {
      ko = `f${i} @ ${x.toFixed(0)},${y.toFixed(0)} kb ${launch.knockback.toFixed(1)} stun ${launch.hitstun}`;
      break;
    }
  }
  return { ko, x, y, minY, kb: launch.knockback };
}

const strong = fresh().fighters[0]?.def.moves.find((move) => move.slot === 'fstrong');
assert(strong, 'strong');
const light = computeLaunch(120, strong, 76, 1);
const heavy = computeLaunch(120, strong, 128, 1);
assert(light.knockback > heavy.knockback, 'lighter characters should take more knockback');
const low = computeLaunch(20, strong, 100, 1);
const high = computeLaunch(180, strong, 100, 1);
assert(high.knockback > low.knockback, 'knockback should grow with percent');
assert(high.vx > 0 && high.vy < 0, 'a forward-up angle should launch right and up');
const spike = fresh().fighters[0]?.def.moves.find((move) => move.slot === 'dair');
assert(spike, 'dair');
const dair = computeLaunch(80, spike, 100, 1);
assert(dair.vy > 0 && Math.abs(dair.vx) < 1, `dair should spike down, got ${dair.vx},${dair.vy}`);

const idle = fresh();
const y0 = idle.fighters[0]?.y ?? 0;
frames(idle, 180, () => [blankInput(), blankInput()]);
assert(Math.abs((idle.fighters[0]?.y ?? 0) - y0) < 1, 'fighters should stand on the stage');
assert(idle.fighters[0]?.stocks === 3, 'standing still should not KO');

const walk = fresh();
const x0 = walk.fighters[0]?.x ?? 0;
frames(walk, 40, () => [press({ right: true }), blankInput()]);
assert((walk.fighters[0]?.x ?? 0) > x0 + 40, 'holding right should walk');
assert(walk.fighters[0]?.stocks === 3, 'walking the stage should not KO');

const jab = fresh();
const attacker = jab.fighters[0];
const victim = jab.fighters[1];
assert(attacker && victim, 'pair');
placeFighter(jab, 0, 600, groundY(attacker));
placeFighter(jab, 1, 650, groundY(victim));
attacker.facing = 1;
attacker.intangible = 0;
victim.intangible = 0;
step(jab, [press({ jabPressed: true }), blankInput()]);
frames(jab, 16, () => [blankInput(), blankInput()]);
assert(victim.percent > 0, `jab should connect, percent=${victim.percent} atk=${attacker.x.toFixed(0)} vic=${victim.x.toFixed(0)}`);

function recover(sim: Sim): InputFrame[] {
  return sim.fighters.map((fighter) => {
    const input = blankInput();
    if (fighter.x < 640) input.right = true;
    else input.left = true;
    if (fighter.airborne && fighter.vy > 0 && fighter.hitstun === 0) input.jumpPressed = true;
    if (fighter.airborne && fighter.y > 430 && fighter.hitstun === 0) input.upAttackPressed = true;
    return input;
  });
}

function strongFrom(percent: number, victimX: number): { stocks: number; x: number; y: number; percent: number } {
  const sim = fresh();
  const a = sim.fighters[0];
  const b = sim.fighters[1];
  assert(a && b, 'pair');
  placeFighter(sim, 0, victimX - 62, groundY(a));
  placeFighter(sim, 1, victimX, groundY(b));
  a.facing = 1;
  a.intangible = 0;
  b.intangible = 0;
  b.percent = percent;
  step(sim, [press({ strongPressed: true }), blankInput()]);
  frames(sim, 260, (current) => {
    const body = current.fighters[1];
    if (body && body.hitstun === 0 && body.hitlag === 0 && body.percent === percent) {
      return [blankInput(), blankInput()];
    }
    return recover(current);
  });
  return { stocks: b.stocks, x: b.x, y: b.y, percent: b.percent };
}

const early = strongFrom(25, 640);
const late = strongFrom(230, 700);
const traces = {
  low: trace('fstrong', 30),
  mid: trace('fstrong', 110),
  high: trace('fstrong', 210),
  upLow: trace('utilt', 40),
  upHigh: trace('utilt', 210),
  early,
  late,
};
assert(early.stocks === 3, `low percent strong should be survivable ${JSON.stringify(traces)}`);
assert(late.stocks < 3, `high percent strong should KO ${JSON.stringify(traces)}`);
assert(!traces.low.ko, `30% strong should not cross a blast zone during hitstun ${JSON.stringify(traces.low)}`);
assert(traces.high.ko, `210% strong should cross a blast zone during hitstun ${JSON.stringify(traces.high)}`);

console.log('sim ok');
