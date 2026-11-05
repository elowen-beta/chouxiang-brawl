import { HEIGHT, WIDTH } from './constants.ts';

export interface PlatformDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  passThrough: boolean;
}

export interface StageDef {
  id: string;
  name: string;
  blurb: string;
  platforms: PlatformDef[];
  blast: { left: number; right: number; top: number; bottom: number };
  width: number;
  height: number;
}

/** The only stage in this MVP. Add another by copying this object. */
export const STAGE: StageDef = {
  id: 'assembly',
  name: '装配台',
  blurb: '中间主台，两侧云台。按住下可以从云台穿下去。',
  width: WIDTH,
  height: HEIGHT,
  platforms: [
    { id: 'main', x: 250, y: 524, w: 780, h: 48, passThrough: false },
    { id: 'left', x: 330, y: 372, w: 210, h: 18, passThrough: true },
    { id: 'right', x: 740, y: 372, w: 210, h: 18, passThrough: true },
  ],
  blast: { left: -80, right: 1360, top: -90, bottom: 810 },
};
