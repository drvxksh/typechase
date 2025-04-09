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
