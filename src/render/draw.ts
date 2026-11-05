import Phaser from 'phaser';
import { HEIGHT, PLAYER_COLORS, WIDTH } from '../game/constants.ts';
import { hitboxWorld } from '../game/sim.ts';
import { STAGE } from '../game/stage.ts';
import type { CharacterDef, FighterState, ShapeKind } from '../game/types.ts';

export function numColor(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

export function paintSky(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x1c1238, 1);
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.fillStyle(0x3a2070, 0.55);
  g.fillRect(0, 0, WIDTH, 280);
  g.fillStyle(0x101828, 0.72);
  g.fillRect(0, 430, WIDTH, HEIGHT - 430);

  g.fillStyle(0xfff3c4, 0.85);
  for (const [x, y, r] of STARS) g.fillCircle(x, y, r);

  g.fillStyle(0xffe3b0, 1);
  g.fillCircle(1048, 124, 58);
  g.fillStyle(0x3a2070, 1);
  g.fillCircle(1072, 108, 48);

  g.fillStyle(0x140c28, 1);
  g.fillRect(0, 268, 190, 280);
  g.fillRect(46, 196, 28, 80);
  g.fillRect(96, 160, 20, 116);
  g.fillRect(1090, 248, 190, 300);
  g.fillRect(1168, 176, 26, 84);
  g.fillStyle(0xffc15a, 0.7);
  for (let y = 292; y < 500; y += 38) {
    g.fillRect(24, y, 16, 18);
    g.fillRect(58, y, 16, 18);
    g.fillRect(1124, y, 16, 18);
    g.fillRect(1176, y, 16, 18);
  }

  g.lineStyle(3, 0x241830, 1);
  g.lineBetween(390, 0, 390, 146);
  g.lineBetween(900, 0, 900, 146);
  g.fillStyle(0xffd27a, 1);
  g.fillCircle(390, 158, 12);
  g.fillCircle(900, 158, 12);
  g.fillStyle(0xffe7b0, 0.16);
  g.fillTriangle(390, 168, 320, 300, 460, 300);
  g.fillTriangle(900, 168, 830, 300, 970, 300);

  g.fillStyle(0x2a1020, 0.55);
  g.fillRect(0, 600, WIDTH, 120);
}

export function paintPlatforms(g: Phaser.GameObjects.Graphics): void {
  for (const platform of STAGE.platforms) {
    if (!platform.passThrough) continue;
    g.fillStyle(0x071018, 0.35);
    g.fillRoundedRect(platform.x, platform.y + 8, platform.w, platform.h, 9);
    g.fillStyle(0x8ee7ff, 0.92);
    g.fillRoundedRect(platform.x, platform.y, platform.w, platform.h, 9);
    g.fillStyle(0xf3fdff, 0.9);
    g.fillRoundedRect(platform.x + 10, platform.y + 4, platform.w - 20, 4, 2);
  }

  const main = STAGE.platforms[0];
  if (!main) return;
  g.fillStyle(0x05040c, 0.4);
  g.fillRoundedRect(main.x + 10, main.y + 14, main.w, main.h, 14);
  g.fillStyle(0x3c4c6c, 1);
  g.fillRoundedRect(main.x, main.y, main.w, main.h, 14);
  g.fillStyle(0xe7eef8, 1);
  g.fillRoundedRect(main.x, main.y, main.w, 12, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.fillStyle(0xf5c542, 1);
  for (let x = main.x + 18; x < main.x + main.w - 20; x += 28) {
    g.fillRect(x, main.y + 22, 14, 12);
  }
  g.fillStyle(0xd5deef, 1);
  g.fillCircle(main.x + 28, main.y + 30, 4);
  g.fillCircle(main.x + main.w - 28, main.y + 30, 4);
  g.fillStyle(0x8ea0c0, 1);
  g.fillCircle(main.x + main.w / 2, main.y + 30, 5);
}

export function paintStage(g: Phaser.GameObjects.Graphics): void {
  paintSky(g);
  paintPlatforms(g);
}

export function drawDanger(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xff3355, 0.12);
  g.fillRect(0, 0, 64, HEIGHT);
  g.fillRect(WIDTH - 64, 0, 64, HEIGHT);
  g.fillRect(0, 0, WIDTH, 28);
  g.fillRect(0, HEIGHT - 46, WIDTH, 46);
}

export function drawPortrait(
  g: Phaser.GameObjects.Graphics,
  def: CharacterDef,
  x: number,
  y: number,
  facing: 1 | -1,
  frame: number,
): void {
  const bob = Math.sin(frame / 16) * 3;
  drawBody(g, def, x, y + bob, facing, 'idle', 0, false);
}

export function drawFighter(
  g: Phaser.GameObjects.Graphics,
  fighter: FighterState,
  frame: number,
): void {
  if (fighter.stocks <= 0 || fighter.respawnTimer > 0) return;

  const ring = PLAYER_COLORS[fighter.seat] ?? 0xffffff;
  g.fillStyle(0x05040c, fighter.airborne ? 0.15 : 0.35);
  const shadowY = fighter.airborne ? fighter.y + fighter.height / 2 + 18 : fighter.y + fighter.height / 2 + 3;
  const shadowW = fighter.airborne ? fighter.width * 0.55 : fighter.width * 0.85;
  g.fillEllipse(fighter.x, shadowY, shadowW, 12);
  g.lineStyle(4, ring, 0.95);
  g.strokeEllipse(fighter.x, fighter.y + fighter.height / 2 - 1, fighter.width * 0.92, 16);

  const flicker = fighter.intangible > 0 && Math.floor(frame / 4) % 2 === 0;
  if (flicker) return;

  const played = fighter.attack ? fighter.attack.frame - 1 : -1;
  const move = fighter.attack?.move;
  const active = Boolean(
    move && played >= move.startup && played < move.startup + move.active,
  );
  const lunge = active ? fighter.facing * 8 : 0;
  const bob =
    !fighter.airborne && fighter.hitstun === 0 && !fighter.attack
      ? Math.sin((frame + fighter.index * 9) / 7) * 2
      : 0;
  const mood = fighter.hitstun > 0 || fighter.flash > 0 ? 'hurt' : fighter.attack ? 'attack' : 'idle';
  drawBody(
    g,
    fighter.def,
    fighter.x + lunge,
    fighter.y + bob,
    fighter.facing,
    mood,
    fighter.rot,
    fighter.flash > 0,
  );
}

export function drawHitboxes(g: Phaser.GameObjects.Graphics, fighter: FighterState): void {
  const box = hitboxWorld(fighter);
  if (!box || fighter.respawnTimer > 0 || fighter.stocks <= 0) return;
  const color = numColor(fighter.def.accent);
  g.fillStyle(color, 0.38);
  g.fillRoundedRect(box.x, box.y, box.w, box.h, 7);
  g.lineStyle(2, 0xffffff, 0.8);
  g.strokeRoundedRect(box.x, box.y, box.w, box.h, 7);
}

function drawBody(
  g: Phaser.GameObjects.Graphics,
  def: CharacterDef,
  x: number,
  y: number,
  facing: 1 | -1,
  mood: 'idle' | 'hurt' | 'attack',
  rot: number,
  flash: boolean,
): void {
  const fill = flash ? 0xfff7ea : numColor(def.color);
  const accent = flash ? 0xffffff : numColor(def.accent);
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(rot);
  paintShape(g, def.shape, def.width + 8, def.height + 8, 0x140c18);
  paintShape(g, def.shape, def.width, def.height, fill);
  if (!flash && def.shape !== 'diamond') {
    g.fillStyle(accent, 0.28);
    if (def.shape === 'circle') g.fillCircle(-def.width * 0.16, -def.height * 0.18, def.width * 0.16);
    else if (def.shape === 'square') {
      g.fillRoundedRect(-def.width / 2 + 7, -def.height / 2 + 7, def.width - 14, def.height * 0.34, 8);
    } else {
      g.fillRoundedRect(-def.width * 0.22, -def.height * 0.28, def.width * 0.44, def.height * 0.18, 6);
    }
  }
  drawFace(g, def, facing, mood);
  g.restore();
}

function paintShape(
  g: Phaser.GameObjects.Graphics,
  shape: ShapeKind,
  w: number,
  h: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  if (shape === 'square') {
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    return;
  }
  if (shape === 'circle') {
    g.fillCircle(0, 0, Math.min(w, h) / 2);
    return;
  }
  if (shape === 'diamond') {
    g.beginPath();
    g.moveTo(0, -h / 2);
    g.lineTo(w / 2, 2);
    g.lineTo(0, h / 2);
    g.lineTo(-w / 2, 2);
    g.closePath();
    g.fillPath();
    return;
  }
  g.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    const px = Math.cos(angle) * (w / 2);
    const py = Math.sin(angle) * (h / 2);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

function drawFace(
  g: Phaser.GameObjects.Graphics,
  def: CharacterDef,
  facing: 1 | -1,
  mood: 'idle' | 'hurt' | 'attack',
): void {
  const spread = def.width * 0.18;
  const eyeY = def.shape === 'circle' ? -2 : -def.height * 0.08;
  const look = facing * 2.4;
  if (def.shape === 'diamond' && mood !== 'hurt') {
    g.lineStyle(4, 0x1a1024, 1);
    g.beginPath();
    g.moveTo(-spread - 8, eyeY - 10);
    g.lineTo(-spread + 7, eyeY - 4);
    g.moveTo(spread + 8, eyeY - 10);
    g.lineTo(spread - 7, eyeY - 4);
    g.strokePath();
  }

  if (mood === 'hurt') {
    g.lineStyle(4, 0x1a1024, 1);
    for (const ex of [-spread, spread]) {
      g.beginPath();
      g.moveTo(ex - 5, eyeY - 5);
      g.lineTo(ex + 5, eyeY + 5);
      g.moveTo(ex + 5, eyeY - 5);
      g.lineTo(ex - 5, eyeY + 5);
      g.strokePath();
    }
  } else {
    g.fillStyle(0xfff8ee, 1);
    g.fillEllipse(-spread, eyeY, 12, 14);
    g.fillEllipse(spread, eyeY, 12, 14);
    g.fillStyle(0x1a1024, 1);
    const pupil = mood === 'attack' ? 2.2 : 3.3;
    g.fillCircle(-spread + look, eyeY + 1, pupil);
    g.fillCircle(spread + look, eyeY + 1, pupil);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(-spread + look - 1.4, eyeY - 1.5, 1.3);
    g.fillCircle(spread + look - 1.4, eyeY - 1.5, 1.3);
    if (mood === 'idle') {
      g.fillStyle(0xff8aa8, 0.45);
      g.fillEllipse(-spread - 1, eyeY + 10, 8, 5);
      g.fillEllipse(spread + 1, eyeY + 10, 8, 5);
    }
  }

  g.lineStyle(3, 0x1a1024, 0.9);
  if (mood === 'hurt') {
    g.strokeCircle(0, def.height * 0.16, 5);
  } else if (mood === 'attack') {
    g.fillStyle(0x1a1024, 0.9);
    g.fillRoundedRect(-7, def.height * 0.14, 14, 4, 2);
  } else {
    g.beginPath();
    g.arc(0, def.height * 0.1, 7, 0.15 * Math.PI, 0.85 * Math.PI, false);
    g.strokePath();
  }
}

const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [80, 70, 1.6],
  [150, 130, 1.3],
  [230, 54, 1.8],
  [310, 150, 1.2],
  [480, 86, 1.5],
  [560, 40, 1.2],
  [690, 120, 1.7],
  [760, 64, 1.3],
  [860, 150, 1.4],
  [980, 48, 1.6],
  [1140, 90, 1.3],
  [1210, 160, 1.5],
  [180, 200, 1.2],
  [640, 170, 1.4],
];
