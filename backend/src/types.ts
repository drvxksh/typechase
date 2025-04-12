import WebSocket from "ws";

export interface SocketClient extends WebSocket {
  playerId?: string;
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
  "CHECK_GAME_ID" = "check_game_id",
}

export interface WebSocketMessage {
  event: MessageEvent;
  payload: any;
}

export enum BroadcastEvent {
  "NEW_PLAYER_JOINED" = "new_player_joined",
  "USERNAME_CHANGED" = "username_changed",
  "GAME_STARTING" = "game_starting",
  "GAME_STARTED" = "game_start",
  "PLAYER_UPDATE" = "player_update",
  "FINISH_GAME" = "finish_game",
  "PLAYER_LEFT" = "player_left",
}

export interface BroadcastMessage {
  event: BroadcastEvent;
  payload: any;
}

export interface Player {
  id: string;
  name: string;
  currentGameId: string | null;
  state: "online" | "offline";
  pastResults: {
    id: string;
  }[];
}

export interface Game {
  id: string;
  hostId: string;
  playerIds: string[];
  status: GameStatus;
  gameText: string;
  createdAt: Date;
}

export interface GameResult {
  id: string;
  players: {
    id: string;
    name: string;
    wpm: number;
    accuracy: number;
    time: number;
    position: number;
  }[];
}

export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export const MIN_SIZE = 2;
export const MAX_SIZE = 5;

export interface PlayerState {
  playerId: string;
  playerName: string;
}

export interface FinishGamePayload {
  wpm: number;
  accuracy: number;
  time: number;
}
