import http from "http";
import { createClient, RedisClientType } from "redis";
import WebSocket from "ws";
import { GameService } from "./gameService";
import {
  BroadcastEvent,
  GameStatus,
  MAX_SIZE,
  MessageEvent,
  MIN_SIZE,
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
      case MessageEvent.CHANGE_USERNAME:
        this.handleChangeUsername(client, payload);
        break;
      case MessageEvent.START_GAME:
        this.handleStartGame(client, payload);
        break;
      case MessageEvent.PLAYER_UPDATE:
        this.handlePlayerUpdate(client, payload);
        break;
      case MessageEvent.FINISH_GAME:
        this.handleFinishGame(client, payload);
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
      client.playerId = playerId;
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
   * Verifies if a client is a registered player and is part of a game
   * @param client - The WebSocket client to verify
   * @returns void - Sends error messages to the client if validation fails
   */
  private verifySocket(client: SocketClient): boolean {
    if (!client.playerId) {
      this.sendError(client, "Bad request: unknown user");
      return false;
    }

    if (!client.gameId) {
      this.sendError(client, "Bad request: user is not a part of any game");
      return false;
    }

    return true;
  }

  /**
   * Subscribes a client to game updates via Redis PubSub
   * @param client - The WebSocket client to subscribe
   * @throws Error if the client is not associated with a game
   * @returns A Promise that resolves when subscription is complete
   */
  private async subscribeToGame(client: SocketClient): Promise<void> {
    // checks that the socket is a valid player.
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId!;
    const playerId = client.playerId!;

    await this.pubSubManager.subscribe(`game:${gameId}`, (message: string) => {
      this.send(client, JSON.parse(message)); // send the message directly
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
    const playerId = client.playerId;

    if (!playerId) {
      this.sendError(client, "Bad request: unknown user");
      return;
    }

    const gameId = client.gameId;

    if (gameId) {
      this.sendError(client, "Bad request: user is already part of a game");
      return;
    }

    try {
      const newGameId = await this.gameService.createGame(playerId);

      client.gameId = newGameId;

      await this.subscribeToGame(client);

      const hostPlayer = await this.gameService.getPlayerState(playerId);

      this.send(client, {
        event: MessageEvent.CREATE_GAME,
        payload: {
          success: true,
          gameId: newGameId,
          hostPlayer,
        },
      });
    } catch (err) {
      console.error("Error creating game:", err);
      this.sendError(client, "Failed to create game");
    }
  }

  private async handleJoinGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const playerId = client.playerId;
    const existingGameId = client.gameId;

    if (!playerId) {
      this.sendError(client, "Bad request: unknown user");
      return;
    }

    if (existingGameId) {
      this.sendError(client, "Bad request: user is already part of a game");
      return;
    }

    // extract the gameId from the payload
    const { gameId } = payload;

    if (!gameId) {
      this.sendError(client, "Bad request: gameId is required to join a game");
      return;
    }

    try {
      // verify that the room size has not exceeded the max size
      const currentSize = await this.gameService.getRoomSize(playerId);

      if (currentSize > MAX_SIZE) {
        this.sendError(client, "Room is full. Try another game.");
        return;
      }

      await this.gameService.addPlayer(playerId, gameId);

      // store the gameId on the client
      client.gameId = gameId;
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
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.NEW_PLAYER_JOINED,
          payload: {
            newPlayerState,
          },
        }),
      );

      // subscribe this user to the gameRoom
      await this.subscribeToGame(client);
    } catch (err) {
      console.error("Error joining game:", err);
      this.sendError(client, "Failed to join game");
    }
  }

  private async handleChangeUsername(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    // verify that this client is valid
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId!;
    const { newUsername } = payload;

    if (!newUsername) {
      this.sendError(client, "Bad request: newUsername is required");
      return;
    }

    try {
      // update the newUsername in the redis object
      await this.gameService.changeUsername(playerId, newUsername);

      // publish the event to others
      await this.pubSubManager.publish(
        `game:${client.gameId}`,
        JSON.stringify({
          event: BroadcastEvent.USERNAME_CHANGED,
          payload: {
            updatedPlayer: {
              playerId,
              playerName: newUsername,
            },
          },
        }),
      );
    } catch (err) {
      console.error("Error changing username:", err);
      this.sendError(client, "Failed to change username");
    }
  }

  private async handleStartGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId!;
    const playerId = client.playerId!;

    try {
      // check that the game has atleast MIN_SIZE players
      const size = await this.gameService.getRoomSize(gameId);

      if (size < MIN_SIZE) {
        this.sendError(client, "Not enough players to start the game");
        return;
      }

      // update the state of the room
      await this.gameService.updateGameState(gameId, GameStatus.STARTING);

      // start the countdown and broadcast
      let count = 10;

      // Using setInterval for proper countdown
      const countdownInterval = setInterval(async () => {
        // Send current count
        await this.pubSubManager.publish(
          `game:${gameId}`,
          JSON.stringify({
            event: BroadcastEvent.GAME_STARTING,
            payload: {
              count,
              message: count === 0 ? "Go!" : `Starting in ${count}...`,
            },
          }),
        );

        // Decrement count
        count--;

        // Check if countdown is complete
        if (count < 0) {
          clearInterval(countdownInterval);

          // Game starts
          await this.pubSubManager.publish(
            `game:${gameId}`,
            JSON.stringify({
              event: BroadcastEvent.GAME_STARTED,
              payload: {
                message: "Game started!",
              },
            }),
          );

          await this.gameService.updateGameState(
            gameId,
            GameStatus.IN_PROGRESS,
          );
        }
      }, 1000);
    } catch (err) {
      console.error("Error starting game:", err);
      this.sendError(client, "Failed to start the game");
    }
  }

  /**
   * Handles position updates from clients during a game
   * @param client - The WebSocket client sending the position update
   * @param payload - The message payload containing position, wpm and accuracy
   * @returns A Promise that resolves when the position update is processed
   */
  private async handlePlayerUpdate(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId;
    const gameId = client.gameId;

    // verify that the payload has the required fields
    if (!payload.position && payload.position !== 0) {
      this.sendError(client, "Incomplete request: new position not provided");
      return;
    }

    // broadcast the position to others
    await this.pubSubManager.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.PLAYER_UPDATE,
        payload: {
          playerId,
          position: payload.position,
        },
      }),
    );
  }

  /**
   * Handles player updates during gameplay including position, WPM, and accuracy
   * @param client - The WebSocket client sending the update
   * @param payload - The message payload containing position, WPM and accuracy data
   * @returns A Promise that resolves when the player update is processed
   */
  private async handleFinishGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId!;
    const gameId = client.gameId!;

    // verify the payload
    if (
      typeof payload.wpm !== "number" ||
      typeof payload.accuracy !== "number" ||
      typeof payload.time !== "number"
    ) {
      this.sendError(
        client,
        "Incomplete request: payload is missing or has invalid wpm, accuracy, or time",
      );
      return;
    }

    try {
      const playerData = {
        wpm: payload.wpm,
        accuracy: payload.accuracy,
        time: payload.time,
      };

      // save the data in the game
      await this.gameService.finishGame(playerId, playerData, gameId);

      // check if all the players have completed the game, send the result
      const gameFinished = await this.gameService.checkGameFinished(gameId);

      if (gameFinished) {
        // broadcast the result
        const gameResult = await this.gameService.getGameResult(gameId);

        await this.pubSubManager.publish(
          `game:${gameId}`,
          JSON.stringify({
            event: BroadcastEvent.FINISH_GAME,
            payload: {
              results: gameResult.players,
            },
          }),
        );
      }
    } catch (err) {
      console.error("Error finishing game:", err);
      this.sendError(client, "Failed to record game results");
    }
  }
}
