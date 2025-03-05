import http from "http";
import { createClient, RedisClientType } from "redis";
import WebSocket from "ws";
import { GameService } from "./gameService";
import { MessageEvent, SocketClient, WebSocketMessage } from "../types";
import { v4 as uuid } from "uuid";

/**
 * Handles WebSocket and PubSub logic
 */
export class CommunicationService {
  private static instance: CommunicationService;
  private pubSubManager: RedisClientType;
  private gameService: GameService;
  private wss: WebSocket.Server;

  private constructor(server: http.Server) {
    this.pubSubManager = createClient();

    this.pubSubManager.on("error", (err) =>
      console.error("PubSubManager error:", err)
    );

    this.pubSubManager.connect();

    this.gameService = new GameService();

    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws: WebSocket) => {
      const socketClient = ws as SocketClient;

      console.log("Client Connected");

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
        this.sendError(socketClient, "Something went wrong");
      });

      ws.on("close", () => {
        console.log("Client disconnected");
      });

      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message);

          // Do something with the data based on the event
          this.processMessage(socketClient, data);
        } catch (err) {
          console.error("Unknown message format:", err);
          this.sendError(socketClient, "Invalid Message Format");
        }
      });
    });
  }

  /**
   * Initializes the Communication Service
   * @param server - HTTP server instance to bind with the WebSocket
   */
  public static initialize(server: http.Server): void {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService(server);
    }
  }

  private processMessage(
    client: SocketClient,
    message: WebSocketMessage
  ): void {
    if (!message) {
      this.sendError(client, "Incomplete message");
    }

    const { event, payload } = message;

    switch (event) {
      case MessageEvent.CONNECT:
        this.handleConnect(client, payload);
      case MessageEvent.CREATE_GAME:
        this.handleCreateGame(client, payload);
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
    }
  }

  private async handleCreateGame(
    client: SocketClient,
    payload: any
  ): Promise<void> {
    const userId = client.userId;

    if (userId) {
      const gameId = await this.gameService.createGameRoom(userId);
      // TODO add subscribers
    } else {
      this.sendError(client, "Bad request");
    }
  }

  private handleConnect(client: SocketClient, payload: any): void {
    if (!payload) {
      this.sendError(client, "Incomplete payload");
    }

    const { playerId } = payload;

    if (playerId) {
      // TODO handle an existing player
      const existingPlayer = true;

      if (existingPlayer) {
        client.userId = playerId;
      }
    } else {
      // this is a new user
      const newPlayerId = uuid();
      client.userId = newPlayerId;
    }

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: client.userId,
        message: "Connected successfully",
      },
    });
  }

  private sendError(client: SocketClient, errorMessage: string): void {
    this.send(client, {
      event: MessageEvent.ERROR,
      payload: { message: errorMessage },
    });
  }

  private send(client: SocketClient, message: WebSocketMessage) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
