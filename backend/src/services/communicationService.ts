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
    this.pubSubManager = createClient();

    this.pubSubManager.on("error", (err) =>
      console.error("PubSubManager error:", err),
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
    message: WebSocketMessage,
  ): void {
    if (!message) {
      this.sendError(client, "Incomplete request: message is missing");
      return;
    }

    const { event, payload } = message;

    if (!event) {
      this.sendError(client, "Incomplete request: event is missing");
      return;
    }

    if (!payload) {
      this.sendError(client, "Incomplete request: payload is missing");
      return;
    }

    switch (event) {
      case MessageEvent.CONNECT:
        this.handleConnect(client, payload);
        break;
      case MessageEvent.CREATE_GAME:
        this.handleCreateGame(client, payload);
        break;
      case MessageEvent.JOIN_ROOM:
        this.handleJoinRoom(client, payload);
        break;
      case MessageEvent.PLAYER_NAME_CHANGE:
        this.handlePlayerNameChange(client, payload);
        break;
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
        break;
    }
  }

  private async handlePlayerNameChange(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const { newName } = payload;

    if (!newName) {
      this.sendError(client, "Incomplete request: newName is missing");
      return;
    }

    const userId = client.userId;
    const gameId = client.gameId;

    if (!gameId) {
      this.sendError(client, "Unauthorized user: unknown game");
      return;
    }

    if (!userId) {
      this.sendError(client, "Unauthorized user: unknown user");
      return;
    }

    const newPlayerState: Player[] = await this.gameService.changePlayerName(
      gameId,
      userId,
      newName,
    );

    this.send(client, {
      event: MessageEvent.PLAYER_NAME_CHANGE,
      payload: {
        playerState: newPlayerState,
        message: "Player name changed successfully",
      },
    });

    await this.pubSubManager.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: MessageEvent.PLAYER_UPDATE,
        payload: {
          action: "playerNameChanged",
          playerState: newPlayerState,
        },
      }),
    );
  }

  private async subscribeToGameChannel(client: SocketClient): Promise<void> {
    const gameId = client.gameId;

    if (!gameId) {
      this.sendError(client, "Unauthorized user: unknown game");
      return;
    }

    return this.pubSubManager.subscribe(`game:${gameId}`, (message: string) => {
      this.send(client, JSON.parse(message));
    });
  }

  private async handleJoinRoom(client: SocketClient, payload: any) {
    const { gameId } = payload;

    if (!gameId) {
      this.sendError(client, "Incomplete request: gameId is missing");
      return;
    }

    // Check that the game exists
    const gameExists = await this.gameService.checkGameId(gameId);
    if (!gameExists) {
      this.sendError(client, "Game does not exist");
      return;
    }

    const userId = client.userId;

    if (userId) {
      const newPlayerState: Player[] = await this.gameService.joinGameRoom(
        gameId,
        userId,
      );

      client.gameId = gameId;

      this.send(client, {
        event: MessageEvent.JOIN_ROOM,
        payload: {
          playerState: newPlayerState,
          message: "Room joined successfully",
        },
      });

      await this.pubSubManager.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: MessageEvent.PLAYER_UPDATE,
          payload: {
            action: "playerJoined",
            playerState: newPlayerState,
          },
        }),
      );

      await this.subscribeToGameChannel(client);
    } else {
      this.sendError(client, "Unauthorized: unknown user");
    }
  }

  private async handleCreateGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const userId = client.userId;

    if (userId) {
      const gameId = await this.gameService.createGameRoom(userId);

      client.gameId = gameId;

      await this.subscribeToGameChannel(client);
    } else {
      this.sendError(client, "Unauthorized: unknown user");
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
