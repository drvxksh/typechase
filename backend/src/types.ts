import WebSocket from "ws";
export interface SocketClient extends WebSocket {
  userId?: string;
  gameId?: string;
}

export enum MessageEvent {
  "ERROR" = "error",
  "CONNECT" = "connect",
  "CREATE_GAME" = "create_game",
  "JOIN_GAME" = "join_game",
  "CHANGE_USERNAME" = "change_username",
  "START_GAME" = "start_game",
  "PLAYER_UPDATE" = "player_update",
  "FINISH_GAME" = "finish_game",
}

export interface WebSocketMessage {
  event: MessageEvent;
  payload: any;
}

export enum BroadcastEvent {}

export interface BroadcastMessage {
  event: BroadcastEvent;
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
