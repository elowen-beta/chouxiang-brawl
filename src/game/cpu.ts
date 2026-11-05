import { blankInput, type InputFrame } from './input.ts';
import { STAGE } from './stage.ts';
import type { FighterState } from './types.ts';

function nextRand(self: FighterState): number {
  self.rng = (Math.imul(self.rng, 1664525) + 1013904223) >>> 0;
  return self.rng / 4294967296;
}

function finishJump(self: FighterState, input: InputFrame): InputFrame {
  if (self.cpuJumpHold > 0) {
    input.jump = true;
    self.cpuJumpHold -= 1;
  }
  return input;
}

function requestJump(self: FighterState, input: InputFrame, frames: number): void {
  if (self.cpuJumpHold > 0) return;
  self.cpuJumpHold = frames;
  input.jumpPressed = true;
}

/** A small practice partner. Deterministic, a little reckless, and happy to mash. */
export function cpuInput(self: FighterState, fighters: readonly FighterState[]): InputFrame {
  const input = blankInput();
  if (self.stocks <= 0 || self.respawnTimer > 0 || self.hitlag > 0) return input;

  const main = STAGE.platforms[0];
  if (!main) return input;
  const stageCenter = main.x + main.w / 2;
  const offstage = self.x < main.x - 8 || self.x > main.x + main.w + 8;

  if (self.hitstun > 0) {
    if (self.x < stageCenter) input.right = true;
    else input.left = true;
    if (self.y > main.y - 80) input.jump = true;
    return input;
  }

  if (offstage && self.airborne) {
    const toward = self.x < stageCenter ? 1 : -1;
    input.left = toward < 0;
    input.right = toward > 0;
    if (self.jumpsLeft > 0 && self.vy > -1) requestJump(self, input, 12);
    else if (self.vy > -2) input.upAttackPressed = true;
    return finishJump(self, input);
  }

  const foes = fighters.filter(
    (other) => other.index !== self.index && other.stocks > 0 && other.respawnTimer === 0,
  );
  if (foes.length === 0) return finishJump(self, input);

  let target = foes[0];
  if (!target) return input;
  for (const other of foes) {
    const score = Math.abs(other.x - self.x) + Math.abs(other.y - self.y) * 0.35;
    const best = Math.abs(target.x - self.x) + Math.abs(target.y - self.y) * 0.35;
    if (score < best) target = other;
  }

  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const adx = Math.abs(dx);
  if (adx > 16) {
    input.left = dx < 0;
    input.right = dx > 0;
  }

  if (!self.airborne && self.x < main.x + 64 && dx < 0 && target.x > main.x) {
    input.left = false;
    input.right = true;
  }
  if (!self.airborne && self.x > main.x + main.w - 64 && dx > 0 && target.x < main.x + main.w) {
    input.right = false;
    input.left = true;
  }

  const roll = nextRand(self);
  const close = adx < 88 && Math.abs(dy) < 84;
  if (close) {
    if (dy < -50 && !self.airborne) {
      requestJump(self, input, 10);
      if (roll < 0.45) input.upAttackPressed = true;
    } else if (target.percent >= 80 && roll < 0.62) {
      input.strongPressed = true;
    } else if (self.airborne && dy > 28 && roll < 0.55) {
      input.down = true;
      input.jabPressed = true;
    } else if (roll < 0.72) {
      input.jabPressed = true;
    }
  } else if (!self.airborne && dy < -70 && adx < 180 && roll < 0.22) {
    requestJump(self, input, 14);
  }

  if (self.airborne && self.vy > 2 && self.y > main.y - 20 && offstage) {
    input.upAttackPressed = true;
  }

  return finishJump(self, input);
}
