import WebSocket from "ws";

export enum GameStatus {
  WAITING = "waiting",
  STARTING = "starting",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export enum MessageType {
  CONNECT = "connect",
  JOIN_GAME = "join_game",
  CREATE_GAME = "create_game",
  ROOM_SIZE = "room_size",
  GAME_UPDATE = "game_update",
  GAME_START = "game_start",
  TYPING_PROGRESS = "typing_progress",
  GAME_END = "game_end",
  PLAYER_JOIN = "player_join",
  PLAYER_LEAVE = "player_leave",
  ERROR = "error",
  RECONNECT = "reconnect",
}

export enum SubscriptionType {
  ROOM_SIZE = "room_size",
}

export interface SocketClient extends WebSocket {
  userId: string;
  isAlive: boolean;
  gameId?: string;
}

export interface WebSocketMessage {
  type: MessageType;
  payload: any;
}

export interface WsGameMemory {
  gameId: string;
  admin: WebSocket;
  players: WebSocket[];
  dateCreated: Date;
}

export interface Player {
  id: string; // userId of the player
  name: string;
  wpm?: number;
  accuracy?: number;
}

export interface Game {
  id: string;
  status: GameStatus;
  hostUserId: string;
  players: Player[];
  text: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
}
