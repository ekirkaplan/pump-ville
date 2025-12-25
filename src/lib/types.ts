export interface Holder {
  owner: string;
  amount: string;
  uiAmount: number;
}

export interface Assignment {
  _id: string; // owner address
  owner: string;
  mint: string;
  charId: number;
  balance: number;
  updatedAt: Date;
}

export interface WorldResponse {
  characters: Array<{
    owner: string;
    charId: number;
    balance: number;
  }>;
}

export interface SpawnPoint {
  x: number;
  y: number;
}
