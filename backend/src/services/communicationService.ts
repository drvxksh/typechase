import http from "http";
import { createClient, RedisClientType } from "redis";
import { v4 as uuid } from "uuid";
import WebSocket from "ws";
import {
  BroadcastEvent,
  GameStatus,
  MAX_SIZE,
  MessageEvent,
  MIN_SIZE,
  SocketClient,
  WebSocketMessage,
} from "../types";
import { GameService } from "./gameService";

/** Handles websocket and pub sub logic */
export class CommunicationService {
  private static instance: CommunicationService;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  private gameService: GameService;
  private wss: WebSocket.Server;

  private constructor(server: http.Server) {
    // instantiating the redis instance for pub sub manager
    this.pubClient = createClient();
    this.subClient = createClient();

    this.pubClient.on("error", (err) =>
      console.error("publisher client error:", err),
    );
    this.subClient.on("error", (err) =>
      console.error("subscriber client error:", err),
    );

    this.pubClient.connect();
    this.subClient.connect();

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

      ws.on("close", async () => {
        // remove this player from its corresponding game.
        if (socketClient.playerId && socketClient.gameId) {
          const updatedHostId = await this.gameService.removePlayerFromGame(
            socketClient.playerId,
            socketClient.gameId,
          );

          if (updatedHostId) {
            await this.pubClient.publish(
              `game:${socketClient.gameId}`,
              JSON.stringify({
                event: BroadcastEvent.PLAYER_LEFT,
                payload: {
                  updatedHostId,
                  playerLeftId: socketClient.playerId,
                },
              }),
            );
          }
        }
      });

      ws.on("message", async (message: string) => {
        let data = null;

        try {
          data = JSON.parse(message);
        } catch (err) {
          console.error("Unknown format for messaging: ", err);

          this.sendError(socketClient, "Something went wrong...");
        }

        if (data) {
          await this.processMessage(socketClient, data);
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

  /** Initializes the Communication Service with a new instance if not already present */
  public static initialize(server: http.Server): void {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService(server);
    }
  }

  private async processMessage(
    client: SocketClient,
    message: WebSocketMessage,
  ): Promise<void> {
    // sanitize the incoming request.
    if (!message || !message.event || !message.payload) {
      const missingField = !message
        ? "message"
        : !message.event
          ? "event"
          : "payload";
      console.warn(`Incomplete request: ${missingField} is missing`);
      this.sendError(client, `Something went wrong...`);
      return;
    }

    const { event, payload } = message;

    switch (event) {
      case MessageEvent.HEALTH_CHECK:
        await this.handleHealthCheck(client);
        break;
      case MessageEvent.CONNECT:
        await this.handleConnect(client, payload);
        break;
      case MessageEvent.CREATE_GAME:
        this.handleCreateGame(client);
        break;
      case MessageEvent.JOIN_GAME:
        this.handleJoinGame(client, payload);
        break;
      case MessageEvent.CHECK_GAME_ID:
        this.handleCheckGameId(client, payload);
        break;
      case MessageEvent.GET_LOBBY:
        this.handleGetLobby(client);
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

  /** Health check handler for the client */
  private async handleHealthCheck(client: SocketClient) {
    this.send(client, {
      event: MessageEvent.HEALTH_CHECK,
      payload: {
        message: "Yes, i am here (atleast for now)",
      },
    });
  }

  /** Handles connection requests from clients */
  private async handleConnect(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const { playerId } = payload;

    if (!playerId) {
      this.handleNewPlayerConnect(client);
      return;
    }

    // validate the playerId.
    const validPlayerId = await this.gameService.validatePlayerId(playerId);
    if (!validPlayerId) {
      this.handleNewPlayerConnect(client);
      return;
    }

    // fetch the gameId and state of the Game
    let gameInfo: {
      gameId: null | string;
      gameStatus: null | string;
    } = {
      gameId: null,
      gameStatus: null,
    };

    try {
      gameInfo = await this.gameService.getGameInfo(playerId);
    } catch (err) {
      console.error("couldn't fetch the game info", err);

      this.handleNewPlayerConnect(client);
      return;
    }

    if (!gameInfo.gameId) {
      // the player was not a part of any game
      client.playerId = playerId;

      this.send(client, {
        event: MessageEvent.CONNECT,
        payload: {
          playerId: client.playerId,
          existingGameId: null,
        },
      });
    } else {
      switch (gameInfo.gameStatus) {
        case GameStatus.WAITING: {
          client.playerId = playerId;
          client.gameId = gameInfo.gameId;

          // add the player back to the game
          await this.gameService.addPlayer(playerId, gameInfo.gameId);

          // notify others that this player has joined again
          const newPlayerInfo = await this.gameService.getPlayerInfo(playerId);

          await this.pubClient.publish(
            `game:${gameInfo.gameId}`,
            JSON.stringify({
              event: BroadcastEvent.NEW_PLAYER_JOINED,
              payload: {
                newPlayerInfo,
              },
            }),
          );

          this.send(client, {
            event: MessageEvent.CONNECT,
            payload: {
              playerId: client.playerId,
              existingGameId: gameInfo.gameId,
            },
          });

          await this.subscribeToGame(client); // subscribe this socket to listen for updates.
        }
      }
    }
  }

  private async handleNewPlayerConnect(client: SocketClient) {
    const newPlayerId = uuid();
    client.playerId = newPlayerId;

    this.send(client, {
      event: MessageEvent.CONNECT,
      payload: {
        playerId: newPlayerId,
        existingGameId: null,
      },
    });
  }

  /** Verifies if a client is a registered player and is part of a game. Returns true if valid */
  private verifySocket(client: SocketClient): boolean {
    if (!client.playerId) {
      this.sendError(client, "Something went wrong...");
      console.warn("Bad request: unknown user");

      return false;
    }

    if (!client.gameId) {
      this.sendError(client, "Something went wrong...");
      console.warn("Bad request: user is not a part of any game");

      return false;
    }

    return true;
  }

  /** Subscribes a client to game updates via the pub-sub manager */
  private async subscribeToGame(client: SocketClient): Promise<void> {
    // make sure that the socket is valid.
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string; // because the socket is verified, the gameId is known to exist.

    await this.subClient.subscribe(`game:${gameId}`, (message: string) => {
      this.send(client, JSON.parse(message));
    });
  }

  /** Creates a new game and sets up the listener for any changes */
  private async handleCreateGame(client: SocketClient): Promise<void> {
    const playerId = client.playerId;

    if (!playerId) {
      this.sendError(client, "Something went wrong...");
      console.warn("failed to create a new game -> unknown player");

      return;
    }

    const gameId = client.gameId;

    if (gameId) {
      this.sendError(client, "Leave the existing game to create a new one");
      console.warn(
        "failed to create a new game -> player was already part of a game",
      );

      return;
    }

    const newGameId = await this.gameService.createGame(playerId);

    client.gameId = newGameId;

    await this.subscribeToGame(client);

    this.send(client, {
      event: MessageEvent.CREATE_GAME,
      payload: {
        gameId: newGameId,
      },
    });
  }

  /** Joins the client to a game room if the max size has not been exceeded and publishes it to the other clients */
  private async handleJoinGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const playerId = client.playerId;
    const existingGameId = client.gameId;

    if (!playerId) {
      console.warn("failed to join a game -> unknown player");
      this.sendError(client, "Something went wrong...");

      return;
    }

    if (existingGameId) {
      this.sendError(client, "Leave the existing game to join a new one.");

      return;
    }

    const { gameId } = payload;

    if (!gameId) {
      this.sendError(client, "Missing invite code");
      return;
    }

    // validate this newGameId
    const validGame = await this.gameService.validateGameId(gameId);

    if (!validGame) {
      this.sendError(client, "Please enter a valid gameId");
      return;
    }

    try {
      // ensure that the room size does not cross the MAX_SIZE
      const currentSize = await this.gameService.getRoomSize(gameId);

      if (currentSize > MAX_SIZE) {
        this.sendError(client, "Game is already full");
        return;
      }

      await this.gameService.addPlayer(playerId, gameId);

      client.gameId = gameId;

      this.send(client, {
        event: MessageEvent.JOIN_GAME,
        payload: {
          gameId,
        },
      });

      // publish this new player on the game channel
      const newPlayerInfo = await this.gameService.getPlayerInfo(playerId);
      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.NEW_PLAYER_JOINED,
          payload: {
            newPlayerInfo,
          },
        }),
      );

      await this.subscribeToGame(client);
    } catch (err) {
      console.error("Error joining game:", err);
      this.sendError(client, "Failed to join game");
    }
  }

  /** Verifies whether the incoming gameId is falid or not. Returns false if no gameId was received */
  private async handleCheckGameId(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    this.send(client, {
      event: MessageEvent.CHECK_GAME_ID,
      payload: {
        isGameInvalid: client.gameId !== payload.gameId,
      },
    });
  }

  /**
   * Returns the current game lobby of the given game
   * @throws if the gameId is not of a valid game
   */
  private async handleGetLobby(client: SocketClient): Promise<void> {
    if (!this.verifySocket(client)) return;

    const gameId = client.gameId as string;
    try {
      const lobby = await this.gameService.getLobby(gameId);

      this.send(client, {
        event: MessageEvent.GET_LOBBY,
        payload: {
          lobby,
        },
      });
    } catch (err) {
      console.error("error retrieving the game lobby", err);
      this.sendError(client, "Something went wrong...");
    }
  }

  /** Changes the player username and notifies other clients */
  private async handleChangeUsername(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId as string;
    const { newUsername } = payload;

    if (!newUsername) {
      this.sendError(client, "Username cannot be empty");

      return;
    }

    try {
      await this.gameService.changeUsername(playerId, newUsername);

      // publish the event to notify others
      await this.pubClient.publish(
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
      console.error("failed to change the username ->", err);
      this.sendError(client, "Something went wrong...");
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
      await this.gameService.updateGameStatus(gameId, GameStatus.STARTING);

      // start the countdown and broadcast
      let count = 10;

      // Using setInterval for proper countdown
      const countdownInterval = setInterval(async () => {
        // Send current count
        await this.pubClient.publish(
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
          await this.pubClient.publish(
            `game:${gameId}`,
            JSON.stringify({
              event: BroadcastEvent.GAME_STARTED,
              payload: {
                message: "Game started!",
              },
            }),
          );

          await this.gameService.updateGameStatus(
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
    await this.pubClient.publish(
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

        await this.pubClient.publish(
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
