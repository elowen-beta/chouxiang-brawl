import Phaser from 'phaser';
import { PLAYER_COLORS, PLAYER_HEX, WIDTH } from '../game/constants.ts';
import { sampleInput } from '../game/input.ts';
import { speedLabel, strongDamage, weightLabel } from '../game/present.ts';
import { roster } from '../game/roster.ts';
import { SETUP_KEY, defaultSetup, type MatchSetup } from '../game/setup.ts';
import { sfx, toggleMute, unlockAudio } from '../game/sfx.ts';
import { STAGE } from '../game/stage.ts';
import { drawPortrait, paintSky } from '../render/draw.ts';
import { label } from '../render/label.ts';

const SEAT_CONTROLS = [
  '移动 A/D    跳 W    下 S\n轻 J    重 K    上 L',
  '移动 ←/→    跳 ↑    下 ↓\n轻 1    重 2    上 3',
  '移动 F/H    跳 T    下 G\n轻 C    重 V    上 B',
  '移动 U/O    跳 I    下 P\n轻 Y    重 [    上 ]',
];

const PANEL_HINT = ['S 切换练习伙伴', '↓ 切换练习伙伴', 'G 切换练习伙伴', 'P 切换练习伙伴'];

export class SelectScene extends Phaser.Scene {
  private fx!: Phaser.GameObjects.Graphics;
  private frame = 0;
  private lock = 12;
  private setup!: MatchSetup;
  private cards: { x: number; y: number; w: number; h: number }[] = [];
  private panelText: {
    mode: Phaser.GameObjects.Text;
    name: Phaser.GameObjects.Text;
    controls: Phaser.GameObjects.Text;
    hint: Phaser.GameObjects.Text;
  }[] = [];

  constructor() {
    super('select');
  }

  create(): void {
    this.setup = this.readSetup();
    const bg = this.add.graphics();
    paintSky(bg);
    bg.fillStyle(0x0c0816, 0.42);
    bg.fillRect(0, 0, WIDTH, 720);
    this.fx = this.add.graphics();

    this.add.text(36, 18, '选人', label(40, '#fff6e4', { stroke: '#1a0c28', strokeThickness: 6 }));
    this.add.text(150, 32, STAGE.blurb, label(18, '#d5def2'));
    this.add
      .text(WIDTH - 36, 28, 'Enter 开打', label(22, '#ffd27a'))
      .setOrigin(1, 0);

    const count = roster.length;
    const gap = count > 5 ? 10 : 14;
    const cardW = Math.min(292, (WIDTH - 48 - gap * (count - 1)) / count);
    const cardH = cardW >= 220 ? 340 : 268;
    const rowW = count * cardW + (count - 1) * gap;
    const startX = (WIDTH - rowW) / 2;
    const cardY = 84;
    const showBlurb = cardW >= 220;

    roster.forEach((def, index) => {
      const x = startX + index * (cardW + gap);
      this.cards.push({ x, y: cardY, w: cardW, h: cardH });
      this.add
        .text(x + cardW / 2, cardY + 132, def.name, label(32, def.color, { stroke: '#140c18', strokeThickness: 4 }))
        .setOrigin(0.5);
      this.add
        .text(x + cardW / 2, cardY + 168, def.epithet, label(16, '#f0e6d4'))
        .setOrigin(0.5);
      this.add
        .text(
          x + cardW / 2,
          cardY + 198,
          `体重${weightLabel(def.weight)}   脚程${speedLabel(def.walkSpeed)}   重击${strongDamage(def)}`,
          label(15, '#d7e4ff'),
        )
        .setOrigin(0.5);
      if (showBlurb) {
        this.add
          .text(x + 18, cardY + 228, def.blurb, {
            ...label(15, '#f6efe4'),
            wordWrap: { width: cardW - 36 },
            align: 'center',
          })
          .setOrigin(0, 0);
      }
    });

    const panelW = 292;
    const panelGap = 16;
    const panelY = 448;
    const panelStart = (WIDTH - (panelW * 4 + panelGap * 3)) / 2;
    this.setup.slots.forEach((_slot, seat) => {
      const x = panelStart + seat * (panelW + panelGap);
      const color = PLAYER_HEX[seat] ?? '#ffffff';
      this.add.text(x + 16, panelY + 12, `P${seat + 1}`, label(20, color));
      const mode = this.add.text(x + panelW - 16, panelY + 14, '', label(16, '#ffe7a8')).setOrigin(1, 0);
      const name = this.add.text(x + 16, panelY + 44, '', label(28, '#fff6e4'));
      const controls = this.add.text(x + 16, panelY + 86, SEAT_CONTROLS[seat] ?? '', label(15, '#efe6d8'));
      const hint = this.add.text(x + 16, panelY + 128, PANEL_HINT[seat] ?? '', label(14, '#c9b8e6'));
      this.panelText.push({ mode, name, controls, hint });
    });

    this.add
      .text(
        WIDTH / 2,
        668,
        '把你喜欢的角色加进大乱斗 — 复制 src/data/characters 里的一份数据，再登记进花名册',
        label(16, '#ffd27a'),
      )
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 694, 'Q 第三位    E 第四位    Esc 返回    手柄坐上对应座位', label(16, '#efe6d8'))
      .setOrigin(0.5);
    this.redraw();
    this.refreshPanels();
  }

  update(): void {
    this.frame += 1;
    const sample = sampleInput();
    if (this.lock > 0) this.lock -= 1;
    else this.handleKeys(sample);
    this.redraw();
    this.refreshPanels();
  }

  private handleKeys(sample: ReturnType<typeof sampleInput>): void {
    const slots = this.setup.slots;
    if (sample.pressed('KeyQ') && slots[2]) {
      slots[2].joined = !slots[2].joined;
      sfx.select();
    }
    if (sample.pressed('KeyE') && slots[3]) {
      slots[3].joined = !slots[3].joined;
      sfx.select();
    }
    if (sample.pressed('Escape') || sample.pressed('Backspace')) {
      this.scene.start('title');
      return;
    }
    if (sample.pressed('KeyM')) {
      unlockAudio();
      toggleMute();
    }
    slots.forEach((slot, seat) => {
      if (!slot.joined) return;
      const input = sample.players[seat];
      if (!input) return;
      if (input.leftPressed || input.rightPressed) {
        const ids = roster.map((character) => character.id);
        let index = ids.indexOf(slot.characterId);
        if (index < 0) index = 0;
        index = input.rightPressed ? (index + 1) % ids.length : (index - 1 + ids.length) % ids.length;
        const next = ids[index];
        if (next) slot.characterId = next;
        sfx.select();
      }
      if (input.downPressed) {
        slot.cpu = !slot.cpu;
        sfx.select();
      }
    });

    if (sample.pressed('Enter') || sample.pressed('Space') || sample.pressed('NumpadEnter')) {
      const ready = slots.filter((slot) => slot.joined).length;
      if (ready >= 2) {
        unlockAudio();
        sfx.start();
        this.scene.start('fight');
      }
    }
  }

  private redraw(): void {
    this.fx.clear();
    const panelW = 292;
    const panelGap = 16;
    const panelY = 448;
    const panelH = 156;
    const panelStart = (WIDTH - (panelW * 4 + panelGap * 3)) / 2;

    this.cards.forEach((card, index) => {
      const def = roster[index];
      if (!def) return;
      this.fx.fillStyle(0x160f28, 0.92);
      this.fx.fillRoundedRect(card.x, card.y, card.w, card.h, 18);
      let inset = 0;
      this.setup.slots.forEach((slot, seat) => {
        if (!slot.joined || slot.characterId !== def.id) return;
        this.fx.lineStyle(5, PLAYER_COLORS[seat] ?? 0xffffff, 1);
        this.fx.strokeRoundedRect(
          card.x - 3 - inset,
          card.y - 3 - inset,
          card.w + 6 + inset * 2,
          card.h + 6 + inset * 2,
          18,
        );
        inset += 5;
      });
      drawPortrait(this.fx, def, card.x + card.w / 2, card.y + 74, index % 2 === 0 ? 1 : -1, this.frame + index * 10);
    });

    this.setup.slots.forEach((slot, seat) => {
      const x = panelStart + seat * (panelW + panelGap);
      this.fx.fillStyle(0x120c20, slot.joined ? 0.94 : 0.38);
      this.fx.fillRoundedRect(x, panelY, panelW, panelH, 16);
      this.fx.lineStyle(4, PLAYER_COLORS[seat] ?? 0xffffff, slot.joined ? 1 : 0.3);
      this.fx.strokeRoundedRect(x, panelY, panelW, panelH, 16);
    });
  }

  private refreshPanels(): void {
    this.setup.slots.forEach((slot, seat) => {
      const text = this.panelText[seat];
      if (!text) return;
      if (!slot.joined) {
        text.mode.setText('空位');
        text.name.setText(seat === 2 ? '按 Q 上场' : '按 E 上场');
        text.name.setColor('#cbbfe0');
        text.controls.setVisible(false);
        text.hint.setVisible(false);
        return;
      }
      const def = roster.find((character) => character.id === slot.characterId) ?? roster[0];
      text.mode.setText(slot.cpu ? '练习伙伴' : '人类');
      text.mode.setColor(slot.cpu ? '#ffd15c' : '#f4f0e6');
      text.name.setText(def?.name ?? '???');
      text.name.setColor(def?.color ?? '#ffffff');
      text.controls.setVisible(true);
      text.hint.setVisible(true);
    });
  }

  private readSetup(): MatchSetup {
    const value = this.registry.get(SETUP_KEY) as MatchSetup | undefined;
    if (!value || !Array.isArray(value.slots) || value.slots.length < 4) {
      const setup = defaultSetup();
      this.registry.set(SETUP_KEY, setup);
      return setup;
    }
    return value;
  }
}
