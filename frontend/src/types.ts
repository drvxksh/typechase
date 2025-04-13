/**
 * the state of the websocket connection
 */
export type ConnectionStatus = "connecting" | "connected" | "failed";

/** the type for the lobby of a game */
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
