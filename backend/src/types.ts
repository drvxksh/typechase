import WebSocket from "ws";

export interface SocketClient extends WebSocket {
  playerId?: string;
  gameId?: string;
  subscription?: string;
}

export enum MessageEvent {
  "ERROR" = "error",
  "HEALTH_CHECK" = "health_check",
  "CONNECT" = "connect",
  "CREATE_GAME" = "create_game",
  "JOIN_GAME" = "join_game",
  "GET_LOBBY" = "get_lobby",
  "CHANGE_USERNAME" = "change_username",
  "START_GAME" = "start_game",
  "GET_GAME_PLAYERS" = "get_game_players",
  "PLAYER_UPDATE" = "player_update",
  "FINISH_GAME" = "finish_game",
  "CHECK_GAME_ID" = "check_game_id",
  "GET_GAME_TEXT" = "get_game_text",
  "GET_GAME_RESULT" = "get_game_result",
  "RESTART_GAME" = "restart_game",
  "LEAVE_GAME" = "leave_game",
  "DISCONNECT" = "disconnected",
}

export interface WebSocketMessage {
  event: MessageEvent;
  payload: any;
}

export enum BroadcastEvent {
  "NEW_PLAYER_JOINED" = "new_player_joined",
  "USERNAME_CHANGED" = "username_changed",
  "GAME_STARTING" = "game_starting",
  "GAME_STARTING_COUNTDOWN" = "game_starting_countdown",
  "GAME_STARTED" = "game_start",
  "PLAYER_UPDATE" = "player_update",
  "FINISH_GAME" = "finish_game",
  "PLAYER_LEFT" = "player_left",
  "GAME_WAITING" = "game_waiting",
}

export interface BroadcastMessage {
  event: BroadcastEvent;
  payload: any;
}

export interface Game {
  id: string;
  hostId: string;
  playerIds: string[];
  status: GameStatus;
  gameText: string;
  createdAt: Date;
}

export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export type GameInfo = {
  gameId: string | null;
  gameStatus: GameStatus | null;
};

export interface Player {
  id: string;
  name: string;
  currentGameId: string | null;
}

export type NewPlayerInfo = {
  playerId: string;
  playerName: string;
};

export interface GameResult {
  id: string; // same as the gameId
  players: {
    id: string;
    name: string;
    wpm: number;
    accuracy: number;
    time: number;
    position: number;
  }[];
}

export const MIN_SIZE = 2;
export const MAX_SIZE = 5;
export const TTL = 3600;

export interface FinishGamePayload {
  wpm: number;
  accuracy: number;
  time: number;
}
