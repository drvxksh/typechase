import http from "http";
import { createClient, RedisClientType } from "redis";
import WebSocket from "ws";
import { GameService } from "./gameService";
import { MessageEvent, Player, SocketClient, WebSocketMessage } from "../types";
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
    // connecting the pubSubManager to the redis instance
    this.pubSubManager = createClient();

    this.pubSubManager.on("error", (err) =>
      console.error("PubSubManager error:", err),
    );

    this.pubSubManager.connect();

    // instantiating the gameService for game related operations
    this.gameService = new GameService();

    // creating the websocket server
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws: WebSocket) => {
      const socketClient = ws as SocketClient;

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
        this.sendError(socketClient, "Something went wrong");
      });

      ws.on("close", () => {
        console.log("Client disconnected");
      });

      ws.on("message", (message: string) => {
        // this project has a convention that the messages will be relayed in JSON only
        try {
          const data = JSON.parse(message);

          this.processMessage(socketClient, data);
        } catch (err) {
          console.error("Unknown message format:", err);

          this.sendError(socketClient, "Invalid Message Format");
        }
      });
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
    message: WebSocketMessage,
  ): void {
    // checking if all the fields are present
    if (!message || !message.event || !message.payload) {
      const missingField = !message
        ? "message"
        : !message.event
          ? "event"
          : "payload";
      this.sendError(client, `Incomplete request: ${missingField} is missing`);
      return;
    }

    const { event, payload } = message;

    switch (event) {
      case MessageEvent.CONNECT:
        this.handleConnect(client, payload);
        break;
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
        break;
    }
  }

  /**
   * Handles connection requests from clients
   * @param client - The WebSocket client
   * @param payload - The message payload containing optional playerId
   */
  private handleConnect(client: SocketClient, payload: any): void {
    const { playerId } = payload;

    if (playerId) {
      // this is a returning user
    } else {
      // create a new user
      const newUserId = uuid();
      client.userId = newUserId;
      // we don't store this user into redis right now because it is not important that this user is committed in playing a game. he could be casually checking in.
    }

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: client.userId,
      },
    });
  }
}
