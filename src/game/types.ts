/** Launch angle: 0 is forward, 90 is up, 270 is straight down. */
export interface MoveDef {
  id: string;
  name: string;
  slot: MoveSlot;
  damage: number;
  /** Added after the percent-scaled term. Higher = more knockback even at low percent. */
  baseKnockback: number;
  /** 100 is a normal scaling strong. Higher sends people farther as percent climbs. */
  knockbackGrowth: number;
  angle: number;
  startup: number;
  active: number;
  recovery: number;
  hitbox: HitboxDef;
  /** Facing-relative velocity applied on the first active frame. */
  boostX?: number;
  /** World velocity applied on the first active frame. Negative is up. */
  boostY?: number;
}

export type MoveSlot =
  | 'jab'
  | 'fstrong'
  | 'utilt'
  | 'dtilt'
  | 'nair'
  | 'fair'
  | 'uair'
  | 'dair';

export interface HitboxDef {
  /** Left edge relative to the fighter center when facing right. */
  x: number;
  /** Top edge relative to the fighter center. Negative is up. */
  y: number;
  w: number;
  h: number;
}

export type ShapeKind = 'square' | 'circle' | 'diamond' | 'hex';

export interface CharacterDef {
  id: string;
  name: string;
  epithet: string;
  /** One or two sentences shown on the select card. */
  blurb: string;
  color: string;
  accent: string;
  shape: ShapeKind;
  /** Higher weight receives less knockback. A comfortable range is 70–140. */
  weight: number;
  gravity: number;
  walkSpeed: number;
  airSpeed: number;
  groundAccel: number;
  airAccel: number;
  friction: number;
  jumpForce: number;
  doubleJumpForce: number;
  maxFall: number;
  fastFall: number;
  /** Extra jumps after leaving the ground. 1 is a double jump. */
  airJumps: number;
  width: number;
  height: number;
  moves: MoveDef[];
}

export interface Launch {
  knockback: number;
  vx: number;
  vy: number;
  hitstun: number;
  hitlag: number;
}

export interface AttackState {
  move: MoveDef;
  /** Frames elapsed since the move started. The frame just played is `frame - 1`. */
  frame: number;
  hit: number[];
}

export interface FighterState {
  index: number;
  /** Keyboard / gamepad seat, 0–3. Stays put even if a middle seat is empty. */
  seat: number;
  def: CharacterDef;
  cpu: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  percent: number;
  stocks: number;
  airborne: boolean;
  jumpsLeft: number;
  coyote: number;
  jumpBuffer: number;
  jumpAge: number;
  jumpScale: number;
  fastFalling: boolean;
  attack: AttackState | null;
  attackBuffer: { kind: 'jab' | 'strong' | 'up'; time: number } | null;
  hitstun: number;
  hitlag: number;
  pending: Launch | null;
  intangible: number;
  respawnTimer: number;
  landLag: number;
  flash: number;
  rot: number;
  rotVel: number;
  prevBottom: number;
  dropIgnore: number;
  cpuJumpHold: number;
  rng: number;
  width: number;
  height: number;
}

export type SimEvent =
  | {
      type: 'hit';
      x: number;
      y: number;
      kb: number;
      damage: number;
      attacker: number;
      victim: number;
    }
  | { type: 'ko'; player: number; x: number; y: number }
  | { type: 'jump'; player: number; x: number; y: number }
  | { type: 'land'; player: number; x: number; y: number; impact: number }
  | { type: 'respawn'; player: number };

export type MatchPhase = 'countdown' | 'fight' | 'end';
