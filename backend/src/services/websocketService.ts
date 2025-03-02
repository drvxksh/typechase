import WebSocket from "ws";
import http from "http";
import { MessageType, Player, SocketClient, WebSocketMessage } from "../types";
import { v4 as uuid } from "uuid";
import { GameController } from "./gameService";

/** A singleton class to handle the WebSocket logic */
export class WebSocketService {
  // the single instance of the class that would be returned
  private static instance: WebSocketService;

  // web socket server object
  private wss?: WebSocket.Server;
  private gameController: GameController;
  private userSockets: Map<string, WebSocket> = new Map();

  // the constructor is private so that no object of this class can be created
  private constructor(server: http.Server) {
    // setting up the WebSocket Server
    this.wss = new WebSocket.Server({ server });

    // creating the game controller object
    this.gameController = new GameController(this);

    this.wss.on("connection", async (ws: WebSocket) => {
      const socketClient = ws as SocketClient;
      socketClient.isAlive = true;

      console.log("Client connected");

      ws.on("error", (err) => {
        console.error("WS error:", err);
        this.sendError(socketClient, "Something went wrong");
      });

      ws.on("close", () => {
        console.log("Client disconnected");
        this.userSockets.delete(socketClient.userId);
      });

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
  public static getInstance(server: http.Server): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(server);
    }
    return WebSocketService.instance;
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
      case MessageType.CREATE_GAME:
        this.handleGameCreation(client, payload);
        break;
      default:
        this.sendError(client, `Unsupported message type: ${type}`);
    }
  }

  private async handleGameCreation(
    client: SocketClient,
    payload: any
  ): Promise<void> {
    const host: Player = {
      id: client.userId,
      name: `Player_${client.userId.substring(0, 5)}`,
    };

    const gameId = await this.gameController.createGameRoom(host);

    this.send(client, {
      type: MessageType.CREATE_GAME,
      payload: {
        gameId,
        message: "Game created successfully",
      },
    });
  }

  private handleConnect(client: SocketClient, payload: any): void {
    if (!payload) return;
    const { playerId } = payload;

    if (playerId) {
      // the user might have dropped off from a game
      // TODO fetch the user object from redis
      // the user is using multiple tabs, update to the latest one
      const oldUserId = client.userId;
      if (oldUserId) {
        this.userSockets.delete(oldUserId);
      }
      client.userId = playerId;
      this.userSockets.set(playerId, client);
    } else {
      // this is a new user
      const newPlayerId = uuid();
      client.userId = playerId;
      this.userSockets.set(newPlayerId, client);
    }

    this.send(client, {
      type: MessageType.CONNECT,
      payload: {
        playerId,
        message: "Connected successfully",
      },
    });
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
   * @param clientOrUserId - WebSocket instance or userId that will send the message
   * @param message - The message that is to be sent
   * @description Used to send messages via WebSockets
   */
  public send(
    clientOrUserId: SocketClient | string,
    message: WebSocketMessage
  ): void {
    let client: SocketClient | undefined;

    if (typeof clientOrUserId === "string") {
      client = this.userSockets.get(clientOrUserId) as SocketClient;
    } else {
      client = clientOrUserId;
    }

    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
