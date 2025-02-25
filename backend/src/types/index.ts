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
  GAME_UPDATE = "game_update",
  TYPING_PROGRESS = "typing_progress",
  GAME_START = "game_start",
  GAME_END = "game_end",
  PLAYER_JOIN = "player_join",
  PLAYER_LEAVE = "player_leave",
  ERROR = "error",
  RECONNECT = "reconnect",
}

export interface Player {
  id: string;
  name: string;
  progress: number; //0-100 percentage
  wpm?: number;
  accuracy?: number;
  connected: boolean;
  lastSeen: number; //timestamp
}

export interface Game {
  id: string;
  status: GameStatus;
  players: Record<string, Player>;
  text: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
  maxPlayers: number;
  minPlayers: number;
}

export interface SocketClient extends WebSocket {
  id: string;
  gameId?: string;
  isAlive: boolean;
  lastActivity: number;
}

export interface WebSocketMessage {
  type: MessageType;
  payload: any;
}

export interface GameResult {
  gameId: string;
  players: Record<
    string,
    {
      name: string;
      place: number;
      wpm: number;
      accuracy: number;
      completionTime: number;
    }
  >;
  text: string;
  duration: number;
}
