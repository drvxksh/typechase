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
  SocketClient,
  WebSocketMessage,
} from "../types";
import { v4 as uuid } from "uuid";

/** Handles websocket and pub sub logic */
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

      ws.on("close", async () => {
        // remove this player from the game if present
        if (socketClient.playerId && socketClient.gameId) {
          console.log("removing the player");

          await this.gameService.removePlayerFromGame(
            socketClient.playerId,
            socketClient.gameId,
          );
        }
      });

      ws.on("message", async (message: string) => {
        // TODO write better error messages
        // a convention that the messages will be relayed in JSON only
        let data = null;

        try {
          data = JSON.parse(message);
        } catch (err) {
          console.error("Unknown message format:", err);

          this.sendError(socketClient, "Invalid Message Format");
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

  /** Handles connection requests from clients */
  private async handleConnect(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const { playerId } = payload;
    let existingGameId = null;

    if (playerId) {
      // this is might be a returning user.
      // TODO if this player Id is valid.
      const validPlayerId = await this.gameService.validatePlayerId(playerId);

      if (!validPlayerId) {
        const playerId = uuid();
        client.playerId = playerId;
      } else {
        client.playerId = playerId;

        // fetch the gameId of this user
        const gameId = await this.gameService.getPlayerGameId(playerId);

        if (gameId) {
          //check if this game still exists
          const validGame = await this.gameService.validateGameId(gameId);
          console.log(`existence of ${gameId}`, validGame);

          if (!validGame) {
            const playerId = uuid();
            client.playerId = playerId;
          } else {
            client.gameId = gameId;

            // fetch the current state of that game.
            const state = await this.gameService.getGameStatus(gameId);

            console.log("status of the existing game is", state);

            // allow the user to rejoin if the game has not yet started
            if (state === "waiting") {
              existingGameId = gameId;
              client.gameId = gameId; // attach the gameId to the client.

              // add the player back to the game
              await this.gameService.addPlayer(playerId, gameId);

              await this.subscribeToGame(client); // subscribe this socket to listen for updates.
            }
          }
        }

        // if the gameId does not exist, we normally return the id that came in.
      }
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
        existingGameId,
      },
    });
  }

  /** Verifies if a client is a registered player and is part of a game. Returns true if valid */
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

  /** Subscribes a client to game updates via Redis PubSub */
  private async subscribeToGame(client: SocketClient): Promise<void> {
    // checks that the socket is a valid player.
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    await this.pubSubManager.subscribe(`game:${gameId}`, (message: string) => {
      this.send(client, JSON.parse(message));
    });
  }

  /** Handles game creation requests from clients */
  private async handleCreateGame(client: SocketClient): Promise<void> {
    const playerId = client.playerId;

    if (!playerId) {
      this.sendError(client, "couldn't create a new game - unknown user");
      return;
    }

    const gameId = client.gameId;

    if (gameId) {
      this.sendError(
        client,
        "couldn't create a new game - already a part of some other game",
      );
      return;
    }

    try {
      const newGameId = await this.gameService.createGame(playerId);

      client.gameId = newGameId;

      await this.subscribeToGame(client);

      this.send(client, {
        event: MessageEvent.CREATE_GAME,
        payload: {
          gameId: newGameId,
        },
      });
    } catch (err) {
      console.error("error creating a new game:", err);
      this.sendError(
        client,
        "couldn't create a new game - something went wrong",
      );
    }
  }

  /** joins the client to a game room */
  private async handleJoinGame(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const playerId = client.playerId;
    const existingGameId = client.gameId;

    if (!playerId) {
      this.sendError(client, "couldn't join the game - unknown user");
      return;
    }

    if (existingGameId) {
      this.sendError(
        client,
        "couldn't join the game - already a part of some other game",
      );
      return;
    }

    // extract the gameId from the payload
    const { gameId } = payload;

    if (!gameId) {
      this.sendError(
        client,
        "couldn't join the game - invite code not provided",
      );
      return;
    }

    try {
      // verify that the room size has not exceeded the max size
      const currentSize = await this.gameService.getRoomSize(playerId);

      if (currentSize > MAX_SIZE) {
        this.sendError(client, "Cannot join this game - room is full");
        return;
      }

      await this.gameService.addPlayer(playerId, gameId);

      // store the gameId on the client
      client.gameId = gameId;

      this.send(client, {
        event: MessageEvent.JOIN_GAME,
        payload: {
          gameId,
        },
      });

      // publish to others of this new player
      const newPlayerState = await this.gameService.getPlayerInfo(playerId);

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

  /** Checks if a game ID is valid and matches the client's current game */
  private async handleCheckGameId(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    this.send(client, {
      event: MessageEvent.CHECK_GAME_ID,
      payload: {
        invalidGameId: client.gameId !== payload.gameId,
      },
    });
  }

  /**
   * Retrieves the state of a game lobby
   * @throws if the gameId is not of a valid game
   */
  private async handleGetLobby(client: SocketClient): Promise<void> {
    // verify that this client is valid
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
      this.sendError(client, "Something went wrong");
    }
  }

  /** Handler to change the username */
  private async handleChangeUsername(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    // verify that this client is valid
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId as string;
    const { newUsername } = payload;

    if (!newUsername) {
      this.sendError(client, "cannot update the username - it cannot be empty");
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
