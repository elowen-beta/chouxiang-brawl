import '@fontsource/zcool-kuaile/chinese-simplified-400.css';
import '@fontsource/zcool-kuaile/latin-400.css';
import Phaser from 'phaser';
import { defaultSetup, SETUP_KEY } from './game/setup.ts';
import { FightScene } from './scenes/FightScene.ts';
import { SelectScene } from './scenes/SelectScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import './style.css';

async function boot(): Promise<void> {
  await document.fonts.load('64px "ZCOOL KuaiLe"');
  await document.fonts.ready;

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#140e22',
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [TitleScene, SelectScene, FightScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set(SETUP_KEY, defaultSetup());
      },
    },
  });
}

void boot();
