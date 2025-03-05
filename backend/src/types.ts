import WebSocket from "ws";
export interface SocketClient extends WebSocket {
  userId?: string;
  gameId?: string;
}

export enum MessageEvent {
  ERROR = "error",
}
export interface WebSocketMessage {
  event: MessageEvent;
  payload: any;
}
