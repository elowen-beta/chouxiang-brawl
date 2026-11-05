export interface InputFrame {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  jab: boolean;
  jabPressed: boolean;
  strong: boolean;
  strongPressed: boolean;
  upAttack: boolean;
  upAttackPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
}

interface KeySet {
  left: string[];
  right: string[];
  jump: string[];
  down: string[];
  jab: string[];
  strong: string[];
  up: string[];
}

const KEYSETS: KeySet[] = [
  {
    left: ['KeyA'],
    right: ['KeyD'],
    jump: ['KeyW'],
    down: ['KeyS'],
    jab: ['KeyJ'],
    strong: ['KeyK'],
    up: ['KeyL'],
  },
  {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: ['ArrowUp'],
    down: ['ArrowDown'],
    jab: ['Digit1', 'Numpad1'],
    strong: ['Digit2', 'Numpad2'],
    up: ['Digit3', 'Numpad3'],
  },
  {
    left: ['KeyF'],
    right: ['KeyH'],
    jump: ['KeyT'],
    down: ['KeyG'],
    jab: ['KeyC'],
    strong: ['KeyV'],
    up: ['KeyB'],
  },
  {
    left: ['KeyU'],
    right: ['KeyO'],
    jump: ['KeyI'],
    down: ['KeyP'],
    jab: ['KeyY'],
    strong: ['BracketLeft'],
    up: ['BracketRight'],
  },
];

const PREVENT = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
]);

const down = new Set<string>();
/** Presses since the last sample. A tap can finish before the next frame. */
const queued = new Set<string>();
let installed = false;
const prevPadButtons: boolean[][] = [[], [], [], []];

export interface InputSample {
  players: InputFrame[];
  pressed: (code: string) => boolean;
  held: (code: string) => boolean;
  pausePressed: boolean;
  anyPressed: boolean;
}

export function blankInput(): InputFrame {
  return {
    left: false,
    right: false,
    down: false,
    jump: false,
    jumpPressed: false,
    jab: false,
    jabPressed: false,
    strong: false,
    strongPressed: false,
    upAttack: false,
    upAttackPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
  };
}

export function heldOnly(input: InputFrame): InputFrame {
  return {
    ...input,
    jumpPressed: false,
    jabPressed: false,
    strongPressed: false,
    upAttackPressed: false,
    downPressed: false,
    leftPressed: false,
    rightPressed: false,
  };
}

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (!down.has(event.code)) queued.add(event.code);
    down.add(event.code);
    if (PREVENT.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
  });
}

function anyHeld(codes: string[]): boolean {
  return codes.some((code) => down.has(code));
}

function anyEdge(codes: string[], edges: Set<string>): boolean {
  return codes.some((code) => edges.has(code));
}

function padButtons(pad: Gamepad | null): boolean[] {
  if (!pad) return [];
  return pad.buttons.map((button) => Boolean(button?.pressed));
}

export function sampleInput(): InputSample {
  install();
  const edges = new Set(queued);
  queued.clear();

  const pads =
    typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  let pausePressed = edges.has('Escape');

  const players = KEYSETS.map((keys, seat) => {
    const pad = pads[seat] ?? null;
    const buttons = padButtons(pad);
    const prev = prevPadButtons[seat] ?? [];
    const axisX = pad ? pad.axes[0] ?? 0 : 0;
    const axisY = pad ? pad.axes[1] ?? 0 : 0;
    const padLeft = axisX < -0.45 || Boolean(buttons[14]);
    const padRight = axisX > 0.45 || Boolean(buttons[15]);
    const padDown = axisY > 0.5 || Boolean(buttons[13]);
    const padJump = Boolean(buttons[0]);
    const padJab = Boolean(buttons[2]);
    const padStrong = Boolean(buttons[3]);
    const padUp = Boolean(buttons[1]);
    const edge = (index: number) => Boolean(buttons[index]) && !prev[index];

    if (edge(9)) pausePressed = true;
    prevPadButtons[seat] = buttons;

    const left = anyHeld(keys.left) || padLeft;
    const right = anyHeld(keys.right) || padRight;
    const downHeld = anyHeld(keys.down) || padDown;
    const jump = anyHeld(keys.jump) || padJump;
    const jab = anyHeld(keys.jab) || padJab;
    const strong = anyHeld(keys.strong) || padStrong;
    const upAttack = anyHeld(keys.up) || padUp;

    return {
      left,
      right,
      down: downHeld,
      jump,
      jumpPressed: anyEdge(keys.jump, edges) || edge(0),
      jab,
      jabPressed: anyEdge(keys.jab, edges) || edge(2),
      strong,
      strongPressed: anyEdge(keys.strong, edges) || edge(3),
      upAttack,
      upAttackPressed: anyEdge(keys.up, edges) || edge(1),
      downPressed: anyEdge(keys.down, edges) || (padDown && !(prevPadDown[seat] ?? false)),
      leftPressed: anyEdge(keys.left, edges) || (padLeft && !(prevPadLeft[seat] ?? false)),
      rightPressed: anyEdge(keys.right, edges) || (padRight && !(prevPadRight[seat] ?? false)),
    } satisfies InputFrame;
  });

  for (let seat = 0; seat < 4; seat += 1) {
    const pad = pads[seat] ?? null;
    const axisX = pad ? pad.axes[0] ?? 0 : 0;
    const axisY = pad ? pad.axes[1] ?? 0 : 0;
    prevPadLeft[seat] = axisX < -0.45 || Boolean(pad?.buttons[14]?.pressed);
    prevPadRight[seat] = axisX > 0.45 || Boolean(pad?.buttons[15]?.pressed);
    prevPadDown[seat] = axisY > 0.5 || Boolean(pad?.buttons[13]?.pressed);
  }

  return {
    players,
    pressed: (code) => edges.has(code),
    held: (code) => down.has(code),
    pausePressed,
    anyPressed: edges.size > 0 || players.some((player) => player.jumpPressed || player.jabPressed),
  };
}

const prevPadLeft: boolean[] = [false, false, false, false];
const prevPadRight: boolean[] = [false, false, false, false];
const prevPadDown: boolean[] = [false, false, false, false];
