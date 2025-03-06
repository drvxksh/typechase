import WebSocket from "ws";
export interface SocketClient extends WebSocket {
  userId?: string;
  gameId?: string;
}

export enum MessageEvent {
  ERROR = "error",
  "CONNECT" = "connect",
  "CREATE_GAME" = "create_game",
  "JOIN_ROOM" = "join_room",
  "PLAYER_UPDATE" = "player_update",
}

export interface WebSocketMessage {
  event: MessageEvent;
  payload: any;
}

export interface Player {
  id: string;
  name: string;
}

export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}
