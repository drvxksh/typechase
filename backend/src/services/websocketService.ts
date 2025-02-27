import WebSocket from "ws";
import http from "http";
import {
  MessageType,
  SocketClient,
  WebSocketMessage,
  WsGameMemory,
} from "../types";
import { v4 as uuid } from "uuid";

/** A singleton class to handle the WebSocket logic */
export class WebSocketController {
  // the single instance of the class that would be returned
  private static instance: WebSocketController;

  // web socket server object
  private wss?: WebSocket.Server;

  // the constructor is private so that no object of this class can be created
  private constructor(server: http.Server) {
    // setting up the WebSocket Server
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", async (ws: WebSocket) => {
      const socketClient = ws as SocketClient;
      socketClient.isAlive = true;

      console.log("Client connected");

      ws.on("error", (err) => {
        console.error("WS error:", err);
        this.sendError(socketClient, "Something went wrong");
      });

      ws.on("close", () => console.log("Client disconnected"));

      ws.on("message", (message: string) => {
        try {
          // JSON data will be used for communication
          const data = JSON.parse(message);

          this.processMessage(socketClient, data);
        } catch (err) {
          console.error("Error process message:", err);
          this.sendError(socketClient, "Invalid Message Format");
        }
      });
    });
  }

  /**
   * @param server - httpServer that the websocket will bind to
   * @description Returns a single instance of the WebSocketController
   */
  public static getInstance(server: http.Server): WebSocketController {
    if (!WebSocketController.instance) {
      WebSocketController.instance = new WebSocketController(server);
    }
    return WebSocketController.instance;
  }

  private processMessage(
    client: SocketClient,
    message: WebSocketMessage
  ): void {
    const { type, payload } = message;

    switch (type) {
      case MessageType.CONNECT:
        this.handleConnect(client, payload);
        break;
      case MessageType.RECONNECT:
        this.handleReconnect(client, payload);
        break;
      default:
        this.sendError(client, `Unsupported message type: ${type}`);
    }
  }

  private handleConnect(client: SocketClient, payload: any): void {
    const { playerId } = payload;

    if (playerId) {
      this.handleReconnect(client, payload);
    } else {
      const newPlayerId = uuid();
      client.userId = newPlayerId;

      this.send(client, {
        type: MessageType.CONNECT,
        payload: {
          playerId: newPlayerId,
          message: "Connected successfully",
        },
      });
    }
  }

  private handleReconnect(client: SocketClient, payload: any): void {
    const { playerId } = payload;

    // TODO check with redis if this player actually exists
    const existingPlayer = true;

    if (existingPlayer) {
      client.userId = playerId;

      this.send(client, {
        type: MessageType.RECONNECT,
        payload: {
          playerId,
          gameId: "abc", // TODO this should be a valid gameId
          message: "Reconnected successfully",
        },
      });
    } else {
      this.handleConnect(client, payload);
    }
  }

  /**
   * @param client  - Websocket instance that will send the error
   * @param errorMessage - The error message to send
   * @description Used to send error messages via WebSockets
   */
  public sendError(client: SocketClient, errorMessage: string): void {
    this.send(client, {
      type: MessageType.ERROR,
      payload: { message: errorMessage },
    });
  }

  /**
   * @param client - WebSocket instance that will send the message
   * @param message - The message that is to be sent
   * @description Used to send messages via WebSockets
   */
  public send(client: SocketClient, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
