import Phaser from 'phaser';
import { HEIGHT, PLAYER_HEX, STEP_MS, WIDTH } from '../game/constants.ts';
import { blankInput, heldOnly, sampleInput, type InputFrame } from '../game/input.ts';
import { percentColor } from '../game/present.ts';
import { SETUP_KEY, defaultSetup, type MatchSetup } from '../game/setup.ts';
import { isMuted, sfx, toggleMute, unlockAudio } from '../game/sfx.ts';
import { createMatch, step, type Sim } from '../game/sim.ts';
import { STAGE } from '../game/stage.ts';
import type { SimEvent } from '../game/types.ts';
import { drawDanger, drawFighter, drawHitboxes, drawPortrait, numColor, paintStage } from '../render/draw.ts';
import { label } from '../render/label.ts';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
  r: number;
}

interface Floater {
  label: Phaser.GameObjects.Text;
  life: number;
}

export class FightScene extends Phaser.Scene {
  private sim!: Sim;
  private fx!: Phaser.GameObjects.Graphics;
  private names: Phaser.GameObjects.Text[] = [];
  private percents: Phaser.GameObjects.Text[] = [];
  private countdown!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private koText!: Phaser.GameObjects.Text;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultBody!: Phaser.GameObjects.Text;
  private resultHint!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private sparks: Spark[] = [];
  private floaters: Floater[] = [];
  private punch: number[] = [];
  private acc = 0;
  private paused = false;
  private endAge = 0;
  private koAge = 0;
  private muteAge = 0;
  private debug = false;
  private flashAlpha = 0;
  private lock = 8;

  constructor() {
    super('fight');
  }

  create(): void {
    const setup = this.readSetup();
    this.sim = createMatch(setup.slots);
    const bg = this.add.graphics();
    paintStage(bg);
    this.add
      .text(WIDTH / 2, STAGE.platforms[0] ? STAGE.platforms[0].y + 26 : 560, STAGE.name, label(16, '#d5def2'))
      .setOrigin(0.5);
    this.fx = this.add.graphics();

    const n = this.sim.fighters.length;
    this.sim.fighters.forEach((fighter, index) => {
      const spot = hudSpot(n, index);
      const color = PLAYER_HEX[fighter.seat] ?? '#ffffff';
      const name = this.add
        .text(spot.x, spot.nameY, `P${fighter.seat + 1}  ${fighter.def.name}${fighter.cpu ? ' · 练习' : ''}`, label(spot.nameSize, color, { stroke: '#140c18', strokeThickness: 4 }))
        .setOrigin(spot.origin, 0);
      const percent = this.add
        .text(spot.x, spot.percentY, '0%', label(spot.percentSize, '#f7f4ee', { stroke: '#140c18', strokeThickness: 6 }))
        .setOrigin(spot.origin, 0);
      this.names.push(name);
      this.percents.push(percent);
      this.punch.push(0);
    });

    this.countdown = this.add
      .text(WIDTH / 2, 250, '3', label(120, '#fff6e4', { stroke: '#1a0c28', strokeThickness: 10 }))
      .setOrigin(0.5);
    this.koText = this.add
      .text(WIDTH / 2, 250, 'KO', label(120, '#ffe56a', { stroke: '#2a0c18', strokeThickness: 10 }))
      .setOrigin(0.5)
      .setVisible(false);
    this.hint = this.add
      .text(
        WIDTH / 2,
        HEIGHT - 28,
        'P1  J轻 K重 L上     P2  1轻 2重 3上     按住下穿过云台     Esc暂停',
        label(18, '#fff6e4', { stroke: '#140c18', strokeThickness: 4 }),
      )
      .setOrigin(0.5);
    this.resultTitle = this.add
      .text(WIDTH / 2, 292, '', label(42, '#fff6e4', { stroke: '#140c18', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setVisible(false);
    this.resultBody = this.add
      .text(WIDTH / 2, 348, '', label(24, '#ffe7a8'))
      .setOrigin(0.5)
      .setVisible(false);
    this.resultHint = this.add
      .text(WIDTH / 2, 398, 'Enter 再来一局    Backspace 换人', label(20, '#efe6d8'))
      .setOrigin(0.5)
      .setVisible(false);
    this.pauseText = this.add
      .text(WIDTH / 2, 300, '暂停\nEsc 继续\nBackspace 回选人', label(40, '#fff6e4', { align: 'center', stroke: '#140c18', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setVisible(false);
    this.muteText = this.add
      .text(WIDTH / 2, 168, '', label(22, '#d7ffe8'))
      .setOrigin(0.5)
      .setVisible(false);
    this.debugText = this.add
      .text(24, 560, '', label(14, '#d7ffe8'))
      .setVisible(false);
    unlockAudio();
  }

  update(_time: number, delta: number): void {
    const sample = sampleInput();
    if (this.lock > 0) this.lock -= 1;
    if (this.handleMeta(sample)) return;
    const events = this.advance(delta, sample.players);
    this.react(events);
    this.redraw();
  }

  private handleMeta(sample: ReturnType<typeof sampleInput>): boolean {
    if (sample.pressed('KeyM')) {
      const muted = toggleMute();
      if (!muted) sfx.pause();
      this.muteAge = 50;
      this.muteText.setText(muted ? '声音关' : '声音开');
    }
    if (sample.pressed('F2')) this.debug = !this.debug;

    const ended = this.sim.phase === 'end';
    if (!ended && this.lock === 0 && sample.pausePressed) {
      this.paused = !this.paused;
      sfx.pause();
    }
    if (this.paused && sample.pressed('Backspace')) {
      this.scene.start('select');
      return true;
    }
    if (ended && this.endAge > 36 && this.lock === 0) {
      if (sample.pressed('Enter') || sample.pressed('Space')) {
        this.scene.restart();
        return true;
      }
      if (sample.pressed('Backspace') || sample.pressed('Escape')) {
        this.scene.start('select');
        return true;
      }
    }
    return false;
  }

  private advance(delta: number, players: InputFrame[]): SimEvent[] {
    if (this.paused) {
      this.acc = 0;
      return [];
    }
    const events: SimEvent[] = [];
    this.acc += delta;
    if (this.acc > 100) this.acc = 100;
    let first = true;
    let guard = 0;
    while (this.acc >= STEP_MS && guard < 5) {
      const inputs =
        this.lock > 0 ? players.map(() => blankInput()) : first ? players : players.map(heldOnly);
      step(this.sim, inputs);
      events.push(...this.sim.events);
      this.acc -= STEP_MS;
      first = false;
      guard += 1;
    }
    if (this.sim.phase === 'end') this.endAge += 1;
    return events;
  }

  private react(events: SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'hit') {
        const victim = this.sim.fighters[event.victim];
        this.punch[event.victim] = 1;
        sfx.hit(event.kb);
        this.burst(event.x, event.y, victim ? numColor(victim.def.accent) : 0xfff1c2, 10, 3.2);
        this.floater(event.x, event.y - 20, `+${event.damage}`);
        if (event.kb > 75) this.cameras.main.shake(90, Math.min(0.01, event.kb / 14000));
        if (event.kb > 130) this.flashAlpha = Math.min(0.28, event.kb / 900);
      } else if (event.type === 'ko') {
        this.koAge = 52;
        sfx.ko();
        this.cameras.main.shake(180, 0.014);
        this.flashAlpha = 0.3;
        this.burst(event.x, Math.min(HEIGHT - 40, Math.max(40, event.y)), 0xffe56a, 22, 5);
      } else if (event.type === 'jump') {
        sfx.jump();
      } else if (event.type === 'land' && event.impact > 11) {
        sfx.land();
      }
    }
  }

  private redraw(): void {
    for (const spark of this.sparks) {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy += 0.12;
      spark.life -= 1;
    }
    this.sparks = this.sparks.filter((spark) => spark.life > 0);
    for (const floater of this.floaters) {
      floater.life -= 1;
      floater.label.y -= 1.3;
      floater.label.setAlpha(Math.max(0, floater.life / 32));
    }
    this.floaters = this.floaters.filter((floater) => {
      if (floater.life > 0) return true;
      floater.label.destroy();
      return false;
    });
    this.flashAlpha = Math.max(0, this.flashAlpha - 0.02);

    this.fx.clear();
    drawDanger(this.fx);
    const hudBottom = this.sim.fighters.length > 2 ? 132 : 150;
    this.fx.fillStyle(0x07060f, 0.42);
    this.fx.fillRect(0, 0, WIDTH, hudBottom);

    const ordered = [...this.sim.fighters].sort((a, b) => a.y - b.y);
    for (const fighter of ordered) drawFighter(this.fx, fighter, this.sim.frame);
    for (const fighter of this.sim.fighters) drawHitboxes(this.fx, fighter);

    this.sim.fighters.forEach((fighter, index) => {
      const spot = hudSpot(this.sim.fighters.length, index);
      this.drawStocks(spot, fighter.stocks, fighter.seat);
      const name = this.names[index];
      const percent = this.percents[index];
      if (!name || !percent) return;
      const out = fighter.stocks <= 0;
      percent.setText(out ? '出局' : `${Math.floor(fighter.percent)}%`);
      percent.setColor(out ? '#8d8798' : percentColor(fighter.percent));
      percent.setAlpha(fighter.respawnTimer > 0 ? 0.45 : 1);
      this.punch[index] = Math.max(0, (this.punch[index] ?? 0) - 0.08);
      percent.setScale(1 + (this.punch[index] ?? 0) * 0.35);
    });

    for (const spark of this.sparks) {
      this.fx.fillStyle(spark.color, Math.max(0, spark.life / 24));
      this.fx.fillCircle(spark.x, spark.y, spark.r);
    }
    if (this.flashAlpha > 0) {
      this.fx.fillStyle(0xfff6ea, this.flashAlpha);
      this.fx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    let banner = '';
    if (this.sim.phase === 'countdown') {
      banner = this.sim.countdown > 120 ? '3' : this.sim.countdown > 60 ? '2' : '1';
    } else if (this.sim.phase === 'fight' && this.sim.fightFrame < 42) {
      banner = '开始';
    }
    this.countdown.setVisible(banner !== '' && this.koAge <= 0);
    if (banner) this.countdown.setText(banner);

    const showResult = this.sim.phase === 'end' && this.endAge > 36;
    if (this.koAge > 0 && !showResult) {
      this.koAge -= 1;
      this.koText.setVisible(true);
      this.koText.setScale(1 + this.koAge / 90);
      this.koText.setAlpha(Math.min(1, this.koAge / 12));
    } else {
      if (showResult) this.koAge = 0;
      this.koText.setVisible(false);
    }

    const hintAlpha =
      this.sim.phase === 'countdown'
        ? 0
        : this.sim.fightFrame < 220
          ? 1
          : Math.max(0, 1 - (this.sim.fightFrame - 220) / 70);
    this.hint.setAlpha(this.paused ? 0 : hintAlpha);

    if (showResult) {
      this.fx.fillStyle(0x120c1e, 0.88);
      this.fx.fillRoundedRect(310, 168, 660, 270, 24);
      const winner = this.sim.fighters.find((fighter) => fighter.index === this.sim.winner);
      const ring = winner ? (PLAYER_HEX[winner.seat] ?? '#fff6e4') : '#fff6e4';
      this.fx.lineStyle(4, numColor(ring), 1);
      this.fx.strokeRoundedRect(310, 168, 660, 270, 24);
      if (winner) {
        drawPortrait(this.fx, winner.def, WIDTH / 2, 230, winner.facing, this.sim.frame);
        this.resultTitle.setText(`${winner.def.name} 拿下了这场乱斗`);
        this.resultTitle.setColor(ring);
        this.resultBody.setText(`P${winner.seat + 1}  还剩 ${winner.stocks} 条命`);
      } else {
        this.resultTitle.setText('一起掉出了装配台');
        this.resultTitle.setColor('#fff6e4');
        this.resultBody.setText('这局没有人留在台上');
      }
    }
    this.resultTitle.setVisible(showResult);
    this.resultBody.setVisible(showResult);
    this.resultHint.setVisible(showResult);
    this.pauseText.setVisible(this.paused && !showResult);
    if (this.paused && !showResult) {
      this.fx.fillStyle(0x07060f, 0.45);
      this.fx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (this.muteAge > 0) {
      this.muteAge -= 1;
      this.muteText.setVisible(true);
      this.muteText.setText(isMuted() ? '声音关' : '声音开');
    } else {
      this.muteText.setVisible(false);
    }

    if (this.debug) {
      const lines = this.sim.fighters.map(
        (fighter) =>
          `P${fighter.seat + 1} ${fighter.def.name} x ${fighter.x.toFixed(0)} y ${fighter.y.toFixed(0)} vx ${fighter.vx.toFixed(1)} vy ${fighter.vy.toFixed(1)} stun ${fighter.hitstun} % ${fighter.percent.toFixed(0)} ${fighter.airborne ? '空中' : '地面'}`,
      );
      this.debugText.setText(lines.join('\n')).setVisible(true);
    } else {
      this.debugText.setVisible(false);
    }
  }

  private drawStocks(
    spot: { x: number; origin: number; pipsY: number },
    stocks: number,
    seat: number,
  ): void {
    const color = numColor(PLAYER_HEX[seat] ?? '#ffffff');
    const gap = 22;
    const total = gap * 2;
    const start =
      spot.origin === 0.5 ? spot.x - total / 2 : spot.origin === 1 ? spot.x - total : spot.x;
    for (let i = 0; i < 3; i += 1) {
      const filled = i < stocks;
      this.fx.fillStyle(filled ? color : 0x2a2438, 1);
      this.fx.fillCircle(start + i * gap, spot.pipsY, 7);
      if (!filled) {
        this.fx.lineStyle(2, 0x6e6780, 0.9);
        this.fx.strokeCircle(start + i * gap, spot.pipsY, 7);
      }
    }
  }

  private burst(x: number, y: number, color: number, count: number, speed: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 16 + Math.floor(Math.random() * 12),
        color,
        r: 2.5 + Math.random() * 2.5,
      });
    }
    if (this.sparks.length > 120) this.sparks.splice(0, this.sparks.length - 120);
  }

  private floater(x: number, y: number, text: string): void {
    const tag = this.add
      .text(x, y, text, label(26, '#fff6e4', { stroke: '#1a1024', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.floaters.push({ label: tag, life: 32 });
  }

  private readSetup(): MatchSetup {
    const value = this.registry.get(SETUP_KEY) as MatchSetup | undefined;
    if (!value || !Array.isArray(value.slots)) {
      const setup = defaultSetup();
      this.registry.set(SETUP_KEY, setup);
      return setup;
    }
    return value;
  }
}

function hudSpot(count: number, index: number): {
  x: number;
  origin: number;
  nameY: number;
  percentY: number;
  pipsY: number;
  nameSize: number;
  percentSize: number;
} {
  if (count === 2) {
    const left = index === 0;
    return {
      x: left ? 36 : WIDTH - 36,
      origin: left ? 0 : 1,
      nameY: 16,
      percentY: 44,
      pipsY: 128,
      nameSize: 22,
      percentSize: 64,
    };
  }
  const slot = WIDTH / count;
  return {
    x: slot * index + slot / 2,
    origin: 0.5,
    nameY: 12,
    percentY: 38,
    pipsY: 108,
    nameSize: count > 3 ? 16 : 18,
    percentSize: count > 3 ? 36 : 44,
  };
}
