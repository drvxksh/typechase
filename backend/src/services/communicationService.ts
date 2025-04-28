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

/**
 * Manages the communication to the client.
 * Uses websockets and redis queues
 */
export class CommunicationService {
  private static instance: CommunicationService;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  private gameService: GameService;
  private wss: WebSocket.Server;

  private constructor(server: http.Server) {
    // instantiating the redis instances
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

    // instantiating the gameService for game operations
    this.gameService = new GameService();

    // creating the websocket server
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws: WebSocket) => {
      const socketClient = ws as SocketClient;

      ws.on("error", (err) => {
        console.error("WebSocket error:", err);
        this.sendError(socketClient, "Something went wrong...");
      });

      ws.on("close", async () => {
        const playerId = socketClient.playerId;
        const gameId = socketClient.gameId;

        let updatedHostId = null;

        try {
          // remove the player from the game and fetch the updated host id if the player was a part of any game.
          updatedHostId = this.gameService.removePlayerFromGame(
            playerId,
            gameId,
          );
        } catch (err) {
          console.error("couldn't remove player from game", err);
        }

        if (updatedHostId) {
          // notify others that a player has left and the host might be updated.
          await this.pubClient.publish(
            `game:${gameId}`,
            JSON.stringify({
              event: BroadcastEvent.PLAYER_LEFT,
              payload: {
                updatedHostId,
                playerLeftId: playerId,
              },
            }),
          );
        }
      });

      ws.on("message", async (message: string) => {
        let data = null;

        // parse the data if possible.
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

  /** Sends an error message to the client */
  private sendError(client: SocketClient, errorMessage: string): void {
    this.send(client, {
      event: MessageEvent.ERROR,
      payload: { message: errorMessage },
    });
  }

  /** Sends a message to the client if the connection is open */
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

  /** Redirects the incoming event to its respective handler */
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
        this.handleStartGame(client);
        break;
      case MessageEvent.GET_GAME_TEXT:
        this.handleGetGameText(client);
        break;
      case MessageEvent.GET_GAME_PLAYERS:
        this.handleGetGamePlayers(client);
      case MessageEvent.PLAYER_UPDATE:
        this.handlePlayerUpdate(client, payload);
        break;
      case MessageEvent.FINISH_GAME:
        this.handleFinishGame(client, payload);
        break;
      case MessageEvent.GET_GAME_RESULT:
        this.handleGetGameResult(client);
        break;
      case MessageEvent.RESTART_GAME:
        this.handleRestartGame(client); // TODO ensure that this is only initiated by the host. similarly check start game as well
        break;
      case MessageEvent.LEAVE_GAME:
        this.handleLeaveGame(client);
        break;
      default:
        this.sendError(client, `Unsupported message event: ${event}`);
        break;
    }
  }

  /** Sends a message to the client to confirm that the connection is alive */
  private async handleHealthCheck(client: SocketClient) {
    this.send(client, {
      event: MessageEvent.HEALTH_CHECK,
      payload: {
        message: "Yes, i am here (atleast for now)",
      },
    });
  }

  /**
   * Returns the playerId and gameId
   * Creates a new playerId if not already existing, along with the gameId if the player was a part of an existing game. Null otherwise.
   */
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
      // the player had an invalid playerId, nothing different than a new player.
      this.handleNewPlayerConnect(client);
      return;
    }

    // fetch the gameId and state of the Game
    const gameInfo = await this.gameService.getGameInfo(playerId);

    if (!gameInfo.gameId) {
      // the player wasn't a part of any game
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
          // update the socket
          client.playerId = playerId;
          client.gameId = gameInfo.gameId;

          // add the player back to the game
          await this.gameService.rejoinPlayer(playerId, gameInfo.gameId);

          // notify others that this player has joined again
          const newPlayerInfo = await this.gameService.getPlayerInfo(playerId);

          if (newPlayerInfo) {
            await this.pubClient.publish(
              `game:${gameInfo.gameId}`,
              JSON.stringify({
                event: BroadcastEvent.NEW_PLAYER_JOINED,
                payload: {
                  newPlayerInfo,
                },
              }),
            );

            // return the connect request.
            this.send(client, {
              event: MessageEvent.CONNECT,
              payload: {
                playerId: client.playerId,
                existingGameId: gameInfo.gameId,
              },
            });

            await this.subscribeToGame(client); // subscribe this socket to listen for updates.
          } else {
            this.sendError(client, "Something went wrong...");
          }
        }
      }
    }
  }

  /** Creates a new playerId and sends it to the client. */
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
      console.warn("Bad request: unknown player");

      return false;
    }

    if (!client.gameId) {
      this.sendError(client, "Something went wrong...");
      console.warn("Bad request: player is not a part of any game");

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
      // using the private "send" method would add redundant parsing and stringifying. Hence, it is sent manaually
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
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
      this.sendError(client, "Enter an invite code to join");
      return;
    }

    // validate this newGameId
    const validGame = await this.gameService.validateGameId(gameId);

    if (!validGame) {
      this.sendError(client, "Please enter a valid gameId");
      return;
    }

    // ensure that the room size does not exceed the MAX_SIZE
    const currentSize = (await this.gameService.getRoomSize(gameId)) as number; // the validity of the game has already been checked, so we can be sure that this won't throw.

    if (currentSize > MAX_SIZE) {
      this.sendError(client, "Game is already full");
      return;
    }

    await this.gameService.addPlayer(playerId, gameId); // the incoming gameId has already been validated and the playerId fetched from the client is always authentic.

    this.send(client, {
      event: MessageEvent.JOIN_GAME,
      payload: {
        gameId,
      },
    });

    // publish this new player on the game channel
    const newPlayerInfo = await this.gameService.getPlayerInfo(playerId); // as the playerId is valid, it won't be null

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
  }

  /** Verifies whether the incoming gameId is valid or not. Returns false if no gameId was received */
  private async handleCheckGameId(
    client: SocketClient,
    payload: any,
  ): Promise<void> {
    const { gameId } = payload;

    this.send(client, {
      event: MessageEvent.CHECK_GAME_ID,
      payload: {
        isGameInvalid: !this.gameService.validateGameId(gameId), // if this returns true, means that gameId is valid, but we return false as the gameId is not invalid
      },
    });
  }

  /** Returns the current game lobby of the given game */
  private async handleGetLobby(client: SocketClient): Promise<void> {
    if (!this.verifySocket(client)) return;

    const gameId = client.gameId as string;

    const lobby = await this.gameService.getLobby(gameId);

    if (lobby) {
      this.send(client, {
        event: MessageEvent.GET_LOBBY,
        payload: {
          lobby,
        },
      });
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

    const userNameChanged = await this.gameService.changeUsername(
      playerId,
      newUsername,
    );

    if (userNameChanged) {
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
    } else {
      this.sendError(client, "Something went wrong...");
      console.error("couldn't update the username");
    }
  }

  /** Updates the game status to starting and broadcasts the countdown. Updates the game to IN_PROGRESS after the countdown. */
  private async handleStartGame(client: SocketClient): Promise<void> {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    // check if the game has the minimum number of players
    const size = (await this.gameService.getRoomSize(gameId)) as number; // the gameId taken from the socket will always be authentic.

    if (size < MIN_SIZE) {
      this.sendError(client, "Not enough players to start the game");
      return;
    }

    // change the status of the game to waiting.
    const success = await this.gameService.updateGameStatus(
      gameId,
      GameStatus.WAITING,
    );

    if (!success) {
      console.error("the game status was not updated");
      this.sendError(client, "Something went wrong...");
      return;
    }

    // broadcast to other players.
    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.GAME_STARTING,
        payload: {},
      }),
    );

    // start the countdown.
    let count = 10;

    const countdownInterval = setInterval(async () => {
      // Send current count
      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.GAME_STARTING_COUNTDOWN,
          payload: {
            count,
          },
        }),
      );

      // Decrement count
      count--;

      // Check if countdown is complete
      if (count < 0) {
        clearInterval(countdownInterval);

        const success = await this.gameService.updateGameStatus(
          gameId,
          GameStatus.IN_PROGRESS,
        );

        if (!success) {
          console.error("couldn't update the game status");
          this.sendError(client, "Something went wrong...");
          return;
        }

        // start the game
        await this.pubClient.publish(
          `game:${gameId}`,
          JSON.stringify({
            event: BroadcastEvent.GAME_STARTED,
            payload: {
              message: "Game started!",
            },
          }),
        );
      }
    }, 1000);
  }

  /** Sends the game text for the given game */
  private async handleGetGameText(client: SocketClient) {
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    const gameText = await this.gameService.getGameText(gameId);

    if (gameText) {
      this.send(client, {
        event: MessageEvent.GET_GAME_TEXT,
        payload: {
          gameText,
        },
      });
    } else {
      console.warn("null game text");
    }
  }

  /** Sends the game players with their initial position */
  private async handleGetGamePlayers(client: SocketClient) {
    if (!this.verifySocket) {
      return;
    }

    const gameId = client.gameId as string;

    const players = await this.gameService.getGamePlayers(gameId);

    if (!players) {
      console.warn("players were not returned");
      this.sendError(client, "Something went wrong...");
      return;
    }

    this.send(client, {
      event: MessageEvent.GET_GAME_PLAYERS,
      payload: {
        players,
      },
    });
  }

  /** Broadcasts player position updates */
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
    if (!payload.position && isNaN(Number(payload.position))) {
      console.warn(`Incomplete request by ${playerId}, position not provided`);
      this.sendError(client, "Something went wrong...");
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

  /** Updates the game result by adding the incoming client. If all the players are finished, updates the game status */
  private async handleFinishGame(client: SocketClient, payload: any) {
    if (!this.verifySocket(client)) {
      return;
    }

    const playerId = client.playerId as string;
    const gameId = client.gameId as string;

    // sanitize the payload
    const wpm = Number(payload.wpm);
    const accuracy = Number(payload.accuracy);
    const time = Number(payload.time);

    if (Number.isNaN(wpm) || Number.isNaN(accuracy) || Number.isNaN(time)) {
      console.error(
        `invalid request for finishing the game, received wpm ${wpm}, accuracy ${accuracy} and time ${time}`,
      );

      this.sendError(client, "Something went wrong...");

      return;
    }

    const playerData = {
      wpm,
      accuracy,
      time,
    };

    // save the game data
    await this.gameService.finishGame(playerId, playerData, gameId);

    const allPlayersFinished =
      await this.gameService.checkAllPlayersFinished(gameId);

    if (allPlayersFinished) {
      await this.gameService.markGameFinished(gameId);

      await this.pubClient.publish(
        `game:${gameId}`,
        JSON.stringify({
          event: BroadcastEvent.FINISH_GAME,
          payload: {},
        }),
      );
    }
  }

  /** Sends the gameResult to the client */
  private async handleGetGameResult(client: SocketClient) {
    // ensure that this connection is valid
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    // fetch the game result
    const players = await this.gameService.getGameResult(gameId);

    if (!players) {
      console.warn("empty players recieved");
      this.sendError(client, "Something went wrong...");
      return;
    }

    // send it back to the client
    this.send(client, {
      event: MessageEvent.GET_GAME_RESULT,
      payload: {
        players,
      },
    });
  }

  private async handleRestartGame(client: SocketClient) {
    // verify this client
    if (!this.verifySocket(client)) {
      return;
    }

    const gameId = client.gameId as string;

    // to restart the game, change the status back to waiting and broadcast to others
    await this.gameService.restartGame(gameId);

    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify(
        JSON.stringify({
          event: BroadcastEvent.GAME_WAITING,
          payload: {},
        }),
      ),
    );
  }

  private async handleLeaveGame(client: SocketClient) {
    //verify the socket.
    if (!this.verifySocket(client)) {
      return;
    }

    // remove this player from the game and update the socket
    const playerId = client.playerId as string;
    const gameId = client.gameId as string;

    await this.gameService.removePlayerFromGame(playerId, gameId);

    client.gameId = undefined;

    // update others that this player left
    await this.pubClient.publish(
      `game:${gameId}`,
      JSON.stringify({
        event: BroadcastEvent.PLAYER_LEFT,
        payload: {
          playerId,
        },
      }),
    );
  }
}
