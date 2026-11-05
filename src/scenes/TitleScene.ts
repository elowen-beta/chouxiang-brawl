import Phaser from 'phaser';
import { WIDTH } from '../game/constants.ts';
import { roster } from '../game/roster.ts';
import { SETUP_KEY, practiceSetup } from '../game/setup.ts';
import { sfx, unlockAudio } from '../game/sfx.ts';
import { STAGE } from '../game/stage.ts';
import { sampleInput } from '../game/input.ts';
import { drawPortrait, paintStage } from '../render/draw.ts';
import { label } from '../render/label.ts';

export class TitleScene extends Phaser.Scene {
  private fx!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Text;
  private frame = 0;
  private leaving = false;

  constructor() {
    super('title');
  }

  create(): void {
    const bg = this.add.graphics();
    paintStage(bg);
    this.fx = this.add.graphics();

    this.add
      .text(WIDTH / 2, 86, '乱斗工坊', label(84, '#fff6e4', { stroke: '#1a0c28', strokeThickness: 10 }))
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 172, '一台键盘，两到四个人', label(28, '#f3e7ff'))
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 218, '把你喜欢的角色加进大乱斗', label(26, '#ffd27a'))
      .setOrigin(0.5);

    this.prompt = this.add
      .text(WIDTH / 2, 286, '按任意键上场', label(32, '#fff6e4', { stroke: '#1a0c28', strokeThickness: 6 }))
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 336, '按 8 先看一场练习赛', label(22, '#d7c4f2'))
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        688,
        '百分比越高，打得越远  ·  掉出装配台就少一条命',
        label(18, '#efe6d8'),
      )
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 560, STAGE.name, label(18, '#d5def2'))
      .setOrigin(0.5);

    this.input.on('pointerdown', () => {
      this.leave('select');
    });
  }

  update(): void {
    this.frame += 1;
    this.prompt.setAlpha(0.45 + Math.sin(this.frame / 10) * 0.45);
    const sample = sampleInput();
    if (sample.pressed('Digit8') || sample.pressed('Numpad8')) {
      this.registry.set(SETUP_KEY, practiceSetup());
      this.leave('fight');
    } else if (sample.anyPressed || sample.pausePressed) {
      this.leave('select');
    }

    this.fx.clear();
    const main = STAGE.platforms[0];
    if (!main) return;
    roster.forEach((def, index) => {
      const span = 780;
      const x =
        roster.length === 1 ? WIDTH / 2 : 250 + (span * index) / Math.max(1, roster.length - 1);
      const y = main.y - def.height / 2;
      drawPortrait(this.fx, def, x, y, x < WIDTH / 2 ? 1 : -1, this.frame + index * 14);
    });
  }

  private leave(target: 'select' | 'fight'): void {
    if (this.leaving) return;
    this.leaving = true;
    unlockAudio();
    sfx.start();
    this.scene.start(target);
  }
}
