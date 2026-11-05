export const SETUP_KEY = 'setup';

export interface SlotSetup {
  joined: boolean;
  characterId: string;
  cpu: boolean;
}

export interface MatchSetup {
  slots: SlotSetup[];
}

export function defaultSetup(): MatchSetup {
  return {
    slots: [
      { joined: true, characterId: 'fangfang', cpu: false },
      { joined: true, characterId: 'gungun', cpu: false },
      { joined: false, characterId: 'cici', cpu: false },
      { joined: false, characterId: 'wenwen', cpu: false },
    ],
  };
}

export function practiceSetup(): MatchSetup {
  return {
    slots: [
      { joined: true, characterId: 'fangfang', cpu: true },
      { joined: true, characterId: 'cici', cpu: true },
      { joined: true, characterId: 'gungun', cpu: true },
      { joined: true, characterId: 'wenwen', cpu: true },
    ],
  };
}
