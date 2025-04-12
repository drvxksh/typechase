/**
 * WebSocket connection status
 */
export type ConnectionStatus = "connecting" | "connected" | "failed";

export type Lobby = {
  hostId: string;
  players: {
    playerName: string;
    playerId: string;
  }[];
};

export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}
