import http from "http";
import { createClient, RedisClientType } from "redis";
import WebSocket from "ws";
import { GameService } from "./gameService";
import {
  BroadcastEvent,
  MAX_SIZE,
  MessageEvent,
  Player,
  PlayerState,
  SocketClient,
  WebSocketMessage,
} from "../types";
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
      case MessageEvent.CREATE_GAME:
        this.handleCreateGame(client, payload);
        break;
      case MessageEvent.JOIN_GAME:
        this.handleJoinGame(client, payload);
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
      const newPlayerId = uuid();
      client.playerId = newPlayerId;
      // we don't store this user into redis right now because it is not important that this user is committed in playing a game. he could be casually checking in.
    }

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: client.playerId,
        success: true,
      },
    });
  }

  /**
   * Handles game creation requests from clients
   * @param client - The WebSocket client
   * @param payload - The message payload for game creation
   * @returns A Promise that resolves when game creation handling is complete
   */
  private async handleCreateGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const playerId = this.validateClient(client);

    if (!playerId) return;

    const gameId = await this.gameService.createGame(playerId);

    client.gameId = gameId;

    await this.subscribeToGame(client);

    const hostPlayer = await this.gameService.getPlayerState(playerId);

    this.send(client, {
      event: MessageEvent.CREATE_GAME,
      payload: {
        success: true,
        hostPlayer,
      },
    });
  }

  /**
   * Validates if client has a valid userId and is not already part of a game
   * @param client - The WebSocket client to validate
   * @returns The userId if valid, null otherwise
   */
  private validateClient(client: SocketClient): string | null {
    if (!client.playerId) {
      this.sendError(client, "Bad request: unknown user");
      return null;
    }
    if (client.gameId) {
      this.sendError(client, "Bad request: user already part of a game");
      return null;
    }

    return client.playerId;
  }

  /**
   * Subscribes a client to game updates via Redis PubSub
   * @param client - The WebSocket client to subscribe
   * @throws Error if the client is not associated with a game
   * @returns A Promise that resolves when subscription is complete
   */
  private subscribeToGame(client: SocketClient): Promise<void> {
    const gameId = client.gameId;

    if (!gameId)
      throw new Error("Cannot subscribe to game: client is not in a game");

    return this.pubSubManager.subscribe(`game:${gameId}`, (message: string) => {
      this.send(client, JSON.parse(message)); // send the message directly
    });
  }

  private async handleJoinGame(client: SocketClient, payload: any) {
    const playerId = this.validateClient(client);

    if (!playerId) return;

    // verify that the room size has not exceeded the max size
    const currentSize = await this.gameService.getRoomSize(playerId);

    if (currentSize > MAX_SIZE) {
      this.sendError(client, "Room is full. Try another game.");
      return;
    }

    // extract the gameId from the payload
    const { gameId } = payload;

    if (!gameId) {
      this.sendError(client, "Bad request: gameId is required to join a game");
      return;
    }

    // add the current player to that gameRoom
    await this.gameService.addPlayer(playerId, gameId);

    // send back the currentPlayer state to this client
    const allPlayers: PlayerState[] =
      await this.gameService.getAllPlayers(gameId);

    this.send(client, {
      event: MessageEvent.JOIN_GAME,
      payload: {
        success: true,
        allPlayers,
      },
    });

    // publish to others of this new player
    const newPlayerState: PlayerState =
      await this.gameService.getPlayerState(playerId);

    await this.pubSubManager.publish(
      `game:{gameId}`,
      JSON.stringify({
        event: BroadcastEvent.NEW_PLAYER_JOINED,
        payload: {
          newPlayerState,
        },
      }),
    );

    // subscribe this user to the gameRoom
    await this.subscribeToGame(client);
  }
}
